import { NextResponse } from 'next/server';

import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import { buildDataSources, calcDataCompleteness, collectLocation } from '@/lib/report/data-collector';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CollectedCommercialData, CollectedCompetitorData, CollectedPopulationData, CollectedRentData } from '@/types/analysis';
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

    const { data: existing } = await auth.supabase
      .from('analysis_collected_data')
      .select('*')
      .eq('analysis_id', owned.analysis.id)
      .maybeSingle();

    const location = await collectLocation(owned.analysis.address, owned.analysis.latitude, owned.analysis.longitude);
    const partialResults = {
      population: (existing?.population_data as CollectedPopulationData | null) ?? null,
      commercial: (existing?.commercial_data as CollectedCommercialData | null) ?? null,
      rent: (existing?.rent_data as CollectedRentData | null) ?? null,
      competitors: (existing?.competitor_data as CollectedCompetitorData | null) ?? null,
      location,
    };
    const dataSources = buildDataSources(partialResults);
    const completeness = calcDataCompleteness(partialResults);

    const admin = createAdminClient();
    const payload: Database['public']['Tables']['analysis_collected_data']['Insert'] = {
      analysis_id: owned.analysis.id,
      location_data: location,
      data_sources: dataSources,
      collection_completed_at: new Date().toISOString(),
    };
    await admin.from('analysis_collected_data').upsert(payload, { onConflict: 'analysis_id' });
    await admin.from('analyses').update({ status: 'collected' }).eq('id', owned.analysis.id);

    return NextResponse.json({ ok: true, completeness }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id/collect/finalize POST]', error);
    return NextResponse.json({ message: '데이터 취합 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
