/**
 * consult-chat-prompt.test.ts
 *
 * TDD 검증: buildSystemPrompt 가 페르소나 + 8개 절대 가드레일을
 * 올바르게 포함하는지 확인한다.
 *
 * 성공 기준:
 *  - 브랜드명이 프롬프트에 반영된다
 *  - 8개 절대 규칙 키워드가 모두 존재한다
 *  - [CLARIFY]가 "선택적"임을 나타내는 표현이 포함된다 (강제 아님)
 *  - 강제 규칙("창업 의향 → 즉시 [CLARIFY]") 패턴이 없다
 */

import { describe, it, expect } from "vitest";
// Wave 4에서 export 키워드를 추가해야 이 import가 작동한다 (TDD RED 단계)
import { buildSystemPrompt } from "@/app/api/consult/chat/route";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

const fakeBrand: BrandRow = {
  id: "test-id",
  user_id: "user-id",
  brand_name: "테스트치킨",
  industry: "외식",
  sub_industry: "치킨",
  avg_store_size_pyeong: 20,
  franchise_fee: 10_000_000,
  education_fee: 2_000_000,
  deposit: 5_000_000,
  logo_url: null,
  interior_cost_per_pyeong: null,
  equipment_cost: null,
  initial_supplies_cost: null,
  signage_cost: null,
  other_cost: null,
  royalty_rate: 3,
  ad_contribution_rate: null,
  supply_cost_rate: null,
  avg_ticket_price: null,
  avg_monthly_revenue: 42_000_000,
  min_store_requirement: null,
  target_customer: null,
  delivery_ratio: null,
  peak_hours: null,
  total_stores: 120,
  avg_close_rate: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("buildSystemPrompt — persona + 8 absolute guardrails", () => {
  const prompt = buildSystemPrompt(fakeBrand, "");

  // ── 브랜드 아이덴티티 ──────────────────────────────────────

  it("브랜드명이 프롬프트에 반영된다", () => {
    expect(prompt).toContain("테스트치킨");
  });

  it("페르소나(가맹 상담 파트너) 문구가 존재한다", () => {
    expect(prompt).toMatch(/가맹 상담 파트너/);
  });

  // ── 절대 규칙 8개 (각 키워드 하나씩) ─────────────────────

  it.each([
    ["규칙1 수익 보장 금지", "평균치"],
    ["규칙2 법적 사안 → 담당자", "담당자"],
    ["규칙3 없는 수치 생성 금지", "만들어내지"],
    ["규칙4 경쟁 브랜드 비방 금지", "경쟁 브랜드"],
    ["규칙5 브랜드 역할 유지", "역할을 유지"],
    ["규칙6 창업 독촉 금지", "압박"],
    ["규칙7 한국어 유지", "한국어"],
    ["규칙8 범위 초과 → 전문가", "전문 영역"],
  ])("%s — 키워드 '%s' 가 존재한다", (_label, keyword) => {
    expect(prompt).toContain(keyword);
  });

  // ── [CLARIFY] 선택적 사용 확인 ───────────────────────────

  it("[CLARIFY]가 선택적임을 나타내는 표현이 있다", () => {
    expect(prompt).toMatch(/선택적|자유롭게|판단/);
  });

  it("'창업 의향 → 즉시 [CLARIFY]' 강제 패턴이 없다", () => {
    // 이전 규칙 중심 프롬프트의 핵심 문구 — 이것이 있으면 안 된다
    expect(prompt).not.toMatch(/즉시 답변 대신 \[CLARIFY\]/);
  });
});
