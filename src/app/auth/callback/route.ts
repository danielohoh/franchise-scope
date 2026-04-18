import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/database";

/**
 * Supabase 이메일 링크 클릭 후 리다이렉트 처리.
 * 이메일 인증 코드(PKCE)를 세션으로 교환하고 쿠키 설정 후 대시보드로 이동.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    // code 없으면 로그인 페이지로
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // 세션 쿠키를 response에 직접 주입하기 위해 수집
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed", error);
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // 기존 users 프로필 확인
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  // 신규 사용자면 회원가입 완료 페이지로, 기존 사용자면 대시보드로
  const redirectPath = profile ? next : "/auth/signup";
  const response = NextResponse.redirect(`${origin}${redirectPath}`);

  // 세션 쿠키 주입
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
