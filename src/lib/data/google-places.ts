// ============================================
// Google Places API — Nearby Search 원시 헬퍼
// competitors/route.ts 에서 추출
// ============================================

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
].join(",");

export interface SearchNearbyOptions {
  lat: number;
  lng: number;
  radiusM: number;
  includedTypes: string[];
  maxResultCount?: number;
  rankBy?: "DISTANCE" | "POPULARITY";
  apiKey: string;
}

/**
 * Google Places API Nearby Search를 호출하여 장소 목록을 반환합니다.
 * 실패 시 빈 배열을 반환합니다 (graceful degradation).
 */
export async function searchNearbyPlaces(opts: SearchNearbyOptions): Promise<GooglePlace[]> {
  const body = {
    includedTypes: opts.includedTypes,
    maxResultCount: opts.maxResultCount ?? 20,
    rankPreference: opts.rankBy ?? "DISTANCE",
    languageCode: "ko",
    regionCode: "KR",
    locationRestriction: {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: Math.min(opts.radiusM, 50_000),
      },
    },
  };

  let response: Response;
  try {
    response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": opts.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[google-places] 네트워크 오류", err);
    return [];
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[google-places] HTTP 오류", response.status, errText.slice(0, 200));
    return [];
  }

  const data = (await response.json()) as GooglePlacesResponse;
  return data.places ?? [];
}
