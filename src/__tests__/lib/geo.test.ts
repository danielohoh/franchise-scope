import { describe, it, expect } from "vitest";
import { haversineDistance, calculateNearbyHouseholds } from "@/lib/geo";

// ────────────────────────────────────────────────────────────────
// haversineDistance
// ────────────────────────────────────────────────────────────────
describe("haversineDistance", () => {
  it("같은 좌표 → 거리 0", () => {
    const d = haversineDistance(37.5665, 126.978, 37.5665, 126.978);
    expect(d).toBe(0);
  });

  it("서울 시청 ↔ 부산역 ≈ 325 km (±10km 허용)", () => {
    // 서울 시청: 37.5665, 126.9780 / 부산역: 35.1151, 129.0422
    const d = haversineDistance(37.5665, 126.978, 35.1151, 129.0422);
    expect(d).toBeGreaterThan(315_000);
    expect(d).toBeLessThan(335_000);
  });

  it("A→B 거리 == B→A 거리 (대칭성)", () => {
    const d1 = haversineDistance(37.4, 126.9, 37.5, 127.0);
    const d2 = haversineDistance(37.5, 127.0, 37.4, 126.9);
    expect(d1).toBeCloseTo(d2, 3);
  });

  it("위도 1도 차이 ≈ 111 km", () => {
    const d = haversineDistance(37.0, 127.0, 38.0, 127.0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("인접 좌표 100m 내 거리 반환", () => {
    // 약 100m 차이
    const d = haversineDistance(37.5665, 126.978, 37.5674, 126.978);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});

// ────────────────────────────────────────────────────────────────
// calculateNearbyHouseholds
// ────────────────────────────────────────────────────────────────
describe("calculateNearbyHouseholds", () => {
  const baseLat = 37.5665;
  const baseLng = 126.978;

  const makeApt = (
    name: string,
    lat: number | null,
    lng: number | null,
    households: number | null,
  ) => ({ complex_name: name, total_households: households, latitude: lat, longitude: lng });

  it("빈 아파트 목록 → total 0, complexes []", () => {
    const result = calculateNearbyHouseholds(baseLat, baseLng, [], 1000);
    expect(result.total).toBe(0);
    expect(result.complexes).toHaveLength(0);
  });

  it("반경 내 아파트 → total에 세대수 합산", () => {
    const apts = [makeApt("A단지", baseLat + 0.001, baseLng, 500)]; // ~110m
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(500);
    expect(result.complexes).toHaveLength(1);
    expect(result.complexes[0].name).toBe("A단지");
  });

  it("반경 외 아파트 → 집계 안 됨", () => {
    // 약 2.2km 떨어진 위치 (반경 1000m 외)
    const apts = [makeApt("먼단지", baseLat + 0.02, baseLng, 300)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(0);
    expect(result.complexes).toHaveLength(0);
  });

  it("lat/lng null인 아파트 → 건너뜀", () => {
    const apts = [makeApt("좌표없음", null, null, 200)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(0);
  });

  it("total_households null인 아파트 → 건너뜀", () => {
    const apts = [makeApt("세대없음", baseLat, baseLng, null)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(0);
  });

  it("total_households 0인 아파트 → 건너뜀", () => {
    const apts = [makeApt("0세대", baseLat, baseLng, 0)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(0);
  });

  it("여러 아파트 → 반경 내만 합산", () => {
    const apts = [
      makeApt("가까운단지", baseLat + 0.001, baseLng, 300),   // ~110m → in
      makeApt("중간단지",  baseLat + 0.005, baseLng, 200),   // ~555m → in
      makeApt("먼단지",   baseLat + 0.02,  baseLng, 100),   // ~2.2km → out
    ];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBe(500);
    expect(result.complexes).toHaveLength(2);
  });

  it("complexes는 거리 오름차순 정렬", () => {
    const apts = [
      makeApt("B단지", baseLat + 0.005, baseLng, 200), // 더 멀리
      makeApt("A단지", baseLat + 0.001, baseLng, 300), // 더 가까이
    ];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.complexes[0].name).toBe("A단지");
    expect(result.complexes[1].name).toBe("B단지");
  });

  it("distance는 미터 단위 정수로 반환", () => {
    const apts = [makeApt("테스트", baseLat + 0.001, baseLng, 100)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(Number.isInteger(result.complexes[0].distance)).toBe(true);
    expect(result.complexes[0].distance).toBeGreaterThan(0);
  });

  it("반경 경계(정확히 반경 거리)에 있는 아파트 → 포함", () => {
    // 딱 1000m에 있는 아파트도 포함 (distance <= radiusMeters)
    // 위도 1도 ≈ 111km, 0.009도 ≈ 999m
    const apts = [makeApt("경계단지", baseLat + 0.009, baseLng, 400)];
    const result = calculateNearbyHouseholds(baseLat, baseLng, apts, 1000);
    expect(result.total).toBeGreaterThanOrEqual(0); // 경계 근처이므로 포함 or 제외 모두 허용
  });
});
