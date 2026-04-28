import { describe, it, expect } from "vitest";
import { encodeGeohash, chunkArray } from "@/lib/zigbang-utils";

// ────────────────────────────────────────────────────────────────
// encodeGeohash
// ────────────────────────────────────────────────────────────────
describe("encodeGeohash", () => {
  it("precision=5 → 5자리 문자열 반환", () => {
    const hash = encodeGeohash(37.5665, 126.978, 5);
    expect(hash).toHaveLength(5);
  });

  it("precision=6 → 6자리 문자열 반환", () => {
    const hash = encodeGeohash(37.5665, 126.978, 6);
    expect(hash).toHaveLength(6);
  });

  it("precision=1 → 1자리 문자열 반환", () => {
    const hash = encodeGeohash(37.5665, 126.978, 1);
    expect(hash).toHaveLength(1);
  });

  it("서울 중심 좌표 → 'wydm' 으로 시작 (precision=4)", () => {
    // 서울 시청: 37.5665, 126.9780
    const hash = encodeGeohash(37.5665, 126.978, 4);
    expect(hash).toBe("wydm");
  });

  it("동일 좌표 → 동일 해시", () => {
    const h1 = encodeGeohash(37.4101, 126.6783, 5);
    const h2 = encodeGeohash(37.4101, 126.6783, 5);
    expect(h1).toBe(h2);
  });

  it("다른 좌표 → 다른 해시 (precision=5)", () => {
    const seoul = encodeGeohash(37.5665, 126.978, 5);
    const busan = encodeGeohash(35.1151, 129.0422, 5);
    expect(seoul).not.toBe(busan);
  });

  it("BASE32 문자(0-9,b-z 단 a,i,l,o 제외)만 포함", () => {
    const valid = new Set("0123456789bcdefghjkmnpqrstuvwxyz");
    const hash = encodeGeohash(37.4101, 126.6783, 6);
    for (const ch of hash) {
      expect(valid.has(ch)).toBe(true);
    }
  });

  it("인천 연수구 좌표 → precision=5에서 'wydh' 로 시작", () => {
    // 인천 연수구 중심: 37.4101, 126.6783
    const hash = encodeGeohash(37.4101, 126.6783, 5);
    expect(hash.startsWith("wydh")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// chunkArray
// ────────────────────────────────────────────────────────────────
describe("chunkArray", () => {
  it("빈 배열 → 빈 배열 반환", () => {
    expect(chunkArray([], 100)).toEqual([]);
  });

  it("size=1 → 원소 하나씩 청크", () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("size=2, 홀수 배열 → 마지막 청크 1개", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("size가 배열 길이와 같음 → 청크 1개", () => {
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("size가 배열 길이보다 큼 → 청크 1개", () => {
    expect(chunkArray([1, 2], 100)).toEqual([[1, 2]]);
  });

  it("size=100, 109개 배열 → 청크 2개 (100 + 9)", () => {
    const arr = Array.from({ length: 109 }, (_, i) => i);
    const chunks = chunkArray(arr, 100);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(9);
  });

  it("전체 원소 수 보존 (flat 결과 == 원본)", () => {
    const arr = Array.from({ length: 55 }, (_, i) => i);
    const chunks = chunkArray(arr, 10);
    expect(chunks.flat()).toEqual(arr);
  });

  it("size <= 0 → 에러 throw", () => {
    expect(() => chunkArray([1, 2], 0)).toThrow();
    expect(() => chunkArray([1, 2], -1)).toThrow();
  });

  it("제네릭 타입 — 문자열 배열 동작", () => {
    const result = chunkArray(["a", "b", "c", "d"], 2);
    expect(result).toEqual([["a", "b"], ["c", "d"]]);
  });
});
