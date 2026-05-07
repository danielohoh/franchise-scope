// ============================================================================
// Analysis (상권분석) domain types — v2.0
// ============================================================================

import type {
  DbAnalysis,
  DbAnalysisCollectedData,
  AnalysisStatus,
  Recommendation,
} from './database';

export type { AnalysisStatus, Recommendation };
export type Analysis = DbAnalysis;
export type AnalysisCollectedData = DbAnalysisCollectedData;

// ── 분석 요청 ───────────────────────────────────────────────────────────────

export type AnalysisCreateRequest = {
  brand_id: string;
  disclosure_id?: string;
  address: string;
  latitude: number;
  longitude: number;
  target_size_pyeong?: number;
  target_floor?: string;
  target_rent?: number;
};

// ── 수집 데이터 구조 ────────────────────────────────────────────────────────

/** 반경별 인구 */
export type PopulationRadius = {
  residential: number; // 주거인구
  households: number; // 세대수
  workers: number; // 직장인구
};

/** 시간대별 유동인구 */
export type HourlyTraffic = {
  morning: { weekday: number; weekend: number };
  lunch: { weekday: number; weekend: number };
  afternoon: { weekday: number; weekend: number };
  evening: { weekday: number; weekend: number };
  night: { weekday: number; weekend: number };
};

/** 인구 데이터 */
export type CollectedPopulationData = {
  radius_500m: PopulationRadius;
  radius_1km: PopulationRadius;
  radius_2km: PopulationRadius;
  core_age_group: string;
  gender_ratio: string;
  commercial_area_type: string;
  hourly_traffic: HourlyTraffic;
  is_mock?: boolean;
  source: string;
};

/** 경쟁점 */
export type CompetitorInfo = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  rating: number | null;
  review_count: number;
  is_open: boolean | null;
  place_id: string;
  type: '프랜차이즈' | '개인점';
};

/** 경쟁점 데이터 */
export type CollectedCompetitorData = {
  competitors: CompetitorInfo[];
  total: number;
  same_brand_exists: boolean;
  source: 'google_places' | 'csv_fallback';
};

/** 상권 데이터 */
export type CollectedCommercialData = {
  commercial_area_type: string;
  competition_density: {
    score: number;
    level: '낮음' | '보통' | '높음' | '매우높음';
    same_industry_count: number;
    total_shop_count: number;
  };
  industry_distribution: Array<{
    category: string;
    count: number;
    ratio: number;
  }>;
  total_shops: number;
  source: string;
};

/** 임대시세 데이터 */
export type CollectedRentData = {
  avg_monthly_rent_per_pyeong: number | null; // 원/평
  avg_deposit_per_pyeong: number | null;
  area_name: string | null;
  is_mock?: boolean;
  source: string;
};

/** 위치/교통 데이터 */
export type CollectedLocationData = {
  lat: number;
  lng: number;
  formatted_address: string;
  nearby_stations?: Array<{ name: string; distance_m: number; line: string }>;
  district: string | null;
  dong: string | null;
};

/** 데이터 출처 메타 */
export type DataSourceMeta = {
  population: { source: string; collected_at: string; cache_hit: boolean };
  commercial: { source: string; collected_at: string; cache_hit: boolean };
  rent: { source: string; collected_at: string; cache_hit: boolean };
  competitors: { source: string; collected_at: string; cache_hit: boolean };
  location: { source: string; collected_at: string };
};

/** 수집된 전체 데이터 (LLM에 주입되는 JSON) */
export type CollectedData = {
  population: CollectedPopulationData | null;
  commercial: CollectedCommercialData | null;
  rent: CollectedRentData | null;
  competitors: CollectedCompetitorData | null;
  location: CollectedLocationData | null;
  data_sources: DataSourceMeta | null;
};

// ── 분석 결과 ───────────────────────────────────────────────────────────────

/** 종합 평가 점수 (6개 항목) */
export type EvaluationScores = {
  location: number;      // 입지
  demand: number;        // 수요
  competition: number;   // 경쟁
  profitability: number; // 수익성
  growth: number;        // 성장
  brand_fit: number;     // 브랜드 적합
  total: number;         // 평균
  grade: 'A' | 'B+' | 'B-' | 'C' | 'D';
};

/** 분석 리스트 아이템 */
export type AnalysisSummary = {
  id: string;
  brand_name: string;
  address: string;
  status: AnalysisStatus;
  recommendation: Recommendation | null;
  total_score: number | null;
  created_at: string;
};

/** 분석 완료 결과 전체 */
export type AnalysisWithData = {
  analysis: DbAnalysis;
  collected_data: DbAnalysisCollectedData | null;
  report: {
    id: string;
    analysis_id: string;
    report_html: string | null;
    report_sections: ReportSections | null;
    docx_file_path: string | null;
    docx_generated_at: string | null;
    llm_model: string | null;
  } | null;
  brand: {
    id: string;
    brand_name: string;
    category: string | null;
    industry: string;
  };
};

// ── 보고서 섹션 ─────────────────────────────────────────────────────────────

export type ReportSections = {
  executive_summary?: string;
  brand_overview?: string;
  location_analysis?: string;
  population_analysis?: string;
  competition_analysis?: string;
  investment_estimate?: string;
  sales_simulation?: string;
  swot?: string;
  evaluation?: string;
  recommendation?: string;
};

// ============================================================================
// AI 매물 추천 상세분석 타입 (recommend feature)
// ============================================================================

import type { DbNaverListing } from './recommend';

// ── Section 1: 건물 기본 정보 (건축물대장 API) ──────────────────────────────

export type BuildingInfoSection = {
  buildingName: string | null;
  mainPurpose: string | null;
  etcPurpose: string | null;
  totalArea: number | null;
  parkingCount: number | null;
  isNeighborhoodFacility: boolean;
  floors: Array<{
    flrNo: string | null;
    flrArea: string | null;
    mainPurpsCdNm: string | null;
    etcPurps: string | null;
  }>;
  builtYear: number | null;
  groundFloors: number | null;
  undergroundFloors: number | null;
  exclusiveRatio: number | null;
};

// ── Section 2: 주변 세대수 ───────────────────────────────────────────────────

export type HouseholdBreakdownSection = {
  total: number;
  radiusMeters: number;
  complexes: Array<{ name: string; households: number; distance: number }>;
};

// ── Section 3: 주변 상권 현황 ────────────────────────────────────────────────

export type CommercialAreaIndustryDistribution = {
  category: string;
  count: number;
  ratio: number;
};

export type CommercialAreaCompetitionDensity = {
  level: '낮음' | '보통' | '높음' | '매우높음';
  sameIndustryCount: number;
  totalShopCount: number;
};

/** ShopResult 와 동일한 shape — api.ts의 CommercialAreaShop 과 호환 */
export type CommercialStatusShop = {
  shopId: string;
  name: string;
  branchName: string;
  industryMajor: string;
  industryMid: string;
  industrySub: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
};

export type CommercialStatusSection = {
  total: number;
  searchRadiusM: number;
  industryDistribution: CommercialAreaIndustryDistribution[];
  commercialAreaType: string;
  competitionDensity: CommercialAreaCompetitionDensity;
  topShops: CommercialStatusShop[];
};

// ── Section 4: 주변 핵심 시설 (Google Places) ────────────────────────────────

export type FacilityItem = {
  name: string;
  address: string;
  distance_m: number;
  lat: number;
  lng: number;
};

export type FacilityCategoryKey =
  | 'subway'
  | 'school'
  | 'hospital'
  | 'supermarket'
  | 'bank'
  | 'park';

export type FacilityCategory = {
  key: string;
  label: string;
  icon: string | null;
  total: number;
  nearest: { name: string; distance_m: number; address?: string; lat?: number; lng?: number } | null;
  items: Array<{ name: string; address: string; distance_m: number; lat?: number; lng?: number }>;
};

export type FacilitiesSection = {
  categories: FacilityCategory[];
};

// ── Section 5: 투자 수익성 분석 ──────────────────────────────────────────────

export type InvestmentScenario = {
  label: '보수적' | '표준' | '낙관적';
  monthlyMargin: number;
  breakEvenMonths: number;
};

export type InvestmentSection = {
  tradeType: string;
  pricePerPyeong: {
    deposit: number | null;
    monthlyRent: number | null;
    sale: number | null;
  };
  annualCost: {
    rent: number | null;
    maintenance: number | null;
    total: number | null;
  };
  surfaceYieldPercent: number | null;
  depositToSaleRatio: number | null;
  breakEvenScenarios: InvestmentScenario[] | null;
};

// ── Section 6: AI 입지 종합 평가 ─────────────────────────────────────────────

export type LocationEval = {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendedIndustries: string[];
  verdict: string;
};

// ── 상세분석 최종 응답 ────────────────────────────────────────────────────────

export type AnalysisResponse = {
  listing: DbNaverListing;
  building: BuildingInfoSection | null;
  households: HouseholdBreakdownSection;
  commercial: CommercialStatusSection | null;
  facilities: FacilitiesSection;
  investment: InvestmentSection;
  aiEval: LocationEval | null;
};
