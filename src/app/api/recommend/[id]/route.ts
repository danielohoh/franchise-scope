import { NextResponse } from "next/server";

import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { getAuthUser } from "@/lib/supabase/auth-bearer";
import { matchListings } from "@/lib/matching";
import { fetchApartmentsForRegion } from "@/lib/apartments";
import type {
  DbNaverListing,
  DbRecommendationResult,
  MatchedListingRef,
  RecommendDetailResponse,
} from "@/types/recommend";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { user, error: authError } = await getAuthUser(request);

  if (authError || !user) {
    return NextResponse.json(
      { error: authError ?? "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const supabase = createUntypedAdminClient();

  try {
    // 1. 추천 결과 조회 (user_id로 소유권 검증)
    const { data: result, error: resultError } = await supabase
      .from("recommendation_results")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (resultError || !result) {
      return NextResponse.json(
        { error: "추천 결과를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const typedResult = result as DbRecommendationResult;

    // 2. 매칭된 매물 ID 추출
    const refs = (typedResult.matched_listings ?? []) as MatchedListingRef[];
    const listingIds = refs.map((r) => r.listing_id);

    if (listingIds.length === 0) {
      return NextResponse.json<RecommendDetailResponse>({
        result: typedResult,
        listings: [],
      });
    }

    // 3. 매물 상세 조회
    const { data: listings, error: listingsError } = await supabase
      .from("naver_listings")
      .select("*")
      .in("id", listingIds);

    if (listingsError) {
      console.error("[recommend/:id] 매물 조회 실패:", listingsError);
      return NextResponse.json(
        { error: "매물 상세 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    const typedListings = (listings ?? []) as DbNaverListing[];

    // 4. 매칭 점수 재계산
    const conditions = typedResult.parsed_conditions;
    if (conditions) {
      const apartmentData = await fetchApartmentsForRegion(
        typedResult.region_code,
      );
      const matchedListings = matchListings(
        typedListings,
        conditions,
        apartmentData,
      );

      return NextResponse.json<RecommendDetailResponse>({
        result: typedResult,
        listings: matchedListings,
      });
    }

    // parsed_conditions가 없으면 저장된 점수로 반환
    const scoredListings = typedListings.map((listing) => {
      const ref = refs.find((r) => r.listing_id === listing.id);
      return {
        ...listing,
        matchScore: ref?.match_score ?? 0,
        matchReasons: ref?.match_reasons ?? [],
        nearbyHouseholds: ref?.nearby_households ?? null,
        nearbyComplexes: [],
      };
    });

    scoredListings.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json<RecommendDetailResponse>({
      result: typedResult,
      listings: scoredListings,
    });
  } catch (error) {
    console.error("[recommend/:id]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
