/**
 * POST /api/listings/collect-server
 * 서버사이드에서 네이버 부동산 API를 직접 호출하여 매물을 수집합니다.
 * SSE(Server-Sent Events)로 실시간 진행상황을 클라이언트에 스트리밍합니다.
 */

import { z } from "zod";
import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { getAuthUser } from "@/lib/supabase/auth-bearer";
import { scrapeNaverListings } from "@/lib/naver-scraper";
import type { DbNaverListingInsert } from "@/types/database";

const RequestSchema = z.object({
  regionCode: z.string().min(1, "지역 코드가 필요합니다."),
  tradeType: z.string().default(""),
});

type SSEEvent =
  | { type: "progress"; current: number; total: number; page: number }
  | { type: "saving"; count: number }
  | { type: "done"; collected: number; skipped: number }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  // ── 인증 (Bearer 또는 쿠키) ──
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

  const { regionCode, tradeType } = parsed.data;
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
        // 1. 네이버 API 수집
        const listings = await scrapeNaverListings(regionCode, tradeType, (progress) => {
          send({ type: "progress", ...progress });
        });

        if (listings.length === 0) {
          send({ type: "done", collected: 0, skipped: 0 });
          controller.close();
          return;
        }

        // 2. DB 저장 (upsert)
        send({ type: "saving", count: listings.length });

        const admin = createUntypedAdminClient();
        const rows: DbNaverListingInsert[] = listings.map((item) => ({
          user_id: userId,
          article_id: item.article_id,
          region_code: regionCode,
          region_name: item.region_name ?? null,
          trade_type: item.trade_type,
          article_name: item.article_name ?? null,
          building_name: item.building_name ?? null,
          detail_address: item.detail_address ?? null,
          floor_info: item.floor_info ?? null,
          area_supply: item.area_supply ?? null,
          area_exclusive: item.area_exclusive ?? null,
          deposit: item.deposit ?? null,
          monthly_rent: item.monthly_rent ?? null,
          sale_price: item.sale_price ?? null,
          maintenance_cost: item.maintenance_cost ?? null,
          building_use: item.building_use ?? null,
          parking_available: item.parking_available ?? false,
          parking_count: item.parking_count ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          image_url: item.image_url ?? null,
          naver_url: item.naver_url ?? null,
          raw_data: null,
        }));

        const { data, error: dbError } = await admin
          .from("naver_listings")
          .upsert(rows, { onConflict: "user_id,article_id" })
          .select("id");

        if (dbError) {
          console.error("[collect-server] DB error:", dbError);
          send({ type: "error", message: "매물 저장 중 오류가 발생했습니다." });
          controller.close();
          return;
        }

        const collected = data?.length ?? 0;
        const skipped = listings.length - collected;

        send({ type: "done", collected, skipped });
      } catch (err) {
        const message = err instanceof Error ? err.message : "수집 중 오류가 발생했습니다.";
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
      "X-Accel-Buffering": "no", // Nginx 버퍼링 비활성화
    },
  });
}
