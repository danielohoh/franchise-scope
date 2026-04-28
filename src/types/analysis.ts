// ============================================
// FranchiseScope — 매물 상세분석 타입 정의
// ============================================

import type { ApartmentSummary, DbNaverListing } from "./recommend";
import type {
  CommercialAreaCompetitionDensity,
  CommercialAreaIndustryDistribution,
  CommercialAreaShop,
} from "./api";

// ---- Section 1: 건물 기본 정보 (건축물대장 API) ----

export type BuildingInfoSection = {
  // 건축물대장 총괄표제부
  buildingName: string | null;
  mainPurpose: string | null;        // 주용도 (근린생활시설 등)
  etcPurpose: string | null;         // 기타용도
  totalArea: number | null;          // 연면적 (㎡)
  parkingCount: number | null;       // 총주차수
  isNeighborhoodFacility: boolean;   // 근린생활시설 여부

  // 층별개요에서 추출
  floors: Array<{
    flrNo: string | null;
    flrArea: string | null;
    mainPurpsCdNm: string | null;
    etcPurps: string | null;
  }>;

  // 파싱/계산값
  builtYear: number | null;          // useAprDay에서 연도 추출
  groundFloors: number | null;       // getBrTitleInfo.grndFlrCnt
  undergroundFloors: number | null;  // getBrTitleInfo.ugrndFlrCnt
  exclusiveRatio: number | null;     // area_exclusive / area_supply × 100
};

// ---- Section 2: 주변 세대수 Breakdown ----

export type HouseholdBreakdownSection = {
  total: number;
  radiusMeters: number;
  complexes: ApartmentSummary[];
};

// ---- Section 3: 주변 상권 현황 (소상공인 CSV) ----

export type CommercialStatusSection = {
  total: number;
  searchRadiusM: number;
  industryDistribution: CommercialAreaIndustryDistribution[];
  commercialAreaType: string;
  competitionDensity: CommercialAreaCompetitionDensity;
  topShops: CommercialAreaShop[];  // 가장 가까운 최대 20개
};

// ---- Section 4: 주변 핵심 시설 (Google Places) ----

export type FacilityItem = {
  name: string;
  address: string;
  distance_m: number;
  lat: number;
  lng: number;
};

export type FacilityCategoryKey =
  | "subway"
  | "school"
  | "hospital"
  | "supermarket"
  | "bank"
  | "park";

export type FacilityCategory = {
  key: FacilityCategoryKey;
  label: string;
  icon: string;
  total: number;
  nearest: FacilityItem | null;
  items: FacilityItem[];  // top 5
};

export type FacilitiesSection = {
  categories: FacilityCategory[];
};

// ---- Section 5: 투자 수익성 분석 ----

export type InvestmentScenario = {
  label: "보수적" | "표준" | "낙관적";
  monthlyMargin: number;    // 만원/월
  breakEvenMonths: number;  // 개월
};

export type InvestmentSection = {
  tradeType: string;
  pricePerPyeong: {
    deposit: number | null;     // 만원/평
    monthlyRent: number | null; // 만원/평
    sale: number | null;        // 만원/평
  };
  annualCost: {
    rent: number | null;        // 연간 임대료 (만원)
    maintenance: number | null; // 연간 관리비 (만원)
    total: number | null;       // 합계
  };
  surfaceYieldPercent: number | null;   // 표면 임대수익률 (매매 only, %)
  depositToSaleRatio: number | null;   // 보증금/매매가 비율 (%)
  breakEvenScenarios: InvestmentScenario[] | null;
};

// ---- Section 6: AI 입지 종합 평가 ----

export type LocationEval = {
  overallScore: number;              // 0–100
  strengths: string[];               // 3–5개
  weaknesses: string[];              // 3–5개
  recommendedIndustries: string[];   // 3–5개
  verdict: string;                   // 1–2문장 종합 평가
};

// ---- Top-level 상세분석 응답 ----

export type AnalysisResponse = {
  listing: DbNaverListing;
  building: BuildingInfoSection | null;
  households: HouseholdBreakdownSection;
  commercial: CommercialStatusSection | null;
  facilities: FacilitiesSection;
  investment: InvestmentSection;
  aiEval: LocationEval | null;
};
