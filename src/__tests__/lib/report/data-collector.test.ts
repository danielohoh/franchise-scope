import { describe, expect, it, vi } from 'vitest';

const searchNearbyCompetitorsMock = vi.fn();
const getSbizCompetitorsMock = vi.fn();

vi.mock('@/lib/public-api/population', () => ({ getPopulationData: vi.fn() }));
vi.mock('@/lib/public-api/seoul-commercial', () => ({ getCommercialSales: vi.fn() }));
vi.mock('@/lib/public-api/rent-index', () => ({ getRentData: vi.fn() }));
vi.mock('@/lib/public-api/google-places', () => ({
  searchNearbyCompetitors: searchNearbyCompetitorsMock,
}));
vi.mock('@/lib/public-api/sbiz-stores', () => ({
  getSbizCompetitors: getSbizCompetitorsMock,
}));

import { buildDataSources, collectCompetitors, collectLocation } from '@/lib/report/data-collector';

describe('data-collector', () => {
  it('collectCompetitors sets same_brand_exists=true when same brand found', async () => {
    searchNearbyCompetitorsMock.mockResolvedValueOnce({
      competitors: [
        { name: '메가커피 강남점', address: '서울', lat: 37.5, lng: 127, distance_m: 120, rating: 4.3, review_count: 10, is_open: true, place_id: '1', type: '프랜차이즈' },
      ],
      total: 1,
      same_brand_exists: false,
      source: 'google_places',
    });

    const result = await collectCompetitors(37.5, 127, '메가커피', 1000);
    expect(result?.same_brand_exists).toBe(true);
  });

  it('collectLocation parses district and dong from korean address', async () => {
    const result = await collectLocation('서울특별시 강남구 역삼동 123-45', 37.5, 127);
    expect(result.district).toBe('강남구');
    expect(result.dong).toBe('역삼동');
  });

  it('buildDataSources builds expected meta structure', () => {
    const result = buildDataSources({
      population: {
        radius_500m: { residential: 1, households: 1, workers: 1 },
        radius_1km: { residential: 1, households: 1, workers: 1 },
        radius_2km: { residential: 1, households: 1, workers: 1 },
        core_age_group: '30대',
        gender_ratio: '남 50% / 여 50%',
        commercial_area_type: '혼합상권',
        hourly_traffic: {
          morning: { weekday: 1, weekend: 1 },
          lunch: { weekday: 1, weekend: 1 },
          afternoon: { weekday: 1, weekend: 1 },
          evening: { weekday: 1, weekend: 1 },
          night: { weekday: 1, weekend: 1 },
        },
        source: 'population_api',
      },
      commercial: {
        commercial_area_type: '혼합상권',
        competition_density: { score: 50, level: '보통', same_industry_count: 1, total_shop_count: 1 },
        industry_distribution: [],
        total_shops: 1,
        source: 'commercial_api',
      },
      rent: {
        avg_monthly_rent_per_pyeong: 100000,
        avg_deposit_per_pyeong: 1000000,
        area_name: '서울',
        source: 'rent_api',
      },
      competitors: { competitors: [], total: 0, same_brand_exists: false, source: 'google_places' },
    });

    expect(result.population.source).toBe('population_api');
    expect(result.commercial.source).toBe('commercial_api');
    expect(result.rent.source).toBe('rent_api');
    expect(result.competitors.source).toBe('google_places');
    expect(result.location.source).toBe('user_input');
  });
});
