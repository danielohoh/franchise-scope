import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type ApiError = {
  message: string;
};

type LogoutResponse = {
  success: true;
};

export async function POST() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[logout] auth.signOut failed", error);
    return NextResponse.json<ApiError>({ message: "로그아웃에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json<LogoutResponse>({ success: true }, { status: 200 });
}
