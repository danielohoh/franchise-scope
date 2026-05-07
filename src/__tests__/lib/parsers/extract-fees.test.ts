import { describe, expect, it, vi } from "vitest";

import { extractFees } from "@/lib/parsers/extract-fees";

vi.mock("@/lib/ai/stream-handler", () => {
  return {
    generateStructuredExtraction: vi.fn(async () => ({
      franchise_fee: 10000000,
      education_fee: 3000000,
      deposit: 5000000,
      royalty: { type: "rate", amount: 3, description: "월 매출의 3%" },
      opening_costs: {
        interior: 20000000,
        signage: 4000000,
        equipment_min: 12000000,
        equipment_max: 18000000,
        total_min: 45000000,
        total_max: 60000000,
        base_size_sqm: 66,
        note: "20평 기준",
      },
    })),
  };
});

describe("extractFees", () => {
  it("정보공개서 형식 텍스트에서 비용 항목을 파싱한다", async () => {
    const sample = `제8장 가맹금 등\n가맹비: 10,000,000원\n교육비: 3,000,000원\n보증금: 5,000,000원\n로열티: 월 매출의 3%\n개점비용(20평 기준): 인테리어 20,000,000원, 간판 4,000,000원, 설비 12,000,000~18,000,000원`;

    const result = await extractFees(sample);

    expect(result).not.toBeNull();
    expect(result?.franchise_fee).toBe(10000000);
    expect(result?.education_fee).toBe(3000000);
    expect(result?.deposit).toBe(5000000);
    expect(result?.royalty?.type).toBe("rate");
    expect(result?.opening_costs?.total_min).toBe(45000000);
  });
});
