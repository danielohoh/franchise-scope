-- FranchiseScope Initial Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. users 테이블 (Supabase auth.users와 연동)
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(15) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  company_name VARCHAR(200),
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. brands 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 필수 입력
  brand_name VARCHAR(200) NOT NULL,
  industry VARCHAR(100) NOT NULL CHECK (industry IN ('치킨', '카페', '한식', '분식', '피자·햄버거', '편의점', '서비스업', '기타')),
  sub_industry VARCHAR(100),
  avg_store_size_pyeong DECIMAL(6,1),
  franchise_fee BIGINT,
  education_fee BIGINT,
  deposit BIGINT,

  -- 선택 입력
  logo_url TEXT,
  interior_cost_per_pyeong BIGINT,
  equipment_cost BIGINT,
  initial_supplies_cost BIGINT,
  signage_cost BIGINT,
  other_cost BIGINT,
  royalty_rate DECIMAL(5,2),
  ad_contribution_rate DECIMAL(5,2),
  supply_cost_rate DECIMAL(5,2),
  avg_ticket_price INTEGER,
  avg_monthly_revenue BIGINT,
  min_store_requirement TEXT,
  target_customer VARCHAR(200),
  delivery_ratio DECIMAL(5,2),
  peak_hours VARCHAR(200),
  total_stores INTEGER,
  avg_close_rate DECIMAL(5,2),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 3. prospects 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,

  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15),
  email VARCHAR(255),
  age_group VARCHAR(20) CHECK (age_group IN ('20대', '30대', '40대', '50대', '60대+')),
  investment_budget BIGINT,
  experience VARCHAR(200),
  preferred_region TEXT,
  consultation_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'consulting', 'report_requested', 'contracted', 'rejected')),
  memo TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 4. reports 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,

  -- 입력 정보
  address TEXT NOT NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),

  -- AI 수집 데이터
  collected_data JSONB,
  analysis_result JSONB,

  -- 보고서 결과
  report_title VARCHAR(500),
  recommendation VARCHAR(50) CHECK (recommendation IN ('적극추천', '조건부추천', '재검토필요', '반려')),
  total_score INTEGER CHECK (total_score >= 0 AND total_score <= 100),
  file_url TEXT,
  file_name VARCHAR(500),

  -- 상태 관리
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collecting', 'analyzing', 'generating', 'completed', 'failed')),
  error_message TEXT,
  llm_provider VARCHAR(50),
  llm_model VARCHAR(100),
  generation_time_seconds INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 5. updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 6. RLS (Row Level Security) 활성화
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. RLS 정책
-- =============================================

-- users: 자기 자신만 조회/수정 가능
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT
  WITH CHECK (true); -- service_role key로만 INSERT (API Route에서 처리)

-- brands: 자기 데이터만 CRUD
CREATE POLICY "Users can CRUD own brands"
  ON public.brands FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- prospects: 자기 데이터만 CRUD
CREATE POLICY "Users can CRUD own prospects"
  ON public.prospects FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- reports: 자기 데이터만 CRUD
CREATE POLICY "Users can CRUD own reports"
  ON public.reports FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- 8. 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON public.prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_recommendation ON public.reports(recommendation);
CREATE INDEX IF NOT EXISTS idx_reports_prospect_id ON public.reports(prospect_id);

-- =============================================
-- 9. Storage 버킷 설정 (별도 Supabase Storage 설정 필요)
-- =============================================
-- Supabase Dashboard → Storage → New Bucket
-- 버킷명: "reports" (private)
-- 버킷명: "logos" (public)

-- Storage policy for reports bucket (RLS)
-- INSERT: auth.uid() = user_id (파일명 패턴으로 구분)
-- SELECT: 자기 파일만
