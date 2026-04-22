import crypto from "crypto";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const sendOtpSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
});

const OTP_TTL_MS = 10 * 60 * 1000; // 10분

function signOtpToken(email: string, otp: string, expires: number): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const payload = `${email}:${otp}:${expires}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ email, otp, expires, hmac })).toString("base64url");
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = sendOtpSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // 1) 6자리 OTP 생성
    const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
    const expires = Date.now() + OTP_TTL_MS;
    const token = signOtpToken(email, otp, expires);

    // 2) Resend로 이메일 발송
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "이메일 서비스가 설정되지 않았습니다." }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "FranchiseScope <noreply@ai-scope.kr>",
      to: email,
      subject: "[FranchiseScope] 로그인 인증코드",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: #1F4E79; border-radius: 12px; line-height: 48px; text-align: center;">
              <span style="color: white; font-weight: 700; font-size: 14px;">FS</span>
            </div>
            <h1 style="color: #1F4E79; font-size: 22px; margin-top: 16px;">FranchiseScope 로그인</h1>
          </div>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
            아래 6자리 인증코드를 입력해 로그인을 완료하세요.<br/>
            코드는 <strong>10분간</strong> 유효합니다.
          </p>
          <div style="background: #F1F5F9; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1F4E79;">${otp}</span>
          </div>
          <p style="color: #94A3B8; font-size: 13px; text-align: center;">
            본인이 요청하지 않은 경우 이 이메일을 무시하세요.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("[send-otp] Resend 발송 실패", emailError);
      return NextResponse.json({ error: "이메일 발송에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    console.log("[send-otp] 발송 완료", email);

    // 3) 서명된 OTP를 httpOnly 쿠키에 저장 (단일 사용 보장)
    const response = NextResponse.json({ success: true });
    response.cookies.set("otp_pending", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: Math.floor(OTP_TTL_MS / 1000),
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[send-otp] Unexpected error", error);
    return NextResponse.json({ error: "인증코드 발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
