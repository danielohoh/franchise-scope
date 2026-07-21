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
import type { DbNaverListingInsert } from "@/types/database";

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
        const location = searchData.items?.[0];

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
        const allListings: DbNaverListingInsert[] = [];
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
              raw_data: item as unknown,
            });
          }

          send({
            type: "progress",
            current: Math.min((i + 1) * 100, allItemIds.length),
            total: allItemIds.length,
            page: i + 1,
          });
        }

        if (allListings.length === 0) {
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
