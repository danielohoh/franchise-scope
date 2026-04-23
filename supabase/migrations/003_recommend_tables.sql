-- FranchiseScope: AI 매물 추천 기능 - 추가 테이블
-- STEP 1: naver_listings, apartment_data, recommendation_results
-- 재실행 안전 (idempotent): IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE 사용

-- =============================================
-- 1. naver_listings (네이버 부동산 수집 매물)
-- =============================================
CREATE TABLE IF NOT EXISTS public.naver_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id TEXT NOT NULL,
  region_code TEXT NOT NULL,
  region_name TEXT,
  trade_type TEXT NOT NULL,
  article_name TEXT,
  building_name TEXT,
  detail_address TEXT,
  floor_info TEXT,
  area_supply NUMERIC,
  area_exclusive NUMERIC,
  area_pyeong NUMERIC GENERATED ALWAYS AS (ROUND(area_exclusive / 3.3058, 1)) STORED,
  deposit BIGINT,
  monthly_rent BIGINT,
  sale_price BIGINT,
  maintenance_cost INTEGER,
  building_use TEXT,
  parking_available BOOLEAN DEFAULT false,
  parking_count INTEGER,
  latitude NUMERIC,
  longitude NUMERIC,
  image_url TEXT,
  naver_url TEXT,
  raw_data JSONB,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_naver_listings_user ON public.naver_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_naver_listings_region ON public.naver_listings(region_code);
CREATE INDEX IF NOT EXISTS idx_naver_listings_area ON public.naver_listings(area_pyeong);
CREATE UNIQUE INDEX IF NOT EXISTS idx_naver_listings_unique ON public.naver_listings(user_id, article_id);

ALTER TABLE public.naver_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own listings" ON public.naver_listings;
CREATE POLICY "Users can manage own listings"
  ON public.naver_listings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. apartment_data (주변 아파트 세대수 데이터)
-- =============================================
CREATE TABLE IF NOT EXISTS public.apartment_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region_code TEXT NOT NULL,
  complex_name TEXT NOT NULL,
  total_households INTEGER,
  dong_count INTEGER,
  floor_max INTEGER,
  built_year INTEGER,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_region ON public.apartment_data(region_code);
CREATE INDEX IF NOT EXISTS idx_apt_geo ON public.apartment_data(latitude, longitude);

ALTER TABLE public.apartment_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read apartment data" ON public.apartment_data;
CREATE POLICY "Authenticated users can read apartment data"
  ON public.apartment_data FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can manage apartment data" ON public.apartment_data;
CREATE POLICY "Service role can manage apartment data"
  ON public.apartment_data FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================
-- 3. recommendation_results (AI 추천 결과 저장)
-- =============================================
CREATE TABLE IF NOT EXISTS public.recommendation_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  region_code TEXT NOT NULL,
  region_name TEXT,
  prompt_text TEXT NOT NULL,
  parsed_conditions JSONB,
  matched_listings JSONB,
  result_count INTEGER DEFAULT 0,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommend_user ON public.recommendation_results(user_id);
CREATE INDEX IF NOT EXISTS idx_recommend_created ON public.recommendation_results(created_at DESC);

ALTER TABLE public.recommendation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own results" ON public.recommendation_results;
CREATE POLICY "Users can manage own results"
  ON public.recommendation_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 4. updated_at 자동 갱신 트리거
-- =============================================
DROP TRIGGER IF EXISTS update_apartment_data_updated_at ON public.apartment_data;
CREATE TRIGGER update_apartment_data_updated_at
  BEFORE UPDATE ON public.apartment_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. Haversine 거리 계산 SQL 함수
--    HAVING 대신 서브쿼리 + WHERE 사용 (PostgreSQL 호환)
-- =============================================
CREATE OR REPLACE FUNCTION nearby_apartments(
  lat NUMERIC,
  lng NUMERIC,
  radius_m NUMERIC,
  region TEXT
)
RETURNS TABLE(
  complex_name TEXT,
  total_households INTEGER,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  distance_m NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sub.complex_name,
    sub.total_households,
    sub.address,
    sub.latitude,
    sub.longitude,
    sub.distance_m
  FROM (
    SELECT
      a.complex_name,
      a.total_households,
      a.address,
      a.latitude,
      a.longitude,
      (6371000 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(lat)) * cos(radians(a.latitude)) *
          cos(radians(a.longitude) - radians(lng)) +
          sin(radians(lat)) * sin(radians(a.latitude))
        ))
      )) AS distance_m
    FROM public.apartment_data a
    WHERE
      a.region_code LIKE (region || '%')
      AND a.latitude IS NOT NULL
      AND a.longitude IS NOT NULL
  ) sub
  WHERE sub.distance_m <= radius_m
  ORDER BY sub.distance_m;
$$;
