/**
 * POST /api/listings/collect-server
 * 서버사이드에서 직방(Zigbang) API를 직접 호출하여 상가 매물을 수집합니다.
 * SSE(Server-Sent Events)로 실시간 진행상황을 클라이언트에 스트리밍합니다.
 *
 * 직방 API 3단계:
 *  1. GET  /v2/search?q={regionName}              → 중심 좌표 획득
 *  2. POST /v2/store/article/stores (geohash)     → 매물 ID 목록 조회
 *  3. POST /v2/store/article/stores/list          → 상세 정보 일괄 조회
 */

import { z } from "zod";
import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { getAuthUser } from "@/lib/supabase/auth-bearer";
import { encodeGeohash, chunkArray } from "@/lib/zigbang-utils";
import type { DbNaverListingInsert, Json } from "@/types/database";

export const maxDuration = 120;

const RequestSchema = z.object({
  regionCode: z.string().min(1, "지역 코드가 필요합니다."),
  regionName: z.string().min(1, "지역명이 필요합니다."),
});

type SSEEvent =
  | { type: "progress"; current: number; total: number; page: number }
  | { type: "saving"; count: number }
  | { type: "done"; collected: number; skipped: number }
  | { type: "error"; message: string };

// ── 직방 응답 타입 ──────────────────────────────────────────────

interface ZigbangSearchItem {
  lat: number;
  lng: number;
  description?: string;
  type?: string;
}

interface ZigbangItemLocation {
  item_id: number;
  lat: number;
  lng: number;
}

interface ZigbangStoreSection {
  title: string;
  item_locations: ZigbangItemLocation[];
}

interface ZigbangStoreDetail {
  item_id: number;
  title: string;
  sales_type: string;   // "임대" | "매매"
  sales_title: string;  // "월세" | "전세" | "매매"
  보증금액: number;
  월세금액: number;
  매매금액: number;
  관리금액: number;
  권리금액: number;
  size_m2: number;
  floor: string;
  local1: string;
  local2: string;
  local3: string;
  업종: string;
  image_thumbnail: string;
  status: string;
  addressOrigin?: { fullText?: string; localText?: string };
}

// ── 지연 ──────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 지역 매칭 ──────────────────────────────────────────────────
//
// [버그 배경] 직방 API는 법정동코드가 아닌 좌표 기반 geohash(precision=5,
// 약 5km 격자)로 매물을 조회한다. 이 때문에 선택한 지역구뿐 아니라 같은
// geohash 격자에 걸친 "인접 지역구"의 매물까지 함께 수집된다. 과거에는 이
// 매물들에 선택한 regionCode를 그대로 라벨링해 저장했기 때문에, 추천 시
// `.eq("region_code", ...)` 쿼리가 실제로는 다른 지역구인 매물을 반환했다.
//
// [수정] 각 매물의 실제 행정구역(local2=시/군/구, local3=읍/면/동)을
// 선택한 지역명과 대조하여, 선택 지역구에 속하지 않는 매물은 저장 단계에서
// 제외한다.

/** "서울특별시 강남구" / "경기도 성남시 분당구" → ["강남구"] / ["성남시","분당구"] */
function extractRegionTokens(regionName: string): string[] {
  const SIDO_SUFFIXES = [
    "특별시",
    "광역시",
    "특별자치시",
    "특별자치도",
    "자치도",
    "도",
  ];
  return regionName
    .trim()
    .split(/\s+/)
    // 시/도 토큰(서울특별시, 경기도 등)은 제외하고 구/군/시 토큰만 남긴다
    .filter((token) => {
      if (!token) return false;
      // "세종특별자치시"처럼 시/도 자체가 최종 단위인 경우를 위해
      // 시/도 접미사로 끝나면 지역구 토큰이 아니라고 판단한다.
      return !SIDO_SUFFIXES.some((suffix) => token.endsWith(suffix));
    });
}

/**
 * 매물의 실제 주소(local2/local3)가 선택한 지역구에 속하는지 판별한다.
 * - 일반: 지역 토큰 하나(예: "강남구")가 local2에 일치하면 통과
 * - 경기 복합(예: "성남시 분당구"): 모든 토큰이 local2/local3에 나타나야 통과
 * 주소 정보가 아예 없으면(둘 다 빈 값) 판별 불가 → 보수적으로 제외한다.
 */
function isListingInSelectedRegion(
  tokens: string[],
  local2: string | undefined,
  local3: string | undefined,
): boolean {
  if (tokens.length === 0) return true; // 세종시 등: 시/도 단위 선택 → 필터 없이 통과
  const haystack = `${local2 ?? ""} ${local3 ?? ""}`.trim();
  if (!haystack) return false; // 주소 없음 → 지역 확인 불가 → 제외
  return tokens.every((token) => haystack.includes(token));
}

/**
 * 직방 지역 검색 결과 중 선택한 지역과 가장 정확히 일치하는 항목을 고른다.
 * 동명 지역(예: 여러 "중구")이 있을 때 첫 결과를 무조건 쓰면 엉뚱한 좌표를
 * 잡을 수 있으므로, description에 지역 토큰이 모두 포함된 항목을 우선한다.
 * 매칭 항목이 없으면 첫 번째 항목으로 폴백한다.
 */
function pickBestRegionMatch(
  items: ZigbangSearchItem[],
  tokens: string[],
): ZigbangSearchItem | undefined {
  const valid = items.filter((it) => it?.lat && it?.lng);
  if (valid.length === 0) return undefined;
  if (tokens.length > 0) {
    const exact = valid.find((it) =>
      tokens.every((token) => (it.description ?? "").includes(token)),
    );
    if (exact) return exact;
  }
  return valid[0];
}

// ── 직방 API 헤더 ─────────────────────────────────────────────

const ZIGBANG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Content-Type": "application/json",
  Referer: "https://www.zigbang.com/",
  Origin: "https://www.zigbang.com",
};

// ── 핸들러 ───────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── 인증 ──
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user) {
    return Response.json({ error: authError ?? "로그인이 필요합니다." }, { status: 401 });
  }

  // ── 요청 파싱 ──
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { regionCode, regionName } = parsed.data;
  const userId = user.id;

  // ── SSE 스트리밍 응답 ──
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // 클라이언트 연결 끊김 - 무시
        }
      };

      try {
        // ── 1단계: 직방 지역 검색 → 좌표 ──
        const searchRes = await fetch(
          `https://apis.zigbang.com/v2/search?q=${encodeURIComponent(regionName)}&leaseYn=N&serviceType=%EC%83%81%EA%B0%80`,
          { headers: ZIGBANG_HEADERS },
        );

        if (!searchRes.ok) {
          send({ type: "error", message: `지역 검색 실패 (${searchRes.status})` });
          controller.close();
          return;
        }

        const searchData = (await searchRes.json()) as { items?: ZigbangSearchItem[] };

        // 선택한 지역명에서 구/군/시 토큰을 추출 (검색 매칭 + 매물 필터링 공용)
        const regionTokens = extractRegionTokens(regionName);

        // 동명 지역 오선택을 막기 위해 정확 매칭 항목을 우선 선택
        const location = pickBestRegionMatch(searchData.items ?? [], regionTokens);

        if (!location?.lat || !location?.lng) {
          send({ type: "error", message: "해당 지역을 찾을 수 없습니다." });
          controller.close();
          return;
        }

        // ── 2단계: Geohash → 매물 ID 목록 ──
        const geohash = encodeGeohash(location.lat, location.lng, 5);

        send({ type: "progress", current: 0, total: 0, page: 1 });

        const storeRes = await fetch("https://apis.zigbang.com/v2/store/article/stores", {
          method: "POST",
          headers: ZIGBANG_HEADERS,
          body: JSON.stringify({
            domain: "zigbang",
            geohash,
            shuffle: false,
            sales_type: "전체",
            first_floor: false,
            업종: [],
          }),
        });

        if (!storeRes.ok) {
          send({ type: "error", message: `매물 목록 조회 실패 (${storeRes.status})` });
          controller.close();
          return;
        }

        const sections = (await storeRes.json()) as ZigbangStoreSection[];

        // 모든 섹션에서 item_id 추출 (lat/lng 포함)
        const locationMap = new Map<number, { lat: number; lng: number }>();
        const allItemIds: number[] = [];

        for (const section of sections) {
          for (const loc of section.item_locations ?? []) {
            if (!locationMap.has(loc.item_id)) {
              locationMap.set(loc.item_id, { lat: loc.lat, lng: loc.lng });
              allItemIds.push(loc.item_id);
            }
          }
        }

        if (allItemIds.length === 0) {
          send({ type: "done", collected: 0, skipped: 0 });
          controller.close();
          return;
        }

        send({ type: "progress", current: 0, total: allItemIds.length, page: 1 });

        // ── 3단계: 100개씩 상세 조회 ──
        // regionTokens는 1단계에서 이미 추출됨 (지역 필터링에 재사용)
        const allListings: DbNaverListingInsert[] = [];
        let regionFilteredOut = 0; // 인접 지역구로 판별되어 제외된 매물 수
        const chunks = chunkArray(allItemIds, 100);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          if (i > 0) {
            await delay(500); // 직방 서버 부하 방지
          }

          const detailRes = await fetch(
            "https://apis.zigbang.com/v2/store/article/stores/list",
            {
              method: "POST",
              headers: ZIGBANG_HEADERS,
              body: JSON.stringify({ item_ids: chunk }),
            },
          );

          if (!detailRes.ok) {
            console.error("[collect-server] 상세 조회 실패:", detailRes.status);
            continue; // 실패한 배치는 건너뜀
          }

          const details = (await detailRes.json()) as ZigbangStoreDetail[];

          for (const item of details) {
            // geohash 격자가 인접 지역구까지 포함하므로, 실제 주소가 선택한
            // 지역구와 다른 매물은 저장하지 않는다. (지역 필터링 버그 수정)
            if (!isListingInSelectedRegion(regionTokens, item.local2, item.local3)) {
              regionFilteredOut++;
              continue;
            }

            const coords = locationMap.get(item.item_id);

            // sales_title이 없으면 sales_type 기반으로 추론
            const tradeType = item.sales_title || item.sales_type || "";

            allListings.push({
              user_id: userId,
              article_id: String(item.item_id),
              region_code: regionCode,
              region_name: regionName,
              trade_type: tradeType,
              article_name: item.title || null,
              building_name: null,
              detail_address:
                item.addressOrigin?.fullText ||
                [item.local1, item.local2, item.local3].filter(Boolean).join(" ") ||
                null,
              floor_info: item.floor || null,
              area_supply: item.size_m2 ? Number(item.size_m2) : null,
              area_exclusive: item.size_m2 ? Number(item.size_m2) : null,
              deposit: item.보증금액 || null,
              // 직방은 월세+관리비 합산 표시 → 동일 기준으로 저장
              monthly_rent: item.월세금액
                ? item.월세금액 + (item.관리금액 || 0)
                : null,
              sale_price: item.매매금액 || null,
              maintenance_cost: item.관리금액 || null,
              building_use: item.업종 || null,
              parking_available: null, // 직방 API에 주차 정보 없음
              parking_count: null,
              latitude: coords?.lat ?? null,
              longitude: coords?.lng ?? null,
              image_url: item.image_thumbnail || null,
              naver_url: `https://www.zigbang.com/home/store/items/${item.item_id}`,
              raw_data: item as unknown as Json,
            });
          }

          send({
            type: "progress",
            current: Math.min((i + 1) * 100, allItemIds.length),
            total: allItemIds.length,
            page: i + 1,
          });
        }

        if (regionFilteredOut > 0) {
          console.info(
            `[collect-server] 지역 불일치로 ${regionFilteredOut}건 제외 ` +
              `(선택: ${regionName}, 수집대상: ${allListings.length}건)`,
          );
        }

        if (allListings.length === 0) {
          // 상세 조회는 됐으나 선택 지역구에 속하는 매물이 하나도 없는 경우 포함
          send({ type: "done", collected: 0, skipped: allItemIds.length });
          controller.close();
          return;
        }

        // ── 4단계: DB upsert ──
        send({ type: "saving", count: allListings.length });

        const admin = createUntypedAdminClient();
        const dbChunks = chunkArray(allListings, 100);
        let totalCollected = 0;

        for (const dbChunk of dbChunks) {
          const { data, error: dbError } = await admin
            .from("naver_listings")
            .upsert(dbChunk, { onConflict: "user_id,article_id" })
            .select("id");

          if (dbError) {
            console.error("[collect-server] DB upsert error:", dbError);
          } else {
            totalCollected += data?.length ?? 0;
          }
        }

        const skipped = allListings.length - totalCollected;
        send({ type: "done", collected: totalCollected, skipped });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "수집 중 오류가 발생했습니다.";
        console.error("[collect-server] error:", err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
