import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // 개발 미리보기 모드: NEXT_PUBLIC_DEMO_MODE=true 시 인증 체크 건너뜀
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (isDemoMode) {
    return response;
  }

  try {
    // getSession()은 쿠키에서 JWT를 읽는 로컬 연산 → 네트워크 요청 없음
    // getUser()는 매번 Supabase 서버로 검증 요청 → Vercel Edge 타임아웃(504) 유발
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Failed to fetch session in middleware", error);
    }

    const user = session?.user ?? null;

    const pathname = request.nextUrl.pathname;
    const isDashboardRoute = pathname.startsWith("/dashboard");
    // /auth/signup은 신규 사용자(세션 있음 + 프로필 없음)가 접근해야 하므로 제외
    const isLoginRoute = pathname.startsWith("/auth/login");

    if (isDashboardRoute && !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 로그인된 상태에서 로그인 페이지만 리다이렉트 (signup은 허용)
    if (isLoginRoute && user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.delete("next");
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Unexpected middleware auth error", error);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("[middleware] Failed to update session", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/login", "/auth/signup", "/auth/callback"],
};
