import { NextResponse } from "next/server";
import { z } from "zod";

import { mapBrandIndustryToMajor, mapBrandIndustryToSub, searchShops } from "@/lib/commercial-area/csv-search";
import { haversineDistance } from "@/lib/utils/geo";
import type { CompetitorItem, CompetitorsRequest, CompetitorsResponse } from "@/types/api";

const competitorsRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  industry: z.string().trim().min(1, "업종을 입력해 주세요."),
  radius: z.number().positive().max(50_000).optional(),
});

const INDUSTRY_TYPES: Record<string, string[]> = {
  치킨: ["chicken_restaurant", "restaurant"],
  카페: ["cafe", "coffee_shop", "bakery"],
  한식: ["korean_restaurant", "restaurant"],
  분식: ["korean_restaurant", "restaurant"],
  "피자·햄버거": ["pizza_restaurant", "hamburger_restaurant", "fast_food_restaurant"],
  편의점: ["convenience_store"],
  서비스업: ["store", "establishment"],
  기타: ["restaurant", "store"],
};

const FRANCHISE_KEYWORDS = [
  "BBQ",
  "교촌",
  "굽네",
  "bhc",
  "BHC",
  "스타벅스",
  "메가커피",
  "이디야",
  "파리바게뜨",
  "뚜레쥬르",
  "맥도날드",
  "버거킹",
  "롯데리아",
  "GS25",
  "CU",
  "세븐일레븐",
] as const;

interface PlacesNearbyResponse {
  places?: PlaceResult[];
}

interface PlaceResult {
  id?: string;
  name?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  regularOpeningHours?: {
    openNow?: boolean;
  };
}

function classifyCompetitorType(name: string): "프랜차이즈" | "개인점" {
  const lowerName = name.toLowerCase();
  const isFranchise = FRANCHISE_KEYWORDS.some((keyword) => lowerName.includes(keyword.toLowerCase()));
  return isFranchise ? "프랜차이즈" : "개인점";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * CSV 데이터에서 경쟁점을 검색하여 CompetitorItem[] 형태로 반환한다.
 */
async function fetchCompetitorsFromCsv(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
): Promise<CompetitorItem[]> {
  const industryMajor = mapBrandIndustryToMajor(industry);
  const industrySub = mapBrandIndustryToSub(industry);

  const result = await searchShops({
    lat,
    lng,
    radiusM,
    industryMajor,
    industrySub,
    limit: 20,
  });

  return result.shops.map((shop) => ({
    name: shop.name + (shop.branchName ? ` ${shop.branchName}` : ""),
    address: shop.address,
    lat: shop.lat,
    lng: shop.lng,
    distance_m: shop.distanceM,
    rating: null,       // CSV에는 평점 정보 없음
    review_count: 0,    // CSV에는 리뷰 수 없음
    is_open: null,      // CSV에는 영업 상태 없음
    place_id: shop.shopId,
    type: classifyCompetitorType(shop.name),
  }));
}

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as CompetitorsRequest;
    const parsed = competitorsRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { lat, lng, industry } = parsed.data;
    const radius = parsed.data.radius ?? 1000;

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Google Places API key가 없거나 placeholder이면 CSV 폴백 사용
    if (!apiKey || apiKey === "placeholder") {
      console.info("[competitors] Google Places API key 없음 → CSV 폴백 사용");

      const competitors = await fetchCompetitorsFromCsv(lat, lng, industry, radius);
      const payload: CompetitorsResponse = { competitors, total: competitors.length };
      return NextResponse.json(payload);
    }

    // Google Places API 호출
    const includedTypes = INDUSTRY_TYPES[industry] ?? INDUSTRY_TYPES["기타"];

    const response = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.regularOpeningHours",
        },
        body: JSON.stringify({
          includedTypes,
          locationRestriction: {
            circle: {
              center: { lat, lng },
              radius,
            },
          },
          maxResultCount: 20,
        }),
      },
      10_000,
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[competitors] Google Places API HTTP error", response.status, text);

      // Google API 실패 시 CSV 폴백
      console.info("[competitors] Google Places 실패 → CSV 폴백 사용");
      const competitors = await fetchCompetitorsFromCsv(lat, lng, industry, radius);
      const payload: CompetitorsResponse = { competitors, total: competitors.length };
      return NextResponse.json(payload);
    }

    const data = (await response.json()) as PlacesNearbyResponse;
    const places = data.places ?? [];

    const competitors: CompetitorItem[] = places
      .filter((place): place is PlaceResult & { location: { latitude: number; longitude: number } } => {
        return typeof place.location?.latitude === "number" && typeof place.location?.longitude === "number";
      })
      .map((place, index) => {
        const distance = haversineDistance(lat, lng, place.location.latitude, place.location.longitude);
        const name = place.displayName?.text ?? "이름 없음";

        return {
          name,
          address: place.formattedAddress ?? "주소 정보 없음",
          lat: place.location.latitude,
          lng: place.location.longitude,
          distance_m: Math.round(distance),
          rating: typeof place.rating === "number" ? place.rating : null,
          review_count: typeof place.userRatingCount === "number" ? place.userRatingCount : 0,
          is_open: typeof place.regularOpeningHours?.openNow === "boolean" ? place.regularOpeningHours.openNow : null,
          place_id: place.id ?? `unknown-${index}`,
          type: classifyCompetitorType(name),
        };
      })
      .sort((a, b) => a.distance_m - b.distance_m);

    const payload: CompetitorsResponse = {
      competitors,
      total: competitors.length,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[competitors] Unexpected error", error);
    return NextResponse.json({ error: "경쟁점 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
