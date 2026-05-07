import { NextResponse } from "next/server";
import { z } from "zod";

import { computeCompetitionDensity, mapBrandIndustryToMajor, mapBrandIndustryToSub, searchShops } from "@/lib/commercial-area/csv-search";
// v2.0: 인라인 타입 (types/api.ts 제거됨)
type CommercialAreaRequest = {
  lat: number;
  lng: number;
  industry: string;
  radius_m?: number;
};

import type { CommercialAreaResult } from "@/lib/commercial-area/types";
type CommercialAreaResponse = CommercialAreaResult;

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  industry: z.string().trim().min(1, "업종을 입력해 주세요."),
  radius_m: z.number().positive().max(5_000).optional(),
});

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as CommercialAreaRequest;
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { lat, lng, industry, radius_m = 1_000 } = parsed.data;

    // 1) 전체 상가 검색 — 업종 필터 없이 상권 전반 파악
    const allResult = await searchShops({
      lat,
      lng,
      radiusM: radius_m,
      limit: 300,
    });

    // 2) 동종 업소 수 별도 집계 — 경쟁 밀도 계산용 (소분류 기준으로 정밀 매칭)
    const industryMajor = mapBrandIndustryToMajor(industry);
    const industrySub = mapBrandIndustryToSub(industry);

    const sameIndustryCount = allResult.shops.filter((shop) => {
      const majorMatch = industryMajor ? shop.industryMajor.includes(industryMajor) : true;
      // 소분류 키워드가 있으면 소분류로 정밀 매칭, 없으면 대분류만 사용
      const subMatch = industrySub ? shop.industrySub.includes(industrySub) : true;
      return majorMatch && subMatch;
    }).length;

    // 경쟁 밀도 계산 (동종 업소 기준)
    const competitionDensity = computeCompetitionDensity(allResult.total, sameIndustryCount, radius_m);

    const response: CommercialAreaResponse = {
      shops: allResult.shops.slice(0, 100),
      total: allResult.total,
      industryDistribution: allResult.industryDistribution,
      commercialAreaType: allResult.commercialAreaType,
      competitionDensity,
      searchRadiusM: radius_m,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[commercial-area] Unexpected error", error);
    return NextResponse.json(
      { error: "상권정보 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
