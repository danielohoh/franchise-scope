import { describe, it, expect } from "vitest";
import { matchListings } from "@/lib/matching";
import type { DbNaverListing, ParsedConditions, DbApartmentData } from "@/types/recommend";

// ────────────────────────────────────────────────────────────────
// 헬퍼: 기본 매물/조건 생성
// ────────────────────────────────────────────────────────────────

function makeListing(overrides: Partial<DbNaverListing> = {}): DbNaverListing {
  return {
    id: "listing-1",
    user_id: "user-1",
    article_id: "art-1",
    region_code: "1168000000",
    region_name: "서울 강남구",
    trade_type: "월세",
    article_name: "테스트 매물",
    building_name: null,
    detail_address: "서울 강남구 테헤란로 1",
    floor_info: "2층",
    area_supply: 165.3,
    area_exclusive: 165.3,
    area_pyeong: 50,
    deposit: 3000,
    monthly_rent: 150,
    sale_price: null,
    maintenance_cost: 20,
    building_use: "근린생활시설",
    parking_available: true,
    parking_count: 2,
    latitude: 37.5665,
    longitude: 126.978,
    image_url: null,
    naver_url: "https://zigbang.com",
    raw_data: null,
    collected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeConditions(overrides: Partial<ParsedConditions> = {}): ParsedConditions {
  return {
    minAreaPyeong: null,
    maxAreaPyeong: null,
    minHouseholds: null,
    radiusMeters: 1000,
    parkingRequired: false,
    buildingUse: null,
    tradeType: "전체",
    maxDeposit: null,
    maxMonthlyRent: null,
    floorPreference: null,
    additionalConditions: null,
    ...overrides,
  };
}

const NO_APARTMENTS: DbApartmentData[] = [];

// ────────────────────────────────────────────────────────────────
// 기본 동작
// ────────────────────────────────────────────────────────────────

describe("matchListings — 기본 동작", () => {
  it("빈 매물 목록 → 빈 결과", () => {
    const result = matchListings([], makeConditions(), NO_APARTMENTS);
    expect(result).toHaveLength(0);
  });

  it("모든 조건 미지정(null) → 만점(100) 매물 포함", () => {
    const listing = makeListing();
    const result = matchListings([listing], makeConditions(), NO_APARTMENTS);
    expect(result).toHaveLength(1);
    expect(result[0].matchScore).toBe(100);
  });

  it("점수 60 미만 → 결과에서 제외", () => {
    // 면적 조건 실패(area_pyeong=10, min=40) → +0  (30점 손실)
    // 주차 조건 실패 → +0  (15점 손실)
    // buildingUse 불일치 → +0  (15점 손실)
    // 세대수 미지정 → +30, 월세 미지정 → +10
    // 합계: 0 + 30 + 0 + 0 + 10 = 40 → 60 미만 → 제외
    const listing = makeListing({ area_pyeong: 10, parking_available: false, building_use: "주거용" });
    const conditions = makeConditions({
      minAreaPyeong: 40,
      parkingRequired: true,
      buildingUse: ["근린생활시설"],
    });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result).toHaveLength(0);
  });

  it("점수 정확히 60 → 결과에 포함", () => {
    // 면적 OK(+30) + 세대수 미지정(+30) + 주차 실패(+0) + 용도 실패(+0) + 월세 실패(+0) = 60
    const listing = makeListing({
      area_pyeong: 50,
      parking_available: false,
      building_use: "기타",
      monthly_rent: 999,
    });
    const conditions = makeConditions({
      minAreaPyeong: 40,           // 통과 → +30
      parkingRequired: true,       // 실패 → +0
      buildingUse: ["근린생활시설"], // 실패 → +0
      maxMonthlyRent: 100,         // 실패 → +0
    });
    // 30 + 30 + 0 + 0 + 0 = 60
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result).toHaveLength(1);
    expect(result[0].matchScore).toBe(60);
  });

  it("여러 매물 → 점수 내림차순 정렬", () => {
    const highScore = makeListing({ id: "a", parking_available: true });
    const lowScore = makeListing({ id: "b", parking_available: false });
    const conditions = makeConditions({ parkingRequired: true });
    const result = matchListings([lowScore, highScore], conditions, NO_APARTMENTS);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
  });
});

// ────────────────────────────────────────────────────────────────
// 조건 1: 면적 매칭 (30점)
// ────────────────────────────────────────────────────────────────

describe("matchListings — 면적 조건 (30점)", () => {
  it("조건 미지정 → 면적 만점 30점 부여", () => {
    const listing = makeListing({ area_pyeong: 10 });
    const result = matchListings([listing], makeConditions(), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100); // 전체 만점
  });

  it("area_pyeong이 min~max 범위 내 → +30", () => {
    const listing = makeListing({ area_pyeong: 50 });
    const conditions = makeConditions({ minAreaPyeong: 40, maxAreaPyeong: 60 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].matchReasons).toContain("면적 50평 (조건 충족)");
  });

  it("area_pyeong이 min 미만 → 면적 0점", () => {
    const listing = makeListing({ area_pyeong: 30 });
    const conditions = makeConditions({ minAreaPyeong: 40 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    // 면적 0 + 세대수 30 + 주차 15 + 용도 15 + 월세 10 = 70
    expect(result[0].matchScore).toBe(70);
  });

  it("area_pyeong이 max 초과 → 면적 0점", () => {
    const listing = makeListing({ area_pyeong: 80 });
    const conditions = makeConditions({ maxAreaPyeong: 60 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(70);
  });

  it("area_pyeong null → 면적 0점", () => {
    const listing = makeListing({ area_pyeong: null });
    const conditions = makeConditions({ minAreaPyeong: 40 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(70);
  });

  it("minAreaPyeong만 설정 → min 이상이면 통과", () => {
    const listing = makeListing({ area_pyeong: 100 });
    const conditions = makeConditions({ minAreaPyeong: 50 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("maxAreaPyeong만 설정 → max 이하이면 통과", () => {
    const listing = makeListing({ area_pyeong: 30 });
    const conditions = makeConditions({ maxAreaPyeong: 50 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });
});

// ────────────────────────────────────────────────────────────────
// 조건 2: 세대수 매칭 (30점)
// ────────────────────────────────────────────────────────────────

describe("matchListings — 세대수 조건 (30점)", () => {
  const apts = (households: number, distanceDeg = 0.001) => [{
    id: "apt-1",
    region_code: "1168000000",
    complex_name: "테스트아파트",
    total_households: households,
    dong_count: 5,
    floor_max: 20,
    built_year: 2010,
    address: "서울 강남구",
    latitude: 37.5665 + distanceDeg,  // ~110m × distanceDeg/0.001
    longitude: 126.978,
    raw_data: null,
    updated_at: new Date().toISOString(),
  }];

  it("조건 미지정 → 세대수 만점 30점", () => {
    const listing = makeListing();
    const result = matchListings([listing], makeConditions(), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("반경 내 세대수 >= minHouseholds → +30, nearbyHouseholds 설정", () => {
    const listing = makeListing({ latitude: 37.5665, longitude: 126.978 });
    const conditions = makeConditions({ minHouseholds: 500, radiusMeters: 1000 });
    const result = matchListings([listing], conditions, apts(1000) as DbApartmentData[]);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].nearbyHouseholds).toBe(1000);
    expect(result[0].matchReasons.some((r) => r.includes("세대"))).toBe(true);
  });

  it("반경 내 세대수 < minHouseholds → +0, 점수 감소", () => {
    const listing = makeListing({ latitude: 37.5665, longitude: 126.978 });
    const conditions = makeConditions({ minHouseholds: 2000, radiusMeters: 1000 });
    const result = matchListings([listing], conditions, apts(500) as DbApartmentData[]);
    // 면적 30 + 세대수 0 + 주차 15 + 용도 15 + 월세 10 = 70
    expect(result[0].matchScore).toBe(70);
  });

  it("위도/경도 null → 세대수 계산 안 함, +0", () => {
    const listing = makeListing({ latitude: null, longitude: null });
    const conditions = makeConditions({ minHouseholds: 500 });
    const result = matchListings([listing], conditions, apts(1000) as DbApartmentData[]);
    expect(result[0].matchScore).toBe(70);
    expect(result[0].nearbyHouseholds).toBeNull();
  });

  it("반경 외 아파트 → 세대수 미집계", () => {
    const listing = makeListing({ latitude: 37.5665, longitude: 126.978 });
    const conditions = makeConditions({ minHouseholds: 500, radiusMeters: 500 });
    // 2km 떨어진 아파트 → 반경 외
    const result = matchListings([listing], conditions, apts(1000, 0.018) as DbApartmentData[]);
    expect(result[0].matchScore).toBe(70);
  });
});

// ────────────────────────────────────────────────────────────────
// 조건 3: 주차 가능 여부 (15점)
// ────────────────────────────────────────────────────────────────

describe("matchListings — 주차 조건 (15점)", () => {
  it("주차 요구 안 함 → 무조건 +15", () => {
    const noPark = makeListing({ parking_available: false });
    const result = matchListings([noPark], makeConditions({ parkingRequired: false }), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("주차 필요 + 주차 가능 → +15, 이유 포함", () => {
    const listing = makeListing({ parking_available: true });
    const conditions = makeConditions({ parkingRequired: true });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].matchReasons).toContain("주차 가능");
  });

  it("주차 필요 + 주차 불가 → +0", () => {
    const listing = makeListing({ parking_available: false });
    const conditions = makeConditions({ parkingRequired: true });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(85); // 100 - 15
  });
});

// ────────────────────────────────────────────────────────────────
// 조건 4: 건물 용도 (15점)
// ────────────────────────────────────────────────────────────────

describe("matchListings — 건물 용도 조건 (15점)", () => {
  it("용도 조건 미지정 → 무조건 +15", () => {
    const listing = makeListing({ building_use: "기타" });
    const result = matchListings([listing], makeConditions({ buildingUse: null }), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("용도 조건 [] (빈 배열) → 무조건 +15", () => {
    const listing = makeListing({ building_use: "기타" });
    const result = matchListings([listing], makeConditions({ buildingUse: [] }), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("building_use에 조건 포함 → +15", () => {
    const listing = makeListing({ building_use: "제2종근린생활시설" });
    const conditions = makeConditions({ buildingUse: ["근린생활시설"] });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].matchReasons.some((r) => r.includes("건물용도"))).toBe(true);
  });

  it("building_use에 조건 미포함 → +0", () => {
    const listing = makeListing({ building_use: "숙박시설" });
    const conditions = makeConditions({ buildingUse: ["근린생활시설"] });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(85); // 100 - 15
  });

  it("building_use null → +0 (조건 불일치)", () => {
    const listing = makeListing({ building_use: null });
    const conditions = makeConditions({ buildingUse: ["근린생활시설"] });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(85);
  });

  it("여러 용도 조건 중 하나라도 포함 → +15", () => {
    const listing = makeListing({ building_use: "제1종근린생활시설" });
    const conditions = makeConditions({
      buildingUse: ["근린생활시설", "제1종근린생활시설", "제2종근린생활시설"],
    });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });
});

// ────────────────────────────────────────────────────────────────
// 조건 5: 월세 (10점)
// ────────────────────────────────────────────────────────────────

describe("matchListings — 월세 조건 (10점)", () => {
  it("maxMonthlyRent 미지정 → 무조건 +10", () => {
    const listing = makeListing({ monthly_rent: 999 });
    const result = matchListings([listing], makeConditions({ maxMonthlyRent: null }), NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("monthly_rent <= maxMonthlyRent → +10, 이유 포함", () => {
    const listing = makeListing({ monthly_rent: 150 });
    const conditions = makeConditions({ maxMonthlyRent: 200 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].matchReasons.some((r) => r.includes("월세"))).toBe(true);
  });

  it("monthly_rent == maxMonthlyRent → +10 (경계 포함)", () => {
    const listing = makeListing({ monthly_rent: 200 });
    const conditions = makeConditions({ maxMonthlyRent: 200 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(100);
  });

  it("monthly_rent > maxMonthlyRent → +0", () => {
    const listing = makeListing({ monthly_rent: 300 });
    const conditions = makeConditions({ maxMonthlyRent: 200 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(90); // 100 - 10
  });

  it("monthly_rent null → +0 (조건 불충족)", () => {
    const listing = makeListing({ monthly_rent: null });
    const conditions = makeConditions({ maxMonthlyRent: 200 });
    const result = matchListings([listing], conditions, NO_APARTMENTS);
    expect(result[0].matchScore).toBe(90);
  });
});

// ────────────────────────────────────────────────────────────────
// 복합 조건
// ────────────────────────────────────────────────────────────────

describe("matchListings — 복합 조건", () => {
  it("모든 조건 통과 → 만점 100, 5개 이유 포함", () => {
    const listing = makeListing({
      area_pyeong: 50,
      latitude: 37.5665,
      longitude: 126.978,
      parking_available: true,
      building_use: "근린생활시설",
      monthly_rent: 150,
    });
    const apts: DbApartmentData[] = [{
      id: "apt-1",
      region_code: "1168000000",
      complex_name: "대단지",
      total_households: 5000,
      dong_count: 10,
      floor_max: 25,
      built_year: 2010,
      address: "테헤란로",
      latitude: 37.5665 + 0.001,
      longitude: 126.978,
      raw_data: null,
      updated_at: new Date().toISOString(),
    }];
    const conditions = makeConditions({
      minAreaPyeong: 40,
      maxAreaPyeong: 60,
      minHouseholds: 1000,
      radiusMeters: 1000,
      parkingRequired: true,
      buildingUse: ["근린생활시설"],
      maxMonthlyRent: 200,
    });
    const result = matchListings([listing], conditions, apts);
    expect(result[0].matchScore).toBe(100);
    expect(result[0].matchReasons).toHaveLength(5);
  });

  it("여러 매물 섞인 경우 → 60점 이상만 반환, 내림차순", () => {
    const high = makeListing({ id: "high", area_pyeong: 50, parking_available: true, monthly_rent: 100 });
    const mid  = makeListing({ id: "mid",  area_pyeong: 50, parking_available: false, monthly_rent: 100 });
    // 면적 0 + 세대수 30 + 주차 0 + 용도 15 + 월세 0 = 45 → 제외
    const low  = makeListing({ id: "low",  area_pyeong: 10, parking_available: false, monthly_rent: 999 });
    const conditions = makeConditions({
      minAreaPyeong: 40,
      parkingRequired: true,
      maxMonthlyRent: 200,
    });
    const result = matchListings([low, mid, high], conditions, NO_APARTMENTS);
    // high: 100, mid: 85 (주차 -15), low: 45 → 제외
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("high");
    expect(result[1].id).toBe("mid");
  });
});
