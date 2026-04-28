import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: sessionRaw, error } = await supabase
      .from("consultation_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const session = sessionRaw as {
      id: string;
      link_id: string;
      prospect_id: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      started_at: string;
      last_active_at: string;
      extracted_data: unknown;
      status: string;
      callback_requested: boolean;
      callback_preferred_time: string | null;
    } | null;

    if (error || !session) {
      if (error) console.error("[consultations/sessions/[id]] GET failed", error);
      return NextResponse.json({ error: "상담 세션을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: linkRaw, error: linkError } = await supabase
      .from("consultation_links")
      .select("user_id, label")
      .eq("id", session.link_id)
      .maybeSingle();

    const link = linkRaw as { user_id: string; label: string | null } | null;

    if (linkError) {
      console.error("[consultations/sessions/[id]] GET link failed", linkError);
      return NextResponse.json({ error: "상담 링크를 확인하지 못했습니다." }, { status: 500 });
    }

    if (!link || link.user_id !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { data: messages, error: messageError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (messageError) {
      console.error("[consultations/sessions/[id]] GET messages failed", messageError);
      return NextResponse.json({ error: "메시지를 불러오지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        link_id: session.link_id,
        prospect_id: session.prospect_id,
        contact_name: session.contact_name,
        contact_phone: session.contact_phone,
        started_at: session.started_at,
        last_active_at: session.last_active_at,
        extracted_data: session.extracted_data,
        status: session.status,
        callback_requested: session.callback_requested,
        callback_preferred_time: session.callback_preferred_time,
        link_label: link.label ?? null,
      },
      messages: messages ?? [],
    });
  } catch (error) {
    console.error("[consultations/sessions/[id]] GET unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
