import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const SalesSchema = z.object({
  year: z.number(),
  total: z.object({
    count: z.number(),
    avg_annual: z.number(),
    per_3_3sqm: z.number(),
    max: z.number().nullable(),
    min: z.number().nullable(),
  }),
  by_region: z.array(
    z.object({
      region: z.string(),
      count: z.number(),
      avg_annual: z.number(),
      per_3_3sqm: z.number(),
      max: z.number().nullable(),
      min: z.number().nullable(),
    }),
  ),
});

export type ParsedSales = z.infer<typeof SalesSchema>;

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  return parseInt(s.replace(/[,\s]/g, ""), 10);
}

function isolateSection(
  rawText: string,
  startPatterns: (string | RegExp)[],
  endPatterns: (string | RegExp)[],
  maxLen = 8000,
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
// 1단계: 정규식 — 연도 감지
// ──────────────────────────────────────────────────────────────

function detectSalesYear(section: string): number {
  // "2024 년" 또는 "2024년도" 형태로 등장
  const m = section.match(/(20[12]\d)\s*년/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear() - 1;
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 — 전체(total) 행
// ──────────────────────────────────────────────────────────────
// PDF표: 전체 | 708 | 363,294 | 14,357 | 1,065,040 | 144,094 | 32,925 | 1,176 | 638개

function regexExtractTotal(section: string): ParsedSales["total"] | null {
  // 표 구조: 전체 | 가맹점수 | 평균매출 | 3.3m²당 | 상한 | 3.3m²당(상한) | 하한 | 3.3m²당(하한)
  // 예: "전체 416 141,150 9,337 503,553 62,446 2,320 145"
  //        m[1] m[2]    m[3]  m[4]    (skip)  m[5]
  const patterns: Array<{ re: RegExp; hasMaxMin: boolean }> = [
    // 7개 이상 컬럼: 가맹점수 평균 3.3당 상한 상한_3.3당 하한 하한_3.3당
    {
      re: /전체\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+[\d,]+\s+([\d,]+)/,
      hasMaxMin: true,
    },
    // 5개 컬럼: 가맹점수 평균 3.3당 상한 하한
    {
      re: /전체\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/,
      hasMaxMin: true,
    },
    // 3개 컬럼: 가맹점수 평균 3.3당
    {
      re: /전체\s+(\d+)\s+([\d,]+)\s+([\d,]+)/,
      hasMaxMin: false,
    },
  ];

  for (const { re, hasMaxMin } of patterns) {
    const m = section.match(re);
    if (!m) continue;

    const count = parseNum(m[1]);
    const avg = parseNum(m[2]);
    const per = parseNum(m[3]);
    const max = hasMaxMin && m[4] ? parseNum(m[4]) : null;
    const min = hasMaxMin && m[5] ? parseNum(m[5]) : null;

    // 상식 검증: 평균 매출(천원) 범위 완화 (소규모 브랜드 포함)
    if (avg < 30_000 || avg > 1_500_000) continue;
    if (count < 10 || count > 10000) continue;

    return { count, avg_annual: avg, per_3_3sqm: per, max, min };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 — 지역별 행
// ──────────────────────────────────────────────────────────────
// 각 지역 행: 지역명 | 가맹점수 | 연간평균매출 | 3.3m²당 | ...

const REGION_LIST = [
  "서울", "부산", "대구", "인천", "광주", "대전",
  "울산", "세종", "경기", "강원", "충북", "충남",
  "전북", "전남", "경북", "경남", "제주",
] as const;

function regexExtractByRegion(section: string): ParsedSales["by_region"] {
  const byRegion: ParsedSales["by_region"] = [];

  for (const region of REGION_LIST) {
    // 표 구조: 지역 | 가맹점수 | 연간평균 | 3.3m²당 | 상한 | 3.3m²당(상한) | 하한 | 3.3m²당(하한) | 비고
    // 예: "서울 18 109,226 9,343 222,917 30,629 24,237 1,127 18곳 산정"
    //          m[1] m[2]     m[3]  m[4]           m[5]
    const patterns: Array<{ re: RegExp; hasMaxMin: boolean }> = [
      // 7열 이상: count avg per max max_per min (max_per 스킵)
      {
        re: new RegExp(
          `${region}\\s+(\\d+)\\s+([\\d,]+)\\s+([\\d,]+)\\s+([\\d,]+)\\s+[\\d,]+\\s+([\\d,]+)`,
          "",
        ),
        hasMaxMin: true,
      },
      // 5열: count avg per max min
      {
        re: new RegExp(
          `${region}\\s+(\\d+)\\s+([\\d,]+)\\s+([\\d,]+)\\s+([\\d,]+)\\s+([\\d,]+)`,
          "",
        ),
        hasMaxMin: true,
      },
      // 3열: count avg per (최대/최소 없음)
      {
        re: new RegExp(`${region}\\s+(\\d+)\\s+([\\d,]+)\\s+([\\d,]+)`, ""),
        hasMaxMin: false,
      },
    ];

    for (const { re, hasMaxMin } of patterns) {
      const m = section.match(re);
      if (!m) continue;

      const count = parseNum(m[1]);
      const avg = parseNum(m[2]);
      const per = parseNum(m[3]);
      const max = hasMaxMin && m[4] ? parseNum(m[4]) : null;
      const min = hasMaxMin && m[5] ? parseNum(m[5]) : null;

      // 상식 검증
      if (count <= 0 || count > 1000) continue;
      if (avg < 30_000 || avg > 1_500_000) continue;

      byRegion.push({ region, count, avg_annual: avg, per_3_3sqm: per, max, min });
      break;
    }
  }

  return byRegion;
}

// ──────────────────────────────────────────────────────────────
// 메인 추출 함수
// ──────────────────────────────────────────────────────────────

export const extractSales = async (rawText: string): Promise<ParsedSales | null> => {
  // 섹션 시작: "7. 가맹점사업자의 연간 평균 매출액과 그 산정기준" 형식 포함
  // 섹션 종료: "당사에서 추정한 매출액은"은 표 아래 각주에 등장하므로
  //   PDF 추출 시 열 순서 역전으로 표보다 먼저 나올 수 있음 → 제외
  const section = isolateSection(
    rawText,
    [
      "가맹점사업자의 연간 평균 매출액",
      "연간 평균 매출액과 그 산정기준",
      "연간 평균 매출액",
      "7. 바로 전 사업연도 가맹점사업자",
    ],
    ["8. 가맹점의 평균", "8. [", "9. 지사의", "Ⅲ."],
    9000,
  );

  const year = detectSalesYear(section);
  const total = regexExtractTotal(section);
  const byRegion = regexExtractByRegion(section);

  if (total && byRegion.length >= 5) {
    return { year, total, by_region: byRegion };
  }

  // LLM 폴백
  const llmSection = section.slice(0, 5000);
  const userPrompt = [
    "아래 정보공개서의 가맹점 평균 매출액 표에서 데이터를 추출하세요.",
    "total: 전체 행 (count/avg_annual/per_3_3sqm/max/min, 단위 천원).",
    "by_region: 각 지역별 행 (region/count/avg_annual/per_3_3sqm/max/min, 단위 천원, 없으면 null).",
    "year는 해당 연도(예: 2024).",
    "",
    llmSection,
  ].join("\n");

  try {
    const result = await generateStructuredExtraction(
      DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      SalesSchema,
    );
    if (result) return result;
  } catch {
    // ignore
  }

  // 정규식 부분 결과라도 반환
  if (total) {
    return { year, total, by_region: byRegion };
  }

  return null;
};
