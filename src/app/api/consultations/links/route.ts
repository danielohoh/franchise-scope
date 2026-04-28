import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ConsultationLinkRow = Database["public"]["Tables"]["consultation_links"]["Row"];

const createLinkSchema = z.object({
  label: z.string().trim().max(100).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: links, error } = await supabase
      .from("consultation_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[consultations/links] GET failed", error);
      return NextResponse.json({ error: "상담 링크 목록을 불러오지 못했습니다." }, { status: 500 });
    }

    const normalized = await Promise.all(
      (links ?? []).map(async (row) => {
        const { count } = await supabase
          .from("consultation_sessions")
          .select("id", { head: true, count: "exact" })
          .eq("link_id", row.id);

        return {
          ...(row as ConsultationLinkRow),
          session_count: count ?? 0,
        };
      }),
    );

    return NextResponse.json({ links: normalized });
  } catch (error) {
    console.error("[consultations/links] GET unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createLinkSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." }, { status: 400 });
    }

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (brandError) {
      console.error("[consultations/links] POST brand lookup failed", brandError);
      return NextResponse.json({ error: "브랜드 정보를 확인하지 못했습니다." }, { status: 500 });
    }

    if (!brand) {
      return NextResponse.json({ error: "브랜드 정보를 먼저 등록해 주세요." }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase
      .from("consultation_links")
      .insert({
        user_id: user.id,
        brand_id: brand.id,
        label: parsed.data.label?.trim() || null,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[consultations/links] POST insert failed", error);
      return NextResponse.json({ error: "상담 링크를 생성하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("[consultations/links] POST unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
