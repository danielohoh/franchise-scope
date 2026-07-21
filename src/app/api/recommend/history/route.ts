import { NextResponse } from "next/server";

import { createUntypedAdminClient } from "@/lib/supabase/untyped-admin";
import { getAuthUser } from "@/lib/supabase/auth-bearer";
import type {
  DbRecommendationResult,
  RecommendHistoryResponse,
} from "@/types/recommend";

export async function GET(request: Request) {
  const { user, error: authError } = await getAuthUser(request);

  if (authError || !user) {
    return NextResponse.json(
      { error: authError ?? "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const supabase = createUntypedAdminClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
  );
  const offset = (page - 1) * limit;

  try {
    // 전체 건수 조회
    const { count, error: countError } = await supabase
      .from("recommendation_results")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("[recommend/history] count 실패:", countError);
      return NextResponse.json(
        { error: "이력 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    // 페이지네이션 적용하여 결과 조회
    const { data: results, error: listError } = await supabase
      .from("recommendation_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (listError) {
      console.error("[recommend/history] list 실패:", listError);
      return NextResponse.json(
        { error: "이력 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json<RecommendHistoryResponse>({
      results: (results ?? []) as DbRecommendationResult[],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[recommend/history]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
