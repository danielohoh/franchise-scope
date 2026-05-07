import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const FeesSchema = z.object({
  franchise_fee: z.number().nullable(),
  education_fee: z.number().nullable(),
  deposit: z.number().nullable(),
  royalty: z
    .object({
      type: z.enum(["fixed", "rate", "none"]),
      amount: z.number(),
      description: z.string().nullable(),
    })
    .nullable(),
  opening_costs: z
    .object({
      interior: z.number().nullable(),
      signage: z.number().nullable(),
      equipment_min: z.number().nullable(),
      equipment_max: z.number().nullable(),
      total_min: z.number().nullable(),
      total_max: z.number().nullable(),
      base_size_sqm: z.number().nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
});

export type ParsedFees = z.infer<typeof FeesSchema>;

// ============================================================
// PRD 버그 6: 다단계 파싱 + 상식적 범위 검증
// ============================================================

// 원화 금액 문자열을 숫자(원)로 변환
// "5,500,000원" → 5500000
// "550만원" → 5500000
// "5,500천원" → 5500000
function parseKoreanAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");

  // 억 단위
  const eokMatch = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) return Math.round(parseFloat(eokMatch[1]) * 1_0000_0000);

  // 만 단위
  const manMatch = cleaned.match(/(\d+(?:\.\d+)?)만/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10_000);

  // 천 단위
  const cheonMatch = cleaned.match(/(\d+(?:\.\d+)?)천/);
  if (cheonMatch) return Math.round(parseFloat(cheonMatch[1]) * 1_000);

  // 순수 숫자 (원 단위 포함 여부 무관)
  const numMatch = cleaned.match(/^(\d{3,})/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}

// ── 1단계: 정규식 패턴 매칭 ─────────────────────────────────────

function regexExtractAmount(
  text: string,
  patterns: RegExp[],
): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const amount = parseKoreanAmount(match[1]);
      if (amount !== null) return amount;
    }
  }
  return null;
}

function regexExtractFees(rawText: string): Partial<ParsedFees> {
  const result: Partial<ParsedFees> = {};

  result.franchise_fee = regexExtractAmount(rawText, [
    /가맹(?:계약)?비\s*[:\s]\s*([\d,만천억원]+(?:\s*VAT\s*포함)?)/i,
    /가맹비\s*[:\|]\s*([\d,만천억원]+)/i,
    /가맹비\s*([\d,]{3,})\s*원/i,
  ]);

  result.education_fee = regexExtractAmount(rawText, [
    /교육(?:훈련)?비\s*[:\s]\s*([\d,만천억원]+)/i,
    /교육비\s*[:\|]\s*([\d,만천억원]+)/i,
    /교육비\s*([\d,]{3,})\s*원/i,
  ]);

  result.deposit = regexExtractAmount(rawText, [
    /보증금\s*[:\s]\s*([\d,만천억원]+)/i,
    /이행보증금\s*[:\s]\s*([\d,만천억원]+)/i,
    /보증금\s*([\d,]{3,})\s*원/i,
  ]);

  // 로열티 추출 — 다단계 패턴 시도
  // 케이스 1: "로열티: 220,000원" 직접 형식
  // 케이스 2: "로열티 가맹본부 월 220,000원" 테이블 행 형식 (공개용 정보공개서)
  // 케이스 3: "로열티 ... 월 X원" 더 유연한 형식
  const royaltyFixedPatterns: RegExp[] = [
    /(?:로열티|월\s*정액)\s*[:\s]\s*([\d,만천]+)\s*원/i,
    /로열티\s+(?:\S+\s+){0,2}월\s+([\d,]+)\s*원/i,
    /로열티[\s\S]{1,120}?월\s+([\d,]+)\s*원/i,
  ];

  let royaltyFixed: number | null = null;
  for (const pat of royaltyFixedPatterns) {
    const m = rawText.match(pat);
    if (m?.[1]) {
      royaltyFixed = parseKoreanAmount(m[1]);
      if (royaltyFixed !== null) break;
    }
  }

  const royaltyRateMatch = rawText.match(
    /(?:로열티|로얄티)\s*[:\s]\s*(\d+(?:\.\d+)?)\s*%/i,
  );

  if (royaltyFixed !== null) {
    result.royalty = { type: "fixed", amount: royaltyFixed, description: null };
  } else if (royaltyRateMatch?.[1]) {
    result.royalty = {
      type: "rate",
      amount: parseFloat(royaltyRateMatch[1]),
      description: null,
    };
  }

  return result;
}

// ── 2단계: 테이블 구조 분석 ─────────────────────────────────────
// 정보공개서의 "구분 | 금액 | 비고" 패턴 테이블 파싱

function tableExtractFees(rawText: string): Partial<ParsedFees> {
  const result: Partial<ParsedFees> = {};

  // 마크다운/텍스트 테이블 행 패턴 (가맹비 | 5,500,000 | ...)
  const rows = rawText.split(/\n/).map((line) => line.trim()).filter(Boolean);

  for (const row of rows) {
    const cells = row.split(/\|/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const label = cells[0].replace(/\s/g, "");
    const valueCell = cells[1];
    const amount = parseKoreanAmount(valueCell);

    if (label.includes("가맹비") && !label.includes("교육")) {
      result.franchise_fee ??= amount;
    } else if (label.includes("교육비") || label.includes("교육훈련비")) {
      result.education_fee ??= amount;
    } else if (label.includes("보증금")) {
      result.deposit ??= amount;
    }
  }

  return result;
}

// ── 4단계: 상식적 범위 검증 ─────────────────────────────────────
// 비정상 수치 감지 후 confidence 하향

type ValidationResult = {
  valid: boolean;
  warnings: string[];
  confidence: number;
};

function validateFees(fees: ParsedFees): ValidationResult {
  const warnings: string[] = [];
  let confidence = 1.0;

  if (fees.franchise_fee !== null) {
    if (fees.franchise_fee < 100_000) {
      warnings.push(`가맹비 ${fees.franchise_fee}원 — 100,000원 미만으로 비정상 (파싱 오류 의심)`);
      confidence -= 0.4;
    } else if (fees.franchise_fee > 100_000_000) {
      warnings.push(`가맹비 ${fees.franchise_fee}원 — 1억 초과로 비정상 고액`);
      confidence -= 0.2;
    }
  }

  if (fees.education_fee !== null && fees.education_fee < 10_000) {
    warnings.push(`교육비 ${fees.education_fee}원 — 10,000원 미만으로 비정상`);
    confidence -= 0.3;
  }

  if (fees.royalty !== null) {
    if (fees.royalty.type === "rate" && fees.royalty.amount > 30) {
      warnings.push(`로열티 ${fees.royalty.amount}% — 30% 초과로 비정상`);
      confidence -= 0.2;
    }
    if (fees.royalty.type === "fixed" && fees.royalty.amount < 1_000) {
      warnings.push(`로열티 ${fees.royalty.amount}원 — 1,000원 미만으로 비정상`);
      confidence -= 0.3;
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
    confidence: Math.max(0.1, confidence),
  };
}

// ── 메인 함수: 다단계 파싱 ──────────────────────────────────────

export const extractFees = async (rawText: string): Promise<ParsedFees | null> => {
  // 1단계: 정규식
  const regexResult = regexExtractFees(rawText);

  // 2단계: 테이블 분석 (1단계에서 놓친 항목 보완)
  const tableResult = tableExtractFees(rawText);
  const merged1and2: Partial<ParsedFees> = {
    franchise_fee: regexResult.franchise_fee ?? tableResult.franchise_fee ?? null,
    education_fee: regexResult.education_fee ?? tableResult.education_fee ?? null,
    deposit: regexResult.deposit ?? tableResult.deposit ?? null,
    royalty: regexResult.royalty ?? tableResult.royalty ?? null,
    opening_costs: null,
  };

  // 1~2단계로 핵심 항목(가맹비)을 얻었으면 3단계 스킵
  const needsLlm =
    merged1and2.franchise_fee === null &&
    merged1and2.education_fee === null;

  let finalFees: ParsedFees | null = null;

  if (!needsLlm) {
    // 3단계 스킵 — LLM 없이 개점비용 보완만 처리
    finalFees = {
      franchise_fee: merged1and2.franchise_fee ?? null,
      education_fee: merged1and2.education_fee ?? null,
      deposit: merged1and2.deposit ?? null,
      royalty: merged1and2.royalty ?? null,
      opening_costs: null, // LLM 없이는 복잡한 개점비용 파싱 어려움
    };
  } else {
    // 3단계: LLM 보조 추출 (Groq generateObject)
    const userPrompt = [
      "다음 정보공개서 텍스트에서 가맹비/교육비/보증금/로열티/개점비용을 추출하세요.",
      "숫자는 원(₩) 단위 정수로 반환하세요.",
      "없는 값은 null로 반환하세요.",
      "",
      rawText.slice(0, 20_000),
    ].join("\n");

    try {
      finalFees = await generateStructuredExtraction(
        DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt,
        FeesSchema,
      );
    } catch {
      finalFees = null;
    }
  }

  if (!finalFees) return null;

  // 4단계: 상식적 범위 검증
  const validation = validateFees(finalFees);
  if (!validation.valid) {
    console.warn("[extractFees] 비정상 수치 감지:", validation.warnings);

    // 비정상 수치를 null로 초기화하여 사용자 재검토 유도
    if (
      finalFees.franchise_fee !== null &&
      finalFees.franchise_fee < 100_000
    ) {
      finalFees = { ...finalFees, franchise_fee: null };
    }
    if (
      finalFees.education_fee !== null &&
      finalFees.education_fee < 10_000
    ) {
      finalFees = { ...finalFees, education_fee: null };
    }
  }

  return finalFees;
};
