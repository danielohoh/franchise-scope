import { NextResponse } from "next/server";

import { extractTextFromPdf } from "@/lib/parsers/pdf-disclosure";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ApiError = { message: string };
type ExtractTextResponse = { ok: true; text_length: number; method: string };

export const maxDuration = 10;

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
      .select("id, brand_id, file_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (disclosureError || !disclosure) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: fileData, error: downloadError } = await admin.storage
      .from("disclosures")
      .download(disclosure.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json<ApiError>({ message: "PDF 다운로드에 실패했습니다." }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extracted = await extractTextFromPdf(buffer);
    const now = new Date().toISOString();

    const { error: upsertError } = await admin.from("disclosure_parsed_data").upsert(
      {
        disclosure_id: disclosure.id,
        brand_id: disclosure.brand_id,
        raw_text: extracted.text,
        updated_at: now,
      },
      { onConflict: "disclosure_id" },
    );

    if (upsertError) {
      return NextResponse.json<ApiError>({ message: "추출 텍스트 저장에 실패했습니다." }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from("disclosures")
      .update({ parse_status: "parsing", parse_error: null, updated_at: now })
      .eq("id", disclosure.id);

    if (updateError) {
      return NextResponse.json<ApiError>({ message: "파싱 상태 업데이트에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json<ExtractTextResponse>(
      { ok: true, text_length: extracted.text.length, method: extracted.method },
      { status: 200 },
    );
  } catch (error) {
    console.error("[disclosure/:id/extract-text POST]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
