# FranchiseScope v2.0 배포 가이드

## 0. 환경 변수 한눈에 보기

전체 변수 목록은 [`.env.example`](./.env.example) 참고.

| 변수 | 필수/선택 | 용도 | 발급 |
|------|----------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase 프로젝트 URL | [supabase.com](https://supabase.com) Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | 브라우저-안전 anon key | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | 서버 전용 service role | Supabase Settings → API |
| `NEXT_PUBLIC_APP_URL` | 필수 | 배포 도메인 (이메일 콜백) | 직접 설정 |
| `NEXT_PUBLIC_DEMO_MODE` | 선택 | UI 데모 모드 (인증 우회) | `true`/`false` |
| `LLM_PROVIDER` | 필수 | `groq` / `anthropic` / `openai` | — |
| `LLM_API_KEY` | 필수 | LLM 메인 API 키 | 제공자별 발급 (아래 §3) |
| `LLM_MODEL` | 필수 | 모델 ID | 예: `llama-3.3-70b-versatile` |
| `ANTHROPIC_API_KEY` | 선택 | Claude 폴백 | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | 선택 | OpenAI 폴백 | [platform.openai.com](https://platform.openai.com) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 선택 | 지도 표시 | Google Cloud Console |
| `GOOGLE_PLACES_API_KEY` | 필수 | 경쟁점/시설 검색 | Google Cloud Console |
| `KAKAO_REST_API_KEY` | 선택 | 주소→좌표 지오코딩 | [developers.kakao.com](https://developers.kakao.com) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 선택 | 카카오 지도 SDK | 카카오 개발자 |
| `DATA_GO_KR_API_KEY` | 필수 | 공공데이터 통합 키 | [data.go.kr](https://data.go.kr) |
| `SEOUL_OPEN_DATA_API_KEY` | 선택 | 서울시 상권분석 | [data.seoul.go.kr](https://data.seoul.go.kr) |
| `RESEND_API_KEY` | 선택 | 이메일 OTP 발송 | [resend.com](https://resend.com) |

> 💡 (선택) 항목이 빠지면 해당 영역은 목업/폴백 데이터로 동작합니다.

---

## 1. Supabase 설정

### 1-1. 프로젝트 생성
1. [app.supabase.com](https://app.supabase.com) → New Project
2. Project URL과 API Keys 복사 (Settings → API)
3. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`에 입력

### 1-2. DB 마이그레이션 실행
Supabase Dashboard → **SQL Editor**에서 아래 파일들을 **순서대로** 붙여넣고 실행:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_email_auth.sql
supabase/migrations/003_recommend_tables.sql
supabase/migrations/004_consultation.sql
supabase/migrations/005_v2_disclosure_analysis.sql   ← v2.0 핵심 (정보공개서/분석)
```

각 파일 끝까지 복사 → SQL Editor 새 쿼리 → 붙여넣기 → **Run**.

005 마이그레이션은 다음을 생성합니다:
- `disclosures`, `disclosure_parsed_data` 테이블
- `analyses`, `analysis_collected_data`, `analysis_reports` 테이블
- `public_data_cache` 캐시 테이블
- `brands` 테이블 v2.0 컬럼 추가 (price_tier, royalty_type 등)
- 모든 테이블 RLS 정책

### 1-3. Storage 버킷 생성
Dashboard → **Storage** → New Bucket:

| 버킷명 | 공개 여부 | 용도 |
|--------|----------|------|
| `reports` | Private | 생성된 docx 보고서 |
| `disclosures` | Private | 정보공개서 PDF 원본 |

### 1-4. RLS 정책 확인
SQL Editor에서:

```sql
SELECT tablename, rowsecurity FROM pg_tables
 WHERE schemaname = 'public'
 ORDER BY tablename;
```

모든 테이블의 `rowsecurity = true` 인지 확인.

### 1-5. 인증 설정
Dashboard → **Authentication** → Providers:
- Email: 활성화 (OTP / Magic Link)
- (선택) Phone: Twilio 연동

콜백 URL: `${NEXT_PUBLIC_APP_URL}/auth/callback`

---

## 2. Vercel 배포

### 2-1. 프로젝트 생성
1. [vercel.com](https://vercel.com) → New Project
2. GitHub 레포 연결
3. Framework: Next.js (자동 감지)

### 2-2. 환경 변수 입력
Settings → Environment Variables — `.env.example`의 모든 (필수) 항목을 등록.

### 2-3. ⚠️ Vercel 플랜 주의사항

`vercel.json`에 일부 라우트가 `maxDuration: 300`(5분)으로 설정되어 있습니다:

| 라우트 | 시간 | 이유 |
|--------|------|------|
| `/api/reports/[id]/run` | 300s | 보고서 LLM 생성 (수집→LLM→docx) |
| `/api/listings/collect-server` | 300s | 직방 매물 SSE 수집 |
| `/api/consult/chat`, `/api/recommend` | 60s | LLM 추론 |

**Hobby 플랜은 `maxDuration: 60`이 한계** → 보고서 생성/매물 수집이 타임아웃으로 실패합니다.

→ **Vercel Pro 플랜 필요** (`maxDuration: 300` 지원).

### 2-4. `serverExternalPackages` 주의

`next.config.ts`에서 다음 패키지가 server-only 로 마킹되어 있습니다:

```ts
serverExternalPackages: ["docx", "pdf-parse", "mammoth", "kordoc", "pdfjs-dist"]
```

이 패키지들은 **서버 컴포넌트/Route Handler에서만** import 가능. 클라이언트 컴포넌트(`"use client"`)에서 import 시 빌드 실패합니다.

또한 `webpack.resolve.alias`에서 `canvas`, `encoding`을 `false`로 처리 → pdf-parse의 native dep 우회.

### 2-5. 도메인 (선택)
Vercel → Domains → Add Domain.
도메인 추가 후 `NEXT_PUBLIC_APP_URL`을 새 도메인으로 갱신.

---

## 3. LLM 제공자 발급

### 3-1. Groq (메인, 권장)
1. [console.groq.com](https://console.groq.com) 가입
2. API Keys → Create
3. 환경변수:
   ```
   LLM_PROVIDER=groq
   LLM_API_KEY=gsk_...
   LLM_MODEL=llama-3.3-70b-versatile
   ```

### 3-2. Anthropic (폴백)
1. [console.anthropic.com](https://console.anthropic.com) 가입
2. API Keys → Create
3. 환경변수:
   ```
   LLM_PROVIDER=anthropic
   LLM_API_KEY=sk-ant-...
   LLM_MODEL=claude-sonnet-4-20250514
   ```

### 3-3. OpenAI (폴백)
1. [platform.openai.com](https://platform.openai.com) 가입
2. API Keys → Create
3. 환경변수:
   ```
   LLM_PROVIDER=openai
   LLM_API_KEY=sk-...
   LLM_MODEL=gpt-4o
   ```

---

## 4. Google APIs 설정

### 4-1. API 활성화
[Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Enable APIs:
- **Maps JavaScript API** (지도 표시)
- **Places API (New)** (경쟁점/시설 검색)
- **Geocoding API** (주소 → 좌표)

### 4-2. API 키 발급
Credentials → Create Credentials → API Key. **두 개 권장**:

| 키 | 환경변수 | 제한 |
|----|---------|------|
| 서버용 | `GOOGLE_PLACES_API_KEY` | None (서버↔Google 통신) |
| 클라이언트용 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | HTTP referrers: `your-domain.vercel.app/*` |

API restrictions: Places API (New), Geocoding API, Maps JavaScript API.

---

## 5. 공공데이터 (data.go.kr)

1. [data.go.kr](https://data.go.kr) 회원가입
2. 다음 API들 검색 후 **활용신청** (각각 별도):
   - 소상공인시장진흥공단 상권정보
   - 행정안전부 인구통계 (또는 SGIS)
   - 한국감정원 임대시세
   - 국토교통부 건축물대장
3. 승인 후 (1~2일) 발급되는 **인증키**를 `DATA_GO_KR_API_KEY`에 입력
   - 4개 API가 동일한 인증키 사용

> ⚠️ 승인 전까지 해당 영역은 `is_mock: true` 목업 데이터로 동작합니다.

---

## 6. (선택) 카카오 / 서울 / Resend

### 6-1. 카카오
- [developers.kakao.com](https://developers.kakao.com) 앱 생성
- REST API 키 → `KAKAO_REST_API_KEY` (지오코딩용)
- JavaScript 키 → `NEXT_PUBLIC_KAKAO_MAP_KEY` (지도 SDK)
- 플랫폼 등록: 웹 도메인에 배포 도메인 추가

### 6-2. 서울 열린데이터
- [data.seoul.go.kr](https://data.seoul.go.kr) 가입
- 인증키 발급 → `SEOUL_OPEN_DATA_API_KEY`
- 서울 지역 분석 시에만 사용 (그 외 지역은 폴백)

### 6-3. Resend (이메일 OTP)
- [resend.com](https://resend.com) 가입
- API Key → `RESEND_API_KEY`
- 발신 도메인 검증 (DNS TXT 레코드)

---

## 7. 배포 후 체크리스트

```
□ 로그인 → /dashboard 정상 진입
□ 신규 가입 → /brand 자동 리다이렉트
□ 브랜드 등록 → DB 저장 (브랜드 미등록 시 다른 메뉴 잠김)
□ 정보공개서 PDF 업로드 → 파싱 상태 갱신
□ 상권분석 새 분석 → 주소 입력 → 보고서 생성 (E2E)
□ docx 다운로드 → Word에서 정상 열림
□ AI 매물 추천 → 지역 수집 → 추천 결과
□ 모바일 Safari/Chrome 사이드바/드로어 동작
□ 로그아웃 → /auth/login
□ Vercel Function Logs에서 maxDuration 초과 없음 확인
```

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Supabase env 누락 | Vercel 환경변수 재확인 후 redeploy |
| 상권분석이 503/타임아웃 | Hobby 플랜 60초 한계 | Pro 플랜 업그레이드 |
| 경쟁점 결과가 비어있음 | `GOOGLE_PLACES_API_KEY` 미설정 | Google Cloud에서 Places API 활성화 + 키 입력 |
| docx 다운로드 실패 | `serverExternalPackages` 누락 | `next.config.ts` 확인, `docx` 포함 여부 |
| 정보공개서 파싱 실패 | `pdf-parse` 빌드 에러 | `webpack.alias.canvas = false` 누락 여부 확인 |
| 인구통계 `is_mock: true` | `DATA_GO_KR_API_KEY` 미발급 | data.go.kr 활용신청 (1~2일 소요) |
