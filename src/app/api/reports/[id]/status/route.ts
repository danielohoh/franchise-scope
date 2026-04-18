import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Recommendation, ReportStatus } from "@/types/database";

const STATUS_STEPS: Record<ReportStatus, { step: number; message: string }> = {
  pending: { step: 0, message: "보고서 생성 대기 중..." },
  collecting: { step: 2, message: "🏘️ 배후 인구 및 경쟁점 데이터 수집 중..." },
  analyzing: { step: 4, message: "🤖 AI 보고서 분석 중..." },
  generating: { step: 5, message: "📄 보고서 문서 생성 중..." },
  completed: { step: 5, message: "✅ 보고서 생성 완료!" },
  failed: { step: 0, message: "❌ 보고서 생성에 실패했습니다." },
};

interface ReportStatusResponse {
  status: ReportStatus;
  error_message: string | null;
  recommendation: Recommendation | null;
  total_score: number | null;
  file_url: string | null;
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
      select: "status,error_message,recommendation,total_score,file_url",
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
      console.error("[reports/status] Failed to fetch report", responseText);
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    const reports = (await response.json()) as ReportStatusResponse[];
    const report = reports[0];

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    const statusInfo = STATUS_STEPS[report.status] ?? {
      step: 0,
      message: "알 수 없는 상태",
    };

    return NextResponse.json({
      status: report.status,
      step: statusInfo.step,
      message: statusInfo.message,
      error_message: report.error_message,
      recommendation: report.recommendation,
      total_score: report.total_score,
      file_url: report.file_url,
    });
  } catch (error) {
    console.error("[reports/status] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
