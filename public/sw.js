// FranchiseScope Service Worker
// 전략: 앱 셸 캐시 (Cache-first) + API 네트워크 우선 (Network-first)

const CACHE_VERSION = "v1";
const CACHE_NAME = `franchise-scope-${CACHE_VERSION}`;

// 앱 셸 — 오프라인에서도 즉시 로드
const APP_SHELL = [
  "/",
  "/dashboard",
  "/dashboard/reports",
  "/dashboard/brand",
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

  // Next.js 빌드 정적 자산 (_next/static) — Cache-first (불변 파일)
  if (url.pathname.startsWith("/_next/static/")) {
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
    return;
  }

  // 페이지 — Stale-while-revalidate (캐시 반환 후 백그라운드 갱신)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok && response.status < 400) {
            cache.put(request, response.clone());
          }
          return response;
        });
        return cached ?? fetchPromise;
      }),
    ),
  );
});
