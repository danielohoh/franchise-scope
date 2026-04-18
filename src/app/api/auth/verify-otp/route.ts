import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Database } from "@/types/database";

const verifyOtpSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
  token: z
    .string()
    .length(6, "인증코드는 6자리여야 합니다.")
    .regex(/^\d{6}$/, "인증코드는 숫자 6자리여야 합니다."),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = verifyOtpSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    // verifyOtp 후 생성되는 세션 쿠키를 수집해서 response에 직접 주입
    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: "email",
    });

    if (verifyError) {
      console.error("verify-otp auth.verifyOtp failed", verifyError);
      return NextResponse.json(
        { message: "인증코드가 올바르지 않거나 만료되었습니다." },
        { status: 400 },
      );
    }

    const userId = verifyData.user?.id;

    if (!userId) {
      console.error("verify-otp user is missing after successful verification");
      return NextResponse.json(
        { message: "인증은 성공했지만 사용자 정보를 확인할 수 없습니다." },
        { status: 500 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .filter("id", "eq", userId)
      .maybeSingle();

    if (profileError) {
      console.error("verify-otp users lookup failed", profileError);
      return NextResponse.json(
        { message: "사용자 상태를 확인하지 못했습니다." },
        { status: 500 },
      );
    }

    // 세션 쿠키를 response에 직접 설정 (브라우저에 전달)
    const response = NextResponse.json({
      message: "인증이 완료되었습니다.",
      isNewUser: !profile,
    });

    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (error) {
    console.error("Unexpected verify-otp error", error);
    return NextResponse.json(
      { message: "인증코드 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
