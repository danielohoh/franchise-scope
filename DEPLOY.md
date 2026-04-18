# FranchiseScope 배포 가이드

## 1. Supabase 설정

### 1-1. 프로젝트 생성
1. [app.supabase.com](https://app.supabase.com) → New Project
2. Project URL과 API Keys 복사 (Settings → API)

### 1-2. DB 마이그레이션 실행
Supabase SQL Editor에서 아래 파일 내용을 실행:
```
supabase/migrations/001_initial_schema.sql
```

### 1-3. Storage 버킷 생성
Dashboard → Storage → New Bucket:
- **reports** (Private) - 생성된 docx 파일 저장

### 1-4. SMS 인증 설정
Dashboard → Authentication → Providers → Phone:
- Enable Phone Auth
- Twilio 연동 (Account SID, Auth Token, Message Service SID)
- 한국 번호: `+8210XXXXXXXX` 형식

### 1-5. RLS 정책 확인
```sql
-- 활성화 확인
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

---

## 2. Vercel 배포

### 2-1. Vercel 프로젝트 생성
1. [vercel.com](https://vercel.com) → New Project
2. GitHub 레포지토리 연결
3. Framework: Next.js (자동 감지)

### 2-2. 환경변수 설정
Vercel 대시보드 → Settings → Environment Variables:

| 변수명 | 값 | 환경 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJxxx...` | Production, Preview |
| `LLM_PROVIDER` | `anthropic` | All |
| `LLM_API_KEY` | `sk-ant-xxx` | Production, Preview |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | All |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaXxx` | All |
| `GOOGLE_PLACES_API_KEY` | `AIzaXxx` | Production, Preview |
| `PUBLIC_DATA_API_KEY` | `xxx` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` | All |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Production |

### 2-3. 도메인 설정 (선택)
Vercel → Domains → Add Domain

### 2-4. Vercel Pro 플랜 필요
- **보고서 생성 파이프라인** (`/api/reports/[id]/run`)은 최대 300초 소요
- Vercel Pro 플랜 (maxDuration: 300 지원)
- Hobby 플랜은 maxDuration: 60 제한 → 파이프라인 실패

---

## 3. Google API 설정

### 3-1. API 활성화
Google Cloud Console → APIs & Services → Enable APIs:
- Maps JavaScript API
- Places API (New)
- Geocoding API

### 3-2. API 키 설정
1. Credentials → Create Credentials → API Key
2. **서버용 키** (`GOOGLE_PLACES_API_KEY`):
   - Application restrictions: None (서버-서버 호출)
   - API restrictions: Places API, Geocoding API
3. **클라이언트용 키** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`):
   - Application restrictions: HTTP referrers
   - 허용 도메인: `your-domain.vercel.app/*`

---

## 4. 공공데이터 API

1. [data.go.kr](https://data.go.kr) → 회원가입
2. "소상공인시장진흥공단_상권정보" 검색 → 활용신청
3. 승인 후 (1~2일) 인증키 발급
4. `PUBLIC_DATA_API_KEY` 환경변수에 입력

> ⚠️ 승인 전까지는 목업 데이터(is_mock: true)로 대체됩니다.

---

## 5. 배포 후 체크리스트

```
□ SMS OTP 로그인 실제 번호로 테스트
□ 브랜드 등록 → DB 저장 확인
□ 예비 창업자 추가/수정/삭제
□ 보고서 생성 E2E 테스트 (실제 주소 입력)
□ docx 다운로드 → Word에서 열기
□ 모바일 Safari/Chrome 테스트
```
