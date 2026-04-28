import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const callbackSchema = z.object({
  session_id: z.string().uuid("유효한 세션 ID가 아닙니다."),
  preferred_time: z.string().trim().min(1, "선호 시간을 입력해 주세요."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = callbackSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: session, error: lookupError } = await supabase
      .from("consultation_sessions")
      .select("id")
      .eq("id", parsed.data.session_id)
      .maybeSingle();

    if (lookupError) {
      console.error("[consult/callback] lookup failed", lookupError);
      return NextResponse.json({ error: "상담 세션을 확인하지 못했습니다." }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "상담 세션을 찾을 수 없습니다." }, { status: 404 });
    }

    const { error } = await supabase
      .from("consultation_sessions")
      .update({
        callback_requested: true,
        callback_preferred_time: parsed.data.preferred_time,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.session_id);

    if (error) {
      console.error("[consult/callback] update failed", error);
      return NextResponse.json({ error: "콜백 요청을 저장하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[consult/callback] POST unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
