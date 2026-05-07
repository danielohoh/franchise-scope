import { NextResponse } from 'next/server';

import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnalysisWithData } from '@/types/analysis';

export const maxDuration = 10;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
        NextResponse.json({ message: '분석 요청을 찾을 수 없습니다.' }, { status: 404 })
      );
    }

    const [{ data: collected_data }, { data: report }, { data: brand }] = await Promise.all([
      auth.supabase.from('analysis_collected_data').select('*').eq('analysis_id', owned.analysis.id).maybeSingle(),
      auth.supabase.from('analysis_reports').select('*').eq('analysis_id', owned.analysis.id).maybeSingle(),
      auth.supabase.from('brands').select('id, brand_name, category, industry').eq('id', owned.analysis.brand_id).single(),
    ]);

    if (!brand) {
      return NextResponse.json({ message: '브랜드 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const result: AnalysisWithData = {
      analysis: owned.analysis,
      collected_data,
      report: report
        ? {
            id: report.id,
            analysis_id: report.analysis_id,
            report_html: report.report_html,
            report_sections: report.report_sections as AnalysisWithData['report'] extends { report_sections: infer T } ? T : null,
            docx_file_path: report.docx_file_path,
            docx_generated_at: report.docx_generated_at,
            llm_model: report.llm_model,
          }
        : null,
      brand,
    };

    return NextResponse.json({ analysis: result }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id GET]', error);
    return NextResponse.json({ message: '분석 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
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
        NextResponse.json({ message: '분석 요청을 찾을 수 없습니다.' }, { status: 404 })
      );
    }

    const { data: report } = await auth.supabase
      .from('analysis_reports')
      .select('docx_file_path')
      .eq('analysis_id', owned.analysis.id)
      .maybeSingle();

    const admin = createAdminClient();
    if (report?.docx_file_path) {
      await admin.storage.from('reports').remove([report.docx_file_path]);
    }

    const { error } = await admin.from('analyses').delete().eq('id', owned.analysis.id);
    if (error) {
      return NextResponse.json({ message: '분석 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[analysis/:id DELETE]', error);
    return NextResponse.json({ message: '분석 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
