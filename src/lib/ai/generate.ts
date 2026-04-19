import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";

import { ReportAnalysisSchema, type ReportAnalysis } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { DbBrand } from "@/types/database";
import type { CollectedData } from "@/types/database";

// ============================================
// Vercel AI SDK 기반 LLM 추상화
// 환경변수 LLM_PROVIDER로 provider 전환
// ============================================

type LLMProvider = "anthropic" | "openai" | "groq";

function getProvider(provider: LLMProvider) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!apiKey) throw new Error("LLM_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!model) throw new Error("LLM_MODEL 환경변수가 설정되지 않았습니다.");
  // 한글 등 비ASCII 문자가 포함된 placeholder 키 감지
  if (!/^[\x00-\x7F]+$/.test(apiKey)) {
    throw new Error("LLM_API_KEY에 유효하지 않은 문자가 포함되어 있습니다. .env.local에 실제 API 키를 입력해주세요.");
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

export interface GenerateReportInput {
  brand: DbBrand;
  address: string;
  lat: number;
  lng: number;
  collectedData: CollectedData;
}

export async function generateReport(input: GenerateReportInput): Promise<ReportAnalysis> {
  const providerName = (process.env.LLM_PROVIDER?.trim() ?? "anthropic") as LLMProvider;
  const llmModel = getProvider(providerName);

  const userPrompt = buildUserPrompt(
    input.brand,
    input.address,
    input.lat,
    input.lng,
    input.collectedData
  );

  const { object } = await generateObject({
    model: llmModel,
    schema: ReportAnalysisSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxRetries: 3,

  });

  return object;
}

export { ReportAnalysisSchema };
export type { ReportAnalysis };
