import { NextResponse } from "next/server";
import { z } from "zod";

import type { GeocodeRequest, GeocodeResponse } from "@/types/api";

const geocodeRequestSchema = z.object({
  address: z.string().trim().min(1, "주소를 입력해 주세요."),
});

interface KakaoGeocodeResponse {
  documents: Array<{
    address_name: string;
    x: string; // longitude
    y: string; // latitude
    address?: { address_name: string };
    road_address?: { address_name: string } | null;
  }>;
  meta: { total_count: number };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** Kakao Local API 지오코딩 — 한국 주소에 최적화 */
async function geocodeWithKakao(address: string, apiKey: string): Promise<GeocodeResponse | null> {
  try {
    const params = new URLSearchParams({ query: address });

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?${params.toString()}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as KakaoGeocodeResponse;
    if (!data.documents?.length) return null;

    const first = data.documents[0];
    const lat = parseFloat(first.y);
    const lng = parseFloat(first.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // 도로명 주소 우선, 없으면 지번 주소
    const formattedAddress =
      first.road_address?.address_name ?? first.address?.address_name ?? first.address_name;

    return { lat, lng, formattedAddress };
  } catch {
    return null;
  }
}

/** Nominatim(OpenStreetMap) 무료 지오코딩 — API 키 불필요 */
async function geocodeWithNominatim(address: string): Promise<GeocodeResponse | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      countrycodes: "kr",
      limit: "1",
      "accept-language": "ko",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          // Nominatim 사용 정책 필수 헤더
          "User-Agent": "FranchiseScope/1.0 (ai-scope.kr)",
          "Accept-Language": "ko",
        },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const results = (await response.json()) as NominatimResult[];
    if (!results.length || !results[0]) return null;

    const first = results[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, formattedAddress: first.display_name };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as GeocodeRequest;
    const parsed = geocodeRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "요청값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { address } = parsed.data;
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    const hasKakaoKey = Boolean(kakaoKey) && kakaoKey !== "placeholder";

    let result: GeocodeResponse | null = null;

    // 1) Kakao 우선 (유효한 키가 있을 때)
    if (hasKakaoKey && kakaoKey) {
      result = await geocodeWithKakao(address, kakaoKey);
      if (result) {
        console.log("[geocode/kakao]", address, "→", result.lat, result.lng);
      } else {
        console.warn("[geocode/kakao] 실패 → Nominatim 폴백");
      }
    }

    // 2) Nominatim 폴백 (Kakao 없거나 실패 시)
    if (!result) {
      result = await geocodeWithNominatim(address);
      if (result) {
        console.log("[geocode/nominatim]", address, "→", result.lat, result.lng);
      }
    }

    if (!result) {
      return NextResponse.json({ error: "주소를 찾을 수 없습니다." }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[geocode] Unexpected error", error);
    return NextResponse.json({ error: "주소 변환 중 오류가 발생했습니다." }, { status: 500 });
  }
}
