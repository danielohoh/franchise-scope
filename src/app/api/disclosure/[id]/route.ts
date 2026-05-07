import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ApiError = { message: string };
type PutBody = {
  parse_status?: "uploaded" | "extracting_text" | "parsing" | "completed" | "failed";
  parse_error?: string | null;
  registration_number?: string | null;
  registration_date?: string | null;
  manually_reviewed?: boolean;
};

export const maxDuration = 10;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { data: disclosure, error } = await supabase
      .from("disclosures")
      .select("*, disclosure_parsed_data(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !disclosure) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    // Supabase join은 one-to-one 관계에서 단일 객체 또는 배열로 반환 가능
    // 두 가지 경우를 모두 처리
    const rawJoined = disclosure as typeof disclosure & {
      disclosure_parsed_data?: unknown | unknown[] | null;
    };
    const rawParsed = rawJoined.disclosure_parsed_data ?? null;
    const parsedData: unknown =
      rawParsed == null
        ? null
        : Array.isArray(rawParsed)
          ? rawParsed.length > 0
            ? rawParsed[0]
            : null
          : rawParsed; // 단일 객체인 경우 그대로 사용

    const { disclosure_parsed_data: _omit, ...disclosureOnly } = rawJoined as typeof rawJoined & {
      disclosure_parsed_data?: unknown;
    };

    return NextResponse.json({ disclosure: disclosureOnly, parsed_data: parsedData }, { status: 200 });
  } catch (error) {
    console.error("[disclosure/:id GET]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const json = (await request.json()) as PutBody;
    const { data: disclosure, error: disclosureError } = await supabase
      .from("disclosures")
      .select("id, brand_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (disclosureError || !disclosure) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    if (json.manually_reviewed !== undefined) {
      const parsedPayload: Database["public"]["Tables"]["disclosure_parsed_data"]["Insert"] = {
        disclosure_id: disclosure.id,
        brand_id: disclosure.brand_id,
        manually_reviewed: json.manually_reviewed,
        updated_at: now,
      };

      const { error: parsedUpdateError } = await admin
        .from("disclosure_parsed_data")
        .upsert(parsedPayload, { onConflict: "disclosure_id" });

      if (parsedUpdateError) {
        return NextResponse.json<ApiError>({ message: "검수 상태 업데이트에 실패했습니다." }, { status: 500 });
      }
    }

    const disclosurePayload: Database["public"]["Tables"]["disclosures"]["Update"] = {
      updated_at: now,
    };
    if (json.parse_status !== undefined) disclosurePayload.parse_status = json.parse_status;
    if (json.parse_error !== undefined) disclosurePayload.parse_error = json.parse_error;
    if (json.registration_number !== undefined)
      disclosurePayload.registration_number = json.registration_number;
    if (json.registration_date !== undefined) disclosurePayload.registration_date = json.registration_date;

    const { error: updateError } = await admin
      .from("disclosures")
      .update(disclosurePayload)
      .eq("id", disclosure.id);

    if (updateError) {
      return NextResponse.json<ApiError>({ message: "정보공개서 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[disclosure/:id PUT]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
      .select("id, file_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (disclosureError || !disclosure) {
      return NextResponse.json<ApiError>({ message: "정보공개서를 찾을 수 없습니다." }, { status: 404 });
    }

    const admin = createAdminClient();
    await admin.storage.from("disclosures").remove([disclosure.file_path]);

    const { error: deleteError } = await admin.from("disclosures").delete().eq("id", disclosure.id);
    if (deleteError) {
      return NextResponse.json<ApiError>({ message: "정보공개서 삭제에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[disclosure/:id DELETE]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
