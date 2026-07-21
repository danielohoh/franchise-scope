import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { fetchApartmentsForRegion } from "@/lib/apartments";
import type { ApartmentsResponse } from "@/types/recommend";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const regionCode = searchParams.get("regionCode");

  if (!regionCode || regionCode.trim().length === 0) {
    return NextResponse.json(
      { error: "regionCode 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const apartments = await fetchApartmentsForRegion(regionCode);

    // 캐시 여부: id가 비어있지 않으면 DB에서 가져온 것
    const cached = apartments.length > 0 && apartments[0].id !== "";

    return NextResponse.json<ApartmentsResponse>({
      apartments,
      cached,
      total: apartments.length,
    });
  } catch (error) {
    console.error("[data/apartments]", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
