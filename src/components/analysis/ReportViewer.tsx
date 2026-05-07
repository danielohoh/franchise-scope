"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ReportSections, ReportStreamEvent } from "@/types/report";
import { useReportStore } from "@/stores/report-store";
import { cn } from "@/lib/utils";

type ReportViewerProps = {
  analysisId: string;
  onCompleteAction: (totalScore: number, recommendation: string) => void;
};

type SectionKey = keyof ReportSections;

const sectionMeta: ReadonlyArray<{ key: SectionKey; label: string }> = [
  { key: "executive_summary", label: "요약" },
  { key: "brand_overview", label: "브랜드" },
  { key: "location_analysis", label: "입지" },
  { key: "population_analysis", label: "인구" },
  { key: "competition_analysis", label: "경쟁" },
  { key: "investment_estimate", label: "투자" },
  { key: "sales_simulation", label: "매출" },
  { key: "swot", label: "SWOT" },
  { key: "evaluation", label: "평가" },
  { key: "recommendation", label: "권고" },
];

function safeParseEvent(data: string): ReportStreamEvent | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    if (!("type" in parsed)) return null;
    return parsed as ReportStreamEvent;
  } catch {
    return null;
  }
}

export function ReportViewer({ analysisId, onCompleteAction }: ReportViewerProps) {
  const sections = useReportStore((s) => s.sections);
  const currentSection = useReportStore((s) => s.currentSection);
  const isStreaming = useReportStore((s) => s.isStreaming);
  const isComplete = useReportStore((s) => s.isComplete);
  const error = useReportStore((s) => s.error);
  const setSectionDelta = useReportStore((s) => s.setSectionDelta);
  const setSectionComplete = useReportStore((s) => s.setSectionComplete);
  const setCurrentSection = useReportStore((s) => s.setCurrentSection);
  const setStreaming = useReportStore((s) => s.setStreaming);
  const setComplete = useReportStore((s) => s.setComplete);
  const setError = useReportStore((s) => s.setError);
  const reset = useReportStore((s) => s.reset);

  const [totalScore, setTotalScore] = React.useState<number | null>(null);
  const totalScoreRef = React.useRef<number | null>(null);
  const recommendationRef = React.useRef<string | null>(null);
  // React 19 strict mode 이중 마운트 방지
  const streamingRef = React.useRef(false);
  // onCompleteAction을 ref로 보관 → useEffect deps에서 제거해 router.refresh() 루프 방지
  const onCompleteActionRef = React.useRef(onCompleteAction);
  React.useLayoutEffect(() => {
    onCompleteActionRef.current = onCompleteAction;
  });
  // complete 콜백 중복 호출 방지 (router.refresh() 후 재스트리밍 시 토스트/콜백 반복 차단)
  const callbackFiredRef = React.useRef(false);

  React.useEffect(() => {
    reset();
    setError("");
    streamingRef.current = false;
    callbackFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  React.useEffect(() => {
    // 이미 스트리밍 중이면 두 번째 연결 차단
    if (streamingRef.current) return;
    streamingRef.current = true;

    const url = `/api/analysis/${encodeURIComponent(analysisId)}/stream`;
    const es = new EventSource(url);

    setStreaming(true);
    setComplete(false);
    setError("");

    es.onmessage = (ev) => {
      const event = safeParseEvent(ev.data);
      if (!event) return;

      if (event.type === "section_start") {
        setCurrentSection(String(event.section));
        return;
      }

      if (event.type === "section_delta") {
        setSectionDelta(String(event.section), event.delta);
        return;
      }

      if (event.type === "section_complete") {
        setSectionComplete(String(event.section), event.html);
        return;
      }

      if (event.type === "score_update") {
        if (typeof event.total === "number" && Number.isFinite(event.total)) {
          totalScoreRef.current = event.total;
          setTotalScore(event.total);
        }
        return;
      }

      if (event.type === "complete") {
        setStreaming(false);
        setComplete(true);
        // 최초 complete 수신 시에만 콜백/토스트 실행 (router.refresh() 후 재연결 시 중복 방지)
        if (!callbackFiredRef.current) {
          callbackFiredRef.current = true;
          const score = totalScoreRef.current;
          const rec = recommendationRef.current;
          if (typeof score === "number" && Number.isFinite(score) && rec) {
            onCompleteActionRef.current(score, rec);
          }
          toast.success("보고서 생성이 완료되었습니다.");
        }
        return;
      }

      if (event.type === "error") {
        setStreaming(false);
        setError(event.message);
        toast.error(event.message);
      }
    };

    es.onerror = (e) => {
      // 409(이미 생성 중) 또는 스트림 정상 종료 후 onerror는 무시
      if (isComplete) return;
      setStreaming(false);
      console.warn('[ReportViewer] stream error', e);
    };

    return () => {
      es.close();
      streamingRef.current = false;
    };
  // onCompleteAction은 ref(onCompleteActionRef)로 관리하므로 deps에서 제외
  // → router.refresh()로 인한 함수 참조 변경이 effect 재실행을 유발하지 않음
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, setComplete, setCurrentSection, setError, setSectionComplete, setSectionDelta, setStreaming]);

  React.useEffect(() => {
    const html = sections.recommendation;
    if (!html) return;
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      const rec = text.slice(0, 160);
      recommendationRef.current = rec;
    }
  }, [sections.recommendation]);

  const sectionProgress = sectionMeta.map((s) => ({
    ...s,
    status: sections[s.key] ? "done" : currentSection === s.key ? "active" : "idle",
  }));

  const rendered = sectionMeta
    .map((s) => ({ key: s.key, label: s.label, html: sections[s.key] ?? "" }))
    .filter((x) => x.html.length > 0);

  return (
    <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">보고서 섹션</p>
          {isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
              <CheckCircle2 className="size-3.5" />
              완료
            </span>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-600/20">
              <Loader2 className="size-3.5 animate-spin" />
              생성 중
            </span>
          ) : null}
        </div>

        {typeof totalScore === "number" ? (
          <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">현재 점수</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{Math.round(totalScore)}점</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-600/20 bg-amber-500/10 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-4" />
            <p>{error}</p>
          </div>
        ) : null}

        <nav className="mt-4 space-y-1">
          {sectionProgress.map((s) => (
            <a
              key={s.key}
              href={`#section-${s.key}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(`section-${s.key}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                s.status === "done"
                  ? "text-foreground hover:bg-muted/40"
                  : s.status === "active"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
            >
              <span className="font-medium">{s.label}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  s.status === "done"
                    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20"
                    : s.status === "active"
                      ? "bg-sky-500/10 text-sky-700 ring-sky-600/20"
                      : "bg-muted text-muted-foreground ring-border",
                )}
              >
                {s.status === "done" ? "완료" : s.status === "active" ? "작성 중" : "대기"}
              </span>
            </a>
          ))}
        </nav>
      </aside>

      <main className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        {rendered.length === 0 ? (
          <div className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert
            prose-h2:text-xl prose-h2:font-bold prose-h2:text-primary prose-h2:border-b-2 prose-h2:border-border prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-800 prose-h3:mt-6 prose-h3:mb-3
            prose-table:text-sm prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2
            prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-primary/10 prose-th:font-semibold
            prose-strong:text-slate-900 prose-em:text-muted-foreground prose-em:text-xs
          ">
            {sectionMeta.map((s) => {
              const content = sections[s.key];
              if (!content) return null;
              return (
                <section key={s.key} id={`section-${s.key}`} className="scroll-mt-24">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 테이블 가로 스크롤 래퍼
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-border">{children}</table>
                        </div>
                      ),
                      // 출처 표기 (*출처: ...*) 스타일
                      em: ({ children }) => (
                        <em className="not-italic text-xs text-muted-foreground font-normal">{children}</em>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                  <hr className="my-8 border-border" />
                </section>
              );
            })}
          </div>
        )}
      </main>
    </section>
  );
}
