import { NextResponse } from "next/server";
import { z } from "zod";

import type { GeocodeRequest, GeocodeResponse } from "@/types/api";

const geocodeRequestSchema = z.object({
  address: z.string().trim().min(1, "주소를 입력해 주세요."),
});

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  error_message?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
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
          "User-Agent": "FranchiseScope/1.0 (franchise-scope@local)",
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

/** Google Geocoding API */
async function geocodeWithGoogle(address: string, apiKey: string): Promise<GeocodeResponse | null> {
  try {
    const params = new URLSearchParams({
      address,
      language: "ko",
      region: "KR",
      key: apiKey,
    });

    const response = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      8_000,
    );

    if (!response.ok) return null;

    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" || !data.results.length) return null;

    const first = data.results[0];
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
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
    const googleKey = process.env.GOOGLE_PLACES_API_KEY;
    const hasGoogleKey = Boolean(googleKey) && googleKey !== "placeholder";

    let result: GeocodeResponse | null = null;

    // 1) Google 우선 (유효한 키가 있을 때)
    if (hasGoogleKey && googleKey) {
      result = await geocodeWithGoogle(address, googleKey);
      if (result) {
        console.log("[geocode/google]", address, "→", result.lat, result.lng);
      } else {
        console.warn("[geocode/google] 실패 → Nominatim 폴백");
      }
    }

    // 2) Nominatim 폴백 (Google 없거나 실패 시)
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
