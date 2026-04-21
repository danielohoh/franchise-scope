import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Service Role 키를 사용하는 Admin 클라이언트 (서버 전용) */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
