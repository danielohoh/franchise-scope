"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { AiSummary } from "@/components/recommend/AiSummary";
import { ListingCard } from "@/components/recommend/ListingCard";
import { ResultMap } from "@/components/recommend/ResultMap";
import { Button } from "@/components/ui/button";
import type { DbRecommendationResult, MatchedListing, RecommendDetailResponse } from "@/types/recommend";

export const dynamic = "force-dynamic";

type ApiError = { error?: string; message?: string };

export default function RecommendDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DbRecommendationResult | null>(null);
  const [listings, setListings] = useState<MatchedListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const regionLabel = useMemo(() => (result?.region_name ?? "-").trim() || "-", [result?.region_name]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/recommend/${encodeURIComponent(id)}`, { method: "GET" });
        const json = (await res.json()) as RecommendDetailResponse | ApiError;
        if (!res.ok) {
          const msg = (json as ApiError).error ?? (json as ApiError).message ?? "결과를 불러오지 못했습니다.";
          throw new Error(msg);
        }
        const data = json as RecommendDetailResponse;
        setResult(data.result);
        setListings(data.listings ?? []);
        setSelectedId((data.listings?.[0]?.id as string | undefined) ?? null);
      } catch (error) {
        console.error("[recommend] detail fetch failed", error);
        toast.error(error instanceof Error ? error.message : "결과를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => { window.location.href = "/dashboard/recommend"; }}>
              <ArrowLeft className="size-4" />
              돌아가기
            </Button>
            <h1 className="text-xl font-bold text-foreground">AI 추천 결과 - {regionLabel}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{result ? `"${result.prompt_text}"` : ""}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-xl"
          onClick={() => { window.location.href = "/dashboard/recommend"; }}
        >
          <RefreshCcw className="size-4" />
          조건 수정하여 재검색
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">🗺️ 위치</p>
            <p className="mt-1 text-xs text-muted-foreground">선택한 매물은 빨간 마커로 표시됩니다.</p>
          </div>

          {loading ? (
            <div className="h-[420px] animate-pulse rounded-xl border border-border bg-muted" />
          ) : (
            <ResultMap
              listings={listings}
              selectedId={selectedId}
              onMarkerClick={(nextId) => setSelectedId(nextId)}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">📋 매칭 매물 ({listings.length}건)</p>
            <p className="mt-1 text-xs text-muted-foreground">카드를 선택하면 지도 마커와 동기화됩니다.</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-6 text-center">
              <p className="text-sm font-semibold text-foreground">매칭된 매물이 없습니다</p>
              <p className="mt-1 text-sm text-muted-foreground">조건을 수정해서 다시 검색해보세요.</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
              {listings.map((listing, idx) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  rank={idx + 1}
                  isSelected={listing.id === selectedId}
                  onSelect={(l) => setSelectedId(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <AiSummary summary={result?.ai_summary ?? null} isLoading={loading} />
    </div>
  );
}
