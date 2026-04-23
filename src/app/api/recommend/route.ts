import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUser } from "@/lib/supabase/auth-bearer";
import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { parseRecommendPrompt } from "@/lib/ai/recommend";
import { matchListings } from "@/lib/matching";
import { fetchApartmentsForRegion } from "@/lib/apartments";
import type {
  DbNaverListing,
  DbRecommendationResult,
  MatchedListingRef,
  RecommendResponse,
} from "@/types/recommend";

const RecommendRequestSchema = z.object({
  regionCode: z.string().min(1, "지역 코드가 필요합니다."),
  regionName: z.string().optional(),
  prompt: z.string().min(1, "검색 조건을 입력해주세요."),
});

export async function POST(request: Request) {
  const { user, error: authError } = await getAuthUser(request);

  if (authError || !user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const parsed = RecommendRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const supabase = createUntypedAdminClient();

  try {
    // 1. AI 파싱: 자연어 → 구조화 조건
    const conditions = await parseRecommendPrompt(body.prompt);

    // 2. DB에서 매물 필터링
    let query = supabase
      .from("naver_listings")
      .select("*")
      .eq("user_id", user.id)
      .eq("region_code", body.regionCode);

    if (conditions.tradeType !== "전체") {
      query = query.ilike("trade_type", `%${conditions.tradeType}%`);
    }
    // 주차 조건은 DB 필터에서 제외: 직방 데이터에 주차 정보가 없어 parking_available = null
    // 주차 조건은 matchListings 스코어링에서 처리됨
    if (conditions.minAreaPyeong) {
      query = query.gte("area_pyeong", conditions.minAreaPyeong);
    }
    if (conditions.maxAreaPyeong) {
      query = query.lte("area_pyeong", conditions.maxAreaPyeong);
    }
    if (conditions.maxMonthlyRent) {
      query = query.lte("monthly_rent", conditions.maxMonthlyRent);
    }

    const { data: listings, error: listingsError } = await query;

    if (listingsError) {
      console.error("[recommend] 매물 조회 실패:", listingsError);
      return NextResponse.json(
        { error: "매물 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    const typedListings = (listings ?? []) as DbNaverListing[];

    // 3. 아파트 데이터 조회 (세대수 매칭용)
    const apartmentData = await fetchApartmentsForRegion(body.regionCode);

    // 4. 매칭 엔진 실행
    const matchedListings = matchListings(
      typedListings,
      conditions,
      apartmentData,
    );

    // 5. 결과 저장
    const matchedListingRefs: MatchedListingRef[] = matchedListings.map(
      (l) => ({
        listing_id: l.id,
        article_id: l.article_id,
        match_score: l.matchScore,
        match_reasons: l.matchReasons,
        nearby_households: l.nearbyHouseholds,
      }),
    );

    const admin = createUntypedAdminClient();
    const { data: inserted, error: insertError } = await admin
      .from("recommendation_results")
      .insert({
        user_id: user.id,
        region_code: body.regionCode,
        region_name: body.regionName ?? null,
        prompt_text: body.prompt,
        parsed_conditions: conditions as unknown,
        matched_listings: matchedListingRefs as unknown,
        result_count: matchedListings.length,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("[recommend] 결과 저장 실패:", insertError);
      return NextResponse.json(
        { error: "추천 결과 저장 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    const result = inserted as DbRecommendationResult;

    return NextResponse.json<RecommendResponse>({
      result: {
        ...result,
        parsed_conditions: conditions,
        matched_listings: matchedListingRefs,
      },
      listings: matchedListings,
    });
  } catch (error) {
    console.error("[recommend]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
