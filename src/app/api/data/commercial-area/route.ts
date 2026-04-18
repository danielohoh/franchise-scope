import { NextResponse } from "next/server";
import { z } from "zod";

import { mapBrandIndustryToMajor, mapBrandIndustryToSub, searchShops } from "@/lib/commercial-area/csv-search";
import type { CommercialAreaRequest, CommercialAreaResponse } from "@/types/api";

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

    // 경쟁 밀도 재계산 (동종 업소 기준)
    const areaSqKm = Math.PI * Math.pow(radius_m / 1000, 2);
    const density = areaSqKm > 0 ? sameIndustryCount / areaSqKm : 0;

    let score: number;
    let level: "낮음" | "보통" | "높음" | "매우높음";

    if (density < 5) {
      score = Math.round((density / 5) * 25);
      level = "낮음";
    } else if (density < 15) {
      score = Math.round(25 + ((density - 5) / 10) * 25);
      level = "보통";
    } else if (density < 30) {
      score = Math.round(50 + ((density - 15) / 15) * 25);
      level = "높음";
    } else {
      score = Math.min(100, Math.round(75 + ((density - 30) / 20) * 25));
      level = "매우높음";
    }

    const response: CommercialAreaResponse = {
      shops: allResult.shops.slice(0, 100),
      total: allResult.total,
      industryDistribution: allResult.industryDistribution,
      commercialAreaType: allResult.commercialAreaType,
      competitionDensity: {
        score,
        level,
        sameIndustryCount,
        totalShopCount: allResult.total,
      },
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
