import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { collectPopulation } from '@/lib/report/data-collector';
import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import type { Database } from '@/types/database';

export const maxDuration = 10;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthedUser();
    if (!auth.user) {
      return (
        auth.response ??
        NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 })
      );
    }

    const { id } = await context.params;
    const owned = await getOwnedAnalysis(id, auth.user.id);
    if (!owned.analysis) {
      return (
        owned.forbiddenResponse ??
        NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 })
      );
    }

    let data = await collectPopulation(owned.analysis.latitude, owned.analysis.longitude);

    // withTimeout이 null을 반환한 경우 — mock 데이터로 보장
    if (!data) {
      data = {
        radius_500m: { residential: 8500, households: 3200, workers: 2800 },
        radius_1km: { residential: 28000, households: 11500, workers: 6500 },
        radius_2km: { residential: 72000, households: 28500, workers: 15000 },
        core_age_group: '30~50대 62%',
        gender_ratio: '남 49% / 여 51%',
        commercial_area_type: '혼합상권',
        hourly_traffic: {
          morning: { weekday: 1850, weekend: 900 },
          lunch: { weekday: 3200, weekend: 2600 },
          afternoon: { weekday: 2100, weekend: 2400 },
          evening: { weekday: 3800, weekend: 3500 },
          night: { weekday: 1500, weekend: 1200 },
        },
        is_mock: true,
        source: 'timeout_fallback',
      };
    }

    const admin = createAdminClient();
    const payload: Database['public']['Tables']['analysis_collected_data']['Insert'] = {
      analysis_id: owned.analysis.id,
      population_data: data,
    };

    await admin.from('analysis_collected_data').upsert(payload, { onConflict: 'analysis_id' });
    await admin.from('analyses').update({ status: 'collecting' }).eq('id', owned.analysis.id);

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id/collect/population POST]', error);
    return NextResponse.json({ message: '인구 데이터 수집 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
