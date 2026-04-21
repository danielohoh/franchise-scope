"use client";

import { useEffect } from "react";

/**
 * Service Worker 등록 + PWA 설치 프롬프트 처리
 * RootLayout에 한 번만 렌더링
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[PWA] Service Worker registered:", reg.scope);

        // 새 버전 감지 시 자동 업데이트
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              // 새 버전이 설치됨 — 다음 탐색 시 자동 적용
              console.log("[PWA] 새 버전이 설치되었습니다.");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker 등록 실패:", err);
      });
  }, []);

  return null;
}
