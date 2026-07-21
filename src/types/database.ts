// ============================================================================
// FranchiseScope v2.0 — Supabase Database Types
//
// 1:1 mapping with supabase/migrations/005_v2_disclosure_analysis.sql
// Hand-written for clarity with JSONB shapes.
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Literal unions ──────────────────────────────────────────────────────────
export type UserRole              = 'user' | 'admin';
export type UserPlan              = 'free' | 'pro' | 'enterprise';
export type Industry              = '외식' | '도소매' | '서비스';
export type PriceTier             = '저가' | '중가' | '프리미엄';
export type RoyaltyType           = 'fixed' | 'rate' | 'none';
export type DisclosureParseStatus =
  | 'uploaded' | 'extracting_text' | 'parsing' | 'completed' | 'failed';
export type AnalysisStatus        =
  | 'pending' | 'collecting' | 'collected' | 'generating' | 'completed' | 'failed';
export type Recommendation        = '적극추천' | '조건부추천' | '재검토필요' | '반려';

// ── Row types ───────────────────────────────────────────────────────────────

export type DbUser = {
  id: string;
  phone: string | null;
  name: string;
  email: string | null;
  company_name: string | null;
  role: UserRole;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
}

export type User = DbUser;
export type AppUser = DbUser;
export type UserRecord = DbUser;

export type DbBrand = {
  id: string;
  user_id: string;

  // 기존 필드
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

  // v2.0 추가 필드 (migration 005)
  company_name: string | null;
  representative: string | null;
  business_number: string | null;
  address: string | null;
  phone: string | null;
  category: string | null;
  price_tier: PriceTier | null;
  royalty_type: RoyaltyType | null;
  royalty_amount: number | null;
  standard_size_min: number | null;
  standard_size_max: number | null;
  standard_staff_count: number | null;
  territory_protection_meters: number | null;
  contract_period_years: number | null;

  created_at: string;
  updated_at: string;
}

export type DbDisclosure = {
  id: string;
  brand_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  registration_number: string | null;
  registration_date: string | null;   // 'YYYY-MM-DD'
  parse_status: DisclosureParseStatus;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

export type DbDisclosureParsedData = {
  id: string;
  disclosure_id: string;
  brand_id: string;
  financials: Json | null;
  franchisee_status: Json | null;
  avg_sales: Json | null;
  fees: Json | null;
  menu: Json | null;
  contract_terms: Json | null;
  ongoing_costs: Json | null;
  legal_issues: Json | null;
  direct_stores: Json | null;
  raw_text: string | null;
  parse_confidence: number | null;    // 0.00 ~ 1.00
  manually_reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export type DbAnalysis = {
  id: string;
  user_id: string;
  brand_id: string;
  disclosure_id: string | null;
  address: string;
  latitude: number;
  longitude: number;
  target_size_pyeong: number | null;
  target_floor: string | null;
  target_rent: number | null;
  status: AnalysisStatus;
  error_message: string | null;
  total_score: number | null;
  recommendation: Recommendation | null;
  created_at: string;
  updated_at: string;
}

export type DbAnalysisCollectedData = {
  id: string;
  analysis_id: string;
  population_data: Json | null;
  commercial_data: Json | null;
  rent_data: Json | null;
  competitor_data: Json | null;
  location_data: Json | null;
  data_sources: Json | null;
  collection_completed_at: string | null;
  created_at: string;
}

export type DbAnalysisReport = {
  id: string;
  analysis_id: string;
  report_html: string | null;
  report_sections: Json | null;
  docx_file_path: string | null;
  docx_generated_at: string | null;
  llm_model: string | null;
  llm_tokens_used: number | null;
  created_at: string;
  updated_at: string;
}

export type DbPublicDataCache = {
  cache_key: string;
  provider: 'seoul' | 'sbiz' | 'google_places' | 'sgis' | (string & {});
  payload: Json;
  expires_at: string;
  created_at: string;
}

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
  parking_available?: boolean | null;
  parking_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  naver_url?: string | null;
  raw_data?: Json;
};

// ── Database generic (Supabase client) ─────────────────────────────────────
// NOTE: Insert/Update types are explicit (not Omit/Pick) — Supabase's generic
//       resolver has trouble with complex intersection types.

export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          company_name?: string | null;
          role?: UserRole;
          plan?: UserPlan;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          phone?: string | null;
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
          // v2.0 new fields (all optional — existing code may not send them)
          company_name?: string | null;
          representative?: string | null;
          business_number?: string | null;
          address?: string | null;
          phone?: string | null;
          category?: string | null;
          price_tier?: PriceTier | null;
          royalty_type?: RoyaltyType | null;
          royalty_amount?: number | null;
          standard_size_min?: number | null;
          standard_size_max?: number | null;
          standard_staff_count?: number | null;
          territory_protection_meters?: number | null;
          contract_period_years?: number | null;
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
          company_name?: string | null;
          representative?: string | null;
          business_number?: string | null;
          address?: string | null;
          phone?: string | null;
          category?: string | null;
          price_tier?: PriceTier | null;
          royalty_type?: RoyaltyType | null;
          royalty_amount?: number | null;
          standard_size_min?: number | null;
          standard_size_max?: number | null;
          standard_staff_count?: number | null;
          territory_protection_meters?: number | null;
          contract_period_years?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      disclosures: {
        Row: DbDisclosure;
        Insert: {
          id?: string;
          brand_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          registration_number?: string | null;
          registration_date?: string | null;
          parse_status?: DisclosureParseStatus;
          parse_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          file_name?: string;
          registration_number?: string | null;
          registration_date?: string | null;
          parse_status?: DisclosureParseStatus;
          parse_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      disclosure_parsed_data: {
        Row: DbDisclosureParsedData;
        Insert: {
          id?: string;
          disclosure_id: string;
          brand_id: string;
          financials?: Json | null;
          franchisee_status?: Json | null;
          avg_sales?: Json | null;
          fees?: Json | null;
          menu?: Json | null;
          contract_terms?: Json | null;
          ongoing_costs?: Json | null;
          legal_issues?: Json | null;
          direct_stores?: Json | null;
          raw_text?: string | null;
          parse_confidence?: number | null;
          manually_reviewed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          financials?: Json | null;
          franchisee_status?: Json | null;
          avg_sales?: Json | null;
          fees?: Json | null;
          menu?: Json | null;
          contract_terms?: Json | null;
          ongoing_costs?: Json | null;
          legal_issues?: Json | null;
          direct_stores?: Json | null;
          raw_text?: string | null;
          parse_confidence?: number | null;
          manually_reviewed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      analyses: {
        Row: DbAnalysis;
        Insert: {
          id?: string;
          user_id: string;
          brand_id: string;
          disclosure_id?: string | null;
          address: string;
          latitude: number;
          longitude: number;
          target_size_pyeong?: number | null;
          target_floor?: string | null;
          target_rent?: number | null;
          status?: AnalysisStatus;
          error_message?: string | null;
          total_score?: number | null;
          recommendation?: Recommendation | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          latitude?: number;
          longitude?: number;
          target_size_pyeong?: number | null;
          target_floor?: string | null;
          target_rent?: number | null;
          status?: AnalysisStatus;
          error_message?: string | null;
          total_score?: number | null;
          recommendation?: Recommendation | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_collected_data: {
        Row: DbAnalysisCollectedData;
        Insert: {
          id?: string;
          analysis_id: string;
          population_data?: Json | null;
          commercial_data?: Json | null;
          rent_data?: Json | null;
          competitor_data?: Json | null;
          location_data?: Json | null;
          data_sources?: Json | null;
          collection_completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          population_data?: Json | null;
          commercial_data?: Json | null;
          rent_data?: Json | null;
          competitor_data?: Json | null;
          location_data?: Json | null;
          data_sources?: Json | null;
          collection_completed_at?: string | null;
        };
        Relationships: [];
      };
      analysis_reports: {
        Row: DbAnalysisReport;
        Insert: {
          id?: string;
          analysis_id: string;
          report_html?: string | null;
          report_sections?: Json | null;
          docx_file_path?: string | null;
          docx_generated_at?: string | null;
          llm_model?: string | null;
          llm_tokens_used?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          report_html?: string | null;
          report_sections?: Json | null;
          docx_file_path?: string | null;
          docx_generated_at?: string | null;
          llm_model?: string | null;
          llm_tokens_used?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_data_cache: {
        Row: DbPublicDataCache;
        Insert: {
          cache_key: string;
          provider: string;
          payload: Json;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          payload?: Json;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_expired_public_data_cache: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
