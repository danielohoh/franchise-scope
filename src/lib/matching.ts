import { calculateNearbyHouseholds } from "@/lib/geo";
import type {
  DbNaverListing,
  ParsedConditions,
  MatchedListing,
  DbApartmentData,
} from "@/types/recommend";

const SCORE_AREA = 30;
const SCORE_HOUSEHOLDS = 30;
const SCORE_PARKING = 15;
const SCORE_BUILDING_USE = 15;
const SCORE_MONTHLY_RENT = 10;
const MIN_SCORE = 60;

/**
 * 매물 목록을 조건에 따라 점수화하고,
 * 기준 점수(60점) 이상인 매물만 점수 내림차순으로 반환합니다.
 */
export function matchListings(
  listings: DbNaverListing[],
  conditions: ParsedConditions,
  apartmentData: DbApartmentData[],
): MatchedListing[] {
  const results: MatchedListing[] = [];

  for (const listing of listings) {
    let score = 0;
    const reasons: string[] = [];
    let nearbyHouseholds: number | null = null;
    let nearbyComplexes: { name: string; households: number; distance: number }[] = [];

    // 1. 면적 매칭 (30점)
    if (conditions.minAreaPyeong != null || conditions.maxAreaPyeong != null) {
      const area = listing.area_pyeong;
      if (area != null) {
        const minOk =
          conditions.minAreaPyeong == null || area >= conditions.minAreaPyeong;
        const maxOk =
          conditions.maxAreaPyeong == null || area <= conditions.maxAreaPyeong;
        if (minOk && maxOk) {
          score += SCORE_AREA;
          reasons.push(`면적 ${area}평 (조건 충족)`);
        }
      }
    } else {
      // 조건 미지정 시 만점
      score += SCORE_AREA;
    }

    // 2. 세대수 매칭 (30점)
    if (conditions.minHouseholds != null) {
      if (listing.latitude != null && listing.longitude != null) {
        const result = calculateNearbyHouseholds(
          listing.latitude,
          listing.longitude,
          apartmentData,
          conditions.radiusMeters,
        );
        nearbyHouseholds = result.total;
        nearbyComplexes = result.complexes;

        if (result.total >= conditions.minHouseholds) {
          score += SCORE_HOUSEHOLDS;
          reasons.push(
            `반경 ${conditions.radiusMeters}m 내 ${result.total.toLocaleString()}세대 (조건 충족)`,
          );
        }
      }
    } else {
      // 조건 미지정 시 만점
      score += SCORE_HOUSEHOLDS;
    }

    // 3. 주차 가능 여부 (15점)
    if (conditions.parkingRequired) {
      if (listing.parking_available) {
        score += SCORE_PARKING;
        reasons.push("주차 가능");
      }
    } else {
      score += SCORE_PARKING;
    }

    // 4. 건물 용도 (15점)
    if (conditions.buildingUse && conditions.buildingUse.length > 0) {
      const listingUse = listing.building_use ?? "";
      const matched = conditions.buildingUse.some((use) =>
        listingUse.includes(use),
      );
      if (matched) {
        score += SCORE_BUILDING_USE;
        reasons.push(`건물용도 "${listingUse}" (조건 충족)`);
      }
    } else {
      score += SCORE_BUILDING_USE;
    }

    // 5. 월세 (10점)
    if (conditions.maxMonthlyRent != null) {
      const rent = listing.monthly_rent;
      if (rent != null && rent <= conditions.maxMonthlyRent) {
        score += SCORE_MONTHLY_RENT;
        reasons.push(`월세 ${rent}만원 (조건 충족)`);
      }
    } else {
      score += SCORE_MONTHLY_RENT;
    }

    if (score >= MIN_SCORE) {
      results.push({
        ...listing,
        matchScore: score,
        matchReasons: reasons,
        nearbyHouseholds,
        nearbyComplexes,
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}
