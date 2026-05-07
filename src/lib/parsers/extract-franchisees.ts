import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const FranchiseesSchema = z.object({
  years: z.array(
    z.object({
      year: z.number(),
      start: z.number(),
      new_open: z.number(),
      terminated: z.number(),
      cancelled: z.number(),
      transferred: z.number(),
      end: z.number(),
    }),
  ),
  by_region: z.array(
    z.object({
      region: z.string(),
      count: z.number(),
    }),
  ),
  avg_operation_days: z.number().nullable(),
});

export type ParsedFranchisees = z.infer<typeof FranchiseesSchema>;

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  return parseInt(s.replace(/[,\s]/g, ""), 10);
}

// "-" 또는 "–" 는 0으로 처리 (계약종료 없음 표기)
function parseNumOrDash(s: string): number {
  const t = s.trim();
  if (t === "-" || t === "–" || t === "") return 0;
  return parseInt(t.replace(/[,\s]/g, ""), 10);
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
// 1단계: 정규식 — 연도별 가맹점 수 추이
// ──────────────────────────────────────────────────────────────
// PDF표: 연도 | 연초 | 신규개점 | 계약종료 | 계약해지 | 명의변경 | 연말
// 예시: "2022 719 70 35 38 130 716"

function regexExtractYearlyTrend(section: string): ParsedFranchisees["years"] {
  // PDF 표: 연도 | 연초 | 신규개점 | 계약종료 | 계약해지 | 명의변경 | 연말
  // 계약종료·해지·명의변경은 0 표시 시 "-" 또는 "–"로 등장할 수 있음
  // "년" 이 연도 뒤에 붙을 수 있음: "2022년 351 80 4 19 29 408"
  const rowPattern =
    /(20[12]\d)\s*년?\s+(\d{1,4})\s+(\d{1,3})\s+([\d\-–]+)\s+([\d\-–]+)\s+(\d{1,3})\s+(\d{1,4})/g;

  const years: ParsedFranchisees["years"] = [];
  let m: RegExpExecArray | null;

  while ((m = rowPattern.exec(section)) !== null) {
    const year = parseInt(m[1], 10);
    if (year < 2018 || year > 2030) continue;
    const start = parseNum(m[2]);
    const end = parseNum(m[7]);

    // 상식 검증: 연초/연말 가맹점 수 10~5000개 범위로 완화 (소규모 브랜드 포함)
    if (start < 10 || start > 5000) continue;
    if (Math.abs(start - end) > 500) continue; // 급격한 변화 허용 완화

    years.push({
      year,
      start,
      new_open: parseNumOrDash(m[3]),
      terminated: parseNumOrDash(m[4]),
      cancelled: parseNumOrDash(m[5]),
      transferred: parseNumOrDash(m[6]),
      end,
    });
  }

  const unique = years.filter((y, i, arr) => arr.findIndex((x) => x.year === y.year) === i);
  return unique.sort((a, b) => a.year - b.year);
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 — 지역별 가맹점 수 (2024년 기준)
// ──────────────────────────────────────────────────────────────
// PDF표: 지역 | 2022(전체/가맹점/직영점) | 2023 | 2024
// 직영점은 "-"이므로 실질적으로: 지역 n1 n1 - n2 n2 - n3 n3 -
// 2024년 말 값 = 7번째 또는 8번째 숫자 (전체 기준)

const KNOWN_REGIONS = [
  "전체", "서울", "부산", "대구", "인천", "광주", "대전",
  "울산", "세종", "경기", "강원", "충북", "충남",
  "전북", "전남", "경북", "경남", "제주",
] as const;

function regexExtractByRegion(section: string): ParsedFranchisees["by_region"] {
  const byRegion: ParsedFranchisees["by_region"] = [];

  for (const region of KNOWN_REGIONS) {
    // 지역별 표 형식:
    //   지역 [전체 가맹 직영] × 3개년 → 9개 토큰 (직영이 숫자 OR "-")
    // 예시: "서울 20 20 – 20 19 1 18 18 –"
    //         idx 0  1  2   3  4 5  6  7  8
    //   2024 전체 = index 6
    //
    // 또는 단순 3열: "지역 n2022 n2023 n2024"
    //   2024 전체 = index 2

    const linePattern = new RegExp(
      `${region}\\s+((?:(?:\\d[\\d,]*|[-–])\\s*){2,9})`,
      "",
    );
    const m = section.match(linePattern);
    if (!m) continue;

    const tokens = m[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    // 9개 토큰 (3년 × 3열): index 6 = 2024 전체
    // 3개 토큰 (단순 연도별): index 2 = 2024
    // 6개 토큰 (2열 × 3년, 직영 생략): index 4 = 2024
    let countStr: string | undefined;
    if (tokens.length >= 9) {
      countStr = tokens[6]; // 2024 전체
    } else if (tokens.length >= 7) {
      countStr = tokens[6]; // 여전히 index 6 시도
    } else if (tokens.length >= 3) {
      countStr = tokens[tokens.length - 1]; // 마지막 토큰
    }

    if (!countStr || countStr === "-" || countStr === "–") continue;

    const count = parseInt(countStr.replace(/,/g, ""), 10);
    if (!isNaN(count) && count > 0 && count < 3000) {
      byRegion.push({ region, count });
    }
  }

  return byRegion;
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 — 평균 영업기간
// ──────────────────────────────────────────────────────────────

function regexExtractAvgDays(section: string): number | null {
  const patterns = [
    /평균\s*영업기간\s*[^\d]*(\d{3,4})\s*일/,
    /(\d{3,4})\s*일\s*(?:평균|기준)/,
    /1[,.]?\d{3}\s*일/, // 예: 1,438일
  ];

  for (const pat of patterns) {
    const m = section.match(pat);
    if (m) {
      // "1,438일" 형태에서 숫자만 추출
      const numStr = m[1] ?? m[0].replace(/[^\d]/g, "");
      const days = parseInt(numStr.replace(/,/g, ""), 10);
      if (days > 100 && days < 10000) return days;
    }
  }

  // "1,438일" 처럼 직접 등장하는 경우
  const directMatch = section.match(/(1[,.]?\d{3})\s*일/);
  if (directMatch) {
    return parseNum(directMatch[1]);
  }

  return null;
}

// ──────────────────────────────────────────────────────────────
// 메인 추출 함수
// ──────────────────────────────────────────────────────────────

export const extractFranchisees = async (rawText: string): Promise<ParsedFranchisees | null> => {
  // Ⅱ 섹션 전체 분리 (지역별 + 연도별 테이블 모두 포함)
  const section = isolateSection(
    rawText,
    ["Ⅱ. 가맹본부의", "가맹사업 현황", "4. 바로 전 3 년간"],
    ["Ⅲ.", "법 위반", "가맹본부와 그 임원"],
    9000,
  );

  // 연도별 추이 테이블 섹션 (바로 전 3년간 가맹점 수)
  // ⚠️ "5. 바로 전 3" 패턴은 제외: Ⅰ-5 재무상황 섹션과 충돌하여 잘못된 위치를 잡음
  // "바로 전 3년간" / "바로 전 3 년간" 으로 정확하게 매칭
  const annualSection = isolateSection(
    rawText,
    ["바로 전 3년간", "바로 전 3 년간"],
    ["6. [", "7. 바로", "7. 가맹", "광고"],
    4000,
  );

  const years = regexExtractYearlyTrend(annualSection.length > 100 ? annualSection : section);
  const byRegion = regexExtractByRegion(section);
  const avgDays = regexExtractAvgDays(section);

  // 연도별 데이터가 2개 이상 있으면 성공으로 처리
  if (years.length >= 2) {
    return { years, by_region: byRegion, avg_operation_days: avgDays };
  }

  // LLM 폴백 — 섹션 텍스트만 전달
  const llmSection = isolateSection(
    rawText,
    ["Ⅱ. 가맹본부의", "4. 바로 전 3 년간"],
    ["Ⅲ.", "법 위반"],
    6000,
  );

  const userPrompt = [
    "아래 정보공개서에서 가맹점 현황(연도별 수 추이 / 지역별 분포 / 평균 영업기간)을 추출하세요.",
    "연도별: year/start/new_open/terminated/cancelled/transferred/end",
    "지역별: region/count (2024년 기준). 평균 영업기간은 일 단위 숫자.",
    "",
    llmSection,
  ].join("\n");

  try {
    const result = await generateStructuredExtraction(
      DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      FranchiseesSchema,
    );

    // 정규식으로 얻은 부분 데이터가 있으면 보강
    if (result) {
      return {
        years: result.years.length > 0 ? result.years : years,
        by_region: result.by_region.length > 0 ? result.by_region : byRegion,
        avg_operation_days: result.avg_operation_days ?? avgDays,
      };
    }
    return null;
  } catch {
    // 정규식 결과라도 반환
    if (years.length > 0 || byRegion.length > 0) {
      return { years, by_region: byRegion, avg_operation_days: avgDays };
    }
    return null;
  }
};
