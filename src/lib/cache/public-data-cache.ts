import 'server-only';

import { createHash } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';
import type { CacheKeyParams } from '@/types/public-data';

type PublicDataCacheRow = Database['public']['Tables']['public_data_cache']['Row'];

function roundTo3(value: number): string {
  return value.toFixed(3);
}

export function buildCacheKey(params: CacheKeyParams): string {
  const sortedEntries = Object.entries(params.extra ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const serializedParams = JSON.stringify(sortedEntries);
  const paramsHash = createHash('sha1').update(serializedParams).digest('hex').slice(0, 12);

  return [params.provider, params.endpoint, roundTo3(params.lat), roundTo3(params.lng), paramsHash].join(':');
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('public_data_cache')
      .select('cache_key,payload,expires_at')
      .eq('cache_key', key)
      .maybeSingle<Pick<PublicDataCacheRow, 'cache_key' | 'payload' | 'expires_at'>>();

    if (error || !data) {
      return null;
    }

    const isExpired = new Date(data.expires_at).getTime() <= Date.now();
    if (isExpired) {
      await admin.from('public_data_cache').delete().eq('cache_key', key);
      return null;
    }

    return data.payload as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  payload: T,
  provider: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await admin.from('public_data_cache').upsert({
      cache_key: key,
      provider,
      payload: payload as Database['public']['Tables']['public_data_cache']['Insert']['payload'],
      expires_at: expiresAt,
    });
  } catch {
    // no-op cache failure
  }
}

export async function getOrFetch<T>(
  key: string,
  provider: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return { data: cached, cacheHit: true };
  }

  const data = await fetcher();
  await setCached<T>(key, data, provider, ttlSeconds);
  return { data, cacheHit: false };
}
