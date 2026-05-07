"use client";

import * as React from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { AiSummary } from "@/components/recommend/AiSummary";
import { CollectionStatus } from "@/components/recommend/CollectionStatus";
import { ListingCard } from "@/components/recommend/ListingCard";
import { MatchScore } from "@/components/recommend/MatchScore";
import { PromptInput } from "@/components/recommend/PromptInput";
import { RecommendHistory } from "@/components/recommend/RecommendHistory";
import { RegionSelector } from "@/components/recommend/RegionSelector";
import { ResultMap } from "@/components/recommend/ResultMap";
import { Button } from "@/components/ui/button";
import { useRecommendStore } from "@/stores/recommendStore";
import type {
  DbRecommendationResult,
  MatchedListing,
  RecommendDetailResponse,
  RecommendHistoryResponse,
  RecommendResponse,
  SelectedRegion,
} from "@/types/recommend";

type ApiError = { message?: string; error?: string };

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const json = await safeReadJson(response);
  if (json && typeof json === "object" && json !== null && ("message" in json || "error" in json)) {
    const e = json as ApiError;
    return (e.message ?? e.error ?? "요청에 실패했습니다.").toString();
  }
  return "요청에 실패했습니다.";
}

function regionDisplayName(region: SelectedRegion | null): string {
  if (!region) return "";
  return `${region.sido} ${region.gugun}`.trim();
}

export default function DashboardRecommendPage() {
  const selectedRegion = useRecommendStore((s) => s.selectedRegion);
  const setSelectedRegion = useRecommendStore((s) => s.setSelectedRegion);

  const collectionStatus = useRecommendStore((s) => s.collectionStatus);
  const collectedCount = useRecommendStore((s) => s.collectedCount);
  const lastCollectedAt = useRecommendStore((s) => s.lastCollectedAt);
  const progressCurrent = useRecommendStore((s) => s.progressCurrent);
  const progressTotal = useRecommendStore((s) => s.progressTotal);
  const progressPage = useRecommendStore((s) => s.progressPage);
  const setCollectionStatus = useRecommendStore((s) => s.setCollectionStatus);

  const prompt = useRecommendStore((s) => s.prompt);
  const setPrompt = useRecommendStore((s) => s.setPrompt);
  const isAnalyzing = useRecommendStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useRecommendStore((s) => s.setIsAnalyzing);

  const currentResult = useRecommendStore((s) => s.currentResult);
  const currentListings = useRecommendStore((s) => s.currentListings);
  const setCurrentResult = useRecommendStore((s) => s.setCurrentResult);

  const history = useRecommendStore((s) => s.history);
  const setHistory = useRecommendStore((s) => s.setHistory);

  const [selectedListingId, setSelectedListingId] = React.useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const selectedListing: MatchedListing | null = React.useMemo(() => {
    if (currentListings.length === 0) return null;
    const found = selectedListingId ? currentListings.find((l) => l.id === selectedListingId) : null;
    return found ?? currentListings[0] ?? null;
  }, [currentListings, selectedListingId]);

  React.useEffect(() => {
    if (currentListings.length === 0) {
      setSelectedListingId(null);
      return;
    }
    if (selectedListingId && currentListings.some((l) => l.id === selectedListingId)) return;
    setSelectedListingId(currentListings[0]?.id ?? null);
  }, [currentListings, selectedListingId]);

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/recommend/history?limit=20&page=1", { cache: "no-store" });
      if (!response.ok) {
        // history는 UX 보조 데이터이므로 조용히 실패 처리
        return;
      }
      const json = (await response.json()) as RecommendHistoryResponse;
      setHistory(Array.isArray(json?.results) ? json.results : []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [setHistory]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const loadRecommendationById = React.useCallback(
    async (id: string) => {
      setIsAnalyzing(true);
      try {
        const response = await fetch(`/api/recommend/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(await getResponseErrorMessage(response));

        const json = (await response.json()) as RecommendDetailResponse;
        setCurrentResult(json.result ?? null, Array.isArray(json.listings) ? json.listings : []);
        setSelectedListingId(json.listings?.[0]?.id ?? null);
      } catch (e) {
        console.error("[recommend detail] failed", e);
        toast.error(e instanceof Error ? e.message : "추천 결과를 불러오지 못했습니다.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setCurrentResult, setIsAnalyzing],
  );

  const submitRecommend = React.useCallback(async () => {
    const regionCode = selectedRegion?.code ?? null;
    const regionName = regionDisplayName(selectedRegion) || undefined;
    const promptText = prompt.trim();

    if (!regionCode) {
      toast.error("지역을 먼저 선택해주세요.");
      return;
    }
    if (!promptText) {
      toast.error("조건을 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionCode, regionName, prompt: promptText }),
      });

      if (!response.ok) throw new Error(await getResponseErrorMessage(response));
      const json = (await response.json()) as RecommendResponse;

      setCurrentResult(json.result ?? null, Array.isArray(json.listings) ? json.listings : []);
      setSelectedListingId(json.listings?.[0]?.id ?? null);
      toast.success("AI 추천 결과를 불러왔습니다.");
      void loadHistory();
    } catch (e) {
      console.error("[recommend] failed", e);
      toast.error(e instanceof Error ? e.message : "AI 추천 요청에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [loadHistory, prompt, selectedRegion, setCurrentResult, setIsAnalyzing]);

  const collectFromServer = React.useCallback(async () => {
    if (!selectedRegion?.code) {
      toast.error("지역을 먼저 선택해주세요.");
      return;
    }

    // API 라우트가 없는 환경에서도 화면이 깨지지 않도록 보호
    setCollectionStatus("collecting");
    try {
      const response = await fetch("/api/listings/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listings: [], regionCode: selectedRegion.code }),
      });

      if (!response.ok) throw new Error(await getResponseErrorMessage(response));
      toast.success("서버 수집을 요청했습니다.");
      setCollectionStatus("done");
    } catch (e) {
      console.error("[collect] failed", e);
      setCollectionStatus("error");
      toast.error(e instanceof Error ? e.message : "수집 요청에 실패했습니다.");
    }
  }, [selectedRegion, setCollectionStatus]);

  const recommendationId = currentResult?.id ?? "";
  const showAiSummary = Boolean(currentResult) || isAnalyzing;

  return (
    <PageContainer
      title="AI 매물 추천"
      description="지역과 조건을 입력하면 최적 매물을 AI가 추천합니다."
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main */}
          <div className="space-y-6 lg:col-span-8">
            <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">지역 선택</p>
                    <p className="text-xs text-muted-foreground">추천 범위를 설정합니다.</p>
                  </div>

                  <RegionSelector
                    selectedSido={selectedRegion?.sido ?? ""}
                    selectedGugun={selectedRegion?.gugun ?? ""}
                    onChange={(sido, gugun, code) => {
                      if (!sido) {
                        setSelectedRegion(null);
                        return;
                      }
                      setSelectedRegion({ sido, gugun, code });
                    }}
                  />
                </div>

                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={() => void submitRecommend()}
                  isLoading={isAnalyzing}
                  disabled={!selectedRegion?.code}
                />
              </div>
            </section>

            {selectedRegion ? (
              <CollectionStatus
                regionCode={selectedRegion.code}
                collectedCount={collectedCount}
                lastCollectedAt={lastCollectedAt}
                status={collectionStatus}
                progressCurrent={progressCurrent || undefined}
                progressTotal={progressTotal || undefined}
                progressPage={progressPage || undefined}
                onCollect={() => void collectFromServer()}
              />
            ) : null}

            {showAiSummary ? (
              <AiSummary summary={currentResult?.ai_summary ?? null} isLoading={isAnalyzing} />
            ) : null}

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">지도</p>
                  <p className="text-xs text-muted-foreground">
                    {currentListings.length > 0 ? `${currentListings.length.toLocaleString()}건 표시` : "-"}
                  </p>
                </div>

                <ResultMap
                  listings={currentListings}
                  selectedId={selectedListingId}
                  onMarkerClick={(id) => setSelectedListingId(id)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">추천 매물</p>
                  {currentResult ? (
                    <p className="text-xs text-muted-foreground">
                      {regionDisplayName(selectedRegion) || currentResult.region_name || "-"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">조건을 입력하면 결과가 표시됩니다</p>
                  )}
                </div>

                {currentListings.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-border bg-muted/30 p-6 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">아직 추천 결과가 없습니다</p>
                      <p className="text-xs text-muted-foreground">
                        지역을 선택하고 조건을 입력한 뒤 <span className="font-medium text-foreground">AI 추천 받기</span>를 눌러주세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentListings.map((listing, idx) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        rank={idx + 1}
                        onSelect={(l) => setSelectedListingId(l.id)}
                        isSelected={listing.id === selectedListingId}
                        recommendationId={recommendationId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Side */}
          <aside className="space-y-6 lg:col-span-4">
            <MatchScore score={selectedListing?.matchScore ?? 0} reasons={selectedListing?.matchReasons ?? []} />

            <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">추천 이력</p>
                  <p className="text-xs text-muted-foreground">이전 결과를 빠르게 다시 불러옵니다.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={historyLoading}
                  onClick={() => void loadHistory()}
                >
                  새로고침
                </Button>
              </div>

              <div className="mt-4">
                <RecommendHistory
                  history={history}
                  onSelect={(h: DbRecommendationResult) => {
                    void loadRecommendationById(h.id);
                  }}
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
