// ============================================
// Google Places API — Nearby Search 원시 헬퍼
// competitors/route.ts 에서 추출
// ============================================

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
].join(",");

export type SearchNearbyOptions = {
  lat: number;
  lng: number;
  radiusM: number;
  includedTypes: string[];
  maxResultCount?: number;
  rankBy?: "DISTANCE" | "POPULARITY";
  apiKey: string;
};

/**
 * Google Places API Nearby Search를 호출하여 장소 목록을 반환합니다.
 * 실패 시 빈 배열을 반환합니다 (graceful degradation).
 */
export type SearchTextOptions = {
  textQuery: string;
  lat: number;
  lng: number;
  radiusM: number;
  maxResultCount?: number;
  apiKey: string;
};

/**
 * Google Places API Text Search를 호출하여 키워드 기반 장소 목록을 반환합니다.
 * 업종 세부(치킨, 커피 등)로 직접 검색할 때 사용합니다.
 */
export async function searchTextPlaces(opts: SearchTextOptions): Promise<GooglePlace[]> {
  const body = {
    textQuery: opts.textQuery,
    maxResultCount: opts.maxResultCount ?? 20,
    languageCode: "ko",
    regionCode: "KR",
    locationBias: {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: Math.min(opts.radiusM, 50_000),
      },
    },
  };

  let response: Response;
  try {
    response = await fetch("https://places.googleapis.com/v1/places:searchText", {
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
    console.error("[google-places] Text Search 네트워크 오류", err);
    return [];
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[google-places] Text Search HTTP 오류", response.status, errText.slice(0, 200));
    return [];
  }

  const data = (await response.json()) as GooglePlacesResponse;
  return data.places ?? [];
}

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
