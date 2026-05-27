import { buildCacheKey, getOrFetch } from '@/lib/cache/public-data-cache';
import { mapBrandIndustryToMajor, mapSubIndustryToSub, searchShops } from '@/lib/commercial-area/csv-search';
import { searchNearbyPlaces } from '@/lib/data/google-places';
import { haversineDistance } from '@/lib/utils/geo';
import type { CollectedCompetitorData, CompetitorInfo } from '@/types/analysis';

const FRANCHISE_KEYWORDS = ['스타벅스', '메가커피', '이디야', '투썸', '할리스', '공차', '컴포즈',
  '빽다방', '더벤티', '파스쿠찌', '탐앤탐스', '카페베네', '커피빈',
  '교촌', 'BBQ', 'bhc', 'BHC', '굽네', '처갓집', '네네치킨', '60계',
  '파리바게뜨', '뚜레쥬르', '던킨', '베스킨라빈스', '설빙',
  '맥도날드', '버거킹', '롯데리아', '맘스터치', '서브웨이', 'KFC',
  '도미노피자', '피자헛', '피자알볼로', 'GS25', 'CU', '세븐일레븐', '미니스톱', '이마트24',
  '올리브영', '다이소', '한솥', '본죽', '국대떡볶이', '죠스떡볶이', '이삭토스트'] as const;

type GeocodeResult = { lat: number; lng: number; formattedAddress: string };

type GeocodeApiResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

function getPlaceTypes(industry: string): string[] {
  const normalized = industry.trim();
  if (!normalized) return ['restaurant', 'cafe'];
  if (normalized.includes('커피') || normalized.includes('카페')) return ['cafe'];
  if (normalized.includes('치킨')) return ['restaurant', 'meal_takeaway'];
  if (normalized.includes('피자')) return ['restaurant', 'meal_delivery'];
  if (normalized.includes('편의점')) return ['convenience_store'];
  if (normalized.includes('패션') || normalized.includes('의류')) return ['clothing_store'];
  if (normalized.includes('미용')) return ['beauty_salon'];
  return ['restaurant', 'cafe', 'store'];
}

function classifyShopType(name: string): '프랜차이즈' | '개인점' {
  return FRANCHISE_KEYWORDS.some((keyword) => name.includes(keyword)) ? '프랜차이즈' : '개인점';
}

function isOpenStatus(status: string | undefined): boolean | null {
  if (!status) return null;
  if (status === 'OPERATIONAL') return true;
  if (status === 'CLOSED_PERMANENTLY' || status === 'CLOSED_TEMPORARILY') return false;
  return null;
}

async function geocodeAddressCore(address: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey || !address.trim()) return null;

  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  endpoint.searchParams.set('address', address);
  endpoint.searchParams.set('language', 'ko');
  endpoint.searchParams.set('region', 'kr');
  endpoint.searchParams.set('key', apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as GeocodeApiResponse;
    const first = data.results?.[0];
    const loc = first?.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: first?.formatted_address ?? address,
    };
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = buildCacheKey({
    provider: 'google_places',
    endpoint: 'geocodeAddress',
    lat: 0,
    lng: 0,
    extra: { address: address.trim() },
  });

  const fetcher = () => geocodeAddressCore(address);

  try {
    const { data } = await getOrFetch<GeocodeResult | null>(key, 'google_places', 60 * 60 * 24 * 7, fetcher);
    return data;
  } catch {
    return fetcher();
  }
}

async function csvFallbackCompetitors(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  category?: string,
): Promise<CollectedCompetitorData> {
  try {
    // industry(외식/도소매/서비스) → CSV 대분류(음식/소매/생활서비스)
    // category(커피/치킨/...) → CSV 소분류(카페/치킨/...)
    const industryMajor = mapBrandIndustryToMajor(industry);
    const industrySub = category ? mapSubIndustryToSub(category) : undefined;
    const csv = await searchShops({ lat, lng, radiusM, industryMajor, industrySub, limit: 50 });
    const competitors: CompetitorInfo[] = csv.shops.slice(0, 20).map((shop) => ({
      name: shop.name,
      address: shop.address,
      lat: shop.lat,
      lng: shop.lng,
      distance_m: shop.distanceM,
      rating: null,
      review_count: 0,
      is_open: null,
      place_id: `csv:${shop.shopId}`,
      type: classifyShopType(shop.name),
    }));
    return {
      competitors,
      total: csv.total,
      same_brand_exists: competitors.some((c) => classifyShopType(c.name) === '프랜차이즈'),
      source: 'csv_fallback',
    };
  } catch {
    return { competitors: [], total: 0, same_brand_exists: false, source: 'csv_fallback' };
  }
}

async function googleCompetitors(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  category?: string,
): Promise<CollectedCompetitorData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  // category(업종 세부)가 있으면 더 정확한 타입 필터, 없으면 industry(대분류) 기반
  const places = await searchNearbyPlaces({
    lat,
    lng,
    radiusM,
    includedTypes: getPlaceTypes(category ?? industry),
    maxResultCount: 20,
    rankBy: 'DISTANCE',
    apiKey,
  });

  if (places.length === 0) return null;

  const competitors: CompetitorInfo[] = places
    .filter((place) => place.location?.latitude != null && place.location?.longitude != null)
    .map((place) => {
      const placeName = place.displayName?.text?.trim() || '이름없음';
      // null-safe 접근: location이 없는 장소는 위에서 필터링됨
      const placeLat = place.location?.latitude ?? 0;
      const placeLng = place.location?.longitude ?? 0;
      return {
        name: placeName,
        address: place.formattedAddress ?? '',
        lat: placeLat,
        lng: placeLng,
        distance_m: Math.round(haversineDistance(lat, lng, placeLat, placeLng)),
        rating: typeof place.rating === 'number' ? place.rating : null,
        review_count: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
        is_open: null,
        place_id: place.id,
        type: classifyShopType(placeName),
      };
    });

  return {
    competitors,
    total: competitors.length,
    same_brand_exists: competitors.some((item) => item.type === '프랜차이즈'),
    source: 'google_places',
  };
}

export async function searchNearbyCompetitors(
  lat: number,
  lng: number,
  industry: string,
  radiusM: number,
  category?: string,
): Promise<CollectedCompetitorData> {
  const key = buildCacheKey({
    provider: 'google_places',
    endpoint: 'nearbyCompetitors',
    lat,
    lng,
    extra: { industry, radiusM, category },
  });

  const fetcher = async (): Promise<CollectedCompetitorData> => {
    // 업종 세부(category)가 지정되면 CSV 우선 — Google Places는 세부 업종 필터를 지원하지 않음
    // CSV 소분류 필터(치킨→치킨, 커피→카페 등)가 훨씬 정확
    if (category) {
      const csv = await csvFallbackCompetitors(lat, lng, industry, radiusM, category);
      if (csv.competitors.length > 0) return csv;
    }
    const google = await googleCompetitors(lat, lng, industry, radiusM, category);
    if (google) return google;
    return csvFallbackCompetitors(lat, lng, industry, radiusM, category);
  };

  try {
    const { data } = await getOrFetch<CollectedCompetitorData>(key, 'google_places', 60 * 60 * 24, fetcher);
    return data;
  } catch {
    return fetcher();
  }
}

type PlaceDetailsResponse = {
  businessStatus?: string;
};

export async function getBusinessStatus(placeId: string): Promise<'open' | 'closed' | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey || !placeId.trim()) return null;

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'businessStatus',
      },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as PlaceDetailsResponse;
    const open = isOpenStatus(data.businessStatus);
    if (open === null) return null;
    return open ? 'open' : 'closed';
  } catch {
    return null;
  }
}
