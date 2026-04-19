import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { generateReport } from "@/lib/ai/generate";
import { generateDocx } from "@/lib/docx/generator";
import { createClient } from "@/lib/supabase/server";
import type { CollectedData, Database, DbBrand, ReportStatus } from "@/types/database";

type ReportRecord = Database["public"]["Tables"]["reports"]["Row"];

type ReportWithBrand = ReportRecord & {
  brands: DbBrand | null;
};

type ReportUpdatePayload = Partial<Database["public"]["Tables"]["reports"]["Update"]>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getAdminHeaders() {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");
  }

  return {
    "Content-Type": "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function updateStatus(reportId: string, status: ReportStatus, extra?: ReportUpdatePayload) {
  try {
    await updateReport(reportId, {
      status,
      ...extra,
    });
  } catch (error) {
    console.error("[run] status update failed", status, error);
  }
}

async function updateReport(reportId: string, payload: ReportUpdatePayload) {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/reports?id=eq.${reportId}`, {
    method: "PATCH",
    headers: {
      ...getAdminHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || "보고서 업데이트에 실패했습니다.");
  }
}

async function fetchReport(reportId: string, userId: string) {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  const searchParams = new URLSearchParams({
    select: "*,brands(*)",
    id: `eq.${reportId}`,
    user_id: `eq.${userId}`,
    limit: "1",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/reports?${searchParams.toString()}`, {
    headers: getAdminHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || "보고서를 불러오지 못했습니다.");
  }

  const reports = (await response.json()) as ReportWithBrand[];
  return reports[0] ?? null;
}

async function callDataApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? `API 오류: ${endpoint}`);
  }

  return (await response.json()) as T;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params;
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const report = await fetchReport(reportId, user.id);

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
      await updateStatus(reportId, "failed", {
        error_message: `주소 분석 실패: ${String(error)}`,
      });
      return NextResponse.json({ error: "주소 분석에 실패했습니다." }, { status: 422 });
    }

    await updateReport(reportId, {
      latitude: geocodeData.lat,
      longitude: geocodeData.lng,
      status: "collecting",
    });

    const [competitorsResult, populationResult] = await Promise.allSettled([
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

    const collectedData: CollectedData = {
      geocode: {
        lat: geocodeData.lat,
        lng: geocodeData.lng,
        formatted_address: geocodeData.formattedAddress,
      },
      competitors,
      population,
    };

    await updateReport(reportId, {
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

    await updateReport(reportId, {
      analysis_result: analysisResult,
      recommendation: analysisResult.recommendation,
      total_score: Math.min(100, Math.max(0, Math.round(analysisResult.evaluation.total))),
      llm_provider: process.env.LLM_PROVIDER ?? "anthropic",
      llm_model: process.env.LLM_MODEL ?? "",
      status: "generating",
    });

    const docxBuffer = await generateDocx({
      reportId,
      brand,
      analysis: analysisResult,
    });

    const admin = getAdminClient();
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

    await updateStatus(reportId, "completed", {
      file_url: urlData.publicUrl,
      file_name: fileName,
      generation_time_seconds: generationTime,
    });

    return NextResponse.json({ ok: true, generation_time_seconds: generationTime });
  } catch (error) {
    console.error("[run] Pipeline failed", error);
    await updateStatus(reportId, "failed", {
      error_message: String(error),
    });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
