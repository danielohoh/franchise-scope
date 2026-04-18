import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const sendOtpSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = sendOtpSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다.",
        },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        // 이메일 링크 클릭 시 /auth/callback으로 리다이렉트하여 세션 생성
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (error) {
      console.error("send-otp auth.signInWithOtp failed", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected send-otp error", error);
    return NextResponse.json(
      { error: "인증코드 발송 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
