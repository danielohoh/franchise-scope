"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// ── iOS 설치 안내 모달 ────────────────────────────────────────

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-card p-6 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-semibold text-foreground">홈 화면에 앱 추가</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 앱 아이콘 + 이름 */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary">
            <span className="text-xl font-black tracking-tighter text-primary-foreground">FS</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">FranchiseScope</p>
            <p className="text-xs text-muted-foreground">ai-scope.kr</p>
          </div>
        </div>

        {/* 단계별 설명 */}
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <p className="text-sm text-foreground leading-snug">
              하단 가운데{" "}
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                <Share className="size-3" />
                공유
              </span>{" "}
              버튼을 탭하세요
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <p className="text-sm text-foreground leading-snug">
              아래로 스크롤해서{" "}
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                홈 화면에 추가
              </span>{" "}
              를 탭하세요
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <p className="text-sm text-foreground leading-snug">
              오른쪽 상단{" "}
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                추가
              </span>{" "}
              를 탭하면 설치 완료!
            </p>
          </li>
        </ol>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Safari 브라우저에서만 설치할 수 있습니다
        </p>
      </div>
    </div>
  );
}

// ── 설치 버튼 ─────────────────────────────────────────────────

export function PwaInstallButton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이미 설치된 경우 (standalone 모드) → 숨김
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // iOS 판별
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS는 항상 안내 버튼 표시
      setVisible(true);
      return;
    }

    // Android / Desktop: beforeinstallprompt 이벤트 캡처
    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // 이미 설치 완료 시 버튼 제거
    window.addEventListener("appinstalled", () => setVisible(false));

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!visible) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowModal(true);
      return;
    }
    if (!promptRef.current) return;

    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      promptRef.current = null;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <Download className="size-4 shrink-0 text-muted-foreground" />
        <span>앱 설치</span>
      </button>

      {showModal && <IOSInstallModal onClose={() => setShowModal(false)} />}
    </>
  );
}
