// FranchiseScope Service Worker
// 전략: 앱 셸 캐시 (Cache-first) + API 네트워크 우선 (Network-first)

const CACHE_VERSION = "v3";
const CACHE_NAME = `franchise-scope-${CACHE_VERSION}`;

// 앱 셸 — 오프라인에서도 즉시 로드 (v2.0 라우트 기준)
const APP_SHELL = [
  "/",
  "/dashboard",
  "/brand",
  "/disclosure",
  "/analysis",
];

// ── Install: 앱 셸 프리캐시 ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // 프리캐시 실패해도 SW 설치 계속 진행
      }),
  );
  self.skipWaiting();
});

// ── Activate: 이전 버전 캐시 삭제 ────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("franchise-scope-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ── Fetch: 요청별 캐싱 전략 ──────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 다른 오리진, POST/PUT/DELETE 요청은 캐시 안 함
  if (
    url.origin !== self.location.origin ||
    request.method !== "GET"
  ) {
    return;
  }

  // API 라우트 — Network-first (항상 최신 데이터)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "오프라인 상태입니다." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    return;
  }

  // Next.js 정적 자산 (_next/static)
  if (url.pathname.startsWith("/_next/static/")) {
    // webpack 런타임(webpack-*.js)은 배포마다 변경되는 청크 매니페스트 파일 —
    // Cache-first 사용 시 구버전 청크 ID를 참조해 ChunkLoadError 발생
    // → Network-first로 반드시 최신 버전 수신
    const isWebpackRuntime = url.pathname.includes("/chunks/webpack");

    // 앱 라우터 JS (chunks/app/, chunks/pages/)도 Network-first
    const isAppChunk =
      url.pathname.includes("/_next/static/chunks/app/") ||
      url.pathname.includes("/_next/static/chunks/pages/");

    if (isWebpackRuntime || isAppChunk) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(request)),
      );
    } else {
      // 콘텐츠 해시 기반 불변 자산 (폰트·미디어·프레임워크 청크) — Cache-first
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ??
            fetch(request).then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              }
              return response;
            }),
        ),
      );
    }
    return;
  }

  // 페이지 — Network-first (항상 최신 HTML 제공, 청크 해시 불일치 방지)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status < 400) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ??
            new Response("오프라인 상태입니다.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
  );
});
