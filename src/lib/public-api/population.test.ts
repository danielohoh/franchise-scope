import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/commercial-area/csv-search', () => ({
  searchShops: vi.fn(async () => ({
    commercialAreaType: '혼합상권',
  })),
}));

import { getPopulationData, getPopulationProvider } from './population';

type MockJsonResponse = {
  body?: { items?: unknown[] };
  items?: unknown[];
};

function mockFetchWithItems(items: unknown[]): void {
  const payload: MockJsonResponse = { body: { items } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.DATA_GO_KR_API_KEY;
});

describe('population provider', () => {
  it('returns mock-like data when API key is missing', async () => {
    const result = await getPopulationData(37.5, 127.0);
    expect(result.is_mock).toBe(true);
    expect(result.source).toBe('mock_population');
    expect(result.radius_1km.residential).toBeGreaterThan(0);
  });

  it('classifies commercial area from store distribution', async () => {
    process.env.DATA_GO_KR_API_KEY = 'test-key';
    mockFetchWithItems([
      { indsLclsNm: '부동산' },
      { indsLclsNm: '학문/교육' },
      { indsLclsNm: '금융/보험' },
      { indsLclsNm: '사무서비스' },
      { indsLclsNm: '부동산' },
      { indsLclsNm: '학문/교육' },
      { indsLclsNm: '음식' },
      { indsLclsNm: '소매' },
    ]);

    const result = await getPopulationData(37.5, 127.0);
    expect(result.commercial_area_type).toBe('오피스상권');
    expect(result.source).toBe('sbiz_store_distribution_estimate');
  });

  it('selects provider based on environment variable', () => {
    delete process.env.DATA_GO_KR_API_KEY;
    const mockProvider = getPopulationProvider();
    expect(typeof mockProvider.getPopulationData).toBe('function');

    process.env.DATA_GO_KR_API_KEY = 'available';
    const realProvider = getPopulationProvider();
    expect(typeof realProvider.getPopulationData).toBe('function');
  });
});
