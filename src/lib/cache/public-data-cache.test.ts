import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingleMock = vi.fn();
const deleteEqMock = vi.fn();
const upsertMock = vi.fn();

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: maybeSingleMock,
  delete: vi.fn().mockReturnThis(),
  upsert: upsertMock,
};

const fromMock = vi.fn(() => queryBuilder);

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { buildCacheKey, getCached, getOrFetch, setCached } from './public-data-cache';

describe('public-data-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteEqMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it('buildCacheKey generates consistent keys', () => {
    const a = buildCacheKey({
      provider: 'seoul',
      endpoint: 'x',
      lat: 37.51234,
      lng: 127.12345,
      extra: { b: 2, a: 1 },
    });
    const b = buildCacheKey({
      provider: 'seoul',
      endpoint: 'x',
      lat: 37.51234,
      lng: 127.12345,
      extra: { a: 1, b: 2 },
    });
    expect(a).toBe(b);
  });

  it('buildCacheKey rounds lat/lng to 3 decimals', () => {
    const key = buildCacheKey({
      provider: 'seoul',
      endpoint: 'x',
      lat: 37.51264,
      lng: 127.12354,
    });
    expect(key).toContain(':37.513:127.124:');
  });

  it('getCached returns null when no row exists', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await getCached('k1');
    expect(result).toBeNull();
  });

  it('getCached returns null for expired row', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { cache_key: 'k1', payload: { x: 1 }, expires_at: new Date(Date.now() - 1_000).toISOString() },
      error: null,
    });
    await getCached('k1');
    expect(queryBuilder.delete).toHaveBeenCalled();
  });

  it('getCached returns parsed payload for valid row', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { cache_key: 'k1', payload: { x: 1 }, expires_at: new Date(Date.now() + 60_000).toISOString() },
      error: null,
    });
    const result = await getCached<{ x: number }>('k1');
    expect(result).toEqual({ x: 1 });
  });

  it('setCached upserts correctly', async () => {
    await setCached('k1', { x: 1 }, 'seoul', 60);
    expect(fromMock).toHaveBeenCalledWith('public_data_cache');
    expect(upsertMock).toHaveBeenCalled();
  });

  it('getOrFetch calls fetcher on cache miss, stores result', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const fetcher = vi.fn().mockResolvedValue({ x: 2 });
    const result = await getOrFetch('k1', 'seoul', 60, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalled();
    expect(result).toEqual({ data: { x: 2 }, cacheHit: false });
  });

  it("getOrFetch returns cached value on hit, doesn't call fetcher", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { cache_key: 'k1', payload: { x: 3 }, expires_at: new Date(Date.now() + 60_000).toISOString() },
      error: null,
    });
    const fetcher = vi.fn();
    const result = await getOrFetch('k1', 'seoul', 60, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ data: { x: 3 }, cacheHit: true });
  });
});
