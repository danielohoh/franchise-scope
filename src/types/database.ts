// ============================================
// FranchiseScope — Supabase Database Types
// Supabase PostgreSQL 스키마 기반 TypeScript 타입
// ============================================

// ---- Enum Types ----
// Json: Supabase JSONB 컬럼 타입
// 주의: 재귀 타입은 TypeScript 복잡도 한계로 Supabase 제네릭 추론을 깨뜨림
// unknown을 사용하고, 실제 사용처에서 명시적 캐스팅 적용
export type Json = unknown;

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "pro" | "enterprise";
export type Industry =
  | "치킨"
  | "카페"
  | "한식"
  | "분식"
  | "피자·햄버거"
  | "편의점"
  | "서비스업"
  | "기타";
export type ProspectStatus =
  | "inquiry"
  | "consulting"
  | "report_requested"
  | "contracted"
  | "rejected";
export type ReportStatus =
  | "pending"
  | "collecting"
  | "analyzing"
  | "generating"
  | "completed"
  | "failed";
export type Recommendation = "적극추천" | "조건부추천" | "재검토필요" | "반려";
export type AgeGroup = "20대" | "30대" | "40대" | "50대" | "60대+";

// ---- Row Types ----

export type DbUser = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  company_name: string | null;
  role: UserRole;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
}

export type User = DbUser;

export type DbBrand = {
  id: string;
  user_id: string;
  brand_name: string;
  industry: Industry;
  sub_industry: string | null;
  avg_store_size_pyeong: number | null;
  franchise_fee: number | null;
  education_fee: number | null;
  deposit: number | null;
  logo_url: string | null;
  interior_cost_per_pyeong: number | null;
  equipment_cost: number | null;
  initial_supplies_cost: number | null;
  signage_cost: number | null;
  other_cost: number | null;
  royalty_rate: number | null;
  ad_contribution_rate: number | null;
  supply_cost_rate: number | null;
  avg_ticket_price: number | null;
  avg_monthly_revenue: number | null;
  min_store_requirement: string | null;
  target_customer: string | null;
  delivery_ratio: number | null;
  peak_hours: string | null;
  total_stores: number | null;
  avg_close_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DbProspect = {
  id: string;
  user_id: string;
  brand_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  age_group: AgeGroup | null;
  investment_budget: number | null;
  experience: string | null;
  preferred_region: string | null;
  consultation_date: string | null;
  status: ProspectStatus;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type DbReport = {
  id: string;
  user_id: string;
  brand_id: string | null;
  prospect_id: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  collected_data: Json | null;
  analysis_result: Json | null;
  report_title: string | null;
  recommendation: Recommendation | null;
  total_score: number | null;
  file_url: string | null;
  file_name: string | null;
  status: ReportStatus;
  error_message: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  generation_time_seconds: number | null;
  created_at: string;
  updated_at: string;
}

// ---- Collected Data (pipeline에서 수집하는 원본 데이터) ----

/** 사용자가 직접 입력한 임대 조건 (원 단위). null = 미입력 → AI 추정 */
export interface PropertyInput {
  deposit: number | null;
  monthly_rent: number | null;
  maintenance_fee: number | null;
}

export interface CollectedData {
  geocode: {
    lat: number;
    lng: number;
    formatted_address: string;
  };
  competitors: CompetitorRaw[];
  population: PopulationData;
  /** 사용자 입력 임대 조건 (없으면 AI가 상권 시세로 추정) */
  property?: PropertyInput;
}

export interface CompetitorRaw {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  rating: number | null;
  review_count: number;
  is_open: boolean | null;
  place_id: string;
  type: "프랜차이즈" | "개인점";
}

export interface PopulationData {
  radius_500m: PopulationRadius;
  radius_1km: PopulationRadius;
  radius_2km: PopulationRadius;
  core_age_group: string;
  gender_ratio: string;
  commercial_area_type: string;
  hourly_traffic: HourlyTraffic;
  is_mock?: boolean;
}

export interface PopulationRadius {
  residential: number;
  households: number;
  workers: number;
}

export interface HourlyTraffic {
  morning: TrafficByDay;
  lunch: TrafficByDay;
  afternoon: TrafficByDay;
  evening: TrafficByDay;
  night: TrafficByDay;
}

export interface TrafficByDay {
  weekday: number;
  weekend: number;
}

// ---- Database Schema (Supabase 클라이언트 타입) ----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: {
          id: string;
          phone: string;
          name: string;
          email?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: UserPlan;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          phone?: string;
          name?: string;
          email?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: UserPlan;
          updated_at?: string;
        };
        Relationships: [];
      };
      brands: {
        Row: DbBrand;
        Insert: {
          id?: string;
          user_id: string;
          brand_name: string;
          industry: Industry;
          sub_industry?: string | null;
          avg_store_size_pyeong?: number | null;
          franchise_fee?: number | null;
          education_fee?: number | null;
          deposit?: number | null;
          logo_url?: string | null;
          interior_cost_per_pyeong?: number | null;
          equipment_cost?: number | null;
          initial_supplies_cost?: number | null;
          signage_cost?: number | null;
          other_cost?: number | null;
          royalty_rate?: number | null;
          ad_contribution_rate?: number | null;
          supply_cost_rate?: number | null;
          avg_ticket_price?: number | null;
          avg_monthly_revenue?: number | null;
          min_store_requirement?: string | null;
          target_customer?: string | null;
          delivery_ratio?: number | null;
          peak_hours?: string | null;
          total_stores?: number | null;
          avg_close_rate?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          brand_name?: string;
          industry?: Industry;
          sub_industry?: string | null;
          avg_store_size_pyeong?: number | null;
          franchise_fee?: number | null;
          education_fee?: number | null;
          deposit?: number | null;
          logo_url?: string | null;
          interior_cost_per_pyeong?: number | null;
          equipment_cost?: number | null;
          initial_supplies_cost?: number | null;
          signage_cost?: number | null;
          other_cost?: number | null;
          royalty_rate?: number | null;
          ad_contribution_rate?: number | null;
          supply_cost_rate?: number | null;
          avg_ticket_price?: number | null;
          avg_monthly_revenue?: number | null;
          min_store_requirement?: string | null;
          target_customer?: string | null;
          delivery_ratio?: number | null;
          peak_hours?: string | null;
          total_stores?: number | null;
          avg_close_rate?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      prospects: {
        Row: DbProspect;
        Insert: {
          id?: string;
          user_id: string;
          brand_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          age_group?: AgeGroup | null;
          investment_budget?: number | null;
          experience?: string | null;
          preferred_region?: string | null;
          consultation_date?: string | null;
          status?: ProspectStatus;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string | null;
          name?: string;
          phone?: string | null;
          email?: string | null;
          age_group?: AgeGroup | null;
          investment_budget?: number | null;
          experience?: string | null;
          preferred_region?: string | null;
          consultation_date?: string | null;
          status?: ProspectStatus;
          memo?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: DbReport;
        Insert: {
          id?: string;
          user_id: string;
          brand_id?: string | null;
          prospect_id?: string | null;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          collected_data?: Json | null;
          analysis_result?: Json | null;
          report_title?: string | null;
          recommendation?: Recommendation | null;
          total_score?: number | null;
          file_url?: string | null;
          file_name?: string | null;
          status?: ReportStatus;
          error_message?: string | null;
          llm_provider?: string | null;
          llm_model?: string | null;
          generation_time_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          collected_data?: Json | null;
          analysis_result?: Json | null;
          report_title?: string | null;
          recommendation?: Recommendation | null;
          total_score?: number | null;
          file_url?: string | null;
          file_name?: string | null;
          status?: ReportStatus;
          error_message?: string | null;
          llm_provider?: string | null;
          llm_model?: string | null;
          generation_time_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience aliases
export type AppUser = DbUser;
export type UserRecord = DbUser;

// ---- New Tables: AI 매물 추천 기능 ----
// (types/recommend.ts에서 전체 정의 — 여기서는 Database 스키마 확장만)

export type DbNaverListingInsert = {
  user_id: string;
  article_id: string;
  region_code: string;
  region_name?: string | null;
  trade_type: string;
  article_name?: string | null;
  building_name?: string | null;
  detail_address?: string | null;
  floor_info?: string | null;
  area_supply?: number | null;
  area_exclusive?: number | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  sale_price?: number | null;
  maintenance_cost?: number | null;
  building_use?: string | null;
  parking_available?: boolean;
  parking_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  naver_url?: string | null;
  raw_data?: Json;
};
