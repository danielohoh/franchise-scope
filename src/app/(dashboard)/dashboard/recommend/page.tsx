"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CollectionStatus } from "@/components/recommend/CollectionStatus";
import { PromptInput } from "@/components/recommend/PromptInput";
import { RecommendHistory } from "@/components/recommend/RecommendHistory";
import { RegionSelector } from "@/components/recommend/RegionSelector";
import { useRecommendStore } from "@/stores/recommendStore";
import type { RecommendHistoryResponse } from "@/types/recommend";

export const dynamic = "force-dynamic";

type ApiError = { error?: string; message?: string };

type CollectSSEEvent =
  | { type: "progress"; current: number; total: number; page: number }
  | { type: "saving"; count: number }
  | { type: "done"; collected: number; skipped: number }
  | { type: "error"; message: string };

export default function RecommendPage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const selectedRegion = useRecommendStore((s) => s.selectedRegion);
  const setSelectedRegion = useRecommendStore((s) => s.setSelectedRegion);

  const collectionStatus = useRecommendStore((s) => s.collectionStatus);
  const collectedCount = useRecommendStore((s) => s.collectedCount);
  const lastCollectedAt = useRecommendStore((s) => s.lastCollectedAt);
  const setCollectionStatus = useRecommendStore((s) => s.setCollectionStatus);
  const setCollectedCount = useRecommendStore((s) => s.setCollectedCount);
  const setLastCollectedAt = useRecommendStore((s) => s.setLastCollectedAt);

  const progressCurrent = useRecommendStore((s) => s.progressCurrent);
  const progressTotal = useRecommendStore((s) => s.progressTotal);
  const progressPage = useRecommendStore((s) => s.progressPage);
  const setProgress = useRecommendStore((s) => s.setProgress);
  const resetProgress = useRecommendStore((s) => s.resetProgress);

  const prompt = useRecommendStore((s) => s.prompt);
  const setPrompt = useRecommendStore((s) => s.setPrompt);
  const isAnalyzing = useRecommendStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useRecommendStore((s) => s.setIsAnalyzing);

  const history = useRecommendStore((s) => s.history);
  const setHistory = useRecommendStore((s) => s.setHistory);

  const regionCode = selectedRegion?.code?.trim() ? selectedRegion.code : null;
  const regionName = selectedRegion?.sido
    ? `${selectedRegion.sido}${selectedRegion.gugun ? ` ${selectedRegion.gugun}` : ""}`
    : null;

  // 추천 이력 로드
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/recommend/history?limit=5");
        if (!res.ok) return;
        const json = (await res.json()) as RecommendHistoryResponse | ApiError;
        setHistory((json as RecommendHistoryResponse).results ?? []);
      } catch (error) {
        console.error("[recommend] history fetch failed", error);
      }
    })();
  }, [setHistory]);

  // 언마운트 시 수집 취소
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── 서버사이드 수집 (SSE 스트리밍) ──
  async function handleCollect() {
    if (!regionCode || !regionName) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setCollectionStatus("collecting");
    resetProgress();

    try {
      const res = await fetch("/api/listings/collect-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionCode, regionName }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as ApiError;
        throw new Error(err.error ?? "수집 요청에 실패했습니다.");
      }

      // SSE 스트림 읽기
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as CollectSSEEvent;
            if (event.type === "progress") {
              setProgress(event.current, event.total, event.page);
            } else if (event.type === "saving") {
              setProgress(event.count, event.count, progressPage);
            } else if (event.type === "done") {
              setCollectedCount(event.collected);
              setLastCollectedAt(new Date());
              setCollectionStatus("done");
              resetProgress();
              toast.success(`${event.collected.toLocaleString()}건 수집 완료!`);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch {
            // JSON 파싱 오류 무시
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("[recommend] collect failed", error);
      setCollectionStatus("error");
      toast.error(error instanceof Error ? error.message : "수집 중 오류가 발생했습니다.");
    }
  }

  // ── AI 추천 제출 ──
  function handleSubmit() {
    if (!regionCode || !regionName) {
      toast.error("지역을 선택해주세요.");
      return;
    }
    if (prompt.trim().length === 0) {
      toast.error("조건을 입력해주세요.");
      return;
    }

    void (async () => {
      try {
        setIsAnalyzing(true);
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, regionName, prompt }),
        });
        const json = (await res.json()) as unknown;

        if (!res.ok) {
          const msg = (json as ApiError)?.error ?? "추천 생성에 실패했습니다.";
          throw new Error(msg);
        }

        const resultId =
          typeof json === "object" &&
          json !== null &&
          "result" in json
            ? (json as { result: { id: string } }).result.id
            : null;

        if (!resultId) throw new Error("추천 생성에 실패했습니다.");
        router.push(`/dashboard/recommend/${resultId}`);
      } catch (error) {
        console.error("[recommend] submit failed", error);
        toast.error(error instanceof Error ? error.message : "추천 생성에 실패했습니다.");
      } finally {
        setIsAnalyzing(false);
      }
    })();
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <span aria-hidden>🏪</span>
          AI 매물 추천
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          지역을 선택하면 서버에서 직방 상가 매물을 자동 수집하고 AI가 최적 매물을 추천합니다.
        </p>
      </div>

      {/* 지역 선택 + 수집 상태 */}
      <section className="space-y-3 rounded-xl border border-border bg-background p-6">
        <RegionSelector
          selectedSido={selectedRegion?.sido ?? ""}
          selectedGugun={selectedRegion?.gugun ?? ""}
          onChange={(sido, gugun, code) => {
            if (!sido) {
              setSelectedRegion(null);
              setCollectedCount(0);
              setLastCollectedAt(null);
              setCollectionStatus("idle");
              resetProgress();
              return;
            }
            setSelectedRegion({ sido, gugun, code });
            // 지역 변경 시 카운트 리셋 (새 지역이므로)
            setCollectedCount(0);
            setLastCollectedAt(null);
            setCollectionStatus("idle");
            resetProgress();
          }}
        />

        <CollectionStatus
          regionCode={regionCode}
          collectedCount={collectedCount}
          lastCollectedAt={lastCollectedAt}
          status={collectionStatus}
          progressCurrent={progressCurrent}
          progressTotal={progressTotal}
          progressPage={progressPage}
          onCollect={regionCode ? handleCollect : undefined}
        />
      </section>

      {/* AI 추천 프롬프트 */}
      <section className="rounded-xl border border-border bg-background p-6">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          isLoading={isAnalyzing}
          disabled={!regionCode || collectionStatus === "collecting" || collectedCount === 0}
          onSubmit={handleSubmit}
        />
        {regionCode && collectedCount === 0 && collectionStatus !== "collecting" && (
          <p className="mt-3 text-xs text-muted-foreground">
            💡 먼저 <strong>"서버에서 수집"</strong> 버튼을 눌러 매물을 수집하세요.
          </p>
        )}
      </section>

      {/* 추천 이력 */}
      <section className="space-y-4 rounded-xl border border-border bg-background p-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">📋 최근 추천 이력</h2>
          <p className="mt-1 text-sm text-muted-foreground">최근 5개의 추천 결과를 빠르게 다시 확인할 수 있습니다.</p>
        </div>
        <RecommendHistory
          history={history}
          onSelect={(result) => router.push(`/dashboard/recommend/${result.id}`)}
        />
      </section>
    </div>
  );
}
