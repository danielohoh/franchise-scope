import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ApiError = { message: string };
type FinalizeResponse = { ok: true; parse_confidence: number };

type JsonObject = Record<string, unknown>;

export const maxDuration = 10;

const readConfidence = (value: unknown): number | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const confidence = (value as JsonObject)._confidence;
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return null;
  }
  return Math.min(1, Math.max(0, confidence));
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ApiError>({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: disclosure, error: disclosureError } = await supabase
      .from("disclosures")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (disclosureError || !disclosure) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: parsedData, error: parsedError } = await supabase
      .from("disclosure_parsed_data")
      .select("fees, franchisee_status, avg_sales, financials, menu, contract_terms, legal_issues")
      .eq("disclosure_id", disclosure.id)
      .single();

    if (parsedError || !parsedData) {
      return NextResponse.json<ApiError>({ message: "파싱 데이터를 찾을 수 없습니다." }, { status: 404 });
    }

    const confidenceCandidates = [
      readConfidence(parsedData.fees),
      readConfidence(parsedData.franchisee_status),
      readConfidence(parsedData.avg_sales),
      readConfidence(parsedData.financials),
      readConfidence(parsedData.menu),
      readConfidence(parsedData.contract_terms),
      readConfidence(parsedData.legal_issues),
    ].filter((value): value is number => value !== null);

    const avgConfidence =
      confidenceCandidates.length > 0
        ? confidenceCandidates.reduce((sum, value) => sum + value, 0) / confidenceCandidates.length
        : 0;

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error: parsedUpdateError } = await admin
      .from("disclosure_parsed_data")
      .update({ parse_confidence: avgConfidence, updated_at: now })
      .eq("disclosure_id", disclosure.id);

    if (parsedUpdateError) {
      return NextResponse.json<ApiError>({ message: "신뢰도 업데이트에 실패했습니다." }, { status: 500 });
    }

    const { error: disclosureUpdateError } = await admin
      .from("disclosures")
      .update({ parse_status: "completed", parse_error: null, updated_at: now })
      .eq("id", disclosure.id);

    if (disclosureUpdateError) {
      return NextResponse.json<ApiError>({ message: "완료 상태 업데이트에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json<FinalizeResponse>(
      { ok: true, parse_confidence: avgConfidence },
      { status: 200 },
    );
  } catch (error) {
    console.error("[disclosure/:id/finalize POST]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
