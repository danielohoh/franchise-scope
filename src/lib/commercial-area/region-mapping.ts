import * as path from "path";

/**
 * 소상공인시장진흥공단 상가(상권)정보 CSV 파일 위치
 * franchise-scope/ 기준으로 한 단계 상위 디렉토리에 위치
 */
const CSV_BASE_DIR = path.resolve(
  process.cwd(),
  "..",
  "소상공인시장진흥공단_상가(상권)정보_20251231",
);

interface RegionBounds {
  /** 지역명 (파일명에 사용) */
  name: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

/**
 * 한국 17개 시도 경계 (근사값).
 * 우선순위 순서: 특별시/광역시를 앞에 배치하여 경기가 서울/인천을 흡수하지 않도록 함.
 */
const REGION_BOUNDS: readonly RegionBounds[] = [
  // 특별시·광역시 (먼저 매칭)
  { name: "서울", latMin: 37.41, latMax: 37.70, lngMin: 126.73, lngMax: 127.27 },
  { name: "부산", latMin: 34.87, latMax: 35.40, lngMin: 128.73, lngMax: 129.32 },
  { name: "대구", latMin: 35.67, latMax: 36.04, lngMin: 128.44, lngMax: 128.78 },
  { name: "인천", latMin: 37.24, latMax: 37.82, lngMin: 126.18, lngMax: 126.80 },
  { name: "광주", latMin: 35.06, latMax: 35.29, lngMin: 126.73, lngMax: 126.98 },
  { name: "대전", latMin: 36.17, latMax: 36.50, lngMin: 127.26, lngMax: 127.58 },
  { name: "울산", latMin: 35.39, latMax: 35.68, lngMin: 129.06, lngMax: 129.43 },
  { name: "세종", latMin: 36.40, latMax: 36.72, lngMin: 127.14, lngMax: 127.40 },
  // 도 (나중에 매칭 — 광역시보다 넓은 범위)
  { name: "경기", latMin: 36.89, latMax: 38.31, lngMin: 126.29, lngMax: 127.97 },
  { name: "강원", latMin: 37.00, latMax: 38.62, lngMin: 127.42, lngMax: 129.39 },
  { name: "충북", latMin: 36.29, latMax: 37.29, lngMin: 127.33, lngMax: 128.53 },
  { name: "충남", latMin: 35.89, latMax: 37.19, lngMin: 125.92, lngMax: 127.55 },
  { name: "전북", latMin: 35.38, latMax: 36.10, lngMin: 126.29, lngMax: 127.84 },
  { name: "전남", latMin: 33.91, latMax: 35.53, lngMin: 125.91, lngMax: 127.87 },
  { name: "경북", latMin: 35.55, latMax: 37.18, lngMin: 127.98, lngMax: 129.58 },
  { name: "경남", latMin: 34.56, latMax: 35.84, lngMin: 127.54, lngMax: 129.22 },
  { name: "제주", latMin: 33.10, latMax: 33.66, lngMin: 126.07, lngMax: 127.00 },
] as const;

function buildFileName(regionName: string): string {
  return path.join(
    CSV_BASE_DIR,
    `소상공인시장진흥공단_상가(상권)정보_${regionName}_202512.csv`,
  );
}

/**
 * 위경도로 해당 지역 CSV 파일 경로를 반환한다.
 * 우선순위: 특별시/광역시 > 도.
 * 경계선 근처 보완을 위해 1개 이상 반환할 수 있다.
 */
export function getRegionFilePaths(lat: number, lng: number): string[] {
  const matched: string[] = [];

  for (const region of REGION_BOUNDS) {
    if (lat >= region.latMin && lat <= region.latMax && lng >= region.lngMin && lng <= region.lngMax) {
      matched.push(buildFileName(region.name));
      // 첫 번째 매칭만으로 충분 (우선순위 정렬되어 있음)
      // 단, 경기는 서울/인천을 포함하므로 서울·인천 매칭 시 경기도 추가
      if (region.name === "서울" || region.name === "인천") {
        matched.push(buildFileName("경기"));
      }
      break;
    }
  }

  // 매칭 없으면 전체 검색 (예외 케이스)
  if (matched.length === 0) {
    // 가장 가까운 지역 찾기
    let minDist = Infinity;
    let closestRegion = REGION_BOUNDS[0];

    for (const region of REGION_BOUNDS) {
      const centerLat = (region.latMin + region.latMax) / 2;
      const centerLng = (region.lngMin + region.lngMax) / 2;
      const dist = Math.abs(lat - centerLat) + Math.abs(lng - centerLng);
      if (dist < minDist) {
        minDist = dist;
        closestRegion = region;
      }
    }

    matched.push(buildFileName(closestRegion.name));
  }

  return matched;
}
