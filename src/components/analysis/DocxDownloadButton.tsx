"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type DocxDownloadButtonProps = {
  analysisId: string;
  disabled?: boolean;
};

type ApiError = { message?: string; error?: string };

function guessUrl(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const url =
    (typeof obj.url === "string" && obj.url) ||
    (typeof obj.download_url === "string" && obj.download_url) ||
    (typeof obj.file_url === "string" && obj.file_url) ||
    (typeof obj.file_path === "string" && obj.file_path) ||
    null;
  return url;
}

export function DocxDownloadButton({ analysisId, disabled }: DocxDownloadButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const onClick = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}/docx`, {
        method: "POST",
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        let json: unknown = null;
        try {
          json = await response.json();
        } catch {
          // ignore
        }
        const msg =
          json && typeof json === "object" && json !== null && ("message" in json || "error" in json)
            ? (((json as ApiError).message ?? (json as ApiError).error) || "DOCX 생성에 실패했습니다.")
            : "DOCX 생성에 실패했습니다.";
        throw new Error(msg);
      }

      if (contentType.includes("application/json")) {
        const json = (await response.json()) as unknown;
        const url = guessUrl(json);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          toast.success("다운로드를 시작합니다.");
          return;
        }
        throw new Error("다운로드 URL을 찾지 못했습니다.");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `analysis-${analysisId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success("다운로드를 시작합니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  return (
    <Button
      type="button"
      size="lg"
      className="rounded-xl"
      variant="outline"
      onClick={() => void onClick()}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Word 보고서 다운로드
    </Button>
  );
}
