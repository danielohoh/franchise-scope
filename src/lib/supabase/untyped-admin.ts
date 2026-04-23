import { createClient } from "@supabase/supabase-js";

/**
 * Database 제네릭 없이 Supabase Admin 클라이언트를 생성합니다.
 * Database 타입에 아직 정의되지 않은 테이블(naver_listings, apartment_data,
 * recommendation_results)에 대한 insert/upsert 작업에 사용합니다.
 */
export function createUntypedAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
