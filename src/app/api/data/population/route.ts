import { NextResponse } from "next/server";
import { z } from "zod";

import { searchShops } from "@/lib/commercial-area/csv-search";
import type { PopulationRequest, PopulationResponse } from "@/types/api";

const populationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const MOCK_POPULATION: PopulationResponse = {
  radius_500m: { residential: 8500, households: 3200, workers: 2800 },
  radius_1km: { residential: 28000, households: 11500, workers: 6500 },
  radius_2km: { residential: 72000, households: 28500, workers: 15000 },
  core_age_group: "30~50대 62%",
  gender_ratio: "남 49% / 여 51%",
  commercial_area_type: "주거+역세권 복합",
  hourly_traffic: {
    morning: { weekday: 1850, weekend: 900 },
    lunch: { weekday: 3200, weekend: 2600 },
    afternoon: { weekday: 2100, weekend: 2400 },
    evening: { weekday: 3800, weekend: 3500 },
    night: { weekday: 1500, weekend: 1200 },
  },
  is_mock: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readFromRecord(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function buildPopulationFromApi(payload: unknown): PopulationResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const body = isRecord(payload.body) ? payload.body : payload;
  const items = isRecord(body.items) ? body.items : body;
  const item = Array.isArray(items.item) ? items.item[0] : items.item;

  if (!isRecord(item)) {
    return null;
  }

  const residential500 = readFromRecord(item, ["residential500", "residential_500m", "residential"]);
  const households500 = readFromRecord(item, ["households500", "households_500m", "households"]);
  const workers500 = readFromRecord(item, ["workers500", "workers_500m", "workers"]);

  if (residential500 === null || households500 === null || workers500 === null) {
    return null;
  }

  return {
    radius_500m: {
      residential: Math.round(residential500),
      households: Math.round(households500),
      workers: Math.round(workers500),
    },
    radius_1km: {
      residential: Math.round(residential500 * 3.2),
      households: Math.round(households500 * 3.6),
      workers: Math.round(workers500 * 2.3),
    },
    radius_2km: {
      residential: Math.round(residential500 * 8.4),
      households: Math.round(households500 * 8.9),
      workers: Math.round(workers500 * 5.4),
    },
    core_age_group: "30~50대 중심",
    gender_ratio: "남녀 비율 균형",
    commercial_area_type: "생활밀착형 상권",
    hourly_traffic: {
      morning: { weekday: Math.round(workers500 * 0.6), weekend: Math.round(workers500 * 0.3) },
      lunch: { weekday: Math.round(workers500 * 1.1), weekend: Math.round(workers500 * 0.9) },
      afternoon: { weekday: Math.round(workers500 * 0.8), weekend: Math.round(workers500 * 0.9) },
      evening: { weekday: Math.round(workers500 * 1.3), weekend: Math.round(workers500 * 1.2) },
      night: { weekday: Math.round(workers500 * 0.5), weekend: Math.round(workers500 * 0.4) },
    },
  };
}

/**
 * CSV 데이터 기반으로 상권 유형을 추정한다.
 * mock 데이터 사용 시 실제 CSV 업종 분포를 반영하여 commercial_area_type을 보정한다.
 */
async function enrichWithCsvData(
  base: PopulationResponse,
  lat: number,
  lng: number,
): Promise<PopulationResponse> {
  try {
    // 반경 1km 내 전체 상가 검색 (업종 필터 없음)
    const result = await searchShops({ lat, lng, radiusM: 1_000, limit: 500 });

    if (result.total === 0) {
      return base;
    }

    // CSV 기반 상권 유형으로 교체
    return {
      ...base,
      commercial_area_type: result.commercialAreaType,
    };
  } catch (err) {
    console.warn("[population] CSV 상권타입 보정 실패, 기본값 유지", err);
    return base;
  }
}

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as PopulationRequest;
    const parsed = populationRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { lat, lng } = parsed.data;

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey || apiKey === "placeholder") {
      console.info("[population] PUBLIC_DATA_API_KEY 없음 → mock + CSV 상권타입 사용");
      const enriched = await enrichWithCsvData(MOCK_POPULATION, lat, lng);
      return NextResponse.json(enriched);
    }

    const query = new URLSearchParams({
      serviceKey: apiKey,
      type: "json",
      radius: "2000",
      cx: String(lng),
      cy: String(lat),
    });

    const response = await fetch(
      `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?${query.toString()}`,
      {
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[population] Public data API HTTP error", response.status, text);
      const enriched = await enrichWithCsvData(MOCK_POPULATION, lat, lng);
      return NextResponse.json(enriched);
    }

    const data = (await response.json()) as unknown;
    const normalized = buildPopulationFromApi(data);

    if (!normalized) {
      console.error("[population] Failed to normalize public data API response. Using mock data.");
      const enriched = await enrichWithCsvData(MOCK_POPULATION, lat, lng);
      return NextResponse.json(enriched);
    }

    // 공공 API 성공 시에도 CSV로 상권 유형 보정
    const enriched = await enrichWithCsvData(normalized, lat, lng);
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[population] Unexpected error", error);
    return NextResponse.json(MOCK_POPULATION);
  }
}
