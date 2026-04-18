import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const generateSchema = z.object({
  brand_id: z.string().uuid("유효한 브랜드 ID가 아닙니다."),
  address: z.string().min(1, "주소를 입력해 주세요.").max(500),
  prospect_id: z.string().uuid().optional(),
});

interface BrandLookupResponse {
  id: string;
  brand_name: string;
}

interface ReportInsertResponse {
  id: string;
}

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const brandParams = new URLSearchParams({
      select: "id,brand_name",
      id: `eq.${parsed.data.brand_id}`,
      user_id: `eq.${user.id}`,
      limit: "1",
    });

    const brandResponse = await fetch(`${supabaseUrl}/rest/v1/brands?${brandParams.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!brandResponse.ok) {
      const responseText = await brandResponse.text();
      console.error("[reports/generate] Brand lookup failed", responseText);
      return NextResponse.json({ error: "브랜드 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const brands = (await brandResponse.json()) as BrandLookupResponse[];
    const brand = brands[0];

    if (!brand) {
      return NextResponse.json({ error: "브랜드 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const reportTitle = `[${brand.brand_name}] ${parsed.data.address}`;
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/reports?select=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.id,
        brand_id: parsed.data.brand_id,
        prospect_id: parsed.data.prospect_id ?? null,
        address: parsed.data.address,
        report_title: reportTitle,
        status: "pending",
      }),
    });

    if (!insertResponse.ok) {
      const responseText = await insertResponse.text();
      console.error("[reports/generate] Report insert failed", responseText);
      return NextResponse.json(
        { error: "보고서 생성 요청 처리 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    const reports = (await insertResponse.json()) as ReportInsertResponse[];
    const report = reports[0];

    if (!report) {
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
