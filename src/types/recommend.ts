// ============================================
// FranchiseScope — AI 매물 추천 기능 타입 정의
// ============================================

import type { Json } from "./database";

// ---- DB Row Types ----

export type DbNaverListing = {
  id: string;
  user_id: string;
  article_id: string;
  region_code: string;
  region_name: string | null;
  trade_type: string;
  article_name: string | null;
  building_name: string | null;
  detail_address: string | null;
  floor_info: string | null;
  area_supply: number | null;
  area_exclusive: number | null;
  area_pyeong: number | null; // GENERATED ALWAYS
  deposit: number | null;
  monthly_rent: number | null;
  sale_price: number | null;
  maintenance_cost: number | null;
  building_use: string | null;
  parking_available: boolean;
  parking_count: number | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  naver_url: string | null;
  raw_data: Json;
  collected_at: string;
  created_at: string;
};

export type DbApartmentData = {
  id: string;
  region_code: string;
  complex_name: string;
  total_households: number | null;
  dong_count: number | null;
  floor_max: number | null;
  built_year: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  raw_data: Json;
  updated_at: string;
};

export type DbRecommendationResult = {
  id: string;
  user_id: string;
  region_code: string;
  region_name: string | null;
  prompt_text: string;
  parsed_conditions: ParsedConditions | null;
  matched_listings: MatchedListingRef[] | null;
  result_count: number;
  ai_summary: string | null;
  created_at: string;
};

// ---- 지역 선택 ----

export type RegionDong = {
  [dongName: string]: string; // dongName → 법정동코드
};

export type RegionGugun = {
  code: string;
  dongs: RegionDong;
};

export type RegionSido = {
  [gugunName: string]: RegionGugun;
};

export type RegionMap = {
  [sidoName: string]: RegionSido;
};

export type SelectedRegion = {
  sido: string;
  gugun: string;
  code: string; // 법정동코드
};

// ---- AI 파싱 조건 ----

export type TradeType = "매매" | "전세" | "월세" | "전체";

export type ParsedConditions = {
  minAreaPyeong: number | null;
  maxAreaPyeong: number | null;
  minHouseholds: number | null;
  radiusMeters: number;
  parkingRequired: boolean;
  buildingUse: string[] | null;
  tradeType: TradeType;
  maxDeposit: number | null;
  maxMonthlyRent: number | null;
  floorPreference: string | null;
  additionalConditions: string[] | null;
};

// ---- Chrome Extension → API 수집 입력 ----

export type NaverListingInput = {
  article_id: string;
  region_code: string;
  region_name?: string;
  trade_type: string;
  article_name?: string;
  building_name?: string;
  detail_address?: string;
  floor_info?: string;
  area_supply?: number | null;
  area_exclusive?: number | null;
  deposit?: number | null;
  monthly_rent?: number | null;
  sale_price?: number | null;
  maintenance_cost?: number | null;
  building_use?: string;
  parking_available?: boolean;
  parking_count?: number;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string;
  naver_url?: string;
  raw_data?: unknown;
};

// ---- 매칭 결과 ----

export type ApartmentSummary = {
  name: string;
  households: number;
  distance: number; // meters
};

export type MatchedListing = DbNaverListing & {
  matchScore: number; // 0-100
  matchReasons: string[];
  nearbyHouseholds: number | null;
  nearbyComplexes: ApartmentSummary[];
};

export type MatchedListingRef = {
  listing_id: string;
  article_id: string;
  match_score: number;
  match_reasons: string[];
  nearby_households: number | null;
};

// ---- API Request / Response ----

// POST /api/listings/collect
export type CollectListingsRequest = {
  listings: NaverListingInput[];
  regionCode: string;
};

export type CollectListingsResponse = {
  collected: number;
  skipped: number;
};

// GET /api/data/apartments
export type ApartmentsResponse = {
  apartments: DbApartmentData[];
  cached: boolean;
  total: number;
};

// POST /api/recommend
export type RecommendRequest = {
  regionCode: string;
  regionName?: string;
  prompt: string;
};

export type RecommendResponse = {
  result: DbRecommendationResult;
  listings: MatchedListing[];
};

// GET /api/recommend/:id
export type RecommendDetailResponse = {
  result: DbRecommendationResult;
  listings: MatchedListing[];
};

// GET /api/recommend/history
export type RecommendHistoryResponse = {
  results: DbRecommendationResult[];
  total: number;
  page: number;
  limit: number;
};

// ---- 공공데이터 API 응답 타입 ----

export type AptBasisInfo = {
  kaptCode: string;
  kaptName: string;
  kaptAddr: string;
  kaptTotHo: string; // 총 세대수 (string)
  kaptDongCnt: string; // 동수
  kaptUseDate: string; // 사용승인일
  bjdCode: string; // 법정동코드
  latitude?: string;
  longitude?: string;
};

export type AptBasisInfoResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items?: { item?: AptBasisInfo | AptBasisInfo[] };
      totalCount: number;
      pageNo: number;
      numOfRows: number;
    };
  };
};

// ---- Zustand Store 상태 타입 ----

export type CollectionStatus = "idle" | "collecting" | "done" | "error";

export type RecommendStoreState = {
  // 지역 선택
  selectedRegion: SelectedRegion | null;
  setSelectedRegion: (region: SelectedRegion | null) => void;

  // 수집 상태
  collectionStatus: CollectionStatus;
  collectedCount: number;
  lastCollectedAt: Date | null;
  setCollectionStatus: (status: CollectionStatus) => void;
  setCollectedCount: (count: number) => void;
  setLastCollectedAt: (date: Date | null) => void;

  // 서버 수집 진행상황
  progressCurrent: number;
  progressTotal: number;
  progressPage: number;
  setProgress: (current: number, total: number, page: number) => void;
  resetProgress: () => void;

  // 프롬프트 + 분석
  prompt: string;
  setPrompt: (prompt: string) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;

  // 결과
  currentResult: DbRecommendationResult | null;
  currentListings: MatchedListing[];
  setCurrentResult: (result: DbRecommendationResult | null, listings?: MatchedListing[]) => void;

  // 이력
  history: DbRecommendationResult[];
  setHistory: (history: DbRecommendationResult[]) => void;
};
