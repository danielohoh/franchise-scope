import { z } from "zod";

import { generateStructuredExtraction } from "@/lib/ai/stream-handler";
import { DISCLOSURE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts/system";

const MenuSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(
        z.object({
          name_kr: z.string(),
          price: z.number(),
          price_ice: z.number().optional(),
          price_hot: z.number().optional(),
        }),
      ),
    }),
  ),
});

export type ParsedMenu = z.infer<typeof MenuSchema>;

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
  if (start === -1) return rawText.slice(Math.max(0, rawText.length - maxLen));

  const sub = rawText.slice(start);
  let end = maxLen;
  for (const p of endPatterns) {
    const idx = typeof p === "string" ? sub.indexOf(p) : sub.search(p);
    if (idx > 50) { end = Math.min(end, idx); break; }
  }
  return sub.slice(0, end);
}

// ──────────────────────────────────────────────────────────────
// 1단계: 정규식 — 메뉴 및 가격
// ──────────────────────────────────────────────────────────────
// PDF 별첨03 형식:
//   메뉴명           가격     구성
//   동물복지 후라이드치킨  20,000  1마리
//   동물복지 핫후라이드치킨 21,000  1마리
//   ...
//
// 치킨 가격대: 3,000원 ~ 40,000원

function regexExtractMenuItems(section: string): Array<{ name_kr: string; price: number }> {
  const items: Array<{ name_kr: string; price: number }> = [];
  const seen = new Set<string>();

  // 패턴 1: "한글메뉴명 숫자,숫자\d 단위" (e.g. "동물복지 후라이드치킨 20,000 1마리")
  // 한글 + 공백이 포함된 이름 다음에 가격(5자리)이 오는 패턴
  const linePattern =
    /([\uAC00-\uD7AF][\uAC00-\uD7AF\s()A-Za-z\d]*?)\s{2,}(\d{1,2},\d{3})(?:\s|$)/g;

  let m: RegExpExecArray | null;
  while ((m = linePattern.exec(section)) !== null) {
    const name = m[1].trim().replace(/\s+/g, " ");
    const price = parseNum(m[2]);

    // 상식 검증: 메뉴명 길이 2~30자, 가격 1,000~50,000원
    if (name.length < 2 || name.length > 35) continue;
    if (price < 1000 || price > 50000) continue;
    if (seen.has(name)) continue;

    seen.add(name);
    items.push({ name_kr: name, price });
  }

  // 패턴 2: 단일 공백으로 구분된 경우 ("동물복지후라이드치킨 20,000 1마리")
  if (items.length < 5) {
    const simplePattern =
      /([\uAC00-\uD7AF][\uAC00-\uD7AF()\s]{2,})\s+(\d{1,2},\d{3})\s+(\d+마리|\d+g|판)/g;

    while ((m = simplePattern.exec(section)) !== null) {
      const name = m[1].trim().replace(/\s+/g, " ");
      const price = parseNum(m[2]);

      if (name.length < 2 || name.length > 35) continue;
      if (price < 1000 || price > 50000) continue;
      if (seen.has(name)) continue;

      seen.add(name);
      items.push({ name_kr: name, price });
    }
  }

  return items;
}

// ──────────────────────────────────────────────────────────────
// 메인 추출 함수
// ──────────────────────────────────────────────────────────────

export const extractMenu = async (rawText: string): Promise<ParsedMenu | null> => {
  // 별첨03 또는 메뉴 및 가격 섹션 분리
  const section = isolateSection(
    rawText,
    ["별첨 03", "별첨03", "메뉴 및 가격", "메뉴및가격"],
    ["별첨 04", "별첨04", "재무제표", "확인서"],
    8000,
  );

  const items = regexExtractMenuItems(section);

  if (items.length >= 5) {
    return { categories: [{ name: "전체 메뉴", items }] };
  }

  // 섹션 텍스트가 너무 짧으면 메뉴 데이터가 PDF에서 추출되지 않은 것
  // (pdf-parse는 복잡한 2단 테이블을 종종 빈 문자열로 처리함)
  // LLM 폴백은 실질적인 텍스트가 있을 때만 시도
  const meaningfulText = section.replace(/[\s\n\r\/\d]+/g, "").length;
  if (meaningfulText < 100) {
    // 메뉴 텍스트가 PDF에서 추출되지 않았음 → LLM도 의미 없음
    if (items.length > 0) {
      return { categories: [{ name: "전체 메뉴", items }] };
    }
    return null;
  }

  // LLM 폴백 — 실질적인 텍스트가 있을 때만 시도
  const llmSection = section.slice(0, 5000);

  const userPrompt = [
    "아래 정보공개서 메뉴표에서 메뉴명과 가격을 추출하세요.",
    "각 항목: name_kr(한국어 메뉴명), price(원 단위 정수).",
    "카테고리가 구분되면 name별로 묶어 반환하세요.",
    "",
    llmSection,
  ].join("\n");

  try {
    const result = await generateStructuredExtraction(
      DISCLOSURE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      MenuSchema,
    );
    if (result && result.categories.some((c) => c.items.length > 0)) return result;
  } catch {
    // ignore
  }

  if (items.length > 0) {
    return { categories: [{ name: "전체 메뉴", items }] };
  }

  return null;
};
