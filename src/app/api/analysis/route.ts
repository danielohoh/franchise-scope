import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AnalysisCreateRequest, AnalysisSummary } from '@/types/analysis';
import type { Database } from '@/types/database';

export const maxDuration = 10;

type ApiError = { message: string };

const createSchema = z.object({
  brand_id: z.string().uuid(),
  disclosure_id: z.string().uuid().optional(),
  address: z.string().trim().min(1),
  latitude: z.number(),
  longitude: z.number(),
  target_size_pyeong: z.number().int().min(1).optional(),
  target_floor: z.string().trim().min(1).optional(),
  target_rent: z.number().int().min(0).optional(),
}) satisfies z.ZodType<AnalysisCreateRequest>;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiError>({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('analyses')
      .select('id, status, recommendation, total_score, created_at, address, brands(brand_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json<ApiError>({ message: '분석 목록 조회에 실패했습니다.' }, { status: 500 });
    }

    const analyses: AnalysisSummary[] = (data ?? []).map((item) => {
      const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
      return {
        id: item.id,
        brand_name: brand?.brand_name ?? '브랜드 미지정',
        address: item.address,
        status: item.status,
        recommendation: item.recommendation,
        total_score: item.total_score,
        created_at: item.created_at,
      };
    });

    return NextResponse.json({ analyses }, { status: 200 });
  } catch (error) {
    console.error('[analysis GET]', error);
    return NextResponse.json<ApiError>({ message: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json<ApiError>({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiError>({ message: parsed.error.issues[0]?.message ?? '잘못된 요청입니다.' }, { status: 400 });
    }

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, user_id')
      .eq('id', parsed.data.brand_id)
      .maybeSingle();
    if (brandError || !brand) {
      return NextResponse.json<ApiError>({ message: '브랜드를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (brand.user_id !== user.id) {
      return NextResponse.json<ApiError>({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const admin = createAdminClient();
    const payload: Database['public']['Tables']['analyses']['Insert'] = {
      id: crypto.randomUUID(),
      user_id: user.id,
      brand_id: parsed.data.brand_id,
      disclosure_id: parsed.data.disclosure_id ?? null,
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      target_size_pyeong: parsed.data.target_size_pyeong ?? null,
      target_floor: parsed.data.target_floor ?? null,
      target_rent: parsed.data.target_rent ?? null,
      status: 'pending',
    };

    const { data: inserted, error } = await admin.from('analyses').insert(payload).select('id').single();
    if (error || !inserted) {
      return NextResponse.json<ApiError>({ message: '분석 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ analysis_id: inserted.id }, { status: 201 });
  } catch (error) {
    console.error('[analysis POST]', error);
    return NextResponse.json<ApiError>({ message: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
