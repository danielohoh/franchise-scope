-- =============================================================================
-- 005_v2_disclosure_analysis.sql
-- AI 상권분석 SaaS v2.0 — 전면 리빌드 마이그레이션
--
-- 변경 요약:
--   1) 폐기 테이블 DROP: prospects, reports, naver_listings, apartment_data,
--      recommendation_results, consultation_links, consultation_sessions,
--      chat_messages, knowledge_docs
--   2) brands 테이블 컬럼 확장 (PRD §브랜드 + 정보공개서 자동채우기)
--   3) 신규 테이블: disclosures, disclosure_parsed_data,
--      analyses, analysis_collected_data, analysis_reports, public_data_cache
--   4) Storage 버킷: disclosures (private), reports (private), logos (public)
--   5) RLS 정책 재정의
-- =============================================================================

SET client_min_messages TO WARNING;

-- =============================================================================
-- 1. 폐기 테이블 삭제 (의존성 역순)
-- =============================================================================
DROP TABLE IF EXISTS public.chat_messages          CASCADE;
DROP TABLE IF EXISTS public.consultation_sessions  CASCADE;
DROP TABLE IF EXISTS public.consultation_links     CASCADE;
DROP TABLE IF EXISTS public.knowledge_docs         CASCADE;
DROP TABLE IF EXISTS public.recommendation_results CASCADE;
DROP TABLE IF EXISTS public.naver_listings         CASCADE;
DROP TABLE IF EXISTS public.apartment_data         CASCADE;
DROP TABLE IF EXISTS public.reports                CASCADE;
DROP TABLE IF EXISTS public.prospects              CASCADE;

DROP FUNCTION IF EXISTS public.nearby_apartments(NUMERIC, NUMERIC, NUMERIC, TEXT) CASCADE;

-- =============================================================================
-- 2. brands 테이블 확장
--    기존 컬럼 보존, PRD 추가 컬럼만 ADD COLUMN IF NOT EXISTS
-- =============================================================================
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS company_name                TEXT,
  ADD COLUMN IF NOT EXISTS representative              TEXT,
  ADD COLUMN IF NOT EXISTS business_number             TEXT,
  ADD COLUMN IF NOT EXISTS address                     TEXT,
  ADD COLUMN IF NOT EXISTS phone                       TEXT,
  ADD COLUMN IF NOT EXISTS category                    TEXT,
  ADD COLUMN IF NOT EXISTS price_tier                  TEXT
    CHECK (price_tier IS NULL OR price_tier IN ('저가', '중가', '프리미엄')),
  ADD COLUMN IF NOT EXISTS royalty_type                TEXT
    CHECK (royalty_type IS NULL OR royalty_type IN ('fixed', 'rate', 'none')),
  ADD COLUMN IF NOT EXISTS royalty_amount              BIGINT,
  ADD COLUMN IF NOT EXISTS standard_size_min           INTEGER,
  ADD COLUMN IF NOT EXISTS standard_size_max           INTEGER,
  ADD COLUMN IF NOT EXISTS standard_staff_count        INTEGER,
  ADD COLUMN IF NOT EXISTS territory_protection_meters INTEGER,
  ADD COLUMN IF NOT EXISTS contract_period_years       INTEGER;

CREATE INDEX IF NOT EXISTS idx_brands_business_number ON public.brands(business_number);
CREATE INDEX IF NOT EXISTS idx_brands_category        ON public.brands(category);

-- =============================================================================
-- 3. disclosures (정보공개서 메타)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.disclosures (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID         NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id             UUID         NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,

  file_name           TEXT         NOT NULL,
  file_path           TEXT         NOT NULL,
  file_size           BIGINT       NOT NULL CHECK (file_size > 0),

  registration_number TEXT,
  registration_date   DATE,

  parse_status        TEXT         NOT NULL DEFAULT 'uploaded'
    CHECK (parse_status IN ('uploaded', 'extracting_text', 'parsing', 'completed', 'failed')),
  parse_error         TEXT,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclosures_brand_id     ON public.disclosures(brand_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_user_id      ON public.disclosures(user_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_parse_status ON public.disclosures(parse_status);

CREATE TRIGGER trg_disclosures_updated_at BEFORE UPDATE ON public.disclosures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. disclosure_parsed_data (PDF에서 추출한 구조화 JSON)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.disclosure_parsed_data (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  disclosure_id       UUID         NOT NULL UNIQUE REFERENCES public.disclosures(id) ON DELETE CASCADE,
  brand_id            UUID         NOT NULL REFERENCES public.brands(id)             ON DELETE CASCADE,

  financials          JSONB,
  franchisee_status   JSONB,
  avg_sales           JSONB,
  fees                JSONB,
  menu                JSONB,
  contract_terms      JSONB,
  ongoing_costs       JSONB,
  legal_issues        JSONB,
  direct_stores       JSONB,

  raw_text            TEXT,
  parse_confidence    DECIMAL(3,2)
    CHECK (parse_confidence IS NULL OR (parse_confidence >= 0 AND parse_confidence <= 1)),
  manually_reviewed   BOOLEAN      NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpd_disclosure_id ON public.disclosure_parsed_data(disclosure_id);
CREATE INDEX IF NOT EXISTS idx_dpd_brand_id      ON public.disclosure_parsed_data(brand_id);

CREATE TRIGGER trg_dpd_updated_at BEFORE UPDATE ON public.disclosure_parsed_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. analyses (상권분석 요청 — 1 row per request)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analyses (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  brand_id            UUID          NOT NULL REFERENCES public.brands(id)      ON DELETE RESTRICT,
  disclosure_id       UUID          REFERENCES public.disclosures(id)           ON DELETE SET NULL,

  address             TEXT          NOT NULL,
  latitude            DECIMAL(10,7) NOT NULL,
  longitude           DECIMAL(10,7) NOT NULL,

  target_size_pyeong  INTEGER,
  target_floor        TEXT,
  target_rent         BIGINT,

  status              TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'collecting', 'collected', 'generating', 'completed', 'failed')),
  error_message       TEXT,

  total_score         DECIMAL(5,2)  CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)),
  recommendation      TEXT          CHECK (recommendation IS NULL OR recommendation IN ('적극추천', '조건부추천', '재검토필요', '반려')),

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_id    ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_brand_id   ON public.analyses(brand_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status     ON public.analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);

CREATE TRIGGER trg_analyses_updated_at BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. analysis_collected_data (공공API 수집 원본 JSON)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_collected_data (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id              UUID         NOT NULL UNIQUE REFERENCES public.analyses(id) ON DELETE CASCADE,

  population_data          JSONB,
  commercial_data          JSONB,
  rent_data                JSONB,
  competitor_data          JSONB,
  location_data            JSONB,
  data_sources             JSONB,

  collection_completed_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acd_analysis_id ON public.analysis_collected_data(analysis_id);

-- =============================================================================
-- 7. analysis_reports (LLM 생성 보고서 + DOCX)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_reports (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id          UUID         NOT NULL UNIQUE REFERENCES public.analyses(id) ON DELETE CASCADE,

  report_html          TEXT,
  report_sections      JSONB,
  docx_file_path       TEXT,
  docx_generated_at    TIMESTAMPTZ,

  llm_model            TEXT,
  llm_tokens_used      INTEGER,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_analysis_id ON public.analysis_reports(analysis_id);

CREATE TRIGGER trg_ar_updated_at BEFORE UPDATE ON public.analysis_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 8. public_data_cache (공공API 캐시 — 24h TTL)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.public_data_cache (
  cache_key   TEXT         PRIMARY KEY,
  provider    TEXT         NOT NULL,
  payload     JSONB        NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdc_provider   ON public.public_data_cache(provider);
CREATE INDEX IF NOT EXISTS idx_pdc_expires_at ON public.public_data_cache(expires_at);

-- =============================================================================
-- 9. RLS 정책
-- =============================================================================

ALTER TABLE public.disclosures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disclosures_owner_all ON public.disclosures;
CREATE POLICY disclosures_owner_all ON public.disclosures
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.disclosure_parsed_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpd_owner_all ON public.disclosure_parsed_data;
CREATE POLICY dpd_owner_all ON public.disclosure_parsed_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.disclosures d
      WHERE d.id = disclosure_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.disclosures d
      WHERE d.id = disclosure_id AND d.user_id = auth.uid()
    )
  );

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analyses_owner_all ON public.analyses;
CREATE POLICY analyses_owner_all ON public.analyses
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.analysis_collected_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acd_owner_all ON public.analysis_collected_data;
CREATE POLICY acd_owner_all ON public.analysis_collected_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  );

ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_owner_all ON public.analysis_reports;
CREATE POLICY ar_owner_all ON public.analysis_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  );

ALTER TABLE public.public_data_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdc_authenticated_read ON public.public_data_cache;
CREATE POLICY pdc_authenticated_read ON public.public_data_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- service_role bypasses RLS, so no need for a separate write policy

-- =============================================================================
-- 10. Storage 버킷
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('disclosures', 'disclosures', false, 20971520, ARRAY['application/pdf']),
  ('reports',     'reports',     false, 52428800, NULL),
  ('logos',       'logos',       true,  2097152,  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS
DROP POLICY IF EXISTS "disclosures_owner_select" ON storage.objects;
CREATE POLICY "disclosures_owner_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'disclosures' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "disclosures_owner_insert" ON storage.objects;
CREATE POLICY "disclosures_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'disclosures' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "disclosures_owner_delete" ON storage.objects;
CREATE POLICY "disclosures_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'disclosures' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reports_owner_select" ON storage.objects;
CREATE POLICY "reports_owner_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reports_owner_insert" ON storage.objects;
CREATE POLICY "reports_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_owner_write" ON storage.objects;
CREATE POLICY "logos_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- 11. 캐시 만료 청소 함수
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_public_data_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.public_data_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
