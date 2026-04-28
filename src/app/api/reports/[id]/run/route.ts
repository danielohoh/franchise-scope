import { NextResponse } from "next/server";
import { z } from "zod";

import { generateReport } from "@/lib/ai/generate";
import { getIndustryBenchmark } from "@/lib/data/industry-benchmarks";
import { fetchPublicCompetition } from "@/lib/data/public-competition";
import { generateDocx } from "@/lib/docx/generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CollectedData, Database, DbBrand, PropertyInput, ReportStatus } from "@/types/database";

// App Router route segment config — Vercel Pro 300s, Hobby 60s 제한 적용
export const maxDuration = 300;

// ---- 임대 조건 body 스키마 (만원 단위, optional) ----
const RunBodySchema = z.object({
  property: z
    .object({
      deposit: z.number().nonnegative().nullable(),
      monthly_rent: z.number().nonnegative().nullable(),
      maintenance_fee: z.number().nonnegative().nullable(),
    })
    .nullable()
    .optional(),
}).optional();

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type ReportRecord = Database["public"]["Tables"]["reports"]["Row"];
type ReportWithBrand = ReportRecord & { brands: DbBrand | null };
type ReportUpdatePayload = Partial<Database["public"]["Tables"]["reports"]["Update"]>;

async function fetchReport(
  admin: SupabaseAdminClient,
  reportId: string,
  userId: string,
): Promise<ReportWithBrand | null> {
  const { data, error } = await admin
    .from("reports")
    .select("*,brands(*)")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message || "보고서를 불러오지 못했습니다.");
  return data as ReportWithBrand | null;
}

async function updateReport(
  admin: SupabaseAdminClient,
  reportId: string,
  payload: ReportUpdatePayload,
): Promise<void> {
  const { error } = await admin
    .from("reports")
    .update(payload)
    .eq("id", reportId);

  if (error) throw new Error(error.message || "보고서 업데이트에 실패했습니다.");
}

async function updateStatus(
  admin: SupabaseAdminClient,
  reportId: string,
  status: ReportStatus,
  extra?: ReportUpdatePayload,
): Promise<void> {
  try {
    await updateReport(admin, reportId, { status, ...extra });
  } catch (error) {
    console.error("[run] status update failed", status, error);
  }
}

async function callDataApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000), // Vercel cold start 고려하여 25s
  });

  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? `API 오류: ${endpoint}`);
  }

  return (await response.json()) as T;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  const startTime = Date.now();
  const admin = createAdminClient();

  // ---- 임대 조건 파싱 (만원 → 원 변환, body 없으면 undefined로 하위 호환) ----
  let propertyInput: PropertyInput | undefined;
  try {
    const text = await request.text();
    if (text.trim()) {
      const parsed = RunBodySchema.parse(JSON.parse(text));
      if (parsed?.property) {
        const MAN_WON = 10_000;
        propertyInput = {
          deposit: parsed.property.deposit != null ? parsed.property.deposit * MAN_WON : null,
          monthly_rent: parsed.property.monthly_rent != null ? parsed.property.monthly_rent * MAN_WON : null,
          maintenance_fee: parsed.property.maintenance_fee != null ? parsed.property.maintenance_fee * MAN_WON : null,
        };
      }
      // parsed.property === null → 해당없음 체크 → propertyInput remains undefined
    }
  } catch {
    console.warn("[run] Could not parse request body, proceeding without property input");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const report = await fetchReport(admin, reportId, user.id);

    if (!report) {
      return NextResponse.json({ error: "보고서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!report.brand_id || !report.brands) {
      return NextResponse.json({ error: "브랜드 정보가 없습니다." }, { status: 400 });
    }

    const brand = report.brands;

    let geocodeData: { lat: number; lng: number; formattedAddress: string };

    try {
      geocodeData = await callDataApi<{ lat: number; lng: number; formattedAddress: string }>(
        "/api/data/geocode",
        { address: report.address },
      );
    } catch (error) {
      console.error("[run] Geocoding failed", error);
      await updateStatus(admin, reportId, "failed", {
        error_message: `주소 분석 실패: ${String(error)}`,
      });
      return NextResponse.json({ error: "주소 분석에 실패했습니다." }, { status: 422 });
    }

    await updateReport(admin, reportId, {
      latitude: geocodeData.lat,
      longitude: geocodeData.lng,
      status: "collecting",
    });

    const [competitorsResult, populationResult, publicCompResult] = await Promise.allSettled([
      callDataApi<{ competitors: CollectedData["competitors"] }>("/api/data/competitors", {
        lat: geocodeData.lat,
        lng: geocodeData.lng,
        industry: brand.industry,
        radius: 1000,
      }),
      callDataApi<CollectedData["population"]>("/api/data/population", {
        lat: geocodeData.lat,
        lng: geocodeData.lng,
      }),
      fetchPublicCompetition(geocodeData.lat, geocodeData.lng, brand.industry),
    ]);

    const competitors =
      competitorsResult.status === "fulfilled" ? competitorsResult.value.competitors : [];

    const population =
      populationResult.status === "fulfilled"
        ? populationResult.value
        : {
            radius_500m: { residential: 0, households: 0, workers: 0 },
            radius_1km: { residential: 0, households: 0, workers: 0 },
            radius_2km: { residential: 0, households: 0, workers: 0 },
            core_age_group: "미수집",
            gender_ratio: "미수집",
            commercial_area_type: "미수집",
            hourly_traffic: {
              morning: { weekday: 0, weekend: 0 },
              lunch: { weekday: 0, weekend: 0 },
              afternoon: { weekday: 0, weekend: 0 },
              evening: { weekday: 0, weekend: 0 },
              night: { weekday: 0, weekend: 0 },
            },
            is_mock: true,
          };

    const publicComp =
      publicCompResult.status === "fulfilled"
        ? publicCompResult.value
        : { same_industry_500m: 0, total_stores_500m: 0, is_real: false };

    const collectedData: CollectedData = {
      geocode: {
        lat: geocodeData.lat,
        lng: geocodeData.lng,
        formatted_address: geocodeData.formattedAddress,
      },
      competitors,
      population,
      public_competition: publicComp,
      ...(propertyInput !== undefined ? { property: propertyInput } : {}),
    };

    await updateReport(admin, reportId, {
      collected_data:
        collectedData as unknown as Database["public"]["Tables"]["reports"]["Update"]["collected_data"],
      status: "analyzing",
    });

    const analysisResult = await generateReport({
      brand,
      address: report.address,
      lat: geocodeData.lat,
      lng: geocodeData.lng,
      collectedData,
    });

    const benchmark = getIndustryBenchmark(brand.industry, brand.sub_industry);
    if (benchmark) {
      analysisResult.industry_benchmark = benchmark;
    }

    // LLM이 total을 합계로 반환하는 경우를 방어: 서버에서 항상 6개 항목 평균으로 직접 계산
    const ev = analysisResult.evaluation;
    const computedTotal = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (ev.location.score + ev.demand.score + ev.competition.score +
            ev.profitability.score + ev.growth.score + ev.brand_fit.score) / 6,
        ),
      ),
    );
    // analysis_result에 저장되는 evaluation.total도 올바른 평균값으로 override
    analysisResult.evaluation.total = computedTotal;

    await updateReport(admin, reportId, {
      analysis_result: analysisResult,
      recommendation: analysisResult.recommendation,
      total_score: computedTotal,
      llm_provider: process.env.LLM_PROVIDER ?? "anthropic",
      llm_model: process.env.LLM_MODEL ?? "",
      status: "generating",
    });

    const docxBuffer = await generateDocx({
      reportId,
      brand,
      analysis: analysisResult,
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    // ASCII-safe: 비 ASCII 문자(한글 포함) 제거 후 공백→_ 치환
    const safeBrand = brand.brand_name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "brand";
    const safeAddr = report.address.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").slice(0, 40) || "address";
    const fileName = `${reportId}_${dateStr}_${safeBrand}_${safeAddr}.docx`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await admin.storage.from("reports").upload(filePath, docxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

    if (uploadError) {
      console.error("[run] Storage upload failed", uploadError);
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    const { data: urlData } = admin.storage.from("reports").getPublicUrl(filePath);
    const generationTime = Math.round((Date.now() - startTime) / 1000);

    // updateStatus 대신 updateReport 직접 사용 — 완료 상태 업데이트 실패 시 에러를 삼키지 않음
    await updateReport(admin, reportId, {
      status: "completed",
      file_url: urlData.publicUrl,
      file_name: fileName,
      generation_time_seconds: generationTime,
    });

    return NextResponse.json({ ok: true, generation_time_seconds: generationTime });
  } catch (error) {
    console.error("[run] Pipeline failed", error);
    await updateStatus(admin, reportId, "failed", {
      error_message: String(error),
    });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
