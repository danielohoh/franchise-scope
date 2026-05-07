import { NextResponse } from "next/server";
import { z } from "zod";

import { extractContract } from "@/lib/parsers/extract-contract";
import { extractFees } from "@/lib/parsers/extract-fees";
import { extractFinancials } from "@/lib/parsers/extract-financials";
import { extractFranchisees } from "@/lib/parsers/extract-franchisees";
import { extractMenu } from "@/lib/parsers/extract-menu";
import { extractSales } from "@/lib/parsers/extract-sales";
import { extractSectionFromText } from "@/lib/parsers/pdf-disclosure";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type ApiError = { message: string };
type ParseSectionResponse = { ok: true; confidence: number };

type SectionKey = "fees" | "franchisees" | "sales" | "financials" | "menu" | "contract" | "legal";

type SectionBody = {
  section: SectionKey;
};

const bodySchema = z.object({
  section: z.enum(["fees", "franchisees", "sales", "financials", "menu", "contract", "legal"]),
});

type SectionExtractPayload = {
  data: Record<string, unknown> | null;
  confidence: number;
  column:
    | "fees"
    | "franchisee_status"
    | "avg_sales"
    | "financials"
    | "menu"
    | "contract_terms"
    | "legal_issues";
};

export const maxDuration = 10;

const wrapData = (data: unknown, confidence: number): Record<string, unknown> | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  return { ...(data as Record<string, unknown>), _confidence: confidence };
};

const toJson = (value: Record<string, unknown> | null): Json | null => {
  return value as Json | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

    let parsedBody: SectionBody;
    try {
      const json = await request.json();
      const safeParsed = bodySchema.safeParse(json);
      if (!safeParsed.success) {
        return NextResponse.json<ApiError>({ message: "section 값이 올바르지 않습니다." }, { status: 400 });
      }
      parsedBody = safeParsed.data;
    } catch {
      return NextResponse.json<ApiError>({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
    }

    const { data: joined, error: queryError } = await supabase
      .from("disclosures")
      .select("id, brand_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (queryError || !joined) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: parsedDataRow, error: parsedDataError } = await supabase
      .from("disclosure_parsed_data")
      .select("raw_text")
      .eq("disclosure_id", joined.id)
      .maybeSingle();

    if (parsedDataError) {
      return NextResponse.json<ApiError>({ message: "파싱 원문 조회에 실패했습니다." }, { status: 500 });
    }

    const rawText = parsedDataRow?.raw_text;
    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json<ApiError>({ message: "먼저 텍스트 추출을 실행해주세요." }, { status: 400 });
    }

    let extracted: SectionExtractPayload;

    if (parsedBody.section === "fees") {
      const data = await extractFees(rawText);
      extracted = { data: wrapData(data, data ? 0.9 : 0), confidence: data ? 0.9 : 0, column: "fees" };
    } else if (parsedBody.section === "franchisees") {
      const data = await extractFranchisees(rawText);
      extracted = {
        data: wrapData(data, data ? 0.9 : 0),
        confidence: data ? 0.9 : 0,
        column: "franchisee_status",
      };
    } else if (parsedBody.section === "sales") {
      const data = await extractSales(rawText);
      extracted = { data: wrapData(data, data ? 0.9 : 0), confidence: data ? 0.9 : 0, column: "avg_sales" };
    } else if (parsedBody.section === "financials") {
      const data = await extractFinancials(rawText);
      extracted = { data: wrapData(data, data ? 0.9 : 0), confidence: data ? 0.9 : 0, column: "financials" };
    } else if (parsedBody.section === "menu") {
      const data = await extractMenu(rawText);
      extracted = { data: wrapData(data, data ? 0.75 : 0), confidence: data ? 0.75 : 0, column: "menu" };
    } else if (parsedBody.section === "contract") {
      const data = await extractContract(rawText);
      extracted = {
        data: wrapData(data, data ? 0.9 : 0),
        confidence: data ? 0.9 : 0,
        column: "contract_terms",
      };
    } else {
      const data = await extractSectionFromText("legal", rawText);
      extracted = {
        data: wrapData(data.data, data.confidence),
        confidence: data.confidence,
        column: "legal_issues",
      };
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const updatePayload: Database["public"]["Tables"]["disclosure_parsed_data"]["Update"] = {
      updated_at: now,
    };
    if (extracted.column === "fees") updatePayload.fees = toJson(extracted.data);
    if (extracted.column === "franchisee_status") updatePayload.franchisee_status = toJson(extracted.data);
    if (extracted.column === "avg_sales") updatePayload.avg_sales = toJson(extracted.data);
    if (extracted.column === "financials") updatePayload.financials = toJson(extracted.data);
    if (extracted.column === "menu") updatePayload.menu = toJson(extracted.data);
    if (extracted.column === "contract_terms") updatePayload.contract_terms = toJson(extracted.data);
    if (extracted.column === "legal_issues") updatePayload.legal_issues = toJson(extracted.data);

    const { error: upsertError } = await admin.from("disclosure_parsed_data").upsert(
      {
        disclosure_id: joined.id,
        brand_id: joined.brand_id,
        ...updatePayload,
      },
      { onConflict: "disclosure_id" },
    );

    if (upsertError) {
      return NextResponse.json<ApiError>({ message: "섹션 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json<ParseSectionResponse>(
      { ok: true, confidence: extracted.confidence },
      { status: 200 },
    );
  } catch (error) {
    console.error("[disclosure/:id/parse-section POST]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
