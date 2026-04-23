/**
 * Bearer 토큰 + 쿠키 이중 인증 헬퍼
 * Chrome 익스텐션은 Authorization: Bearer {token} 헤더로 인증
 * 웹 앱은 쿠키 세션으로 인증
 */
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: string };

/**
 * Authorization 헤더의 Bearer 토큰 또는 쿠키 세션으로 사용자 인증
 */
export async function getAuthUser(request: Request): Promise<AuthResult> {
  // 1. Authorization: Bearer {token} 헤더 확인 (익스텐션 → API)
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (bearerToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return { user: null, error: "서버 설정 오류" };
    }

    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });

    const { data, error } = await client.auth.getUser(bearerToken);

    if (error || !data.user) {
      return { user: null, error: "인증 토큰이 유효하지 않습니다." };
    }

    return { user: data.user, error: null };
  }

  // 2. 쿠키 세션 확인 (웹 앱 → API)
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, error: "로그인이 필요합니다." };
  }

  return { user: data.user, error: null };
}
