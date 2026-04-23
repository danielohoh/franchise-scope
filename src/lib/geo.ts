import type { ApartmentSummary } from "@/types/recommend";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine 공식으로 두 좌표 간 거리(m)를 계산합니다. */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** 반경 내 아파트 세대수 합산 및 단지 목록을 반환합니다. */
export function calculateNearbyHouseholds(
  listingLat: number,
  listingLng: number,
  apartments: Array<{
    complex_name: string;
    total_households: number | null;
    latitude: number | null;
    longitude: number | null;
  }>,
  radiusMeters: number,
): { total: number; complexes: ApartmentSummary[] } {
  const complexes: ApartmentSummary[] = [];
  let total = 0;

  for (const apt of apartments) {
    if (apt.latitude == null || apt.longitude == null) continue;
    if (apt.total_households == null || apt.total_households <= 0) continue;

    const distance = haversineDistance(
      listingLat,
      listingLng,
      apt.latitude,
      apt.longitude,
    );

    if (distance <= radiusMeters) {
      complexes.push({
        name: apt.complex_name,
        households: apt.total_households,
        distance: Math.round(distance),
      });
      total += apt.total_households;
    }
  }

  complexes.sort((a, b) => a.distance - b.distance);

  return { total, complexes };
}
