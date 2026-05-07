import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchShopsMock = vi.fn();

vi.mock('@/lib/commercial-area/csv-search', () => ({
  searchShops: searchShopsMock,
  mapBrandIndustryToMajor: vi.fn(() => '음식'),
  mapBrandIndustryToSub: vi.fn(() => undefined),
}));

import {
  classifyType,
  fetchStoreListInRadius,
  getSbizCompetitors,
} from './sbiz-stores';

describe('sbiz-stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env.DATA_GO_KR_API_KEY = 'test-key';
  });

  it('fetchStoreListInRadius calls correct URL', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ body: { totalCount: 1, items: { item: { bizesNm: 'A', indsLclsNm: '음식', indsMclsNm: '', indsSclsNm: '', lnoAdr: '', rdnmAdr: '', lon: '127.0', lat: '37.5' } } } }),
    } as Response);

    await fetchStoreListInRadius(37.5, 127, 500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('storeListInRadius');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('radius=500');
  });

  it('fetchStoreListInRadius falls back to CSV on API error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error('network'));
    searchShopsMock.mockResolvedValueOnce({
      shops: [
        {
          shopId: '1',
          name: 'CSV 상점',
          branchName: '',
          industryMajor: '음식',
          industryMid: '카페',
          industrySub: '커피',
          address: '서울',
          lat: 37.5,
          lng: 127,
          distanceM: 100,
        },
      ],
    });

    const rows = await fetchStoreListInRadius(37.5, 127, 500, '외식');
    expect(searchShopsMock).toHaveBeenCalled();
    expect(rows[0]?.bizesNm).toBe('CSV 상점');
  });

  it('getSbizCompetitors maps results correctly', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        body: {
          totalCount: 1,
          items: {
            item: {
              bizesNm: '스타벅스 강남점',
              indsLclsNm: '음식',
              indsMclsNm: '카페',
              indsSclsNm: '커피',
              lnoAdr: '서울',
              rdnmAdr: '서울',
              lon: '127.001',
              lat: '37.501',
            },
          },
        },
      }),
    } as Response);

    const result = await getSbizCompetitors(37.5, 127, '외식', 500);
    expect(result.total).toBe(1);
    expect(result.competitors[0]?.name).toBe('스타벅스 강남점');
    expect(result.competitors[0]?.type).toBe('프랜차이즈');
  });

  it('classifyType correctly identifies franchise names', () => {
    expect(classifyType('스타벅스 리저브')).toBe('프랜차이즈');
    expect(classifyType('동네카페')).toBe('개인점');
  });
});
