import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import type { DbAnalysis } from '@/types/database';

export type ApiError = { message: string };

export const getAuthedUser = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, response: NextResponse.json<ApiError>({ message: '인증이 필요합니다.' }, { status: 401 }) };
  }

  return { supabase, user, response: null };
};

export const getOwnedAnalysis = async (
  analysisId: string,
  userId: string,
): Promise<{ analysis: DbAnalysis | null; forbiddenResponse: NextResponse<ApiError> | null }> => {
  const supabase = await createClient();
  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .maybeSingle();

  if (error || !analysis) {
    return {
      analysis: null,
      forbiddenResponse: NextResponse.json<ApiError>({ message: '분석 요청을 찾을 수 없습니다.' }, { status: 404 }),
    };
  }

  if (analysis.user_id !== userId) {
    return {
      analysis: null,
      forbiddenResponse: NextResponse.json<ApiError>({ message: '권한이 없습니다.' }, { status: 403 }),
    };
  }

  return { analysis, forbiddenResponse: null };
};
