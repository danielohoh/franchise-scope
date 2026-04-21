import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const generateSchema = z.object({
  brand_id: z.string().uuid("유효한 브랜드 ID가 아닙니다."),
  address: z.string().min(1, "주소를 입력해 주세요.").max(500),
  prospect_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = generateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: brand, error: brandError } = await admin
      .from("brands")
      .select("id, brand_name")
      .eq("id", parsed.data.brand_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (brandError) {
      console.error("[reports/generate] Brand lookup failed", brandError);
      return NextResponse.json({ error: "브랜드 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!brand) {
      return NextResponse.json({ error: "브랜드 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const reportTitle = `[${brand.brand_name}] ${parsed.data.address}`;

    const { data: report, error: insertError } = await admin
      .from("reports")
      .insert({
        user_id: user.id,
        brand_id: parsed.data.brand_id,
        prospect_id: parsed.data.prospect_id ?? null,
        address: parsed.data.address,
        report_title: reportTitle,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !report) {
      console.error("[reports/generate] Report insert failed", insertError);
      return NextResponse.json(
        { error: "보고서 생성 요청 처리 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ report_id: report.id });
  } catch (error) {
    console.error("[reports/generate] Unexpected error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
