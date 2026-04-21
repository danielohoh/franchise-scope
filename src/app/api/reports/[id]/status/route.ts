import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
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

    const admin = createAdminClient();

    const { data: report, error } = await admin
      .from("reports")
      .select("status, error_message, recommendation, total_score, file_url")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[reports/status] Failed to fetch report", error);
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    const status = report.status as ReportStatus;
    const statusInfo = STATUS_STEPS[status] ?? { step: 0, message: "알 수 없는 상태" };

    return NextResponse.json({
      status,
      step: statusInfo.step,
      message: statusInfo.message,
      error_message: report.error_message,
      recommendation: report.recommendation as Recommendation | null,
      total_score: report.total_score,
      file_url: report.file_url,
    });
  } catch (error) {
    console.error("[reports/status] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
