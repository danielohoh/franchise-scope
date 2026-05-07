"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ChunkLoadError: 배포 후 구버전 청크 → 1회 자동 새로고침
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module");

    if (isChunkError) {
      const KEY = "__chunk_reload__";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        return;
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <h1 className="text-xl font-bold text-foreground">페이지를 불러오지 못했습니다</h1>
      <p className="text-sm text-muted-foreground">
        새로고침하거나 잠시 후 다시 시도해주세요.
      </p>
      <button
        onClick={() => {
          sessionStorage.removeItem("__chunk_reload__");
          reset();
        }}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        다시 시도
      </button>
    </div>
  );
}
