// ============================================
// GET /api/recommend/[id]/analysis/[listingId]
// 매물 상세분석 집계 API
// ============================================

import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/supabase/auth-bearer";
import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { fetchApartmentsForRegion } from "@/lib/apartments";
import { calculateNearbyHouseholds } from "@/lib/geo";
import { searchShops } from "@/lib/commercial-area/csv-search";
import { getBuildingByAddress } from "@/lib/data/building";
import { fetchFacilities } from "@/lib/data/facilities";
import { calcInvestment } from "@/lib/data/investment";
import { evaluateLocation } from "@/lib/ai/location-eval";
import type {
  DbNaverListing,
  DbRecommendationResult,
  MatchedListingRef,
} from "@/types/recommend";
import type {
  AnalysisResponse,
  CommercialStatusSection,
  HouseholdBreakdownSection,
} from "@/types/analysis";

const DEFAULT_RADIUS_M = 1_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; listingId: string }> },
) {
  const { id: recommendId, listingId } = await params;

  // ---- 1. 인증 ----
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user) {
    return NextResponse.json(
      { error: authError ?? "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const admin = createUntypedAdminClient();

  try {
    // ---- 2. 추천 결과 소유권 검증 ----
    const { data: result, error: resultError } = await admin
      .from("recommendation_results")
      .select("*")
      .eq("id", recommendId)
      .eq("user_id", user.id)
      .single();

    if (resultError || !result) {
      return NextResponse.json(
        { error: "추천 결과를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const typedResult = result as DbRecommendationResult;

    // ---- 3. listingId가 이 추천 결과에 속하는지 확인 ----
    const refs = (typedResult.matched_listings ?? []) as MatchedListingRef[];
    const isOwned = refs.some((r) => r.listing_id === listingId);

    if (!isOwned) {
      return NextResponse.json(
        { error: "해당 매물을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // ---- 4. naver_listings 매물 상세 조회 ----
    const { data: listingData, error: listingError } = await admin
      .from("naver_listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingError || !listingData) {
      return NextResponse.json(
        { error: "매물 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const listing = listingData as DbNaverListing;

    // ---- 5. 주변 세대수 계산 ----
    const apartmentData = await fetchApartmentsForRegion(listing.region_code);
    const lat = listing.latitude;
    const lng = listing.longitude;

    let households: HouseholdBreakdownSection;
    if (lat != null && lng != null) {
      const nearbyResult = calculateNearbyHouseholds(lat, lng, apartmentData, DEFAULT_RADIUS_M);
      households = {
        total: nearbyResult.total,
        radiusMeters: DEFAULT_RADIUS_M,
        complexes: nearbyResult.complexes,
      };
    } else {
      households = { total: 0, radiusMeters: DEFAULT_RADIUS_M, complexes: [] };
    }

    // ---- 6. 병렬 외부 데이터 조회 ----
    const [buildingResult, commercialResult, facilitiesResult] = await Promise.allSettled([
      // 건축물대장 (주소 필요)
      listing.detail_address
        ? getBuildingByAddress(listing.detail_address, listing.area_supply, listing.area_exclusive)
        : Promise.resolve(null),

      // 상권 정보 (좌표 필요)
      lat != null && lng != null
        ? searchShops({ lat, lng, radiusM: DEFAULT_RADIUS_M, limit: 100 })
        : Promise.resolve(null),

      // 주변 시설 (좌표 필요)
      lat != null && lng != null
        ? fetchFacilities({ lat, lng, radiusM: DEFAULT_RADIUS_M })
        : fetchFacilities({ lat: 0, lng: 0, radiusM: 0 }),
    ]);

    const building =
      buildingResult.status === "fulfilled" ? buildingResult.value : null;

    let commercial: CommercialStatusSection | null = null;
    if (commercialResult.status === "fulfilled" && commercialResult.value) {
      const csv = commercialResult.value;
      commercial = {
        total: csv.total,
        searchRadiusM: csv.searchRadiusM,
        industryDistribution: csv.industryDistribution,
        commercialAreaType: csv.commercialAreaType,
        competitionDensity: csv.competitionDensity,
        topShops: csv.shops.slice(0, 20),
      };
    } else if (commercialResult.status === "rejected") {
      console.warn("[analysis] 상권정보 조회 실패:", commercialResult.reason);
    }

    const facilities =
      facilitiesResult.status === "fulfilled"
        ? facilitiesResult.value
        : { categories: [] };

    // ---- 7. 투자 수익성 계산 (동기) ----
    const investment = calcInvestment(listing);

    // ---- 8. AI 입지 종합 평가 (순차) ----
    let aiEval = null;
    try {
      aiEval = await evaluateLocation({
        listing,
        building,
        households,
        commercial,
        facilities,
      });
    } catch (aiError) {
      console.warn("[analysis] AI 입지 평가 실패:", aiError);
    }

    // ---- 9. 응답 ----
    const response: AnalysisResponse = {
      listing,
      building,
      households,
      commercial,
      facilities,
      investment,
      aiEval,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[analysis]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
