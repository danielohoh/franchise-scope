import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/types/database";

interface ReportDownloadResponse {
  file_url: string | null;
  status: ReportStatus;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const searchParams = new URLSearchParams({
      select: "file_url,status",
      id: `eq.${reportId}`,
      user_id: `eq.${user.id}`,
      limit: "1",
    });

    const response = await fetch(`${supabaseUrl}/rest/v1/reports?${searchParams.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("[reports/download] Failed to fetch report", responseText);
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    const reports = (await response.json()) as ReportDownloadResponse[];
    const report = reports[0];

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (report.status !== "completed" || !report.file_url) {
      return NextResponse.json(
        { error: "아직 생성이 완료되지 않은 보고서입니다." },
        { status: 400 },
      );
    }

    return NextResponse.redirect(report.file_url);
  } catch (error) {
    console.error("[reports/download] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
