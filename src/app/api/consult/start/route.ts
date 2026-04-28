import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const startSchema = z.object({
  token: z.string().trim().min(1),
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().trim().min(1, "휴대폰 번호를 입력해 주세요."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = startSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const nowIso = new Date().toISOString();
    const { data: link, error: linkError } = await supabase
      .from("consultation_links")
      .select("id, brand_id, status, expires_at")
      .eq("token", parsed.data.token)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (linkError) {
      console.error("[consult/start] link lookup failed", linkError);
      return NextResponse.json({ error: "상담 링크를 확인하지 못했습니다." }, { status: 500 });
    }

    if (!link) {
      return NextResponse.json({ error: "유효하지 않은 상담 링크입니다." }, { status: 404 });
    }

    const { data: existingSession, error: sessionError } = await supabase
      .from("consultation_sessions")
      .select("id")
      .eq("link_id", link.id)
      .eq("contact_phone", parsed.data.phone)
      .maybeSingle();

    if (sessionError) {
      console.error("[consult/start] session lookup failed", sessionError);
      return NextResponse.json({ error: "상담 세션을 조회하지 못했습니다." }, { status: 500 });
    }

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("brand_name")
      .eq("id", link.brand_id)
      .maybeSingle();

    if (brandError) {
      console.error("[consult/start] brand lookup failed", brandError);
      return NextResponse.json({ error: "브랜드 정보를 불러오지 못했습니다." }, { status: 500 });
    }

    if (existingSession) {
      const { data: messages, error: messageError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", existingSession.id)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("[consult/start] existing messages failed", messageError);
        return NextResponse.json({ error: "대화 내역을 불러오지 못했습니다." }, { status: 500 });
      }

      await supabase
        .from("consultation_sessions")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", existingSession.id);

      return NextResponse.json({
        session_id: existingSession.id,
        brand_name: brand?.brand_name ?? "브랜드",
        brand_id: link.brand_id,
        messages: messages ?? [],
      });
    }

    const { data: newSession, error: insertError } = await supabase
      .from("consultation_sessions")
      .insert({
        link_id: link.id,
        contact_name: parsed.data.name,
        contact_phone: parsed.data.phone,
      })
      .select("id")
      .single();

    if (insertError || !newSession) {
      console.error("[consult/start] session insert failed", insertError);
      return NextResponse.json({ error: "상담 세션을 시작하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      session_id: newSession.id,
      brand_name: brand?.brand_name ?? "브랜드",
      brand_id: link.brand_id,
      messages: [],
    });
  } catch (error) {
    console.error("[consult/start] POST unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
