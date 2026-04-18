import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Recommendation, ReportStatus } from "@/types/database";

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
    const status = searchParams.get("status") as ReportStatus | null;
    const recommendation = searchParams.get("recommendation") as Recommendation | null;
    const search = searchParams.get("search") ?? "";
    const prospectId = searchParams.get("prospect_id");

    let query = supabase
      .from("reports")
      .select(
        "id, address, report_title, analysis_result, recommendation, total_score, status, error_message, file_url, file_name, created_at, llm_provider, generation_time_seconds, prospect_id, brand_id"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (recommendation) query = query.eq("recommendation", recommendation);
    if (prospectId) query = query.eq("prospect_id", prospectId);
    if (search) query = query.ilike("address", `%${search}%`);

    const { data: reports, error } = await query;

    if (error) {
      console.error("[GET /api/reports]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: reports ?? [] });
  } catch (error) {
    console.error("[GET /api/reports] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "report id가 필요합니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[DELETE /api/reports]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/reports] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
