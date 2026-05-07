"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PdfUploaderProps = {
  brandId: string;
  onUploadCompleteAction: (disclosureId: string) => void;
};

type UploadState =
  | { status: "idle" }
  | { status: "dragging" }
  | { status: "uploading"; progress: number; fileName: string }
  | { status: "success"; fileName: string }
  | { status: "error"; message: string };

type UploadResponse = {
  disclosureId?: string;
  disclosure_id?: string;
  id?: string;
  message?: string;
  error?: string;
};

const MAX_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
}

function validatePdf(file: File): string | null {
  const nameOk = file.name.toLowerCase().endsWith(".pdf");
  const typeOk = file.type === "application/pdf" || file.type === "application/x-pdf" || file.type === "";
  if (!nameOk || !typeOk) return "PDF 파일만 업로드할 수 있어요.";
  if (file.size > MAX_BYTES) return `파일 크기는 최대 20MB까지 가능합니다. (현재 ${formatBytes(file.size)})`;
  return null;
}

export function PdfUploader({ brandId, onUploadCompleteAction }: PdfUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  const [state, setState] = React.useState<UploadState>({ status: "idle" });

  const isBusy = state.status === "uploading";
  const isDragging = state.status === "dragging";

  React.useEffect(() => {
    return () => {
      xhrRef.current?.abort();
      xhrRef.current = null;
    };
  }, []);

  const upload = React.useCallback(
    (file: File) => {
      const validationError = validatePdf(file);
      if (validationError) {
        setState({ status: "error", message: validationError });
        toast.error(validationError);
        return;
      }

      if (!brandId) {
        const message = "브랜드를 먼저 선택해주세요.";
        setState({ status: "error", message });
        toast.error(message);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("brand_id", brandId);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      setState({ status: "uploading", progress: 0, fileName: file.name });

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        setState((prev) => (prev.status === "uploading" ? { ...prev, progress: percent } : prev));
      });

      xhr.addEventListener("error", () => {
        const message = "업로드 중 네트워크 오류가 발생했습니다.";
        setState({ status: "error", message });
        toast.error(message);
      });

      xhr.addEventListener("abort", () => {
        const message = "업로드가 취소되었습니다.";
        setState({ status: "error", message });
      });

      xhr.addEventListener("load", () => {
        try {
          const raw = xhr.responseText;
          const json = (raw ? (JSON.parse(raw) as UploadResponse) : {}) as UploadResponse;

          if (xhr.status < 200 || xhr.status >= 300) {
            const message = json.message ?? json.error ?? "업로드에 실패했습니다.";
            setState({ status: "error", message });
            toast.error(message);
            return;
          }

          const disclosureId = json.disclosureId ?? json.disclosure_id ?? json.id;
          if (!disclosureId) {
            const message = "업로드 응답이 올바르지 않습니다. (disclosureId 누락)";
            setState({ status: "error", message });
            toast.error(message);
            return;
          }

          setState({ status: "success", fileName: file.name });
          toast.success("업로드가 완료되었습니다.");
          onUploadCompleteAction(disclosureId);
        } catch (error) {
          console.error("[disclosure upload] invalid response", error);
          const message = "서버 응답을 처리하지 못했습니다.";
          setState({ status: "error", message });
          toast.error(message);
        }
      });

      xhr.open("POST", "/api/disclosure/upload");
      xhr.send(formData);
    },
    [brandId, onUploadCompleteAction],
  );

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      upload(file);
    },
    [upload],
  );

  const reset = React.useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "group relative rounded-2xl border border-dashed bg-card p-6 text-card-foreground shadow-sm transition",
          "border-border/70 hover:border-border hover:bg-muted/30",
          isDragging ? "border-primary bg-primary/5" : null,
          isBusy ? "opacity-80" : null,
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          if (isBusy) return;
          setState({ status: "dragging" });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (isBusy) return;
          if (!isDragging) setState({ status: "dragging" });
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (isBusy) return;
          setState({ status: "idle" });
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (isBusy) return;
          setState({ status: "idle" });
          handleFiles(e.dataTransfer.files);
        }}
        aria-label="PDF 업로드"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => handleFiles(e.currentTarget.files)}
          disabled={isBusy}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl border",
              isDragging ? "border-primary/40 bg-primary/10" : "border-border bg-background",
            )}
          >
            {state.status === "success" ? (
              <CheckCircle2 className="size-5 text-primary" />
            ) : state.status === "error" ? (
              <AlertCircle className="size-5 text-destructive" />
            ) : (
              <Upload className="size-5 text-muted-foreground group-hover:text-foreground" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              PDF 파일을 끌어다 놓거나,
              <button
                type="button"
                className="mx-1 underline underline-offset-4 decoration-muted-foreground/60 hover:decoration-foreground"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
              >
                파일 선택
              </button>
              으로 업로드하세요.
            </p>
            <p className="text-xs text-muted-foreground">최대 20MB · PDF만 가능</p>
          </div>

          {state.status === "uploading" ? (
            <div className="w-full max-w-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-3.5" />
                  <span className="truncate">{state.fileName}</span>
                </div>
                <span className="shrink-0 tabular-nums">{state.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={reset} className="rounded-xl">
                  <X className="size-3.5" />
                  취소
                </Button>
              </div>
            </div>
          ) : null}

          {state.status === "error" ? (
            <div className="w-full max-w-xl rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-left">
              <p className="text-sm font-medium text-destructive">업로드 실패</p>
              <p className="mt-1 text-xs text-muted-foreground">{state.message}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={reset}>
                  다시 시도
                </Button>
              </div>
            </div>
          ) : null}

          {state.status === "success" ? (
            <div className="w-full max-w-xl rounded-xl border border-border bg-background p-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">업로드 완료</p>
                  <p className="mt-1 text-xs text-muted-foreground">{state.fileName}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={reset}>
                  다른 파일 업로드
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
