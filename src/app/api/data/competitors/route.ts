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

// ============================================================
// 업종명 → Google Places includedTypes 매핑
// https://developers.google.com/maps/documentation/places/web-service/place-types
// ============================================================
const GOOGLE_PLACES_TYPES: Record<string, string[]> = {
  치킨: ["chicken_restaurant"],
  카페: ["cafe", "coffee_shop"],
  한식: ["korean_restaurant", "korean_barbecue_restaurant"],
  분식: ["restaurant"],
  "피자·햄버거": ["pizza_restaurant", "hamburger_restaurant", "fast_food_restaurant"],
  편의점: ["convenience_store"],
  서비스업: ["point_of_interest"],
  기타: ["restaurant"],
};

const FRANCHISE_KEYWORDS = [
  "BBQ", "교촌", "굽네", "bhc", "BHC",
  "스타벅스", "메가커피", "이디야", "파리바게뜨", "뚜레쥬르",
  "맥도날드", "버거킹", "롯데리아",
  "GS25", "CU", "세븐일레븐",
] as const;

function classifyType(name: string): "프랜차이즈" | "개인점" {
  return FRANCHISE_KEYWORDS.some((k) => name.toLowerCase().includes(k.toLowerCase()))
    ? "프랜차이즈"
    : "개인점";
}

// ============================================================
// Google Places API (New) — Nearby Search
// ============================================================

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
].join(",");

async function fetchCompetitorsFromGoogle(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  apiKey: string,
): Promise<CompetitorItem[]> {
  const includedTypes = GOOGLE_PLACES_TYPES[industry] ?? ["restaurant"];

  const body = {
    includedTypes,
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    languageCode: "ko",
    regionCode: "KR",
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusM, 50_000),
      },
    },
  };

  let response: Response;
  try {
    response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[competitors/google] 네트워크 오류", err);
    return [];
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[competitors/google] HTTP error", response.status, errText.slice(0, 200));
    return [];
  }

  const data = (await response.json()) as GooglePlacesResponse;
  const places = data.places ?? [];

  if (places.length === 0) {
    console.info("[competitors/google] 결과 없음");
    return [];
  }

  return places.map((p): CompetitorItem => {
    const placeLat = p.location.latitude;
    const placeLng = p.location.longitude;
    const distance = haversineDistance(lat, lng, placeLat, placeLng);

    return {
      name: p.displayName?.text ?? "이름 없음",
      address: p.formattedAddress ?? "",
      lat: placeLat,
      lng: placeLng,
      distance_m: Math.round(distance),
      rating: p.rating ?? null,
      review_count: p.userRatingCount ?? 0,
      is_open: null,
      place_id: p.id,
      type: classifyType(p.displayName?.text ?? ""),
    };
  });
}

// ============================================================
// CSV 폴백
// ============================================================

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
    industryMid: undefined,
    industrySub,
    limit: 20,
  });

  return result.shops.map((shop) => ({
    name: shop.name + (shop.branchName ? ` ${shop.branchName}` : ""),
    address: shop.address,
    lat: shop.lat,
    lng: shop.lng,
    distance_m: shop.distanceM,
    rating: null,
    review_count: 0,
    is_open: null,
    place_id: shop.shopId,
    type: classifyType(shop.name),
  }));
}

// ============================================================
// POST /api/data/competitors
// 우선순위: Google Places → CSV 폴백
// ============================================================

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

    const googleKey = process.env.GOOGLE_PLACES_API_KEY;
    const hasGoogleKey = Boolean(googleKey) && googleKey !== "placeholder";

    if (hasGoogleKey && googleKey) {
      console.info("[competitors] Google Places API 사용");
      const competitors = await fetchCompetitorsFromGoogle(lat, lng, industry, radius, googleKey);

      if (competitors.length > 0) {
        const payload: CompetitorsResponse = { competitors, total: competitors.length };
        return NextResponse.json(payload);
      }

      console.info("[competitors] Google 결과 없음 → CSV 폴백");
    } else {
      console.info("[competitors] Google API key 없음 → CSV 폴백");
    }

    const competitors = await fetchCompetitorsFromCsv(lat, lng, industry, radius);
    const payload: CompetitorsResponse = { competitors, total: competitors.length };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[competitors] Unexpected error", error);
    return NextResponse.json({ error: "경쟁점 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
