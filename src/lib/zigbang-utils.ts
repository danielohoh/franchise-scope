/**
 * 직방 API 관련 순수 유틸리티 함수
 * collect-server/route.ts에서 공유되며 단위 테스트 대상
 */

// ── Geohash 인코더 ──────────────────────────────────────────────

/**
 * 위경도 좌표를 Geohash 문자열로 인코딩합니다.
 * 직방 API는 geohash precision=5 (약 5km×5km 범위)를 사용합니다.
 */
export function encodeGeohash(lat: number, lng: number, precision: number): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let isLng = true;
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    const range = isLng ? lngRange : latRange;
    const val = isLng ? lng : lat;
    const mid = (range[0] + range[1]) / 2;

    if (val >= mid) {
      ch |= 1 << (4 - bit);
      range[0] = mid;
    } else {
      range[1] = mid;
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

// ── 배열 청킹 ──────────────────────────────────────────────────

/**
 * 배열을 지정한 크기의 청크로 분할합니다.
 * 직방 API 100개 배치 처리 및 Supabase upsert에 사용합니다.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("size must be greater than 0");
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
