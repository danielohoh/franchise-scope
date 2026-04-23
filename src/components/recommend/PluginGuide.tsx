"use client";

export function PluginGuide() {
  return (
    <section className="rounded-xl border border-border bg-background p-6">
      <h1 className="text-base font-semibold text-foreground">Chrome 플러그인 설치 가이드</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        플러그인으로 네이버 부동산 매물을 수집한 뒤 AI 매물 추천을 사용할 수 있습니다.
      </p>

      <ol className="mt-4 space-y-2 text-sm text-foreground">
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <span>GitHub에서 플러그인 다운로드</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            2
          </span>
          <span>Chrome 주소창에 chrome://extensions 입력</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            3
          </span>
          <span>'개발자 모드' 활성화</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            4
          </span>
          <span>'압축 해제된 확장 프로그램 로드' 클릭</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            5
          </span>
          <span>다운로드한 폴더 선택</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            6
          </span>
          <span>네이버 부동산(new.land.naver.com) 접속 후 수집 시작</span>
        </li>
      </ol>
    </section>
  );
}
