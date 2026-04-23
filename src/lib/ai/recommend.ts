import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

import type { ParsedConditions } from "@/types/recommend";

// ============================================
// AI 기반 자연어 → 매물 검색 조건 파싱
// generate.ts와 동일한 LLM 프로바이더 패턴
// ============================================

type LLMProvider = "anthropic" | "openai" | "groq";

function getProvider(provider: LLMProvider) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!apiKey) throw new Error("LLM_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!model) throw new Error("LLM_MODEL 환경변수가 설정되지 않았습니다.");
  if (!/^[\x00-\x7F]+$/.test(apiKey)) {
    throw new Error(
      "LLM_API_KEY에 유효하지 않은 문자가 포함되어 있습니다. .env.local에 실제 API 키를 입력해주세요.",
    );
  }

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "groq": {
      const groq = createGroq({ apiKey });
      return groq(model);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`지원하지 않는 LLM 프로바이더: ${String(_exhaustive)}`);
    }
  }
}

// Groq API 제약: JSON Schema의 모든 property가 required 배열에 포함되어야 합니다.
// .optional() / .default() 사용 금지 → 모두 required로 선언, 선택적 값은 .nullable()
// 기본값(1000, false 등)은 API 라우트에서 null 체크 후 적용합니다.
export const RecommendConditionSchema = z.object({
  minAreaPyeong: z.number().nullable(),
  maxAreaPyeong: z.number().nullable(),
  minHouseholds: z.number().nullable(),
  radiusMeters: z.number(),             // AI가 반드시 숫자 반환 (프롬프트로 1000 기본값 유도)
  parkingRequired: z.boolean(),         // AI가 반드시 true/false 반환
  buildingUse: z.array(z.string()).nullable(),
  tradeType: z.enum(["매매", "전세", "월세", "전체"]),
  maxDeposit: z.number().nullable(),
  maxMonthlyRent: z.number().nullable(),
  floorPreference: z.string().nullable(),
  additionalConditions: z.array(z.string()).nullable(),
});

const SYSTEM_PROMPT = `당신은 상가 부동산 매물 검색 조건 분석 전문가입니다.
사용자의 자연어 요청을 분석하여 구조화된 검색 조건 JSON으로 변환하세요.

[필수 규칙]
- 모든 필드를 반드시 반환하세요. null이나 기본값으로라도 채워야 합니다.
- 언급하지 않은 숫자 조건은 null로 반환하세요.
- radiusMeters: 언급 없으면 1000 (기본값)
- parkingRequired: 언급 없으면 false
- tradeType: 언급 없으면 "전체"

[변환 규칙]
- "50평 내외" → minAreaPyeong: 45, maxAreaPyeong: 55
- "30평대" → minAreaPyeong: 30, maxAreaPyeong: 39
- "2만세대 이상" → minHouseholds: 20000
- "1만세대" → minHouseholds: 10000
- "주차가능" → parkingRequired: true
- "근린시설" 또는 "근린상가" → buildingUse: ["근린생활시설", "제1종근린생활시설", "제2종근린생활시설"]
- "1층" → floorPreference: "1"
- "저층" → floorPreference: "1-3"
- "월세 200 이하" → maxMonthlyRent: 200, tradeType: "월세"
- "매매 5억 이하" → maxDeposit: 50000, tradeType: "매매"
- "역세권" → additionalConditions: ["역세권"]
- "대로변" → additionalConditions: ["대로변"]`;

// ============================================
// JSON 추출 헬퍼
// ============================================

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

// ============================================
// 조건 파싱 결과 repair — 흔한 오류 수정
// ============================================

function repairConditions(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    // 완전히 잘못된 경우 기본값 반환
    return {
      minAreaPyeong: null,
      maxAreaPyeong: null,
      minHouseholds: null,
      radiusMeters: 1000,
      parkingRequired: false,
      buildingUse: null,
      tradeType: "전체",
      maxDeposit: null,
      maxMonthlyRent: null,
      floorPreference: null,
      additionalConditions: null,
    };
  }

  const obj = { ...(raw as Record<string, unknown>) };

  // radiusMeters: 없거나 숫자가 아니면 1000
  if (typeof obj.radiusMeters !== "number" || isNaN(obj.radiusMeters as number)) {
    obj.radiusMeters = 1000;
  }

  // parkingRequired: boolean으로 강제
  if (typeof obj.parkingRequired !== "boolean") {
    obj.parkingRequired =
      obj.parkingRequired === "true" ||
      obj.parkingRequired === 1 ||
      obj.parkingRequired === "yes";
  }

  // tradeType: 유효 enum 값 확인
  const validTradeTypes = ["매매", "전세", "월세", "전체"];
  if (!validTradeTypes.includes(obj.tradeType as string)) {
    obj.tradeType = "전체";
  }

  // nullable number 필드들: 숫자가 아니면 null
  for (const key of ["minAreaPyeong", "maxAreaPyeong", "minHouseholds", "maxDeposit", "maxMonthlyRent"]) {
    if (obj[key] !== null && obj[key] !== undefined) {
      const n = Number(obj[key]);
      obj[key] = isNaN(n) ? null : n;
    } else {
      obj[key] = null;
    }
  }

  // nullable string 필드
  if (obj.floorPreference !== null && obj.floorPreference !== undefined) {
    obj.floorPreference = String(obj.floorPreference);
  } else {
    obj.floorPreference = null;
  }

  // nullable array 필드들
  for (const key of ["buildingUse", "additionalConditions"]) {
    if (obj[key] !== null && obj[key] !== undefined) {
      if (!Array.isArray(obj[key])) {
        obj[key] = [String(obj[key])];
      }
    } else {
      obj[key] = null;
    }
  }

  return obj;
}

/**
 * 사용자 자연어 프롬프트를 구조화된 검색 조건으로 파싱합니다.
 * 1차: generateObject (strict 스키마 검증)
 * 2차 fallback: generateText + repair + Zod parse
 */
export async function parseRecommendPrompt(
  prompt: string,
): Promise<ParsedConditions> {
  const providerName = (process.env.LLM_PROVIDER?.trim() ??
    "anthropic") as LLMProvider;
  const llmModel = getProvider(providerName);

  // ---- 1차 시도: generateObject (Vercel AI SDK strict 검증) ----
  try {
    const { object } = await generateObject({
      model: llmModel,
      schema: RecommendConditionSchema,
      system: SYSTEM_PROMPT,
      prompt,
      maxRetries: 1,
    });
    return object;
  } catch (primaryError) {
    console.warn(
      "[recommend] generateObject 실패, text fallback 시도:",
      String(primaryError).slice(0, 200),
    );
  }

  // ---- 2차 시도: generateText + 수동 repair + Zod parse ----
  const fallbackSystem =
    SYSTEM_PROMPT +
    "\n\n[출력 형식] 반드시 순수 JSON 객체만 출력하세요. 마크다운 코드블록(```) 사용 금지.\n" +
    "아래 구조를 그대로 따르세요:\n" +
    '{"minAreaPyeong":null,"maxAreaPyeong":null,"minHouseholds":null,"radiusMeters":1000,' +
    '"parkingRequired":false,"buildingUse":null,"tradeType":"전체","maxDeposit":null,' +
    '"maxMonthlyRent":null,"floorPreference":null,"additionalConditions":null}';

  const { text } = await generateText({
    model: llmModel,
    system: fallbackSystem,
    prompt: `다음 요청을 JSON으로 변환하세요: ${prompt}`,
    maxRetries: 1,
  });

  const cleaned = extractJSON(text);
  const parsed: unknown = JSON.parse(cleaned);
  const repaired = repairConditions(parsed);

  return RecommendConditionSchema.parse(repaired) as ParsedConditions;
}
