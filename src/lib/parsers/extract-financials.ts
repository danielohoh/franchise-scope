import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const FinancialsSchema = z.object({
  years: z.array(
    z.object({
      year: z.number(),
      revenue: z.number().nullable(),
      operating_profit: z.number().nullable(),
      net_income: z.number().nullable(),
      total_assets: z.number().nullable(),
      total_liabilities: z.number().nullable(),
    }),
  ),
});

export type ParsedFinancials = z.infer<typeof FinancialsSchema>;

// ──────────────────────────────────────────────────────────────
// 공통 헬퍼
// ──────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  // 음수(-2,297,340) 처리 포함
  const cleaned = s.replace(/[,\s]/g, "");
  return parseInt(cleaned, 10);
}

/**
 * rawText에서 특정 섹션만 잘라냅니다.
 * startPatterns 중 가장 먼저 등장하는 위치부터 endPatterns까지.
 */
function isolateSection(
  rawText: string,
  startPatterns: (string | RegExp)[],
  endPatterns: (string | RegExp)[],
  maxLen = 6000,
): string {
  let start = -1;
  for (const p of startPatterns) {
    const idx = typeof p === "string" ? rawText.indexOf(p) : rawText.search(p);
    if (idx !== -1 && (start === -1 || idx < start)) start = idx;
  }
  if (start === -1) return rawText.slice(0, maxLen);

  const sub = rawText.slice(start);
  let end = maxLen;
  for (const p of endPatterns) {
    const idx = typeof p === "string" ? sub.indexOf(p) : sub.search(p);
    if (idx > 50) { end = Math.min(end, idx); break; }
  }
  return sub.slice(0, end);
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 추출
// ──────────────────────────────────────────────────────────────
// PDF 표 구조: 연도 | 자산총계 | 부채총계 | 자본총계 | 매출액 | 영업이익 | 당기순이익
// pdf-parse 출력: "2022년 13,960,160 12,051,505 1,908,655 85,248,859 3,736,403 2,835,209"

function regexExtractFinancials(rawText: string): ParsedFinancials | null {
  const section = isolateSection(
    rawText,
    ["재무상태표", "손익계산서", "바로 전 3 개 사업연도", "바로 전 3개 사업연도", "5. 바로"],
    ["6. 가맹본부", "임원명단", "Ⅱ.", "가맹사업 현황"],
    7000,
  );

  // 패턴: 연도 + 6개 숫자 (각 4자리 이상, 쉼표 포함 가능)
  // 자산총계/부채총계는 보통 7-8자리, 매출액도 7-8자리
  // 당기순이익은 음수(-2,297,340)일 수 있으므로 선행 마이너스 허용
  const numGroup = "(-?[\\d,]{4,14})";
  const rowPattern = new RegExp(
    `(20[12]\\d)\\s*년?\\s*${numGroup}\\s+${numGroup}\\s+${numGroup}\\s+${numGroup}\\s+${numGroup}\\s+${numGroup}`,
    "g",
  );

  const years: ParsedFinancials["years"] = [];
  let m: RegExpExecArray | null;
  while ((m = rowPattern.exec(section)) !== null) {
    const year = parseInt(m[1], 10);
    if (year < 2020 || year > 2030) continue;

    // 순서: 자산총계(m[2]) | 부채총계(m[3]) | 자본총계(m[4]) | 매출액(m[5]) | 영업이익(m[6]) | 당기순이익(m[7])
    const totalAssets = parseNum(m[2]);
    const totalLiabilities = parseNum(m[3]);
    // m[4] = 자본총계 (스키마에 없어서 사용 안함)
    const revenue = parseNum(m[5]);
    const operatingProfit = parseNum(m[6]);
    const netIncome = parseNum(m[7]);

    // 상식 검증: 매출액이 너무 작으면 잘못 파싱된 것
    // (단위가 천원이므로 reasonable한 범위: 500,000 ~ 500,000,000)
    // 소규모 프랜차이즈의 경우 매출액이 낮을 수 있으므로 하한 완화
    if (revenue < 500_000 || revenue > 500_000_000) continue;
    if (totalAssets < 500_000) continue;

    years.push({ year, revenue, operating_profit: operatingProfit, net_income: netIncome, total_assets: totalAssets, total_liabilities: totalLiabilities });
  }

  // 중복 year 제거 (같은 연도가 여러 번 매칭될 수 있음)
  const unique = years.filter((y, i, arr) => arr.findIndex((x) => x.year === y.year) === i);

  return unique.length > 0 ? { years: unique.sort((a, b) => a.year - b.year) } : null;
}

// ──────────────────────────────────────────────────────────────
// 3단계: LLM 폴백 (섹션 텍스트만 전달)
// ──────────────────────────────────────────────────────────────

async function llmExtractFinancials(rawText: string): Promise<ParsedFinancials | null> {
  const section = isolateSection(
    rawText,
    ["재무상태표", "손익계산서", "바로 전 3 개 사업연도", "5. 바로"],
    ["6. 가맹본부", "임원명단", "Ⅱ."],
    5000,
  );

  const userPrompt = [
    "아래 정보공개서 재무제표 섹션에서 최근 3개년(2022~2024년) 재무 데이터를 추출하세요.",
    "단위는 천원(원본 숫자 그대로). 없는 값은 null.",
    "",
    section,
  ].join("\n");

  try {
    return await generateStructuredExtraction(DISCLOSURE_EXTRACTION_SYSTEM_PROMPT, userPrompt, FinancialsSchema);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// 메인 추출 함수
// ──────────────────────────────────────────────────────────────

export const extractFinancials = async (rawText: string): Promise<ParsedFinancials | null> => {
  // 1단계: 정규식
  const regexResult = regexExtractFinancials(rawText);
  if (regexResult && regexResult.years.length >= 2) return regexResult;

  // 3단계: LLM 폴백 (섹션만)
  return llmExtractFinancials(rawText);
};
