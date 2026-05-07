import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const ContractSchema = z.object({
  contract_period: z.string().nullable(),
  renewal_period: z.string().nullable(),
  territory_meters: z.number().nullable(),
  operating_hours: z.string().nullable(),
  operating_days: z.string().nullable(),
});

export type ParsedContract = z.infer<typeof ContractSchema>;

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

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
// 1단계: 정규식 — 계약조건 각 항목
// ──────────────────────────────────────────────────────────────
// 자담치킨 기준:
//   계약기간: 2년
//   갱신기간: 2년씩
//   영업지역: 직선거리 100M
//   영업시간: 12:00~24:00
//   영업일수: 주 6일 이상 (월 28일 이상)

function regexExtractContractPeriod(text: string): string | null {
  // 우선순위: 가맹계약기간 명시 → 가맹사업 계약기간 → 일반 계약기간
  // 주의: "지사 계약기간 1년" 같은 오탐 방지 — 가맹점 계약기간만 추출
  const patterns = [
    // "계약 체결일로부터 [2 년]" 형태 (가맹계약서 조항)
    /계약\s*체결일로부터\s*\[?\s*(\d+)\s*년\s*\]?/,
    // "가맹계약기간은 ... 2년" 형태
    /가맹계약기간은[^.]{0,50}\[?\s*(\d+)\s*년\s*\]?/,
    // "가맹사업의 계약기간은 ... 2년"
    /가맹사업[^\n]{0,30}계약기간은[^\d]{0,30}\[?\s*(\d+)\s*년\s*\]?/,
    // "계약기간은 계약 체결일" 직전 숫자
    /계약기간[은]?\s*계약\s*체결일[^.]{0,50}\[?\s*(\d+)\s*년\s*\]?/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const years = parseInt(m[1], 10);
      // 가맹계약기간은 보통 1~5년 (지사 계약기간도 1년이지만 위 패턴이 더 구체적)
      if (years >= 2 && years <= 5) return `${years}년`;
      if (years >= 1 && years <= 10) return `${years}년`;
    }
  }
  return null;
}

function regexExtractRenewalPeriod(text: string): string | null {
  const patterns = [
    /갱신\s*(?:시|기간)[은]?\s*계약기간은?\s*\[?\s*(\d+)\s*년\s*\]?\s*씩/,
    /(\d+)\s*년\s*씩\s*연장/,
    /계약갱신[^\d]*(\d+)\s*년/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const years = parseInt(m[1], 10);
      if (years > 0 && years <= 10) return `${years}년씩`;
    }
  }
  return null;
}

function regexExtractTerritoryMeters(text: string): number | null {
  const patterns = [
    /직선거리\s*(\d+)\s*M\s*를?\s*원칙/i,
    /직선거리\s*(\d+)\s*M(?!\d)/i,
    /반경\s*(\d+)\s*m\s*(?:이내|기준)/i,
    /영업지역.*?(\d{2,4})\s*m\b/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const meters = parseInt(m[1], 10);
      if (meters >= 50 && meters <= 5000) return meters;
    }
  }
  return null;
}

function regexExtractOperatingHours(text: string): string | null {
  // 형식 A: "12:00~24:00" 시간 범위 (시:분~시:분)
  // 형식 B: "1일 12시간 이상" 지속시간 — PDF 개행으로 "1일 12시간\n이상" 처리 필요
  const patterns = [
    // 형식 A: 시간 범위
    /(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})/,
    /영업시간\s+(\d{1,2}:\d{2}~\d{1,2}:\d{2})/,
    // 형식 B: "1일 N시간 이상" — 개행(\n) 포함 가능, \s가 \n 포함
    /(\d+일\s+\d+시간\s*이상)/,
    // 형식 B (더 유연): "영업시간" 이후 40자 이내에 등장하는 지속시간
    /영업시간[\s\S]{0,40}?(\d+일[\s\n]*\d+시간[\s\n]*이상)/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      // 개행/다중 공백을 단일 공백으로 정규화
      return m[1].replace(/[\s\n]+/g, " ").trim();
    }
  }
  return null;
}

function regexExtractOperatingDays(text: string): string | null {
  // "주 6일 이상 (월 28일 이상)" 형태
  const patterns = [
    /(주\s*\d+\s*일\s*이상[^,\n]*?월\s*\d+\s*일\s*이상)/,
    /(월\s*\d+\s*일\s*이상)/,
    /(주\s*\d+\s*일\s*이상)/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 메인 추출 함수
// ──────────────────────────────────────────────────────────────

export const extractContract = async (rawText: string): Promise<ParsedContract | null> => {
  // 계약 관련 섹션 분리
  const contractSection = isolateSection(
    rawText,
    ["Ⅴ. 영업활동", "계약기간", "6. 계약기간"],
    ["Ⅵ.", "가맹사업의 영업개시", "7. 가맹점운영권"],
    7000,
  );

  // 영업시간/영업일수는 Ⅴ 하단 8번 섹션에 등장
  // ⚠️ "영업시간" 단독 패턴은 이전 섹션(경업금지 등)에서 오탐 가능 → 더 구체적 패턴 우선
  // 더 구체적인 패턴이 없으면 "영업시간" 단독으로 폴백
  const operationsSection = isolateSection(
    rawText,
    ["2) 영업시간 및 영업일수", "2) 영업시간", "영업시간 영업일수", "영업시간"],
    ["3) 권장 종업원", "3) 권장", "9. 광고", "Ⅸ."],
    4000,
  );

  // 전체 텍스트에서도 시도 (영업지역은 Ⅴ에 있지만 계약기간은 Ⅵ에 있을 수 있음)
  const fullSearch = contractSection + "\n" + operationsSection;

  const contract_period = regexExtractContractPeriod(fullSearch) ?? regexExtractContractPeriod(rawText);
  const renewal_period = regexExtractRenewalPeriod(fullSearch) ?? regexExtractRenewalPeriod(rawText);
  const territory_meters = regexExtractTerritoryMeters(fullSearch) ?? regexExtractTerritoryMeters(rawText);
  const operating_hours = regexExtractOperatingHours(operationsSection) ?? regexExtractOperatingHours(rawText);
  const operating_days = regexExtractOperatingDays(operationsSection) ?? regexExtractOperatingDays(rawText);

  const filledCount = [contract_period, renewal_period, territory_meters, operating_hours, operating_days]
    .filter(Boolean).length;

  // 3개 이상 추출했으면 성공
  if (filledCount >= 3) {
    return { contract_period, renewal_period, territory_meters, operating_hours, operating_days };
  }

  // LLM 폴백 — 섹션만 전달
  const llmText = (contractSection + "\n" + operationsSection).slice(0, 5000);
  const userPrompt = [
    "아래 정보공개서에서 계약 조건을 추출하세요.",
    "contract_period(계약기간 문자열), renewal_period(갱신기간), territory_meters(영업지역 보호 거리 숫자/미터), operating_hours(영업시간 문자열), operating_days(영업일수 문자열).",
    "없는 값은 null.",
    "",
    llmText,
  ].join("\n");

  try {
    const result = await generateStructuredExtraction(
      DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      ContractSchema,
    );
    if (result) {
      // 정규식으로 얻은 값 우선 사용 (더 정확함)
      return {
        contract_period: contract_period ?? result.contract_period,
        renewal_period: renewal_period ?? result.renewal_period,
        territory_meters: territory_meters ?? result.territory_meters,
        operating_hours: operating_hours ?? result.operating_hours,
        operating_days: operating_days ?? result.operating_days,
      };
    }
  } catch {
    // ignore
  }

  // 부분 결과라도 반환
  if (filledCount > 0) {
    return { contract_period, renewal_period, territory_meters, operating_hours, operating_days };
  }

  return null;
};
