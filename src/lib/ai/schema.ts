import { z } from "zod";

// ============================================
// LLM 응답 스키마 — Zod (기획서 7-2 기반)
// Vercel AI SDK generateObject()에 직접 사용
// ============================================

export const LocationInfoSchema = z.object({
  candidate_name: z.string().describe("입지 후보 명칭 (예: 연수푸르지오1단지 상가)"),
  address: z.string().describe("분석 대상 주소"),
  estimated_area_pyeong: z.number().describe("예상 점포 면적 (평)"),
  floor: z.string().describe("층수 (예: 1층)"),
  frontage_m: z.string().describe("전면 폭 (예: 6~8m)"),
  deposit: z.number().describe("보증금 (원)"),
  monthly_rent: z.number().describe("월 임대료 (원)"),
  key_money: z.number().describe("권리금 (원)"),
  maintenance_fee: z.number().describe("관리비 (원)"),
  parking: z.string().describe("주차 가능 여부 및 설명"),
  delivery_coverage: z.string().describe("배달 권역 설명"),
});

export const PopulationRadiusSchema = z.object({
  residential: z.number().describe("주거 인구 수"),
  households: z.number().describe("세대 수"),
  workers: z.number().describe("직장 인구 수"),
});

export const TrafficByDaySchema = z.object({
  weekday: z.number().describe("평일 유동 인구"),
  weekend: z.number().describe("주말 유동 인구"),
});

export const PopulationAnalysisSchema = z.object({
  radius_500m: PopulationRadiusSchema,
  radius_1km: PopulationRadiusSchema,
  radius_2km: PopulationRadiusSchema,
  core_age_group: z.string().describe("핵심 연령대 (예: 30~50대 62%)"),
  gender_ratio: z.string().describe("성별 비율 (예: 남 49% / 여 51%)"),
  commercial_area_type: z.string().describe("상권 유형 (예: 주거+역세권 복합)"),
  hourly_traffic: z.object({
    morning: TrafficByDaySchema,
    lunch: TrafficByDaySchema,
    afternoon: TrafficByDaySchema,
    evening: TrafficByDaySchema,
    night: TrafficByDaySchema,
  }),
});

export const CompetitorAnalysisSchema = z.object({
  rank: z.number().describe("순위"),
  name: z.string().describe("상호명"),
  distance_m: z.number().describe("거리 (m)"),
  type: z.enum(["프랜차이즈", "개인점"]),
  rating: z.number().nullable().describe("평점 (없으면 null)"),
  review_count: z.number().describe("리뷰 수"),
  estimated_monthly_revenue: z.number().describe("추정 월 매출 (원)"),
  risk_level: z.enum(["치명적", "높음", "보통", "낮음"]).describe("위험도"),
  note: z.string().describe("비고 (예: 동일 건물 A-103호)"),
});

export const RevenueScenarioSchema = z.object({
  daily_customers: z.number().describe("일 고객 수"),
  avg_ticket: z.number().describe("평균 객단가 (원)"),
  daily_revenue: z.number().describe("일 매출 (원)"),
  monthly_revenue: z.number().describe("월 매출 (원)"),
});

export const CostSimulationSchema = z.object({
  supply_cost_rate: z.number().describe("식재료 원가율 (0.0~1.0)"),
  labor_and_rent: z.number().describe("인건비+임대료 합계 (원)"),
  delivery_commission_rate: z.number().describe("배달 수수료율 (0.0~1.0)"),
  royalty_and_others: z.number().describe("로열티+기타 고정비 (원)"),
  monthly_operating_profit: z.object({
    conservative: z.number(),
    standard: z.number(),
    optimistic: z.number(),
  }),
});

export const InvestmentSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
    })
  ).describe("투자 항목 목록"),
  total: z.number().describe("총 투자비 (원)"),
  monthly_profit: z.number().describe("기본 시나리오 월 영업이익 (원)"),
  annual_profit: z.number().describe("연 영업이익 (원)"),
  payback_months: z.number().describe("투자금 회수 기간 (개월)"),
  annual_roi_percent: z.number().describe("연간 ROI (%)"),
});

export const SWOTSchema = z.object({
  strengths: z.array(z.string()).describe("강점 목록 (3~5개)"),
  weaknesses: z.array(z.string()).describe("약점 목록 (3~5개)"),
  opportunities: z.array(z.string()).describe("기회 목록 (3~5개)"),
  threats: z.array(z.string()).describe("위협 목록 (3~5개)"),
});

export const EvaluationResultSchema = z.object({
  location: z.object({ score: z.number(), max: z.literal(20) }),
  demand: z.object({ score: z.number(), max: z.literal(20) }),
  competition: z.object({ score: z.number(), max: z.literal(15) }),
  profitability: z.object({ score: z.number(), max: z.literal(25) }),
  growth: z.object({ score: z.number(), max: z.literal(10) }),
  brand_fit: z.object({ score: z.number(), max: z.literal(10) }),
  total: z.number().min(0).max(100).describe("총점 /100"),
  grade: z.string().describe("등급: 90~100=A+, 80~89=A, 70~79=B+, 60~69=B, 50~59=C, 50미만=D"),
});

export const CompetitorAlertSchema = z.object({
  type: z.enum(["same_building_competitor", "nearby_competitor"]),
  competitor_name: z.string(),
  detail: z.string().describe("상세 설명 (주소, 영업시간 등)"),
});

// ============================================
// 메인 보고서 스키마
// ============================================

export const ReportAnalysisSchema = z.object({
  location_info: LocationInfoSchema,
  population: PopulationAnalysisSchema,
  competitors: z.array(CompetitorAnalysisSchema).describe("경쟁점 분석 (최대 6개)"),
  revenue_simulation: z.object({
    conservative: RevenueScenarioSchema,
    standard: RevenueScenarioSchema,
    optimistic: RevenueScenarioSchema,
  }),
  cost_simulation: CostSimulationSchema,
  investment: InvestmentSchema,
  swot: SWOTSchema,
  evaluation: EvaluationResultSchema,
  recommendation: z
    .enum(["적극추천", "조건부추천", "재검토필요", "반려"])
    .describe("최종 권고 의견"),
  recommendation_reason: z
    .string()
    .describe("권고 사유 (2~4문장, 핵심 근거 포함)"),
  alert: CompetitorAlertSchema.nullable().describe("동일건물/극근접 경쟁점 경고 (없으면 null)"),
});

export type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;
