// ============================================================================
// Public Data API types — v2.0
// ============================================================================

// ── 서울시 상권분석 API ─────────────────────────────────────────────────────

/** 서울시 상권분석 API 응답 (OA-15572) */
export type SeoulCommercialApiResponse = {
  TBGIS_BZ_CMR_CUST_SERVICE: {
    list_total_count: number;
    RESULT: { CODE: string; MESSAGE: string };
    row: SeoulCommercialRow[];
  };
};

export type SeoulCommercialRow = {
  STDR_YYQU_CD: string;           // 기준 연도분기
  TRDAR_CD: string;               // 상권코드
  TRDAR_CD_NM: string;            // 상권코드명
  TRDAR_SE_CD_NM: string;         // 상권구분코드명
  SVC_INDUTY_CD: string;          // 서비스업종코드
  THMON_SELNG_AMT: number;        // 당월매출금액
  THMON_SELNG_CO: number;         // 당월매출건수
  MON_SELNG_AMT: number;          // 월요일매출금액
  TUE_SELNG_AMT: number;          // 화요일매출금액
  WED_SELNG_AMT: number;
  THU_SELNG_AMT: number;
  FRI_SELNG_AMT: number;
  SAT_SELNG_AMT: number;
  SUN_SELNG_AMT: number;
};

// ── 소상공인시장진흥공단 상권정보 API ───────────────────────────────────────

/** sbiz 업종별 상권 데이터 */
export type SbizStoreItem = {
  bizesNm: string;           // 상호명
  indsLclsNm: string;        // 상권업종 대분류명
  indsMclsNm: string;        // 상권업종 중분류명
  indsSclsNm: string;        // 상권업종 소분류명
  lnoAdr: string;            // 지번주소
  rdnmAdr: string;           // 도로명주소
  lon: string;               // 경도
  lat: string;               // 위도
};

export type SbizApiResponse = {
  body: {
    totalCount: number;
    items: {
      item: SbizStoreItem | SbizStoreItem[];
    };
  };
};

// ── SGIS 통계지리정보서비스 ─────────────────────────────────────────────────

/** SGIS 인구 데이터 (Phase 1에서는 Mock) */
export type SgisPopulationData = {
  pnu: string;              // 법정동 코드
  pop_resident: number;     // 주거인구
  pop_worker: number;       // 직장인구
  household_count: number;  // 세대수
  is_mock: boolean;
};

// ── 공공데이터 캐시 ─────────────────────────────────────────────────────────

/** 캐시 키 생성 파라미터 */
export type CacheKeyParams = {
  provider: 'seoul' | 'sbiz' | 'google_places' | 'sgis' | 'rent-index';
  endpoint: string;
  lat: number;
  lng: number;
  extra?: Record<string, string | number | null | undefined>;
};

/** 캐시 엔트리 */
export type CacheEntry<T = unknown> = {
  payload: T;
  expires_at: string;
  cache_hit: boolean;
  cached_at?: string;
};

// ── Google Places ───────────────────────────────────────────────────────────

/** Google Places Nearby Search 응답 */
export type GooglePlacesNearbyResponse = {
  places?: GooglePlaceResult[];
};

export type GooglePlaceResult = {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
};

// ── 임대시세 ────────────────────────────────────────────────────────────────

/** 서울시 상가 임대시세 API (OA-15573) */
export type SeoulRentApiResponse = {
  TBGIS_TRDAR_RENT_INFO_QTRLY: {
    list_total_count: number;
    RESULT: { CODE: string; MESSAGE: string };
    row: SeoulRentRow[];
  };
};

export type SeoulRentRow = {
  STDR_YYQU_CD: string;         // 기준 연도분기
  TRDAR_CD: string;             // 상권코드
  TRDAR_CD_NM: string;          // 상권코드명
  CLTUR_PRICE: number;          // 임대료 (천원/㎡)
  DTLS_RTNG: number;            // 환산보증금 (천원/㎡)
};
