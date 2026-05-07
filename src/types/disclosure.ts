// ============================================================================
// Disclosure (정보공개서) domain types — v2.0
// ============================================================================

import type { DbDisclosure, DbDisclosureParsedData, DisclosureParseStatus } from './database';

export type { DisclosureParseStatus };
export type Disclosure = DbDisclosure;
export type DisclosureParsedData = DbDisclosureParsedData;

// ── 파싱 섹션별 JSONB 구조 ──────────────────────────────────────────────────

/** 신뢰도 래퍼 — 모든 추출 필드에 적용 */
export type ConfidenceField<T> = {
  value: T;
  confidence: number; // 0.0 ~ 1.0
  source_text?: string; // 원문 발췌
};

/** 재무제표 1개년 */
export type FinancialYear = {
  year: number;
  revenue: number | null; // 매출액 (천원)
  operating_profit: number | null; // 영업이익 (천원)
  net_income: number | null; // 당기순이익 (천원)
  total_assets: number | null; // 자산총계 (천원)
  total_liabilities: number | null; // 부채총계 (천원)
};

/** 재무제표 3개년 */
export type ParsedFinancials = {
  years: FinancialYear[];
  _confidence?: number;
};

/** 가맹점 연도별 현황 */
export type FranchiseeYear = {
  year: number;
  start: number; // 기초 점포수
  new_open: number; // 신규 개점
  terminated: number; // 계약 종료
  cancelled: number; // 계약 해지
  transferred: number; // 양도양수
  end: number; // 기말 점포수
};

/** 지역별 가맹점 수 */
export type FranchiseeByRegion = {
  region: string;
  count: number;
};

/** 가맹점 현황 */
export type ParsedFranchiseeStatus = {
  years: FranchiseeYear[];
  by_region: FranchiseeByRegion[];
  avg_operation_days?: number;
  _confidence?: number;
};

/** 지역별 평균 매출 */
export type AvgSalesByRegion = {
  region: string;
  count: number;
  calculated_count: number;
  avg_annual: number; // 연간 평균 (천원)
  per_3_3sqm: number; // 3.3㎡당 평균 (천원)
  max: number | null;
  min: number | null;
};

/** 평균 매출 현황 */
export type ParsedAvgSales = {
  year: number;
  total: AvgSalesByRegion;
  by_region: AvgSalesByRegion[];
  _confidence?: number;
};

/** 로열티 정보 */
export type ParsedRoyalty = {
  type: 'fixed' | 'rate' | 'none';
  amount: number; // fixed: 원/월, rate: %
  description: string | null;
};

/** 개점 비용 */
export type OpeningCosts = {
  interior: number | null; // 인테리어
  signage: number | null; // 간판
  equipment_min: number | null; // 주방설비 최소
  equipment_max: number | null; // 주방설비 최대
  promotion: number | null; // 홍보비
  initial_supplies: number | null; // 초도물품
  pos: number | null; // POS
  total_min: number | null;
  total_max: number | null;
  base_size_sqm: number | null; // 기준 면적 (㎡)
  note: string | null;
};

/** 가맹비/로열티 전체 */
export type ParsedFees = {
  franchise_fee: number | null; // 가맹비 (원)
  education_fee: number | null; // 교육비 (원)
  deposit: number | null; // 보증금 (원)
  royalty: ParsedRoyalty | null;
  opening_costs: OpeningCosts | null;
  _confidence?: number;
};

/** 메뉴 아이템 */
export type MenuItem = {
  name_kr: string;
  name_en?: string;
  price: number;
  price_ice?: number;
  price_hot?: number;
  note?: string;
};

/** 메뉴 카테고리 */
export type MenuCategory = {
  name: string;
  items: MenuItem[];
};

/** 메뉴 전체 */
export type ParsedMenu = {
  categories: MenuCategory[];
  _confidence?: number;
};

/** 계약 조건 */
export type ParsedContractTerms = {
  contract_period?: string; // 예: "2년"
  renewal_period?: string; // 예: "1년씩"
  territory_meters?: number;
  operating_hours?: string;
  operating_days?: string;
  non_compete?: string;
  _confidence?: number;
};

/** 법 위반 사실 */
export type ParsedLegalIssues = {
  has_issues: boolean;
  details: string | null;
  _confidence?: number;
};

/** 파싱 완료된 정보공개서 전체 구조 */
export type DisclosureParsedSections = {
  financials: ParsedFinancials | null;
  franchisee_status: ParsedFranchiseeStatus | null;
  avg_sales: ParsedAvgSales | null;
  fees: ParsedFees | null;
  menu: ParsedMenu | null;
  contract_terms: ParsedContractTerms | null;
  legal_issues: ParsedLegalIssues | null;
};

/** 파싱 진행 상태 (프론트엔드 UI용) */
export type ParseProgress = {
  overall: DisclosureParseStatus;
  sections: {
    text_extraction: 'pending' | 'running' | 'done' | 'failed';
    financials: 'pending' | 'running' | 'done' | 'failed';
    franchisees: 'pending' | 'running' | 'done' | 'failed';
    fees: 'pending' | 'running' | 'done' | 'failed';
    sales: 'pending' | 'running' | 'done' | 'failed';
    menu: 'pending' | 'running' | 'done' | 'failed';
    contract: 'pending' | 'running' | 'done' | 'failed';
  };
};
