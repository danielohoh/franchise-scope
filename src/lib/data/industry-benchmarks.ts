export interface IndustryBenchmark {
  industry: string;
  sub_label: string;
  avg_monthly_revenue: number;
  median_monthly_revenue: number;
  source: string;
}

const BENCHMARK_SOURCE = "소상공인진흥공단 실태조사·국세청 업종 통계";

// 세부업종별 벤치마크 (sub_industry 기준)
const SUB_INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  한식: { industry: "외식", sub_label: "한식 일반", avg_monthly_revenue: 17_000_000, median_monthly_revenue: 13_000_000, source: BENCHMARK_SOURCE },
  분식: { industry: "외식", sub_label: "분식/김밥전문", avg_monthly_revenue: 11_000_000, median_monthly_revenue: 8_500_000, source: BENCHMARK_SOURCE },
  중식: { industry: "외식", sub_label: "중식당", avg_monthly_revenue: 15_000_000, median_monthly_revenue: 12_000_000, source: BENCHMARK_SOURCE },
  일식: { industry: "외식", sub_label: "일식당", avg_monthly_revenue: 18_000_000, median_monthly_revenue: 14_000_000, source: BENCHMARK_SOURCE },
  서양식: { industry: "외식", sub_label: "서양식당", avg_monthly_revenue: 20_000_000, median_monthly_revenue: 15_000_000, source: BENCHMARK_SOURCE },
  "기타 외국식": { industry: "외식", sub_label: "기타 외국식", avg_monthly_revenue: 14_000_000, median_monthly_revenue: 11_000_000, source: BENCHMARK_SOURCE },
  패스트푸드: { industry: "외식", sub_label: "패스트푸드", avg_monthly_revenue: 29_000_000, median_monthly_revenue: 24_000_000, source: BENCHMARK_SOURCE },
  치킨: { industry: "외식", sub_label: "치킨전문점", avg_monthly_revenue: 35_000_000, median_monthly_revenue: 28_000_000, source: BENCHMARK_SOURCE },
  피자: { industry: "외식", sub_label: "피자전문점", avg_monthly_revenue: 22_000_000, median_monthly_revenue: 18_000_000, source: BENCHMARK_SOURCE },
  제과제빵: { industry: "외식", sub_label: "제과점/베이커리", avg_monthly_revenue: 14_000_000, median_monthly_revenue: 11_000_000, source: BENCHMARK_SOURCE },
  "아이스크림/빙수": { industry: "외식", sub_label: "아이스크림/빙수", avg_monthly_revenue: 10_000_000, median_monthly_revenue: 7_500_000, source: BENCHMARK_SOURCE },
  커피: { industry: "외식", sub_label: "커피전문점", avg_monthly_revenue: 23_000_000, median_monthly_revenue: 18_000_000, source: BENCHMARK_SOURCE },
  "음료(커피외)": { industry: "외식", sub_label: "음료(커피 외)", avg_monthly_revenue: 12_000_000, median_monthly_revenue: 9_000_000, source: BENCHMARK_SOURCE },
  주점: { industry: "외식", sub_label: "주점", avg_monthly_revenue: 20_000_000, median_monthly_revenue: 15_000_000, source: BENCHMARK_SOURCE },
  "기타 외식": { industry: "외식", sub_label: "기타 외식", avg_monthly_revenue: 12_000_000, median_monthly_revenue: 9_000_000, source: BENCHMARK_SOURCE },
  편의점: { industry: "도소매", sub_label: "편의점", avg_monthly_revenue: 48_000_000, median_monthly_revenue: 42_000_000, source: BENCHMARK_SOURCE },
  "의류/패션": { industry: "도소매", sub_label: "의류/패션", avg_monthly_revenue: 15_000_000, median_monthly_revenue: 10_000_000, source: BENCHMARK_SOURCE },
  화장품: { industry: "도소매", sub_label: "화장품", avg_monthly_revenue: 13_000_000, median_monthly_revenue: 9_000_000, source: BENCHMARK_SOURCE },
  농수산물: { industry: "도소매", sub_label: "농수산물", avg_monthly_revenue: 20_000_000, median_monthly_revenue: 15_000_000, source: BENCHMARK_SOURCE },
  "(건강)식품": { industry: "도소매", sub_label: "(건강)식품", avg_monthly_revenue: 12_000_000, median_monthly_revenue: 8_500_000, source: BENCHMARK_SOURCE },
  종합소매점: { industry: "도소매", sub_label: "종합소매점", avg_monthly_revenue: 25_000_000, median_monthly_revenue: 18_000_000, source: BENCHMARK_SOURCE },
  기타도소매: { industry: "도소매", sub_label: "기타 도소매", avg_monthly_revenue: 12_000_000, median_monthly_revenue: 8_500_000, source: BENCHMARK_SOURCE },
  "교육(교과)": { industry: "서비스", sub_label: "교과 학원", avg_monthly_revenue: 10_000_000, median_monthly_revenue: 7_000_000, source: BENCHMARK_SOURCE },
  "교육(외국어)": { industry: "서비스", sub_label: "외국어 학원", avg_monthly_revenue: 9_000_000, median_monthly_revenue: 6_500_000, source: BENCHMARK_SOURCE },
  "기타 교육": { industry: "서비스", sub_label: "기타 교육", avg_monthly_revenue: 8_000_000, median_monthly_revenue: 5_500_000, source: BENCHMARK_SOURCE },
  "육아관련(교육 외)": { industry: "서비스", sub_label: "육아관련(교육 외)", avg_monthly_revenue: 8_000_000, median_monthly_revenue: 5_500_000, source: BENCHMARK_SOURCE },
  "부동산 중개": { industry: "서비스", sub_label: "부동산 중개", avg_monthly_revenue: 7_000_000, median_monthly_revenue: 4_500_000, source: BENCHMARK_SOURCE },
  임대: { industry: "서비스", sub_label: "임대업", avg_monthly_revenue: 6_000_000, median_monthly_revenue: 4_000_000, source: BENCHMARK_SOURCE },
  숙박: { industry: "서비스", sub_label: "숙박업", avg_monthly_revenue: 15_000_000, median_monthly_revenue: 10_000_000, source: BENCHMARK_SOURCE },
  육아관련: { industry: "서비스", sub_label: "육아관련", avg_monthly_revenue: 7_500_000, median_monthly_revenue: 5_000_000, source: BENCHMARK_SOURCE },
  "스포츠 관련": { industry: "서비스", sub_label: "스포츠 관련", avg_monthly_revenue: 9_000_000, median_monthly_revenue: 6_000_000, source: BENCHMARK_SOURCE },
  이미용: { industry: "서비스", sub_label: "이미용", avg_monthly_revenue: 8_000_000, median_monthly_revenue: 5_500_000, source: BENCHMARK_SOURCE },
  "자동차 관련": { industry: "서비스", sub_label: "자동차 관련", avg_monthly_revenue: 12_000_000, median_monthly_revenue: 8_500_000, source: BENCHMARK_SOURCE },
  PC방: { industry: "서비스", sub_label: "PC방", avg_monthly_revenue: 10_000_000, median_monthly_revenue: 7_000_000, source: BENCHMARK_SOURCE },
  오락: { industry: "서비스", sub_label: "오락", avg_monthly_revenue: 7_000_000, median_monthly_revenue: 4_500_000, source: BENCHMARK_SOURCE },
  배달: { industry: "서비스", sub_label: "배달", avg_monthly_revenue: 8_000_000, median_monthly_revenue: 5_500_000, source: BENCHMARK_SOURCE },
  안경: { industry: "서비스", sub_label: "안경점", avg_monthly_revenue: 9_000_000, median_monthly_revenue: 6_500_000, source: BENCHMARK_SOURCE },
  세탁: { industry: "서비스", sub_label: "세탁소", avg_monthly_revenue: 6_000_000, median_monthly_revenue: 4_000_000, source: BENCHMARK_SOURCE },
  이사: { industry: "서비스", sub_label: "이사/운송", avg_monthly_revenue: 7_000_000, median_monthly_revenue: 4_500_000, source: BENCHMARK_SOURCE },
  운송: { industry: "서비스", sub_label: "운송", avg_monthly_revenue: 7_000_000, median_monthly_revenue: 4_500_000, source: BENCHMARK_SOURCE },
  "반려동물 관련": { industry: "서비스", sub_label: "반려동물 관련", avg_monthly_revenue: 8_000_000, median_monthly_revenue: 5_500_000, source: BENCHMARK_SOURCE },
  약국: { industry: "서비스", sub_label: "약국", avg_monthly_revenue: 30_000_000, median_monthly_revenue: 22_000_000, source: BENCHMARK_SOURCE },
  "인력 파견": { industry: "서비스", sub_label: "인력 파견", avg_monthly_revenue: 6_000_000, median_monthly_revenue: 4_000_000, source: BENCHMARK_SOURCE },
  "기타 서비스": { industry: "서비스", sub_label: "기타 서비스", avg_monthly_revenue: 7_000_000, median_monthly_revenue: 4_500_000, source: BENCHMARK_SOURCE },
};

// 대분류 기본 벤치마크 (세부업종 없을 때 fallback)
const INDUSTRY_FALLBACK: Record<string, IndustryBenchmark> = {
  외식: { industry: "외식", sub_label: "외식업 평균", avg_monthly_revenue: 16_000_000, median_monthly_revenue: 12_000_000, source: BENCHMARK_SOURCE },
  도소매: { industry: "도소매", sub_label: "도소매업 평균", avg_monthly_revenue: 20_000_000, median_monthly_revenue: 14_000_000, source: BENCHMARK_SOURCE },
  서비스: { industry: "서비스", sub_label: "생활서비스업 평균", avg_monthly_revenue: 9_000_000, median_monthly_revenue: 6_500_000, source: BENCHMARK_SOURCE },
};

const HANSIK_MEAT_BENCHMARK: IndustryBenchmark = {
  industry: "외식",
  sub_label: "한식(고기구이/삼겹살)",
  avg_monthly_revenue: 27_000_000,
  median_monthly_revenue: 22_000_000,
  source: BENCHMARK_SOURCE,
};

export function getIndustryBenchmark(
  industry: string,
  subIndustry?: string | null,
): IndustryBenchmark | null {
  const normalizedSub = (subIndustry ?? "").trim();

  // 한식 고기구이 특수 케이스
  if (subIndustry === "한식") {
    const lower = normalizedSub.toLowerCase();
    if (["삼겹살", "고기", "구이"].some((kw) => lower.includes(kw))) {
      return HANSIK_MEAT_BENCHMARK;
    }
  }

  // 세부업종 기준 우선 조회
  if (normalizedSub && SUB_INDUSTRY_BENCHMARKS[normalizedSub]) {
    return SUB_INDUSTRY_BENCHMARKS[normalizedSub];
  }

  // 대분류 fallback
  return INDUSTRY_FALLBACK[industry] ?? null;
}
