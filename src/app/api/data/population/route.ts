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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeStoreItems(payload: unknown): { totalCount: number; items: Record<string, unknown>[] } {
  if (!isRecord(payload)) return { totalCount: 0, items: [] };

  const body = isRecord(payload.body) ? payload.body : payload;
  const totalCount = toNumber(body.totalCount);
  const itemsRaw = isRecord(body.items) ? body.items : null;

  if (!itemsRaw) return { totalCount, items: [] };
  if (Array.isArray(itemsRaw.item)) return { totalCount, items: itemsRaw.item.filter(isRecord) };
  if (isRecord(itemsRaw.item)) return { totalCount, items: [itemsRaw.item] };

  return { totalCount, items: [] };
}

function classifyCommercialAreaByStoreDistribution(items: Record<string, unknown>[]): string {
  if (items.length === 0) return MOCK_POPULATION.commercial_area_type;

  let food = 0;
  let retail = 0;
  let realestate = 0;
  let living = 0;
  let office = 0;

  for (const item of items) {
    const category = String(item.indsLclsNm ?? "");
    if (category.includes("음식")) food += 1;
    else if (category.includes("소매")) retail += 1;
    else if (category.includes("부동산")) realestate += 1;
    else if (category.includes("생활서비스")) living += 1;
    else if (category.includes("시설관리") || category.includes("과학") || category.includes("전문")) office += 1;
  }

  const total = Math.max(1, items.length);
  const foodRatio = food / total;
  const retailRatio = retail / total;
  const residentialRatio = (realestate + living) / total;
  const officeRatio = office / total;

  if (foodRatio >= 0.45) return "상업 중심 상권";
  if (officeRatio >= 0.25 && foodRatio >= 0.2) return "오피스+상업 복합";
  if (residentialRatio >= 0.35) return "주거생활 밀착 상권";
  if (retailRatio >= 0.35) return "생활소매 중심 상권";
  return "주거+상업 혼합 상권";
}

function adjustHourlyTrafficByStoreDistribution(
  base: PopulationResponse["hourly_traffic"],
  totalCount: number,
  commercialAreaType: string,
): PopulationResponse["hourly_traffic"] {
  const densityMult = Math.min(1.35, Math.max(0.8, 0.85 + totalCount / 220));

  const profileMult: Record<keyof PopulationResponse["hourly_traffic"], { weekday: number; weekend: number }> =
    commercialAreaType.includes("상업")
      ? {
          morning: { weekday: 1.0, weekend: 0.9 },
          lunch: { weekday: 1.15, weekend: 1.05 },
          afternoon: { weekday: 1.05, weekend: 1.1 },
          evening: { weekday: 1.2, weekend: 1.2 },
          night: { weekday: 1.15, weekend: 1.2 },
        }
      : commercialAreaType.includes("주거")
        ? {
            morning: { weekday: 0.95, weekend: 1.05 },
            lunch: { weekday: 0.95, weekend: 1.0 },
            afternoon: { weekday: 0.95, weekend: 1.1 },
            evening: { weekday: 1.05, weekend: 1.15 },
            night: { weekday: 0.95, weekend: 1.05 },
          }
        : {
            morning: { weekday: 1.0, weekend: 1.0 },
            lunch: { weekday: 1.05, weekend: 1.0 },
            afternoon: { weekday: 1.0, weekend: 1.05 },
            evening: { weekday: 1.1, weekend: 1.1 },
            night: { weekday: 1.0, weekend: 1.05 },
          };

  const next = { ...base };
  const timeKeys: Array<keyof PopulationResponse["hourly_traffic"]> = [
    "morning",
    "lunch",
    "afternoon",
    "evening",
    "night",
  ];

  for (const key of timeKeys) {
    next[key] = {
      weekday: Math.round(base[key].weekday * densityMult * profileMult[key].weekday),
      weekend: Math.round(base[key].weekend * densityMult * profileMult[key].weekend),
    };
  }

  return next;
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

    const apiKey = process.env.DATA_GO_KR_API_KEY;
    if (!apiKey || apiKey === "placeholder") {
      console.info("[population] DATA_GO_KR_API_KEY 없음 → mock + CSV 상권타입 사용");
      const enriched = await enrichWithCsvData(MOCK_POPULATION, lat, lng);
      return NextResponse.json(enriched);
    }

    const query = new URLSearchParams({
      serviceKey: apiKey,
      type: "json",
      radius: "500",
      numOfRows: "200",
      cx: String(lng),
      cy: String(lat),
    });

    const response = await fetch(
        `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?${query.toString()}`,
      {
        signal: AbortSignal.timeout(8_000),
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
    const normalized = normalizeStoreItems(data);
    const commercialAreaType = classifyCommercialAreaByStoreDistribution(normalized.items);

    const enriched: PopulationResponse = {
      ...MOCK_POPULATION,
      commercial_area_type: commercialAreaType,
      hourly_traffic: adjustHourlyTrafficByStoreDistribution(
        MOCK_POPULATION.hourly_traffic,
        normalized.totalCount,
        commercialAreaType,
      ),
      is_mock: true,
    };

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[population] Unexpected error", error);
    return NextResponse.json(MOCK_POPULATION);
  }
}
