"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ParseStage = "idle" | "running" | "done" | "failed";

export type ParseProgressProps = {
  disclosureId: string;
  onCompleteAction: () => void;
};

type StepKey =
  | "extract-text"
  | "fees"
  | "franchisees"
  | "sales"
  | "financials"
  | "menu"
  | "contract"
  | "finalize";

type Step = {
  key: StepKey;
  label: string;
  description?: string;
  stage: ParseStage;
};

type ApiError = { message?: string; error?: string };

const INITIAL_STEPS: ReadonlyArray<Omit<Step, "stage">> = [
  { key: "extract-text", label: "텍스트 추출", description: "extract-text" },
  { key: "fees", label: "가맹비/개점비용", description: "fees" },
  { key: "franchisees", label: "가맹점 현황", description: "franchisees" },
  { key: "sales", label: "평균 매출", description: "sales" },
  { key: "financials", label: "재무제표", description: "financials" },
  { key: "menu", label: "메뉴/가격", description: "menu" },
  { key: "contract", label: "계약 조건", description: "contract" },
  { key: "finalize", label: "최종 반영", description: "finalize" },
];

function safeErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  return fallback;
}

function StepIcon({ stage }: { stage: ParseStage }) {
  if (stage === "running") return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (stage === "done") return <CheckCircle2 className="size-4 text-primary" />;
  if (stage === "failed") return <XCircle className="size-4 text-destructive" />;
  return <div className="size-4 rounded-full border border-border" aria-hidden="true" />;
}

export function ParseProgressTracker({ disclosureId, onCompleteAction }: ParseProgressProps) {
  const [steps, setSteps] = React.useState<Step[]>(() =>
    INITIAL_STEPS.map((s) => ({ ...s, stage: "idle" })),
  );
  const [busy, setBusy] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);

  const completedCount = steps.filter((s) => s.stage === "done").length;
  const failedCount = steps.filter((s) => s.stage === "failed").length;
  const totalCount = steps.length;
  const percent = Math.round((completedCount / Math.max(1, totalCount)) * 100);

  const setStage = React.useCallback((key: StepKey, stage: ParseStage) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, stage } : s)));
  }, []);

  const reset = React.useCallback(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, stage: "idle" })));
    setBusy(false);
    setHasStarted(false);
  }, []);

  const postJson = React.useCallback(async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.ok) return;

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // ignore
    }

    const message =
      (json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
        ? ((json as ApiError).message ?? (json as ApiError).error)
        : null) ?? `요청에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }, []);

  const run = React.useCallback(async () => {
    if (!disclosureId) return;
    if (busy) return;

    setBusy(true);
    setHasStarted(true);

    try {
      // 1) extract text
      setStage("extract-text", "running");
      await postJson(`/api/disclosure/${encodeURIComponent(disclosureId)}/extract-text`);
      setStage("extract-text", "done");

      // 2) parse sections in parallel
      const sectionKeys: Array<Exclude<StepKey, "extract-text" | "finalize">> = [
        "fees",
        "franchisees",
        "sales",
        "financials",
        "menu",
        "contract",
      ];

      sectionKeys.forEach((k) => setStage(k, "running"));

      const results = await Promise.allSettled(
        sectionKeys.map((section) =>
          postJson(`/api/disclosure/${encodeURIComponent(disclosureId)}/parse-section`, { section }),
        ),
      );

      const failed: { key: StepKey; reason: string }[] = [];
      results.forEach((r, idx) => {
        const key = sectionKeys[idx];
        if (r.status === "fulfilled") {
          setStage(key, "done");
        } else {
          setStage(key, "failed");
          failed.push({ key, reason: safeErrorMessage(r.reason, "섹션 파싱에 실패했습니다.") });
        }
      });

      if (failed.length > 0) {
        const message = `일부 섹션 파싱에 실패했습니다. (${failed.length}개)`;
        toast.error(message);
        throw new Error(message);
      }

      // 3) finalize
      setStage("finalize", "running");
      await postJson(`/api/disclosure/${encodeURIComponent(disclosureId)}/finalize`);
      setStage("finalize", "done");

      toast.success("파싱이 완료되었습니다.");
      onCompleteAction();
    } catch (error) {
      console.error("[disclosure parse] failed", error);
      const message = safeErrorMessage(error, "파싱에 실패했습니다.");
      toast.error(message);
      // If a request failed before marking, ensure finalize isn't stuck running.
      setSteps((prev) =>
        prev.map((s) => (s.stage === "running" ? { ...s, stage: "failed" } : s)),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, disclosureId, onCompleteAction, postJson, setStage]);

  React.useEffect(() => {
    void run();
    // run on mount only (disclosureId is stable in flow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disclosureId]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-semibold">파싱 진행 상황</h2>
          <p className="text-sm text-muted-foreground">문서를 분석하여 섹션별 데이터를 추출합니다.</p>
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                reset();
                void run();
              }}
              disabled={busy}
            >
              다시 시도
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{percent}%</span>
          <span className="tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, idx) => (
          <li
            key={step.key}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-background p-3",
              step.stage === "failed" ? "border-destructive/30 bg-destructive/5" : null,
            )}
          >
            <div className="mt-0.5 shrink-0">
              <StepIcon stage={step.stage} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="mr-2 text-xs text-muted-foreground tabular-nums">{idx + 1}.</span>
                  {step.label}
                </p>
                <span
                  className={cn(
                    "text-xs font-medium",
                    step.stage === "done"
                      ? "text-primary"
                      : step.stage === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {step.stage === "idle"
                    ? hasStarted
                      ? "대기"
                      : "시작 전"
                    : step.stage === "running"
                      ? "진행 중"
                      : step.stage === "done"
                        ? "완료"
                        : "실패"}
                </span>
              </div>
              {step.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
