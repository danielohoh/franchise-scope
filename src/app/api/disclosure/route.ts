import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

type ApiError = { message: string };

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ApiError>({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const brandId = request.nextUrl.searchParams.get("brand_id");

    let query = supabase
      .from("disclosures")
      .select("id, brand_id, file_name, file_size, parse_status, created_at, updated_at, brands(brand_name), disclosure_parsed_data(parse_confidence)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[disclosure GET] query error:", error.message);
      return NextResponse.json<ApiError>({ message: "정보공개서 목록 조회에 실패했습니다." }, { status: 500 });
    }

    // Flatten: disclosure_parsed_data join → parse_confidence 직접 노출
    const disclosures = (data ?? []).map((item) => {
      const pd = item.disclosure_parsed_data;
      const pdObj = Array.isArray(pd) ? (pd[0] ?? null) : (pd ?? null);
      const parseConfidence: number | null =
        pdObj && typeof pdObj === "object" && "parse_confidence" in pdObj
          ? ((pdObj as { parse_confidence: number | null }).parse_confidence ?? null)
          : null;
      const { disclosure_parsed_data: _omit, ...rest } = item as typeof item & {
        disclosure_parsed_data?: unknown;
      };
      return { ...rest, parse_confidence: parseConfidence };
    });

    return NextResponse.json({ disclosures }, { status: 200 });
  } catch (error) {
    console.error("[disclosure GET]", error);
    return NextResponse.json<ApiError>({ message: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
