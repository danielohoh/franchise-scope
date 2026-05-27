import { NextResponse } from 'next/server';

import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { collectCompetitors } from '@/lib/report/data-collector';
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

    const { data: brand } = await auth.supabase
      .from('brands')
      .select('industry, brand_name, category')
      .eq('id', owned.analysis.brand_id)
      .maybeSingle();

    const data = await collectCompetitors(
      owned.analysis.latitude,
      owned.analysis.longitude,
      brand?.industry ?? '외식',
      1000,
      brand?.category ?? undefined,
    );

    const admin = createAdminClient();
    const payload: Database['public']['Tables']['analysis_collected_data']['Insert'] = {
      analysis_id: owned.analysis.id,
      competitor_data: data,
    };
    await admin.from('analysis_collected_data').upsert(payload, { onConflict: 'analysis_id' });

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id/collect/competitors POST]', error);
    return NextResponse.json({ message: '경쟁점 데이터 수집 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
