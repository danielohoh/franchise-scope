"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CollectStatus = "idle" | "loading" | "done" | "error";

type CollectionProgressProps = {
  analysisId: string;
  brand: { id: string; industry: string; category: string | null };
  lat: number;
  lng: number;
  targetSizePyeong?: number;
  onComplete: () => void;
};

type ApiError = { message?: string; error?: string };

type TaskKey = "population" | "commercial" | "competitors" | "rent" | "finalize";

const taskLabels: Record<TaskKey, string> = {
  population: "인구 데이터 수집",
  commercial: "상권 분석 데이터 수집",
  competitors: "경쟁점 조회",
  rent: "임대 시세 수집",
  finalize: "정리 중",
};

function statusTone(status: CollectStatus) {
  if (status === "done") return "done";
  if (status === "error") return "error";
  if (status === "loading") return "loading";
  return "idle";
}

export function CollectionProgress({
  analysisId,
  brand,
  lat,
  lng,
  targetSizePyeong,
  onComplete,
}: CollectionProgressProps) {
  const [status, setStatus] = React.useState<Record<TaskKey, CollectStatus>>({
    population: "idle",
    commercial: "idle",
    competitors: "idle",
    rent: "idle",
    finalize: "idle",
  });
  const [detail, setDetail] = React.useState<Partial<Record<TaskKey, string>>>({});
  const [started, setStarted] = React.useState(false);

  const setTask = React.useCallback((key: TaskKey, s: CollectStatus, message?: string) => {
    setStatus((prev) => ({ ...prev, [key]: s }));
    if (message) setDetail((prev) => ({ ...prev, [key]: message }));
  }, []);

  const post = React.useCallback(
    async (url: string, body?: unknown) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const message =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "요청에 실패했습니다.")
            : "요청에 실패했습니다.";
        throw new Error(message);
      }

      return json;
    },
    [],
  );

  const run = React.useCallback(async () => {
    if (started) return;
    setStarted(true);

    const base = `/api/analysis/${encodeURIComponent(analysisId)}/collect`;

    const tasks: Array<{ key: TaskKey; run: () => Promise<void> }> = [
      {
        key: "population",
        run: async () => {
          await post(`${base}/population`, { lat, lng });
        },
      },
      {
        key: "commercial",
        run: async () => {
          await post(`${base}/commercial`, { industry: brand.industry, lat, lng });
        },
      },
      {
        key: "competitors",
        run: async () => {
          await post(`${base}/competitors`, { industry: brand.industry, lat, lng });
        },
      },
      {
        key: "rent",
        run: async () => {
          await post(`${base}/rent`, {
            target_size_pyeong: typeof targetSizePyeong === "number" ? targetSizePyeong : undefined,
            lat,
            lng,
          });
        },
      },
    ];

    const results = await Promise.all(
      tasks.map(async ({ key, run }) => {
        setTask(key, "loading");
        try {
          await run();
          setTask(key, "done");
          return { key, ok: true as const };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "수집에 실패했습니다.";
          setTask(key, "error", msg);
          return { key, ok: false as const, message: msg };
        }
      }),
    );

    const hasError = results.some((r) => !r.ok);
    if (hasError) {
      toast.error("일부 데이터 수집에 실패했습니다. 다시 시도하거나 상세 페이지에서 확인해주세요.");
      setStarted(false);
      return;
    }

    setTask("finalize", "loading");
    try {
      await post(`${base}/finalize`);
      setTask("finalize", "done");
      onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "정리 단계에 실패했습니다.";
      setTask("finalize", "error", msg);
      toast.error(msg);
      setStarted(false);
    }
  }, [analysisId, brand.industry, lat, lng, onComplete, post, setTask, started, targetSizePyeong]);

  React.useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDone =
    status.population === "done" &&
    status.commercial === "done" &&
    status.competitors === "done" &&
    status.rent === "done" &&
    (status.finalize === "done" || status.finalize === "idle");

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">데이터 수집</p>
          <p className="text-sm text-muted-foreground">필요한 공공/상권/경쟁/임대 데이터를 수집 중입니다.</p>
        </div>
        {allDone ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            <CheckCircle2 className="size-3.5" />
            완료
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-600/20">
            <Loader2 className="size-3.5 animate-spin" />
            진행 중
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(Object.keys(taskLabels) as TaskKey[]).filter((k) => k !== "finalize").map((k) => {
          const tone = statusTone(status[k]);
          return (
            <div key={k} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">🔵 {taskLabels[k]}</p>
                  {detail[k] ? <p className="mt-1 text-xs text-muted-foreground">{detail[k]}</p> : null}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                    tone === "done"
                      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20"
                      : tone === "error"
                        ? "bg-rose-500/10 text-rose-700 ring-rose-600/20"
                        : tone === "loading"
                          ? "bg-sky-500/10 text-sky-700 ring-sky-600/20"
                          : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {status[k] === "done" ? (
                    <CheckCircle2 className="mr-1 size-3.5" />
                  ) : status[k] === "error" ? (
                    <XCircle className="mr-1 size-3.5" />
                  ) : status[k] === "loading" ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : null}
                  {status[k] === "done"
                    ? "완료"
                    : status[k] === "error"
                      ? "실패"
                      : status[k] === "loading"
                        ? "수집 중"
                        : "대기"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {Object.values(status).some((s) => s === "error") ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">일부 작업이 실패했습니다.</p>
          <p className="text-destructive/80">네트워크/권한/서버 설정 문제일 수 있어요. 다시 시도해볼까요?</p>
          <div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void run()}>
              다시 시도
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
