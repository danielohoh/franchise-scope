import { NextResponse } from "next/server";
import { z } from "zod";

import { mapBrandIndustryToMajor, mapBrandIndustryToSub, searchShops } from "@/lib/commercial-area/csv-search";
import { haversineDistance } from "@/lib/utils/geo";
// v2.0: 인라인 타입 정의 (types/api.ts 제거됨)
type CompetitorItem = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  rating: number | null;
  review_count: number;
  is_open: boolean | null;
  place_id: string;
  type: "프랜차이즈" | "개인점";
};

type CompetitorsRequest = {
  lat: number;
  lng: number;
  industry: string;
  radius?: number;
};

type CompetitorsResponse = {
  competitors: CompetitorItem[];
  total: number;
};

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
  // 대분류
  외식: ["restaurant", "food"],
  도소매: ["store", "convenience_store", "clothing_store", "supermarket"],
  서비스: ["point_of_interest"],
  // 세부업종 (sub_industry)
  한식: ["korean_restaurant", "korean_barbecue_restaurant"],
  분식: ["restaurant"],
  중식: ["chinese_restaurant"],
  일식: ["japanese_restaurant"],
  서양식: ["western_restaurant"],
  "기타 외국식": ["restaurant"],
  패스트푸드: ["fast_food_restaurant"],
  치킨: ["chicken_restaurant"],
  피자: ["pizza_restaurant"],
  제과제빵: ["bakery"],
  "아이스크림/빙수": ["ice_cream_shop"],
  커피: ["cafe", "coffee_shop"],
  "음료(커피외)": ["cafe"],
  주점: ["bar"],
  "기타 외식": ["restaurant"],
  편의점: ["convenience_store"],
  "의류/패션": ["clothing_store"],
  화장품: ["beauty_store"],
  농수산물: ["grocery_store"],
  "(건강)식품": ["grocery_store"],
  종합소매점: ["supermarket"],
  기타도소매: ["store"],
  "교육(교과)": ["school"],
  "교육(외국어)": ["school"],
  "기타 교육": ["school"],
  "육아관련(교육 외)": ["child_care_agency"],
  "부동산 중개": ["real_estate_agency"],
  임대: ["real_estate_agency"],
  숙박: ["lodging"],
  육아관련: ["child_care_agency"],
  "스포츠 관련": ["gym", "sports_activity_location"],
  이미용: ["hair_salon", "beauty_salon"],
  "자동차 관련": ["car_repair", "car_dealer"],
  PC방: ["internet_cafe"],
  오락: ["amusement_center"],
  배달: ["point_of_interest"],
  안경: ["optician"],
  세탁: ["laundry"],
  이사: ["moving_company"],
  운송: ["moving_company"],
  "반려동물 관련": ["veterinary_care", "pet_store"],
  약국: ["pharmacy"],
  "인력 파견": ["point_of_interest"],
  "기타 서비스": ["point_of_interest"],
};

const FRANCHISE_KEYWORDS = [
  // 치킨 프랜차이즈
  "BBQ", "교촌", "굽네", "bhc", "BHC", "처갓집", "네네치킨", "60계",
  "노랑통닭", "푸라닭", "페리카나", "지코바", "멕시카나", "황금올리브",
  "후라이드참잘하는집", "치킨플러스", "맥시칸치킨", "자담치킨", "깐부치킨",
  "호식이두마리치킨", "또래오래", "훌랄라", "두찜", "오븐에빠진닭",
  "bb닭", "반마리치킨", "바베큐치킨", "세마리치킨", "치킨마루",
  "파닭", "춘천닭갈비", "불닭", "걸작떡볶이치킨",
  // 카페·음료 프랜차이즈
  "스타벅스", "메가커피", "이디야", "투썸플레이스", "할리스", "폴바셋",
  "커피빈", "파스쿠찌", "빽다방", "요거프레소", "카페베네", "탐앤탐스",
  "더벤티", "드롭탑", "엔제리너스", "달콤커피", "컴포즈커피", "컴포즈",
  "매머드커피", "더리터", "공차", "쥬씨", "스무디킹",
  // 베이커리·디저트
  "파리바게뜨", "뚜레쥬르", "던킨도너츠", "던킨", "크리스피크림",
  "베스킨라빈스", "배스킨라빈스", "나뚜루", "설빙", "빙그레", "요플레",
  // 패스트푸드·버거
  "맥도날드", "버거킹", "롯데리아", "맘스터치", "서브웨이", "노브랜드버거",
  "KFC", "파파이스", "파이브가이즈", "쉐이크쉑", "모스버거",
  // 피자
  "도미노피자", "피자헛", "피자알볼로", "미스터피자", "7번가피자",
  "피자에땅", "피자스쿨", "반올림피자",
  // 한식·분식 프랜차이즈
  "한솥도시락", "한솥", "본죽", "본비빔밥", "국대떡볶이", "죠스떡볶이",
  "엽기떡볶이", "신전떡볶이", "고봉민", "김가네", "김밥나라", "바르다김선생",
  "새마을식당", "놀부부대찌개", "놀부", "찜닭나라", "이춘복참게장",
  "이삭토스트", "에그드랍",
  // 편의점
  "GS25", "CU", "세븐일레븐", "미니스톱", "이마트24", "스토리웨이",
  // 기타 서비스
  "올리브영", "다이소",
] as const;

function classifyType(name: string): "프랜차이즈" | "개인점" {
  return FRANCHISE_KEYWORDS.some((k) => name.toLowerCase().includes(k.toLowerCase()))
    ? "프랜차이즈"
    : "개인점";
}

// ============================================================
// Google Places API (New) — Nearby Search
// ============================================================

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

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
