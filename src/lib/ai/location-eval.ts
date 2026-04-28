// ============================================
// AI 입지 종합 평가 — generateObject 패턴 (recommend.ts 동일)
// ============================================

import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

import type { DbNaverListing, ApartmentSummary } from "@/types/recommend";
import type {
  BuildingInfoSection,
  CommercialStatusSection,
  FacilitiesSection,
  LocationEval,
} from "@/types/analysis";

// ---- LLM 프로바이더 ----

type LLMProvider = "anthropic" | "openai" | "groq";

function getProvider(provider: LLMProvider) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!apiKey) throw new Error("LLM_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!model) throw new Error("LLM_MODEL 환경변수가 설정되지 않았습니다.");

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`지원하지 않는 LLM 프로바이더: ${String(_exhaustive)}`);
    }
  }
}

// ---- Zod 스키마 ----
// Groq 제약: 모든 property가 required여야 함. optional/default 금지 → nullable 사용

export const LocationEvalSchema = z.object({
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).min(3).max(5),
  weaknesses: z.array(z.string()).min(3).max(5),
  recommendedIndustries: z.array(z.string()).min(3).max(5),
  verdict: z.string().min(20),
});

// ---- Repair ----

function repairLocationEval(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return {
      overallScore: 50,
      strengths: ["데이터 분석 중 오류 발생"],
      weaknesses: ["데이터 분석 중 오류 발생"],
      recommendedIndustries: ["일반 상가", "편의점", "서비스업"],
      verdict: "데이터 부족으로 정확한 평가가 어렵습니다. 추후 재분석을 권장합니다.",
    };
  }

  const obj = { ...(raw as Record<string, unknown>) };

  // overallScore
  const rawScore = Number(obj.overallScore);
  obj.overallScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 50;

  // 배열 필드 정규화
  for (const key of ["strengths", "weaknesses", "recommendedIndustries"] as const) {
    if (!Array.isArray(obj[key]) || (obj[key] as unknown[]).length === 0) {
      obj[key] = key === "recommendedIndustries"
        ? ["일반 상가", "편의점", "서비스업"]
        : ["분석 데이터 부족"];
    } else {
      // 최소 3개, 최대 5개
      const arr = (obj[key] as unknown[]).map(String).filter(Boolean);
      while (arr.length < 3) arr.push("추가 분석 필요");
      obj[key] = arr.slice(0, 5);
    }
  }

  // verdict
  if (typeof obj.verdict !== "string" || obj.verdict.trim().length < 10) {
    obj.verdict = "입지 분석 결과를 바탕으로 종합적인 검토가 필요합니다.";
  }

  return obj;
}

// ---- JSON 추출 ----

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

// ---- 프롬프트 구성 ----

function buildContext(ctx: {
  listing: DbNaverListing;
  building: BuildingInfoSection | null;
  households: { total: number; complexes: ApartmentSummary[] };
  commercial: CommercialStatusSection | null;
  facilities: FacilitiesSection;
}): string {
  const { listing, building, households, commercial, facilities } = ctx;

  const lines: string[] = [];

  lines.push("=== 매물 기본 정보 ===");
  lines.push(`주소: ${listing.detail_address ?? "미확인"}`);
  lines.push(`면적: ${listing.area_pyeong != null ? `${listing.area_pyeong}평` : "미확인"}`);
  lines.push(`거래유형: ${listing.trade_type}`);
  if (listing.monthly_rent) lines.push(`월세: ${listing.monthly_rent}만원`);
  if (listing.deposit) lines.push(`보증금: ${listing.deposit}만원`);
  if (listing.sale_price) lines.push(`매매가: ${listing.sale_price}만원`);
  lines.push(`주차: ${listing.parking_available === true ? `가능 (${listing.parking_count ?? "?"}대)` : listing.parking_available === false ? "불가" : "미확인"}`);
  lines.push(`건물용도: ${listing.building_use ?? "미확인"}`);

  if (building) {
    lines.push("\n=== 건물 정보 ===");
    lines.push(`준공연도: ${building.builtYear ?? "미확인"}`);
    lines.push(`지상층수: ${building.groundFloors ?? "미확인"}층`);
    lines.push(`근린생활시설 여부: ${building.isNeighborhoodFacility ? "예" : "아니오"}`);
    lines.push(`연면적: ${building.totalArea != null ? `${building.totalArea}㎡` : "미확인"}`);
    lines.push(`전용률: ${building.exclusiveRatio != null ? `${building.exclusiveRatio}%` : "미확인"}`);
  }

  lines.push("\n=== 주변 세대수 ===");
  lines.push(`반경 1km 내 총 세대수: ${households.total.toLocaleString()}세대`);
  if (households.complexes.length > 0) {
    const top3 = households.complexes.slice(0, 3);
    lines.push(`주요 단지: ${top3.map((c) => `${c.name} ${c.households.toLocaleString()}세대 (${c.distance}m)`).join(", ")}`);
  }

  if (commercial) {
    lines.push("\n=== 주변 상권 ===");
    lines.push(`반경 내 총 상가 수: ${commercial.total}개`);
    lines.push(`상권 유형: ${commercial.commercialAreaType}`);
    lines.push(`경쟁 밀도: ${commercial.competitionDensity.level} (동종업소 ${commercial.competitionDensity.sameIndustryCount}개)`);
    const top3industry = commercial.industryDistribution.slice(0, 3);
    if (top3industry.length > 0) {
      lines.push(`주요 업종: ${top3industry.map((i) => `${i.category} ${i.count}개`).join(", ")}`);
    }
  }

  lines.push("\n=== 주변 핵심 시설 ===");
  for (const cat of facilities.categories) {
    if (cat.nearest) {
      lines.push(`${cat.label}: ${cat.nearest.name} (${cat.nearest.distance_m}m)`);
    } else {
      lines.push(`${cat.label}: 반경 내 없음`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `당신은 상가 부동산 입지 분석 전문가입니다.
제공된 데이터를 바탕으로 해당 매물의 입지를 종합 평가하세요.

[필수 규칙]
- 모든 필드를 반드시 반환하세요.
- overallScore: 0~100 사이 정수 (100에 가까울수록 우수한 입지)
- strengths: 핵심 강점 3~5개 (한국어, 간결하게)
- weaknesses: 주의사항/단점 3~5개 (한국어, 간결하게)
- recommendedIndustries: 이 입지에 적합한 업종 3~5개 (예: 헬스장, 카페, 학원)
- verdict: 종합 평가 1~2문장 (한국어)

[평가 기준]
- 배후 세대수: 1km 내 1만세대 이상이면 우수
- 근린생활시설: 있으면 가점
- 주차: 가능하면 가점
- 지하철 거리: 500m 이내이면 우수
- 경쟁 밀도: 낮을수록 유리
- 건물 연식: 15년 이하이면 가점`;

/**
 * 매물 입지 종합 평가를 AI로 생성합니다.
 * 1차: generateObject → 2차: generateText + repair
 */
export async function evaluateLocation(ctx: {
  listing: DbNaverListing;
  building: BuildingInfoSection | null;
  households: { total: number; complexes: ApartmentSummary[] };
  commercial: CommercialStatusSection | null;
  facilities: FacilitiesSection;
}): Promise<LocationEval> {
  const providerName = (process.env.LLM_PROVIDER?.trim() ?? "anthropic") as LLMProvider;
  const llmModel = getProvider(providerName);
  const contextText = buildContext(ctx);

  const userPrompt = `다음 매물 데이터를 분석하여 입지를 평가해 주세요:\n\n${contextText}`;

  // ---- 1차: generateObject ----
  try {
    const { object } = await generateObject({
      model: llmModel,
      schema: LocationEvalSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxRetries: 1,
    });
    return object;
  } catch (primaryError) {
    console.warn(
      "[location-eval] generateObject 실패, text fallback 시도:",
      String(primaryError).slice(0, 200),
    );
  }

  // ---- 2차: generateText + repair ----
  const fallbackSystem =
    SYSTEM_PROMPT +
    "\n\n[출력 형식] 반드시 순수 JSON 객체만 출력하세요. 마크다운 코드블록(```) 사용 금지.\n" +
    '{"overallScore":75,"strengths":["강점1","강점2","강점3"],"weaknesses":["약점1","약점2","약점3"],"recommendedIndustries":["업종1","업종2","업종3"],"verdict":"종합 평가 문장"}';

  const { text } = await generateText({
    model: llmModel,
    system: fallbackSystem,
    prompt: `다음 데이터를 JSON으로 평가하세요: ${contextText}`,
    maxRetries: 1,
  });

  const cleaned = extractJSON(text);
  const parsed: unknown = JSON.parse(cleaned);
  const repaired = repairLocationEval(parsed);

  return LocationEvalSchema.parse(repaired) as LocationEval;
}
