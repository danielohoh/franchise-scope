import { describe, it, expect } from "vitest";
import { calcGrade } from "@/lib/ai/schema";
import { RecommendConditionSchema } from "@/lib/ai/recommend";

// ────────────────────────────────────────────────────────────────
// calcGrade
// ────────────────────────────────────────────────────────────────
describe("calcGrade", () => {
  it("90 이상 → A+", () => expect(calcGrade(90)).toBe("A+"));
  it("100 → A+", () => expect(calcGrade(100)).toBe("A+"));
  it("95 → A+", () => expect(calcGrade(95)).toBe("A+"));

  it("80~89 → A", () => expect(calcGrade(80)).toBe("A"));
  it("85 → A", () => expect(calcGrade(85)).toBe("A"));
  it("89 → A", () => expect(calcGrade(89)).toBe("A"));

  it("70~79 → B+", () => expect(calcGrade(70)).toBe("B+"));
  it("75 → B+", () => expect(calcGrade(75)).toBe("B+"));
  it("79 → B+", () => expect(calcGrade(79)).toBe("B+"));

  it("60~69 → B", () => expect(calcGrade(60)).toBe("B"));
  it("65 → B", () => expect(calcGrade(65)).toBe("B"));
  it("69 → B", () => expect(calcGrade(69)).toBe("B"));

  it("50~59 → C", () => expect(calcGrade(50)).toBe("C"));
  it("55 → C", () => expect(calcGrade(55)).toBe("C"));
  it("59 → C", () => expect(calcGrade(59)).toBe("C"));

  it("49 이하 → D", () => expect(calcGrade(49)).toBe("D"));
  it("0 → D", () => expect(calcGrade(0)).toBe("D"));
  it("30 → D", () => expect(calcGrade(30)).toBe("D"));
});

// ────────────────────────────────────────────────────────────────
// RecommendConditionSchema (AI 파싱 결과 Zod 스키마)
// ────────────────────────────────────────────────────────────────
describe("RecommendConditionSchema", () => {
  const validBase = {
    minAreaPyeong: null,
    maxAreaPyeong: null,
    minHouseholds: null,
    radiusMeters: 1000,
    parkingRequired: false,
    buildingUse: null,
    tradeType: "전체" as const,
    maxDeposit: null,
    maxMonthlyRent: null,
    floorPreference: null,
    additionalConditions: null,
  };

  it("모든 필드 유효한 입력 → parse 성공", () => {
    const result = RecommendConditionSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("tradeType 유효값 매매/전세/월세/전체", () => {
    for (const t of ["매매", "전세", "월세", "전체"] as const) {
      const result = RecommendConditionSchema.safeParse({ ...validBase, tradeType: t });
      expect(result.success).toBe(true);
    }
  });

  it("tradeType 유효하지 않은 값 → parse 실패", () => {
    const result = RecommendConditionSchema.safeParse({ ...validBase, tradeType: "계약" });
    expect(result.success).toBe(false);
  });

  it("minAreaPyeong 숫자 → parse 성공", () => {
    const result = RecommendConditionSchema.safeParse({ ...validBase, minAreaPyeong: 30 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.minAreaPyeong).toBe(30);
  });

  it("parkingRequired false/true 모두 허용", () => {
    expect(RecommendConditionSchema.safeParse({ ...validBase, parkingRequired: false }).success).toBe(true);
    expect(RecommendConditionSchema.safeParse({ ...validBase, parkingRequired: true }).success).toBe(true);
  });

  it("buildingUse 문자열 배열 → parse 성공", () => {
    const result = RecommendConditionSchema.safeParse({
      ...validBase,
      buildingUse: ["근린생활시설", "제1종근린생활시설"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.buildingUse).toHaveLength(2);
  });

  it("additionalConditions 배열 → parse 성공", () => {
    const result = RecommendConditionSchema.safeParse({
      ...validBase,
      additionalConditions: ["역세권", "대로변"],
    });
    expect(result.success).toBe(true);
  });

  it("radiusMeters 숫자 필수 → 문자열이면 실패", () => {
    const result = RecommendConditionSchema.safeParse({ ...validBase, radiusMeters: "1000" });
    expect(result.success).toBe(false);
  });

  it("maxMonthlyRent 숫자 null 모두 허용", () => {
    expect(RecommendConditionSchema.safeParse({ ...validBase, maxMonthlyRent: 200 }).success).toBe(true);
    expect(RecommendConditionSchema.safeParse({ ...validBase, maxMonthlyRent: null }).success).toBe(true);
  });
});
