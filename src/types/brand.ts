// ============================================================================
// Brand domain types — v2.0
// ============================================================================

import type { DbBrand, Industry, PriceTier, RoyaltyType } from './database';

export type { Industry, PriceTier, RoyaltyType };

/** 브랜드 카드 (리스트용 경량 타입) */
export type BrandSummary = {
  id: string;
  brand_name: string;
  company_name: string | null;
  industry: Industry;
  category: string | null;
  price_tier: PriceTier | null;
  total_stores: number | null;
  created_at: string;
};

/** 브랜드 폼 입력값 */
export type BrandFormValues = {
  // 기본 정보
  brand_name: string;
  company_name: string;
  representative: string;
  business_number: string;
  address: string;
  phone: string;

  // 업종
  industry: Industry;
  sub_industry: string;
  category: string;
  price_tier: PriceTier | '';

  // 가맹 조건
  franchise_fee: number | '';
  education_fee: number | '';
  deposit: number | '';
  royalty_type: RoyaltyType | '';
  royalty_amount: number | '';

  // 매장 규격
  standard_size_min: number | '';
  standard_size_max: number | '';
  standard_staff_count: number | '';
  territory_protection_meters: number | '';
  contract_period_years: number | '';

  // 비용 상세
  interior_cost_per_pyeong: number | '';
  equipment_cost: number | '';
  initial_supplies_cost: number | '';
  signage_cost: number | '';
  other_cost: number | '';

  // 운영
  avg_ticket_price: number | '';
  avg_monthly_revenue: number | '';
  total_stores: number | '';
  avg_close_rate: number | '';
  delivery_ratio: number | '';
  peak_hours: string;
  target_customer: string;
  min_store_requirement: string;
  notes: string;
};

export type Brand = DbBrand;

/** 정보공개서 파싱 데이터에서 브랜드 필드 자동 채우기용 */
export type BrandAutoFillFields = {
  company_name?: string;
  representative?: string;
  franchise_fee?: number;
  education_fee?: number;
  royalty_type?: RoyaltyType;
  royalty_amount?: number;
  interior_cost_per_pyeong?: number;
  standard_size_min?: number;
  standard_size_max?: number;
  territory_protection_meters?: number;
  contract_period_years?: number;
  total_stores?: number;
};
