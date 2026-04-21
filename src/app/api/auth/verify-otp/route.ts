import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const verifyOtpSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

interface OtpToken {
  email: string;
  otp: string;
  expires: number;
  hmac: string;
}

function verifyToken(token: string, email: string, otp: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString()) as OtpToken;
    if (Date.now() > decoded.expires) return false;
    if (decoded.email !== email || decoded.otp !== otp) return false;

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${decoded.email}:${decoded.otp}:${decoded.expires}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(decoded.hmac, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = verifyOtpSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { email, otp } = parsed.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // httpOnly 쿠키에서 OTP 토큰 추출
    const otpCookie = request.cookies.get("otp_pending")?.value;

    if (!otpCookie) {
      return NextResponse.json(
        { error: "인증코드가 만료되었습니다. 다시 요청해주세요." },
        { status: 400 },
      );
    }

    // HMAC 서명 검증
    if (!verifyToken(otpCookie, email, otp)) {
      return NextResponse.json(
        { error: "인증코드가 올바르지 않거나 만료되었습니다." },
        { status: 400 },
      );
    }

    // OTP 검증 성공 → Admin으로 magic link 생성해 세션 URL 반환
    const supabaseAdmin = createAdminClient();
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl}/auth/confirm` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[verify-otp] generateLink 실패", linkError);
      return NextResponse.json(
        { error: "세션 생성에 실패했습니다. 다시 시도해주세요." },
        { status: 500 },
      );
    }

    // OTP 쿠키 삭제 (단일 사용)
    const response = NextResponse.json({
      success: true,
      action_link: linkData.properties.action_link,
    });
    response.cookies.delete("otp_pending");
    return response;
  } catch (error) {
    console.error("[verify-otp] Unexpected error", error);
    return NextResponse.json({ error: "인증 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
