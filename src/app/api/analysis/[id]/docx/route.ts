import { NextResponse } from 'next/server';

import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import { buildDocx } from '@/lib/report/docx-builder';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CollectedData } from '@/types/analysis';
import type { ReportSections } from '@/types/report';

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

    const [{ data: brand }, { data: report }, { data: collected }] = await Promise.all([
      auth.supabase.from('brands').select('*').eq('id', owned.analysis.brand_id).single(),
      auth.supabase.from('analysis_reports').select('*').eq('analysis_id', owned.analysis.id).single(),
      auth.supabase.from('analysis_collected_data').select('*').eq('analysis_id', owned.analysis.id).single(),
    ]);

    if (!brand || !report || !collected) {
      return NextResponse.json({ message: 'DOCX 생성에 필요한 데이터가 없습니다.' }, { status: 400 });
    }

    const buffer = await buildDocx(
      owned.analysis,
      brand,
      (report.report_sections as ReportSections | null) ?? {},
      {
        population: collected.population_data as CollectedData['population'],
        commercial: collected.commercial_data as CollectedData['commercial'],
        rent: collected.rent_data as CollectedData['rent'],
        competitors: collected.competitor_data as CollectedData['competitors'],
        location: collected.location_data as CollectedData['location'],
        data_sources: collected.data_sources as CollectedData['data_sources'],
      },
    );

    const filePath = `reports/${auth.user.id}/${owned.analysis.id}.docx`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from('reports')
      .upload(filePath, buffer, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    if (uploadError) {
      return NextResponse.json({ message: 'DOCX 업로드에 실패했습니다.' }, { status: 500 });
    }

    await admin
      .from('analysis_reports')
      .upsert(
        {
          analysis_id: owned.analysis.id,
          docx_file_path: filePath,
          docx_generated_at: new Date().toISOString(),
        },
        { onConflict: 'analysis_id' },
      );

    const { data: signed } = await admin.storage.from('reports').createSignedUrl(filePath, 3600);
    return NextResponse.json({ ok: true, url: signed?.signedUrl ?? null }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id/docx POST]', error);
    return NextResponse.json({ message: 'DOCX 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
