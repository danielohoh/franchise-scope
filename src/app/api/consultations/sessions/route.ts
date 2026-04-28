import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("link_id");

    let query = supabase
      .from("consultation_sessions")
      .select("*")
      .order("last_active_at", { ascending: false });

    if (linkId) query = query.eq("link_id", linkId);

    const { data: ownedLinksRaw, error: linkError } = await supabase
      .from("consultation_links")
      .select("id, label")
      .eq("user_id", user.id);

    if (linkError) {
      console.error("[consultations/sessions] GET link lookup failed", linkError);
      return NextResponse.json({ error: "상담 링크를 조회하지 못했습니다." }, { status: 500 });
    }

    const ownedLinks = (ownedLinksRaw ?? []) as Array<{ id: string; label: string | null }>;
    const allowedLinkIds = ownedLinks.map((v) => v.id);
    if (allowedLinkIds.length === 0) return NextResponse.json({ sessions: [] });

    query = query.in("link_id", allowedLinkIds);

    const { data: sessionsRaw, error } = await query;

    if (error) {
      console.error("[consultations/sessions] GET failed", error);
      return NextResponse.json({ error: "상담 세션 목록을 불러오지 못했습니다." }, { status: 500 });
    }

    const sessions = (sessionsRaw ?? []) as Array<{
      id: string;
      link_id: string;
      contact_name: string | null;
      contact_phone: string | null;
      started_at: string;
      last_active_at: string;
      extracted_data: unknown;
      status: string;
      callback_requested: boolean;
      callback_preferred_time: string | null;
    }>;

    const linkLabelMap = new Map(ownedLinks.map((v) => [v.id, v.label]));

    const normalized = await Promise.all(sessions.map(async (row) => {
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { head: true, count: "exact" })
        .eq("session_id", row.id);

      return {
        id: row.id,
        link_id: row.link_id,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        started_at: row.started_at,
        last_active_at: row.last_active_at,
        extracted_data: row.extracted_data,
        status: row.status,
        callback_requested: row.callback_requested,
        callback_preferred_time: row.callback_preferred_time,
        link_label: linkLabelMap.get(row.link_id) ?? null,
        message_count: count ?? 0,
      };
    }));

    return NextResponse.json({ sessions: normalized });
  } catch (error) {
    console.error("[consultations/sessions] GET unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
