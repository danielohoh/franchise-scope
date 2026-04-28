// ============================================
// 주변 핵심 시설 조회 — Google Places API 사용
// ============================================

import { haversineDistance } from "@/lib/utils/geo";
import { searchNearbyPlaces } from "./google-places";
import type { FacilitiesSection, FacilityCategoryKey, FacilityCategory, FacilityItem } from "@/types/analysis";

const MAX_ITEMS_PER_CATEGORY = 5;

// ---- 카테고리 정의 ----

interface CategoryDef {
  key: FacilityCategoryKey;
  label: string;
  icon: string;
  includedTypes: string[];
}

const FACILITY_CATEGORIES: CategoryDef[] = [
  {
    key: "subway",
    label: "지하철역",
    icon: "🚇",
    includedTypes: ["subway_station", "transit_station", "light_rail_transit_station"],
  },
  {
    key: "school",
    label: "학교",
    icon: "🏫",
    includedTypes: ["primary_school", "secondary_school", "school", "university"],
  },
  {
    key: "hospital",
    label: "병원/의원",
    icon: "🏥",
    includedTypes: ["hospital", "doctor", "medical_clinic", "pharmacy"],
  },
  {
    key: "supermarket",
    label: "마트/슈퍼",
    icon: "🛒",
    includedTypes: ["supermarket", "grocery_store", "convenience_store"],
  },
  {
    key: "bank",
    label: "은행",
    icon: "🏦",
    includedTypes: ["bank", "atm"],
  },
  {
    key: "park",
    label: "공원",
    icon: "🌳",
    includedTypes: ["park", "playground"],
  },
];

/**
 * 특정 좌표 반경 내 핵심 시설 목록을 카테고리별로 조회합니다.
 * Google Places API가 없으면 빈 카테고리 목록을 반환합니다.
 */
export async function fetchFacilities(opts: {
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<FacilitiesSection> {
  const { lat, lng, radiusM = 1_000 } = opts;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const hasApiKey = Boolean(apiKey) && apiKey !== "placeholder";

  if (!hasApiKey || !apiKey) {
    console.info("[facilities] GOOGLE_PLACES_API_KEY 없음 → 빈 결과 반환");
    return buildEmptyResult();
  }

  // 모든 카테고리를 병렬 조회
  const categoryResults = await Promise.allSettled(
    FACILITY_CATEGORIES.map((def) =>
      fetchCategory({ lat, lng, radiusM, apiKey, def }),
    ),
  );

  const categories: FacilityCategory[] = categoryResults.map((result, idx) => {
    const def = FACILITY_CATEGORIES[idx];
    if (!def) {
      return { key: "park" as FacilityCategoryKey, label: "", icon: "", total: 0, nearest: null, items: [] };
    }
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.warn(`[facilities] ${def.label} 조회 실패:`, result.reason);
    return emptyCategory(def);
  });

  return { categories };
}

// ---- 내부 헬퍼 ----

async function fetchCategory(opts: {
  lat: number;
  lng: number;
  radiusM: number;
  apiKey: string;
  def: CategoryDef;
}): Promise<FacilityCategory> {
  const { lat, lng, radiusM, apiKey, def } = opts;

  const places = await searchNearbyPlaces({
    lat,
    lng,
    radiusM,
    includedTypes: def.includedTypes,
    maxResultCount: 20,
    rankBy: "DISTANCE",
    apiKey,
  });

  // 거리 계산 후 정렬
  const items: FacilityItem[] = places
    .map((p) => ({
      name: p.displayName?.text ?? "이름 없음",
      address: p.formattedAddress ?? "",
      distance_m: Math.round(haversineDistance(lat, lng, p.location.latitude, p.location.longitude)),
      lat: p.location.latitude,
      lng: p.location.longitude,
    }))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, MAX_ITEMS_PER_CATEGORY);

  return {
    key: def.key,
    label: def.label,
    icon: def.icon,
    total: places.length,
    nearest: items[0] ?? null,
    items,
  };
}

function emptyCategory(def: CategoryDef): FacilityCategory {
  return {
    key: def.key,
    label: def.label,
    icon: def.icon,
    total: 0,
    nearest: null,
    items: [],
  };
}

function buildEmptyResult(): FacilitiesSection {
  return {
    categories: FACILITY_CATEGORIES.map(emptyCategory),
  };
}
