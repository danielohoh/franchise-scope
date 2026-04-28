"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BuildingInfo } from "@/components/analysis/BuildingInfo";
import { HouseholdBreakdown } from "@/components/analysis/HouseholdBreakdown";
import { CommercialStatus } from "@/components/analysis/CommercialStatus";
import { NearbyFacilities } from "@/components/analysis/NearbyFacilities";
import { InvestmentAnalysis } from "@/components/analysis/InvestmentAnalysis";
import { AiLocationEval } from "@/components/analysis/AiLocationEval";
import type { AnalysisResponse } from "@/types/analysis";

export const dynamic = "force-dynamic";

type ApiError = { error?: string; message?: string };

function getListingTitle(data: AnalysisResponse | null): string {
  if (!data) return "상세 분석";
  const l = data.listing;
  const parts = [l.detail_address, l.building_name, l.article_name]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  return parts[0] ?? "상세 분석";
}

function getMatchScore(data: AnalysisResponse | null): number | null {
  if (!data) return null;
  // matchScore is not in DbNaverListing; check recommendation_results matched_listings
  // For display, we skip score in page header (it's on the card back in the list)
  return null;
}

export default function ListingAnalysisPage() {
  const params = useParams<{ id: string; listingId: string }>();
  const { id: recommendId, listingId } = params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    if (!recommendId || !listingId) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/recommend/${encodeURIComponent(recommendId)}/analysis/${encodeURIComponent(listingId)}`,
          { method: "GET" },
        );
        const json = (await res.json()) as AnalysisResponse | ApiError;
        if (!res.ok) {
          const msg =
            (json as ApiError).error ??
            (json as ApiError).message ??
            "분석 데이터를 불러오지 못했습니다.";
          throw new Error(msg);
        }
        setData(json as AnalysisResponse);
      } catch (error) {
        console.error("[analysis] fetch failed", error);
        toast.error(
          error instanceof Error ? error.message : "분석 데이터를 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [recommendId, listingId]);

  const title = getListingTitle(data);
  const naverUrl = data?.listing.naver_url ?? null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={() => {
                window.location.href = `/dashboard/recommend/${recommendId}`;
              }}
            >
              <ArrowLeft className="size-4" />
              추천 결과로
            </Button>
            <h1 className="text-lg font-bold text-foreground line-clamp-1">{title}</h1>
          </div>
          {data?.listing.area_pyeong != null ? (
            <p className="text-sm text-muted-foreground pl-2">
              {Math.round(data.listing.area_pyeong)}평 | {data.listing.trade_type}
              {data.listing.monthly_rent != null
                ? ` | 월세 ${data.listing.monthly_rent.toLocaleString()}만`
                : null}
              {data.listing.sale_price != null
                ? ` | 매매 ${(data.listing.sale_price / 10000).toFixed(1)}억`
                : null}
            </p>
          ) : null}
        </div>

        {naverUrl ? (
          <a href={naverUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="outline" className="shrink-0 rounded-xl">
              <ExternalLink className="size-4" />
              부동산 매물 보기
            </Button>
          </a>
        ) : null}
      </div>

      {/* 섹션 1: 건물 기본 정보 */}
      <BuildingInfo data={data?.building ?? null} loading={loading} />

      {/* 섹션 2: 주변 세대수 */}
      <HouseholdBreakdown
        data={
          data?.households ?? { total: 0, radiusMeters: 1000, complexes: [] }
        }
        loading={loading}
      />

      {/* 섹션 3: 주변 상권 현황 */}
      <CommercialStatus data={data?.commercial ?? null} loading={loading} />

      {/* 섹션 4: 주변 핵심 시설 */}
      <NearbyFacilities
        data={data?.facilities ?? { categories: [] }}
        loading={loading}
      />

      {/* 섹션 5: 투자 수익성 */}
      {!loading && data ? (
        <InvestmentAnalysis data={data.investment} loading={false} />
      ) : (
        <InvestmentAnalysis
          data={{
            tradeType: "",
            pricePerPyeong: { deposit: null, monthlyRent: null, sale: null },
            annualCost: { rent: null, maintenance: null, total: null },
            surfaceYieldPercent: null,
            depositToSaleRatio: null,
            breakEvenScenarios: null,
          }}
          loading={true}
        />
      )}

      {/* 섹션 6: AI 입지 종합 평가 */}
      <AiLocationEval data={data?.aiEval ?? null} loading={loading} />
    </div>
  );
}
