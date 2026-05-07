import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthedUser, getOwnedAnalysis } from '@/app/api/analysis/_utils';
import { createStreamResponse, generateStructuredExtraction } from '@/lib/ai/stream-handler';
import { buildSectionPrompt } from '@/lib/ai/prompts/analysis';
import type { BrandData } from '@/lib/ai/prompts/analysis';
import { SECTION_ORDER } from '@/lib/ai/prompts/report-sections';
import { ANALYSIS_SYSTEM_PROMPT, SCORING_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CollectedData, Recommendation, ReportSections } from '@/types/analysis';
import type { DbDisclosureParsedData } from '@/types/database';

// PRD 버그 4: 구조화된 점수 추출 Zod 스키마
const scoringSchema = z.object({
  scores: z.object({
    location:     z.object({ score: z.number().min(0).max(100), reason: z.string() }),
    demand:       z.object({ score: z.number().min(0).max(100), reason: z.string() }),
    competition:  z.object({ score: z.number().min(0).max(100), reason: z.string() }),
    profitability:z.object({ score: z.number().min(0).max(100), reason: z.string() }),
    growth:       z.object({ score: z.number().min(0).max(100), reason: z.string() }),
    brand_fit:    z.object({ score: z.number().min(0).max(100), reason: z.string() }),
  }),
  total_avg: z.number().min(0).max(100),
  grade: z.string(),
  recommendation: z.enum(['적극추천', '조건부추천', '재검토필요', '반려']),
});

type ScoringResult = z.infer<typeof scoringSchema>;

export const maxDuration = 25;
export const dynamic = 'force-dynamic';

const extractScoreFromText = (text: string): number => {
  const match = text.match(/(\d{1,3})\.?\d*\s*점/);
  const raw = match?.[1] ? Number.parseInt(match[1], 10) : 0;
  return Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
};

const extractRecommendationFromText = (text: string): Recommendation => {
  if (text.includes('적극추천') || text.includes('적극 추천') || text.includes('강력 추천') || text.includes('강력추천')) return '적극추천';
  if (text.includes('조건부추천') || text.includes('조건부 추천') || text.includes('조건부로') || text.includes('조건부 권장') || text.includes('조건부 출점') || text.includes('조건부출점')) return '조건부추천';
  if (text.includes('재검토') || text.includes('신중') || text.includes('보류')) return '재검토필요';
  if (text.includes('반려') || text.includes('출점 불가') || text.includes('비추천')) return '반려';
  return '조건부추천'; // 명확한 권고가 없으면 조건부추천 기본값
};

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
    const analysis = owned.analysis;

    const [{ data: brand }, { data: parsed }, { data: collected }] = await Promise.all([
      auth.supabase.from('brands').select('*').eq('id', analysis.brand_id).single(),
      analysis.disclosure_id
        ? auth.supabase.from('disclosure_parsed_data').select('*').eq('disclosure_id', analysis.disclosure_id).maybeSingle()
        : Promise.resolve({ data: null }),
      auth.supabase.from('analysis_collected_data').select('*').eq('analysis_id', analysis.id).single(),
    ]);

    if (!brand || !collected) {
      return NextResponse.json({ message: '분석 데이터가 준비되지 않았습니다.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 이미 생성 중이거나 완료된 경우 — React 19 strict mode 더블 마운트 방지
    if (analysis.status === 'generating') {
      return NextResponse.json({ message: '이미 보고서를 생성 중입니다.' }, { status: 409 });
    }
    if (analysis.status === 'completed') {
      // 완료된 경우 기존 데이터를 SSE로 스트리밍
      const { data: existing } = await admin.from('analysis_reports')
        .select('report_sections, report_html')
        .eq('analysis_id', analysis.id)
        .maybeSingle();
      if (existing?.report_sections) {
        const body = SECTION_ORDER.map((section) => {
          const html = (existing.report_sections as Record<string, string>)[section] ?? '';
          return `data: ${JSON.stringify({ type: 'section_complete', section, html })}\n\n`;
        }).join('') + `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
        return new Response(body, {
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
        });
      }
    }

    await admin.from('analyses').update({ status: 'generating', error_message: null }).eq('id', analysis.id);

    const parsedData = parsed as DbDisclosureParsedData | null;
    const brandData: BrandData = {
      brand_name: brand.brand_name,
      company_name: brand.company_name,
      category: brand.category,
      industry: brand.industry,
      franchise_fee: brand.franchise_fee,
      education_fee: brand.education_fee,
      royalty_type: brand.royalty_type,
      royalty_amount: brand.royalty_amount,
      interior_cost_per_pyeong: brand.interior_cost_per_pyeong,
      avg_monthly_revenue: brand.avg_monthly_revenue,
      total_stores: brand.total_stores,
      avg_sales: (parsedData?.avg_sales as BrandData['avg_sales']) ?? null,
      fees: (parsedData?.fees as BrandData['fees']) ?? null,
    };

    const collectedData: CollectedData = {
      population: collected.population_data as CollectedData['population'],
      commercial: collected.commercial_data as CollectedData['commercial'],
      rent: collected.rent_data as CollectedData['rent'],
      competitors: collected.competitor_data as CollectedData['competitors'],
      location: collected.location_data as CollectedData['location'],
      data_sources: collected.data_sources as CollectedData['data_sources'],
    };

    const sectionsAcc: ReportSections = {};

    const reportSections = SECTION_ORDER.map((section) => ({
      section,
      prompt: buildSectionPrompt(section, brandData, collectedData),
    }));

    const source = createStreamResponse(reportSections, ANALYSIS_SYSTEM_PROMPT);
    let outerClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = source.getReader();
        const decoder = new TextDecoder();

        const safeEnqueue = (data: Uint8Array) => {
          if (!outerClosed) {
            try { controller.enqueue(data); } catch { outerClosed = true; }
          }
        };
        const safeClose = () => {
          if (!outerClosed) {
            outerClosed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        };

        try {
          while (true) {
            if (outerClosed) break;
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              safeEnqueue(value);
              const text = decoder.decode(value, { stream: true });
              const chunks = text.split('\n\n').filter((line) => line.startsWith('data: '));
              for (const chunk of chunks) {
                const json = chunk.slice(6);
                try {
                  const event = JSON.parse(json) as
                    | { type: 'section_complete'; section: keyof ReportSections; html: string }
                    | { type: 'error'; message: string }
                    | { type: 'complete' };

                  if (event.type === 'section_complete') {
                    sectionsAcc[event.section] = event.html;
                    await admin.from('analysis_reports').upsert(
                      {
                        analysis_id: analysis.id,
                        report_sections: sectionsAcc,
                        llm_model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
                      },
                      { onConflict: 'analysis_id' },
                    );
                  }
                } catch {
                  // ignore partial JSON chunk
                }
              }
            }
          }

          const reportHtml = SECTION_ORDER.map((section) => `<h2>${section}</h2>${sectionsAcc[section] ?? ''}`).join('\n');

          // PRD 버그 4: generateObject + Zod 스키마로 구조화된 점수 추출
          let totalScore = 0;
          let recommendation: Recommendation = '조건부추천';
          let scoringResult: ScoringResult | null = null;

          try {
            const fullReportText = SECTION_ORDER
              .map((s) => sectionsAcc[s] ?? '')
              .filter(Boolean)
              .join('\n\n');

            scoringResult = await generateStructuredExtraction(
              SCORING_SYSTEM_PROMPT,
              `다음 상권분석 보고서를 읽고 6개 항목을 평가하십시오:\n\n${fullReportText.slice(0, 12000)}`,
              scoringSchema,
            );

            totalScore = Math.round(scoringResult.total_avg * 10) / 10;
            recommendation = scoringResult.recommendation;

            // 프론트엔드에 점수 업데이트 이벤트 전송
            safeEnqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'score_update', total: totalScore, recommendation, scores: scoringResult.scores, grade: scoringResult.grade })}\n\n`,
              ),
            );
          } catch (scoringError) {
            // 구조화 추출 실패 시 regex 폴백
            console.warn('[stream] generateObject scoring failed, falling back to regex', scoringError);
            const mergedText = `${sectionsAcc.evaluation ?? ''}\n${sectionsAcc.recommendation ?? ''}`;
            totalScore = extractScoreFromText(mergedText);
            recommendation = extractRecommendationFromText(mergedText);
          }

          await admin.from('analysis_reports').upsert(
            {
              analysis_id: analysis.id,
              report_sections: sectionsAcc,
              report_html: reportHtml,
              llm_model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
            },
            { onConflict: 'analysis_id' },
          );

          await admin
            .from('analyses')
            .update({ status: 'completed', total_score: totalScore, recommendation })
            .eq('id', analysis.id);
          safeClose();
        } catch (error) {
          console.error('[analysis/:id/stream GET] stream error', error);
          await admin
            .from('analyses')
            .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'streaming error' })
            .eq('id', analysis.id);
          if (!outerClosed) {
            safeEnqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', message: '스트리밍 실패' })}\n\n`));
          }
          safeClose();
        } finally {
          reader.releaseLock();
        }
      },
      cancel() {
        outerClosed = true;
        source.cancel().catch(() => {/* ignore */});
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[analysis/:id/stream GET]', error);
    return NextResponse.json({ message: '스트리밍 준비 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
