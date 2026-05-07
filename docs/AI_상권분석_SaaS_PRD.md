# 🏪 AI 상권분석 SaaS 프로그램 — PRD (Product Requirements Document)

> **프로젝트명**: 프랜차이즈 AI 상권분석 플랫폼
> **버전**: v2.0 (기존 프로그램 전면 리빌드)
> **작성일**: 2026.05.05
> **핵심 개선점**: 할루시네이션 제거 — 모든 데이터를 검증된 소스(정보공개서 + 공공API)에서 가져와 LLM에 주입하는 구조

---

## 📌 핵심 설계 원칙

```
[절대 원칙] LLM은 "분석·요약·문장 생성"만 담당한다.
            숫자·통계·매출·가맹점수 등 팩트 데이터는
            반드시 DB 또는 공공API에서 가져온 값만 사용한다.
            LLM이 자체적으로 수치를 생성하는 것을 금지한다.
```

### 할루시네이션 방지 아키텍처

```
[사용자 입력: 주소]
       │
       ▼
[1단계: 데이터 수집 레이어] ← LLM 개입 없음
  ├── 정보공개서 파싱 데이터 (DB에서 조회)
  ├── 공공데이터 API 호출 (서울시 상권분석 등)
  ├── Google Maps / Places API (경쟁점, 위치)
  └── Google Geocoding (좌표 변환)
       │
       ▼
[2단계: 구조화된 데이터 JSON 생성] ← LLM 개입 없음
  {
    "brand": { ...정보공개서 파싱 데이터... },
    "location": { ...좌표, 주소... },
    "population": { ...공공API 인구 데이터... },
    "competitors": { ...Google Places 검색 결과... },
    "rent": { ...공공API 임대 시세... },
    "sales": { ...공공API 매출 추정... }
  }
       │
       ▼
[3단계: LLM 분석 레이어] ← 여기서만 LLM 사용
  시스템 프롬프트:
  "아래 JSON 데이터만을 근거로 분석하라.
   JSON에 없는 수치를 절대 생성하지 마라.
   출처를 반드시 명시하라."
       │
       ▼
[4단계: 보고서 렌더링]
  ├── HTML 실시간 스트리밍 (타이핑 효과)
  └── docx 다운로드
```

---

## 🔧 기술 스택 (확정)

### 핵심 프레임워크
| 항목 | 버전 |
|------|------|
| Next.js (App Router) | 16.2.4 |
| React | 19.2.4 |
| TypeScript | ^5 |

### 스타일링 / UI
| 항목 | 설명 |
|------|------|
| Tailwind CSS v4 | 유틸리티 CSS |
| shadcn/ui | 컴포넌트 라이브러리 |
| @base-ui/react | 헤드리스 UI 컴포넌트 |
| Lucide React | 아이콘 |
| clsx + tailwind-merge | 조건부 클래스 처리 |
| class-variance-authority | 컴포넌트 변형 (variants) |
| next-themes | 다크모드 |
| Sonner | Toast 알림 |

### AI / LLM
| 항목 | 설명 |
|------|------|
| Vercel AI SDK (ai ^6) | AI 스트리밍 통합 레이어 |
| @ai-sdk/groq | **Groq 모델 (메인 LLM)** |
| @ai-sdk/anthropic | Claude 모델 (백업/비교용) |
| @ai-sdk/openai | GPT 모델 (백업/비교용) |

### 백엔드 / 데이터베이스
| 항목 | 설명 |
|------|------|
| Supabase | PostgreSQL DB + Auth + Storage |
| @supabase/ssr | SSR 전용 Supabase 클라이언트 |
| Next.js API Routes | 서버 로직 (/app/api) |

### 상태 관리 / 폼
| 항목 | 설명 |
|------|------|
| Zustand v5 | 전역 상태 관리 |
| React Hook Form v7 | 폼 처리 |
| Zod v4 | 스키마 유효성 검증 |

### 데이터 시각화 / 지도
| 항목 | 설명 |
|------|------|
| Recharts v3 | 차트 |
| Google Maps (@vis.gl/react-google-maps) | 지도 |

### 문서 처리
| 항목 | 설명 |
|------|------|
| docx | Word 문서 생성 (보고서 다운로드) |
| pdf-parse | PDF 파싱 (정보공개서 업로드) |
| mammoth | Word 문서 파싱 |
| Resend | 이메일 발송 |

### 테스트 / 빌드 / 배포
| 항목 | 설명 |
|------|------|
| Vitest v4 | 단위 테스트 |
| ESLint v9 | 린팅 |
| Webpack | 빌드 (Turbopack은 한국어 경로 버그로 비활성화) |
| Vercel | 배포 플랫폼 |

---

## 📁 프로젝트 폴더 구조

```
src/
├── app/
│   ├── (auth)/                    # 인증 관련 라우트 그룹
│   │   ├── login/
│   │   │   └── page.tsx           # 로그인 페이지
│   │   ├── signup/
│   │   │   └── page.tsx           # 회원가입 페이지
│   │   └── layout.tsx             # auth 레이아웃 (로고만, 사이드바 없음)
│   │
│   ├── (dashboard)/               # 인증 후 대시보드 라우트 그룹
│   │   ├── dashboard/
│   │   │   └── page.tsx           # 대시보드 메인 (최근 분석 리스트)
│   │   │
│   │   ├── brand/
│   │   │   ├── page.tsx           # 브랜드 정보 관리 (CRUD)
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 브랜드 상세/수정
│   │   │
│   │   ├── disclosure/
│   │   │   ├── page.tsx           # 정보공개서 관리 (업로드 리스트)
│   │   │   ├── upload/
│   │   │   │   └── page.tsx       # 정보공개서 업로드 + 파싱 결과 확인
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 파싱된 정보공개서 상세 보기/수정
│   │   │
│   │   ├── analysis/
│   │   │   ├── page.tsx           # 상권분석 리스트 (과거 분석 이력)
│   │   │   ├── new/
│   │   │   │   └── page.tsx       # 새 상권분석 — 주소 입력 + 브랜드 선택
│   │   │   └── [id]/
│   │   │       └── page.tsx       # 분석 결과 보기 (HTML 보고서 + docx 다운로드)
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx           # 계정 설정
│   │   │
│   │   └── layout.tsx             # dashboard 레이아웃 (사이드바 + 헤더)
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signup/route.ts    # 회원가입 API
│   │   │   └── callback/route.ts  # Supabase auth 콜백
│   │   │
│   │   ├── brand/
│   │   │   └── route.ts           # 브랜드 CRUD API
│   │   │
│   │   ├── disclosure/
│   │   │   ├── upload/route.ts    # PDF 업로드 + Storage 저장
│   │   │   └── parse/route.ts     # PDF 파싱 + DB 저장
│   │   │
│   │   ├── analysis/
│   │   │   ├── route.ts           # 분석 CRUD
│   │   │   ├── collect/route.ts   # [1단계] 데이터 수집 (공공API + Google)
│   │   │   ├── stream/route.ts    # [3단계] LLM 스트리밍 분석
│   │   │   └── docx/route.ts      # docx 파일 생성 + 다운로드
│   │   │
│   │   └── public-data/
│   │       ├── population/route.ts   # 서울시 인구 API 프록시
│   │       ├── commercial/route.ts   # 서울시 상권분석 API 프록시
│   │       ├── rent/route.ts         # 임대시세 API 프록시
│   │       └── competitors/route.ts  # Google Places 경쟁점 검색
│   │
│   ├── layout.tsx                 # 루트 레이아웃
│   └── page.tsx                   # 랜딩 페이지 (→ 로그인 리다이렉트)
│
├── components/
│   ├── ui/                        # shadcn/ui 컴포넌트 (Button, Input, Dialog 등)
│   ├── layout/
│   │   ├── Sidebar.tsx            # 사이드바 네비게이션
│   │   ├── Header.tsx             # 상단 헤더
│   │   └── PageContainer.tsx      # 페이지 래퍼
│   ├── brand/
│   │   ├── BrandForm.tsx          # 브랜드 정보 입력 폼
│   │   └── BrandCard.tsx          # 브랜드 카드 컴포넌트
│   ├── disclosure/
│   │   ├── PdfUploader.tsx        # PDF 드래그앤드롭 업로더
│   │   ├── ParsedDataReview.tsx   # 파싱 결과 검토/수정 UI
│   │   └── ParsedDataTable.tsx    # 파싱 데이터 테이블 뷰
│   ├── analysis/
│   │   ├── AddressInput.tsx       # 주소 입력 (Google Autocomplete)
│   │   ├── BrandSelector.tsx      # 분석할 브랜드 선택
│   │   ├── AnalysisMap.tsx        # Google Maps 경쟁점 표시
│   │   ├── ReportViewer.tsx       # HTML 보고서 뷰어 (스트리밍)
│   │   ├── ReportSection.tsx      # 보고서 개별 섹션 컴포넌트
│   │   └── DocxDownloadButton.tsx # docx 다운로드 버튼
│   └── charts/
│       ├── PopulationChart.tsx    # 인구 차트
│       ├── SalesChart.tsx         # 매출 차트
│       └── CompetitorChart.tsx    # 경쟁 분석 차트
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # 브라우저용 Supabase 클라이언트
│   │   ├── server.ts              # 서버용 Supabase 클라이언트
│   │   └── middleware.ts          # 인증 미들웨어
│   ├── ai/
│   │   ├── groq.ts                # Groq 클라이언트 설정
│   │   ├── prompts/
│   │   │   ├── system.ts          # 시스템 프롬프트 (할루시네이션 방지 규칙)
│   │   │   ├── analysis.ts        # 상권분석 프롬프트 템플릿
│   │   │   └── report-sections.ts # 보고서 섹션별 프롬프트
│   │   └── stream-handler.ts      # 스트리밍 응답 처리
│   ├── parsers/
│   │   ├── pdf-disclosure.ts      # 정보공개서 PDF 파싱 로직
│   │   ├── extract-financials.ts  # 재무제표 추출
│   │   ├── extract-franchisees.ts # 가맹점 현황 추출
│   │   ├── extract-fees.ts        # 가맹비/로열티 추출
│   │   ├── extract-sales.ts       # 평균매출 추출
│   │   └── extract-menu.ts        # 메뉴/가격 추출
│   ├── public-api/
│   │   ├── seoul-commercial.ts    # 서울시 상권분석 API 클라이언트
│   │   ├── population.ts          # 인구 데이터 API
│   │   ├── rent-index.ts          # 임대시세 API
│   │   └── google-places.ts       # Google Places API 래퍼
│   ├── report/
│   │   ├── data-collector.ts      # [1단계] 모든 데이터 수집 + JSON 조립
│   │   ├── report-generator.ts    # [3단계] LLM 호출 + 보고서 생성
│   │   └── docx-builder.ts        # docx 파일 빌더
│   ├── validators/
│   │   ├── brand.ts               # 브랜드 입력 Zod 스키마
│   │   ├── disclosure.ts          # 정보공개서 데이터 스키마
│   │   ├── analysis.ts            # 분석 요청 스키마
│   │   └── auth.ts                # 인증 스키마
│   └── utils/
│       ├── format.ts              # 숫자/날짜 포맷
│       ├── geocode.ts             # 주소 → 좌표 변환
│       └── constants.ts           # 상수 정의
│
├── stores/
│   ├── auth-store.ts              # 인증 상태
│   ├── brand-store.ts             # 브랜드 데이터 상태
│   ├── analysis-store.ts          # 분석 진행 상태
│   └── report-store.ts            # 보고서 스트리밍 상태
│
├── types/
│   ├── brand.ts                   # 브랜드 타입
│   ├── disclosure.ts              # 정보공개서 파싱 데이터 타입
│   ├── analysis.ts                # 분석 요청/결과 타입
│   ├── report.ts                  # 보고서 타입
│   ├── public-data.ts             # 공공 데이터 타입
│   └── database.ts                # Supabase 테이블 타입 (자동생성)
│
└── middleware.ts                   # Next.js 미들웨어 (인증 체크)
```

---

## 🗄️ Supabase 데이터베이스 스키마

### ERD 관계도

```
users (Supabase Auth)
  │
  ├── 1:N ── brands
  │              │
  │              ├── 1:N ── disclosures
  │              │              │
  │              │              └── 1:1 ── disclosure_parsed_data
  │              │
  │              └── 1:N ── analyses
  │                             │
  │                             ├── 1:1 ── analysis_collected_data
  │                             └── 1:1 ── analysis_reports
  │
  └── (Supabase Storage)
       └── disclosure-pdfs/   # 정보공개서 원본 PDF
```

### 테이블 정의

```sql
-- ============================================
-- 1. brands (브랜드 정보)
-- ============================================
CREATE TABLE brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- 기본 정보
  brand_name TEXT NOT NULL,                    -- 브랜드명 (예: THE LITER)
  company_name TEXT NOT NULL,                  -- 법인명 (예: (주)더리터)
  representative TEXT,                         -- 대표자
  business_number TEXT,                        -- 사업자등록번호
  address TEXT,                                -- 본사 주소
  phone TEXT,                                  -- 대표번호
  
  -- 브랜드 특성
  category TEXT NOT NULL,                      -- 업종 (커피, 치킨, 분식 등)
  price_tier TEXT NOT NULL,                    -- 가격대 (저가/중가/프리미엄)
  avg_ticket_price INTEGER,                    -- 평균 객단가 (원)
  
  -- 가맹 조건 (정보공개서에서 파싱 or 직접 입력)
  franchise_fee INTEGER,                       -- 가맹비 (원, VAT포함)
  education_fee INTEGER,                       -- 교육비 (원, VAT포함)
  royalty_type TEXT,                            -- 로열티 유형 (fixed/rate/none)
  royalty_amount INTEGER,                      -- 로열티 금액 (원) 또는 비율(%)
  interior_cost_per_pyeong INTEGER,            -- 인테리어 평당 비용 (원)
  
  -- 표준 매장 모델
  standard_size_min INTEGER,                   -- 최소 평수
  standard_size_max INTEGER,                   -- 최대 평수
  standard_staff_count INTEGER,                -- 표준 인력 수
  
  -- 영업 조건
  territory_protection_meters INTEGER,         -- 영업지역 보호 거리 (m)
  contract_period_years INTEGER,               -- 계약기간 (년)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. disclosures (정보공개서 업로드)
-- ============================================
CREATE TABLE disclosures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  file_name TEXT NOT NULL,                     -- 원본 파일명
  file_path TEXT NOT NULL,                     -- Supabase Storage 경로
  file_size INTEGER,                           -- 파일 크기 (bytes)
  
  registration_number TEXT,                    -- 정보공개서 등록번호
  registration_date DATE,                      -- 최종 등록일
  
  parse_status TEXT DEFAULT 'pending',         -- pending / parsing / completed / failed
  parse_error TEXT,                            -- 파싱 실패 시 에러 메시지
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. disclosure_parsed_data (파싱된 정보공개서 데이터)
-- ============================================
CREATE TABLE disclosure_parsed_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  disclosure_id UUID REFERENCES disclosures(id) ON DELETE CASCADE NOT NULL UNIQUE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  
  -- 본사 재무 (3개년)
  financials JSONB,
  /* 구조:
  {
    "years": [
      { "year": 2024, "revenue": 18493914, "operating_profit": 151855, "net_income": -2297340, "total_assets": 25627488, "total_liabilities": 19486663 },
      { "year": 2023, ... },
      { "year": 2022, ... }
    ]
  }
  */
  
  -- 가맹점 현황 (3개년)
  franchisee_status JSONB,
  /* 구조:
  {
    "years": [
      { "year": 2024, "start": 420, "new_open": 27, "terminated": 0, "cancelled": 31, "transferred": 19, "end": 416 },
      ...
    ],
    "by_region": [
      { "region": "서울", "count_2024": 18, "count_2023": 19, "count_2022": 20 },
      ...
    ],
    "avg_operation_days": 1524
  }
  */
  
  -- 가맹점 평균 매출 (지역별)
  avg_sales JSONB,
  /* 구조:
  {
    "year": 2024,
    "total": { "count": 416, "calculated_count": 404, "avg_annual": 141150, "per_3_3sqm": 9337, "max": 503553, "min": 2320 },
    "by_region": [
      { "region": "서울", "count": 18, "calculated_count": 18, "avg_annual": 109226, "per_3_3sqm": 9343, "max": 222917, "min": 24237 },
      ...
    ]
  }
  */
  
  -- 가맹비 상세
  fees JSONB,
  /* 구조:
  {
    "franchise_fee": 5500000,
    "education_fee": 3300000,
    "total_initial": 8800000,
    "deposit": 0,
    "royalty": { "type": "fixed", "amount": 220000, "description": "월 22만원 VAT포함" },
    "transfer_fee": { "franchise_fee": 2750000, "education_fee": 3300000 },
    "opening_costs": {
      "interior": 20900000,
      "signage": 4950000,
      "equipment_min": 27610000,
      "equipment_max": 30360000,
      "promotion": 2200000,
      "initial_supplies": 5600000,
      "pos": 550000,
      "total_min": 61810000,
      "total_max": 64560000,
      "base_size_sqm": 33,
      "note": "10평 기준, 임대비 별도"
    }
  }
  */
  
  -- 메뉴 및 가격
  menu JSONB,
  /* 구조:
  {
    "categories": [
      { "name": "ESPRESSO", "items": [
        { "name_kr": "아메리카노", "name_en": "AMERICANO", "price_hot": 1800, "price_ice": 1800, "price_liter": 2300 },
        ...
      ]},
      ...
    ]
  }
  */
  
  -- 계약 조건
  contract_terms JSONB,
  /* 구조:
  {
    "contract_period": "2년",
    "renewal_period": "1년씩",
    "renewal_right_years": 10,
    "territory": { "standard_meters": 200, "special_note": "특수상권 제외" },
    "operating_hours": "1일 12시간 이상",
    "operating_days": "월 25일 이상",
    "non_compete": "계약기간 중 카페 국내 전 지역"
  }
  */
  
  -- 영업 중 비용
  ongoing_costs JSONB,
  
  -- 법위반 사실
  legal_issues JSONB,
  /* { "has_issues": false, "details": null } */
  
  -- 직영점 현황
  direct_stores JSONB,
  
  -- 원본 텍스트 (LLM 참조용)
  raw_text TEXT,
  
  -- 파싱 신뢰도
  parse_confidence DECIMAL(3,2),               -- 0.00 ~ 1.00
  manually_reviewed BOOLEAN DEFAULT FALSE,     -- 사람이 검토했는지
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. analyses (상권분석 요청)
-- ============================================
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  disclosure_id UUID REFERENCES disclosures(id),
  
  -- 분석 대상 위치
  address TEXT NOT NULL,                       -- 입력된 주소
  latitude DECIMAL(10,7),                      -- 위도
  longitude DECIMAL(10,7),                     -- 경도
  
  -- 분석 조건
  target_size_pyeong INTEGER,                  -- 예상 매장 평수
  target_floor TEXT,                           -- 층수 (1층, 2층, 지하1층 등)
  target_rent INTEGER,                         -- 예상 임대료 (입력 시)
  
  -- 분석 상태
  status TEXT DEFAULT 'pending',               -- pending / collecting / analyzing / completed / failed
  error_message TEXT,
  
  -- 결과 점수
  total_score DECIMAL(4,1),                    -- 종합 점수 (100점 만점)
  recommendation TEXT,                         -- GO / CONDITIONAL_GO / NO_GO
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. analysis_collected_data (수집된 원본 데이터)
-- ============================================
CREATE TABLE analysis_collected_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- [1단계] 수집된 데이터 (JSON) — LLM에 주입할 팩트 데이터
  population_data JSONB,       -- 반경별 인구 (공공API)
  commercial_data JSONB,       -- 상권 데이터 (공공API)
  rent_data JSONB,             -- 임대시세 (공공API)
  competitor_data JSONB,       -- 경쟁점 (Google Places)
  location_data JSONB,         -- 위치/교통 정보
  
  -- 데이터 수집 메타
  data_sources JSONB,          -- 각 데이터의 출처 + 수집 시각
  collection_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. analysis_reports (생성된 보고서)
-- ============================================
CREATE TABLE analysis_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- 보고서 콘텐츠
  report_html TEXT,                            -- HTML 보고서 전문
  report_sections JSONB,                       -- 섹션별 분리 저장
  /* 구조:
  {
    "executive_summary": "...",
    "brand_overview": "...",
    "location_analysis": "...",
    "population_analysis": "...",
    "competition_analysis": "...",
    "investment_estimate": "...",
    "sales_simulation": "...",
    "swot": "...",
    "evaluation": "...",
    "recommendation": "..."
  }
  */
  
  -- docx 파일
  docx_file_path TEXT,                         -- Supabase Storage 경로
  docx_generated_at TIMESTAMPTZ,
  
  -- LLM 메타
  llm_model TEXT,                              -- 사용된 모델명
  llm_tokens_used INTEGER,                     -- 토큰 사용량
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_brands_user_id ON brands(user_id);
CREATE INDEX idx_disclosures_brand_id ON disclosures(brand_id);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_brand_id ON analyses(brand_id);
CREATE INDEX idx_analyses_status ON analyses(status);

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_parsed_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_collected_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

-- 모든 테이블: 본인 데이터만 접근
CREATE POLICY "Users can manage own brands" ON brands FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own disclosures" ON disclosures FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own parsed data" ON disclosure_parsed_data FOR ALL USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own analyses" ON analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own collected data" ON analysis_collected_data FOR ALL USING (analysis_id IN (SELECT id FROM analyses WHERE user_id = auth.uid()));
CREATE POLICY "Users can view own reports" ON analysis_reports FOR ALL USING (analysis_id IN (SELECT id FROM analyses WHERE user_id = auth.uid()));
```

---

## 🔄 사용자 플로우 상세

### Flow 1: 회원가입 → 브랜드 등록

```
[1] 회원가입 (/signup)
    ├── 이메일 + 비밀번호 입력
    ├── Supabase Auth 처리
    └── 가입 완료 → 대시보드 리다이렉트

[2] 브랜드 정보 입력 (/brand)
    ├── 신규 등록 폼:
    │   ├── 브랜드명 (필수)
    │   ├── 법인명 (필수)
    │   ├── 업종 카테고리 (필수) — 드롭다운: 커피/치킨/분식/한식/...
    │   ├── 가격대 (필수) — 저가/중가/프리미엄
    │   ├── 대표자, 주소, 연락처 (선택)
    │   └── 가맹 조건 (선택 — 정보공개서 파싱으로 자동 채움 가능)
    └── 저장 → brands 테이블

[3] 정보공개서 업로드 (/disclosure/upload)
    ├── PDF 드래그앤드롭 업로드
    │   └── Supabase Storage에 원본 저장
    ├── 파싱 진행 (비동기)
    │   ├── pdf-parse로 텍스트 추출
    │   ├── 정규식 + 구조 분석으로 섹션 분리
    │   ├── 각 섹션별 데이터 추출:
    │   │   ├── extract-financials.ts → 재무제표 3개년
    │   │   ├── extract-franchisees.ts → 가맹점 수/개폐점/지역별
    │   │   ├── extract-fees.ts → 가맹비/교육비/로열티/개점비용
    │   │   ├── extract-sales.ts → 지역별 평균매출
    │   │   └── extract-menu.ts → 메뉴명/가격
    │   └── disclosure_parsed_data 테이블에 저장
    ├── 파싱 결과 검토 화면
    │   ├── 추출된 데이터를 테이블로 표시
    │   ├── ⚠️ 누락/오류 항목 하이라이트
    │   ├── 사용자가 직접 수정 가능 (인라인 에디팅)
    │   └── "검토 완료" 버튼 → manually_reviewed = true
    └── 파싱 데이터로 brands 테이블 자동 업데이트
        (가맹비, 로열티, 인테리어 비용 등)
```

### Flow 2: AI 상권분석

```
[4] 새 상권분석 시작 (/analysis/new)
    ├── Step 1: 브랜드 선택
    │   └── 등록된 브랜드 중 선택 (정보공개서 파싱 완료된 것만)
    │
    ├── Step 2: 주소 입력
    │   ├── Google Places Autocomplete로 주소 검색
    │   ├── 지도에 핀 표시 (위치 확인)
    │   └── 추가 입력 (선택):
    │       ├── 예상 매장 평수
    │       ├── 층수
    │       └── 예상 임대료
    │
    └── Step 3: "분석 시작" 버튼 클릭

[5] 데이터 수집 (자동, /api/analysis/collect)
    ├── [1단계] 정보공개서 데이터 조회
    │   └── disclosure_parsed_data에서 해당 브랜드 데이터 로드
    │
    ├── [1단계] 공공데이터 API 호출
    │   ├── 서울시 상권분석 API → 유동인구, 매출추정, 업종분포
    │   ├── 행정안전부 인구 API → 주거인구, 세대수
    │   ├── 한국부동산원 임대시세 → 임대료 시세
    │   └── (서울 외 지역은 다른 API 또는 LLM 추정으로 대체)
    │
    ├── [1단계] Google API 호출
    │   ├── Google Geocoding → 좌표 확정
    │   ├── Google Places Nearby → 반경 500m 경쟁 카페 검색
    │   │   ├── 매장명, 주소, 평점, 리뷰수
    │   │   └── 동일 브랜드 기존점 존재 여부 확인
    │   └── Google Places Details → 경쟁점 상세 (영업시간 등)
    │
    ├── [2단계] 구조화된 JSON 조립
    │   └── analysis_collected_data 테이블에 저장
    │       {
    │         brand_data: { ...정보공개서 파싱 데이터... },
    │         population: { ...공공API 결과... },
    │         commercial: { ...상권 데이터... },
    │         rent: { ...임대 시세... },
    │         competitors: [ ...Google Places 결과... ],
    │         location: { lat, lng, address, nearby_stations... }
    │       }
    │
    └── 수집 완료 → status = 'analyzing'

[6] AI 분석 + 보고서 생성 (/api/analysis/stream)
    ├── [3단계] LLM 호출 (Groq via Vercel AI SDK)
    │   ├── System Prompt:
    │   │   "당신은 프랜차이즈 상권분석 전문가입니다.
    │   │    아래 제공된 JSON 데이터만을 근거로 분석하십시오.
    │   │    JSON에 포함되지 않은 수치를 절대 생성하지 마십시오.
    │   │    모든 수치에는 [출처: 정보공개서] 또는 [출처: 서울시 상권분석 API] 등을 명시하십시오.
    │   │    분석이 불가능한 항목은 '데이터 부족으로 분석 불가'로 명시하십시오."
    │   │
    │   ├── User Prompt:
    │   │   "다음 데이터를 기반으로 상권분석 보고서를 작성하십시오.
    │   │    === 브랜드 데이터 (정보공개서) ===
    │   │    {brand_data JSON}
    │   │    === 상권 데이터 (공공API) ===
    │   │    {collected_data JSON}
    │   │    
    │   │    [보고서 구조]
    │   │    1. 핵심 요약
    │   │    2. 브랜드 개요 (정보공개서 기준)
    │   │    3. 입지 분석
    │   │    4. 상권 인구 분석
    │   │    5. 경쟁 환경 분석
    │   │    6. 투자비 산출 (정보공개서 기준)
    │   │    7. 월 매출 시뮬레이션 (보수/기본/낙관)
    │   │    8. SWOT 분석
    │   │    9. 종합 평가 (100점 만점 6개 항목)
    │   │    10. 출점 권고 의견"
    │   │
    │   └── 실시간 스트리밍 응답 → 프론트엔드로 전송
    │
    ├── 프론트엔드: ReportViewer 컴포넌트
    │   ├── Vercel AI SDK의 useChat / useCompletion 훅 사용
    │   ├── 스트리밍 텍스트를 HTML로 실시간 렌더링
    │   ├── 마크다운 → HTML 변환 (타이핑 효과)
    │   └── 차트/지도는 수집 데이터 기반으로 별도 렌더링 (LLM 미사용)
    │
    └── 스트리밍 완료 후:
        ├── report_html + report_sections 저장
        ├── total_score + recommendation 저장
        └── status = 'completed'

[7] 보고서 조회 (/analysis/[id])
    ├── HTML 보고서 전체 보기
    │   ├── 인쇄 친화적 레이아웃
    │   ├── 차트 (Recharts) — 수집 데이터 기반
    │   ├── 지도 (Google Maps) — 경쟁점 표시
    │   └── 테이블 — 정보공개서 데이터
    │
    └── docx 다운로드 버튼
        ├── /api/analysis/docx 호출
        ├── docx 라이브러리로 Word 문서 생성
        │   ├── 보고서 텍스트 (report_sections에서)
        │   ├── 테이블 (수집 데이터에서)
        │   └── 차트는 이미지로 변환 후 삽입 (또는 텍스트 테이블로 대체)
        └── 브라우저에서 다운로드
```

---

## 🤖 LLM 프롬프트 설계 (할루시네이션 방지)

### 시스템 프롬프트 (`lib/ai/prompts/system.ts`)

```typescript
export const SYSTEM_PROMPT = `
당신은 프랜차이즈 본사의 점포개발팀에서 사용하는 AI 상권분석 전문가입니다.

## 절대 규칙 (위반 시 보고서 무효)

1. **데이터 근거 원칙**: 아래 제공된 JSON 데이터에 포함된 수치만 사용하십시오.
2. **수치 생성 금지**: JSON에 없는 매출액, 인구수, 임대료 등 수치를 절대 생성하지 마십시오.
3. **출처 명시**: 모든 수치에 출처를 괄호로 표기하십시오.
   - (출처: 정보공개서)
   - (출처: 서울시 상권분석 API)
   - (출처: Google Places)
   - (출처: 한국부동산원)
4. **데이터 부족 인정**: 데이터가 없는 항목은 "해당 데이터 미수집"으로 명시하십시오.
5. **추정치 표기**: 불가피하게 추정이 필요한 경우 "추정"임을 명시하고 산출 근거를 밝히십시오.

## 보고서 작성 규칙

- 한국어로 작성
- 보고서 톤: 프랜차이즈 본사 → 예비 점주 제공용 (전문적이되 이해하기 쉽게)
- 각 섹션은 ## 헤더로 구분
- 테이블은 마크다운 테이블 문법 사용
- 금액은 천원 단위 또는 만원 단위로 통일
- SWOT은 2×2 테이블 형태로 작성

## 매출 시뮬레이션 규칙

- 정보공개서의 해당 지역 평균 매출을 기본(Baseline) 시나리오로 사용
- 보수적 = 기본의 60~70%
- 낙관적 = 기본의 130~150%
- 비용 항목: 원재료비(매출의 33~38%), 인건비, 임대료, 로열티(정보공개서 기준), 배달수수료, 기타
- BEP(손익분기점)를 반드시 산출

## 종합 평가 규칙

- 6개 항목: 입지, 수요, 경쟁, 수익성, 성장, 브랜드 적합
- 각 항목 100점 만점
- 평균 점수 계산
- 등급: A(80+), B+(65-79), B-(55-64), C(45-54), D(44이하)
- 출점 권고: GO / CONDITIONAL_GO / NO_GO
`;
```

### 보고서 섹션별 프롬프트 (`lib/ai/prompts/report-sections.ts`)

```typescript
export const REPORT_STRUCTURE = `
## 보고서 구조

### 1. 핵심 요약 (Executive Summary)
- 종합 점수 및 등급
- 출점 권고 의견 (한 줄)
- BEP 매출
- 핵심 기회 요인 3개
- 핵심 리스크 요인 3개

### 2. 브랜드 개요
- 정보공개서 기반 본사 정보 테이블
- 가맹점 현황 추이 테이블 (3개년)
- 지역별 평균 매출 테이블

### 3. 입지 분석
- 위치/교통 정보 테이블
- 반경별 인구 분석 테이블 (500m/1km/2km)
- 상권 특성 분석

### 4. 경쟁 환경 분석
- 반경 500m 내 경쟁점 테이블
- 동일 브랜드 기존점 존재 여부
- 브랜드 포지셔닝 분석

### 5. 투자비 산출
- 초기 투자비 테이블 (정보공개서 기준)
- 월 고정비용 테이블

### 6. 월 매출 시뮬레이션
- 보수/기본/낙관 3단계 시나리오 테이블
- 비용 구조 및 영업이익 산출
- BEP 분석

### 7. SWOT 분석
- 2×2 매트릭스 (S/W/O/T)

### 8. 종합 평가
- 6개 항목 점수 테이블
- 평균 점수 및 등급

### 9. 출점 권고 의견
- 필수 조건 (Must-Have)
- 권장 사항 (Should-Have)
- 회피 사항 (Must-Avoid)
- 최종 결론
`;
```

---

## 🔌 외부 API 연동 상세

### 1. 공공데이터 API

```typescript
// lib/public-api/seoul-commercial.ts

// 서울시 우리마을가게 상권분석 서비스 (golmok.seoul.go.kr)
// API 키: data.seoul.go.kr에서 발급

interface SeoulCommercialAPI {
  // 상권 영역 조회
  getCommercialArea(lat: number, lng: number): Promise<CommercialArea>;
  
  // 유동인구
  getFootTraffic(areaCode: string, yearQuarter: string): Promise<FootTraffic>;
  
  // 상주인구
  getResidentPopulation(areaCode: string): Promise<Population>;
  
  // 직장인구
  getWorkingPopulation(areaCode: string): Promise<Population>;
  
  // 업종별 매출
  getSalesByIndustry(areaCode: string, industryCode: string): Promise<Sales>;
  
  // 업종별 점포수
  getStoreCount(areaCode: string, industryCode: string): Promise<StoreCount>;
  
  // 임대시세
  getRentPrice(areaCode: string): Promise<RentPrice>;
}

// 서울 외 지역 대체 API
// - 소상공인시장진흥공단 상권정보시스템 (sg.sbiz.or.kr)
// - 행정안전부 주민등록인구 API
```

### 2. Google APIs

```typescript
// lib/public-api/google-places.ts

interface GooglePlacesService {
  // 주소 → 좌표 변환
  geocode(address: string): Promise<{ lat: number; lng: number }>;
  
  // 주변 카페 검색 (반경 500m)
  nearbySearch(lat: number, lng: number, radius: number, type: string): Promise<Place[]>;
  
  // 매장 상세 정보
  getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  
  // 주소 자동완성
  autocomplete(input: string): Promise<AutocompleteResult[]>;
}
```

---

## 📄 정보공개서 PDF 파싱 상세

### 파싱 전략

```
[PDF 업로드]
    │
    ▼
[pdf-parse로 전체 텍스트 추출]
    │
    ▼
[섹션 분리] — 정보공개서 표준 구조 기반
    ├── "Ⅰ. 당사의 일반현황" → 본사 기본 정보
    ├── "Ⅱ. 가맹본부의 가맹사업 현황" → 가맹점 수, 매출
    ├── "Ⅲ. 법 위반 사실" → 법위반 여부
    ├── "Ⅳ. 가맹점사업자의 부담" → 가맹비, 개점비용, 로열티
    ├── "Ⅴ. 영업활동 조건 및 제한" → 영업지역, 메뉴, 계약
    └── 별첨 → 메뉴/가격, 재무제표
    │
    ▼
[각 섹션별 정규식 + 패턴 매칭으로 데이터 추출]
    │
    ▼
[추출 실패 항목은 Groq LLM으로 2차 추출 시도]
    │   └── "아래 텍스트에서 가맹비 금액을 추출하라. 
    │        숫자와 단위만 응답하라."
    │
    ▼
[구조화된 JSON으로 변환 → DB 저장]
    │
    ▼
[사용자 검토 화면에서 확인/수정]
```

### 파싱 대상 항목 체크리스트

```typescript
interface DisclosureParsedFields {
  // 필수 추출 (보고서 생성에 반드시 필요)
  required: {
    company_name: string;              // ✅ 법인명
    brand_name: string;                // ✅ 브랜드명
    franchise_fee: number;             // ✅ 가맹비
    education_fee: number;             // ✅ 교육비
    royalty: { type: string; amount: number }; // ✅ 로열티
    franchisee_count_by_year: object;  // ✅ 가맹점 수 (3개년)
    avg_sales_by_region: object;       // ✅ 지역별 평균매출
    opening_costs: object;             // ✅ 개점비용 내역
    territory_protection: number;      // ✅ 영업지역 보호거리
  };
  
  // 선택 추출 (있으면 보고서 풍부해짐)
  optional: {
    financials_3yr: object;            // 재무제표 3개년
    menu_prices: object;               // 메뉴/가격표
    contract_terms: object;            // 계약조건
    legal_issues: object;              // 법위반 사실
    direct_stores: object;             // 직영점 현황
    advertising_costs: object;         // 광고/판촉비
  };
}
```

---

## 🎨 UI/UX 와이어프레임 가이드

### 전체 레이아웃

```
┌─────────────────────────────────────────────┐
│  Header (로고 + 브랜드명 + 알림 + 프로필)       │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │       Main Content Area          │
│          │                                  │
│ 📊 대시보드│                                  │
│ 🏢 브랜드  │                                  │
│ 📋 정보공개서│                                 │
│ 🔍 상권분석│                                  │
│ ⚙️ 설정   │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### 상권분석 결과 화면 (핵심)

```
┌─────────────────────────────────────────────┐
│ ← 뒤로    강남대로156길 20 상권분석    [docx ↓] │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ 종합 평가 카드 ───────────────────────┐   │
│ │  58.2점 / B- 등급 / 조건부 출점 권고      │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ ┌─ 지도 ─────────┐ ┌─ 핵심 지표 ─────────┐ │
│ │  [Google Maps]  │ │ BEP: 1,550만/월     │ │
│ │  경쟁점 핀 표시   │ │ 투자비: 1.7~2.1억   │ │
│ │                 │ │ 기본매출: 2,450만/월  │ │
│ └─────────────────┘ └────────────────────┘ │
│                                             │
│ ── AI 분석 보고서 (스트리밍) ──                 │
│                                             │
│ ## 1. 핵심 요약                               │
│ 본 위치는 ... (타이핑 효과로 실시간 표시)         │
│ ...                                         │
│ ## 2. 브랜드 개요                              │
│ | 항목 | 내용 |                                │
│ | 가맹비 | 550만원 (출처: 정보공개서) |            │
│ ...                                         │
│                                             │
│ ── 차트 영역 (수집 데이터 기반, LLM 미사용) ──    │
│ [인구 차트] [매출 차트] [경쟁 차트]               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ⚙️ 환경변수 (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI / LLM
GROQ_API_KEY=                          # 메인 LLM
ANTHROPIC_API_KEY=                     # 백업 (선택)
OPENAI_API_KEY=                        # 백업 (선택)

# Google APIs
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=       # 프론트엔드 지도용
GOOGLE_PLACES_API_KEY=                 # 서버사이드 Places API용

# 공공데이터
SEOUL_OPEN_DATA_API_KEY=               # data.seoul.go.kr
SGIS_API_KEY=                          # 통계지리정보서비스
PUBLIC_DATA_API_KEY=                   # data.go.kr (공공데이터포털)

# Email
RESEND_API_KEY=
```

---

## 🚀 개발 우선순위 (Phase)

### Phase 1: 핵심 기능 (MVP)
1. ✅ Supabase 프로젝트 셋업 + DB 스키마 생성
2. ✅ 회원가입/로그인 (Supabase Auth)
3. ✅ 브랜드 정보 CRUD
4. ✅ 정보공개서 PDF 업로드 + 파싱
5. ✅ 파싱 결과 검토/수정 UI
6. ✅ 상권분석: 주소 입력 + 데이터 수집
7. ✅ 상권분석: LLM 스트리밍 보고서 생성
8. ✅ 보고서 HTML 뷰어
9. ✅ docx 다운로드

### Phase 2: 고도화
1. 차트/그래프 (Recharts)
2. Google Maps 경쟁점 시각화
3. 분석 이력 관리
4. 보고서 템플릿 커스터마이징
5. 다크모드

### Phase 3: 확장
1. 보고서 PDF 다운로드
2. 팀 기능 (같은 브랜드 직원 초대)
3. 분석 비교 (위치 A vs B)
4. 이메일 보고서 발송 (Resend)
5. 모바일 반응형 최적화

---

## 📝 구현 시 주의사항

### 1. 할루시네이션 방지 (최우선)
- LLM에 전달하는 데이터는 반드시 `analysis_collected_data`에서 가져온 JSON만 사용
- LLM 응답에서 수치를 파싱하여 원본 데이터와 교차 검증하는 후처리 로직 구현
- 검증 실패 시 해당 수치에 ⚠️ 경고 표시

### 2. 정보공개서 파싱 정확도
- 정보공개서는 브랜드마다 포맷이 다름 → 정규식만으로는 한계
- 1차: 정규식 + 테이블 구조 분석 → 2차: LLM 보조 추출 → 3차: 사용자 수동 검토
- `parse_confidence` 점수를 산출하여 신뢰도 낮은 항목 하이라이트

### 3. 공공데이터 API 한계
- 서울시 상권분석 API는 서울만 지원 → 서울 외 지역은 대체 데이터 소스 필요
- API 응답 지연 가능 → 데이터 수집은 비동기 + 프로그레스바 표시
- API 일일 호출 제한 있음 → 캐싱 전략 (동일 위치 24시간 캐시)

### 4. Groq 모델 선택
- 속도 우선: `llama-3.3-70b-versatile` (빠른 응답, 한국어 양호)
- 품질 우선: `llama-3.1-70b-versatile` (더 정확, 약간 느림)
- 컨텍스트 윈도우 확인 필요 (정보공개서 데이터 + 수집 데이터가 클 수 있음)

### 5. docx 생성
- 서버사이드에서 `docx` 라이브러리로 생성 (브라우저에서는 무거움)
- 차트는 HTML Canvas → 이미지 변환 → docx 삽입 (또는 텍스트 테이블로 대체)
- 한국어 폰트: '맑은 고딕' 지정 (docx 내 폰트 임베딩 불필요, Word에서 렌더링)

---

## 🚨 기존 프로그램(v1) 버그 분석 및 v2 해결 방안

> 기존 프로그램 캡쳐에서 확인된 6가지 치명적 문제와 해결 방안입니다.
> v2 개발 시 아래 내용을 반드시 반영해야 합니다.

### 버그 1: 스트리밍 에러 — "Invalid state: Controller is already closed"

**원인**: ReadableStream 컨트롤러가 닫힌 후에도 chunk를 push하려는 문제. LLM 응답이 길어 타임아웃 발생 후 후속 chunk 도착.

**해결**:
```typescript
// lib/ai/stream-handler.ts — 안전한 스트림 래퍼
export function createSafeStream(aiStream: AsyncIterable<string>) {
  let isClosed = false;
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
          if (isClosed) break;
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        if (!isClosed) controller.close();
      } catch (error) {
        if (!isClosed) controller.error(error);
      }
    },
    cancel() { isClosed = true; }
  });
}
```
- Groq API 타임아웃 120초 설정
- 섹션별 분리 호출로 단일 요청 크기 축소
- 에러 시 해당 섹션만 재시도

### 버그 2: "Cannot read properties of undefined (reading 'get')"

**원인**: 공공데이터 API가 해당 지역 데이터를 반환하지 않는 경우 null 체크 없이 프로퍼티 접근.

**해결**:
```typescript
// lib/report/data-collector.ts — null-safe API 래퍼
async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  source: string
): Promise<{ data: T; source: string; success: boolean }> {
  try {
    const data = await apiCall();
    if (!data) return { data: fallbackValue, source: `${source} (데이터 없음)`, success: false };
    return { data, source, success: true };
  } catch (error) {
    return { data: fallbackValue, source: `${source} (호출 실패)`, success: false };
  }
}
```
- 수집 completeness 점수 산출 (예: 8/10 = 80%)
- 60% 미만 시 사용자에게 "데이터 부족 경고" 후 진행 여부 확인

### 버그 3: 마크다운이 HTML로 렌더링 안 됨

**원인**: LLM이 마크다운으로 응답하는데 프론트에서 raw text로 출력. `##`, `|---|`, `**볼드**` 등이 그대로 보임.

**해결 — 필수 패키지**:
```bash
npm install react-markdown remark-gfm @tailwindcss/typography
```

```tsx
// components/analysis/ReportViewer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ReportViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-200">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-blue-50 border border-gray-200 px-3 py-2 text-sm font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 text-sm">{children}</td>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-blue-900 border-b-2 border-blue-900 pb-2 mt-8 mb-4">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold text-red-700 mt-6 mb-3">{children}</h3>
          ),
        }}
      />
    </div>
  );
}
```

### 버그 4: 종합점수 0점 — 점수 산출 로직 미작동

**원인**: LLM이 점수를 자연어 텍스트에 포함시키는데 이를 파싱하여 DB 저장하는 로직 없음.

**해결 — 점수를 구조화된 JSON으로 별도 요청**:
```typescript
// 보고서 스트리밍 완료 후, 별도 호출로 점수만 JSON 추출
const scoringResponse = await generateObject({
  model: groq('llama-3.3-70b-versatile'),
  schema: z.object({
    scores: z.object({
      location: z.object({ score: z.number(), reason: z.string() }),
      demand: z.object({ score: z.number(), reason: z.string() }),
      competition: z.object({ score: z.number(), reason: z.string() }),
      profitability: z.object({ score: z.number(), reason: z.string() }),
      growth: z.object({ score: z.number(), reason: z.string() }),
      brand_fit: z.object({ score: z.number(), reason: z.string() }),
    }),
    total_avg: z.number(),
    grade: z.string(),
    recommendation: z.enum(['GO', 'CONDITIONAL_GO', 'NO_GO']),
  }),
  prompt: SCORING_PROMPT + JSON.stringify(collectedData),
});

// 데이터 부족 항목은 보수적으로 40~50점 부여, reason에 "데이터 부족" 명시
```

### 버그 5: 다국어 혼용 (러시아어/독일어/일본어 텍스트 혼입)

**원인**: Groq Llama 모델이 다국어 모델이라 컨텍스트 길어지면 code-switching 발생. "존재"→"存在", "부재"→"отсутств" 등.

**해결**:
```typescript
// 시스템 프롬프트에 언어 강제 규칙 추가
const LANGUAGE_RULE = `
## 언어 규칙 (절대)
- 반드시 한국어로만 작성하라.
- 한자(存在), 일본어, 러시아어, 독일어 단어를 절대 사용하지 마라.
- 영어는 브랜드명, 약어(SWOT, BEP) 등에만 허용한다.
`;

// 후처리 필터 (안전장치)
function sanitizeKorean(text: string): string {
  return text
    .replace(/[\u3400-\u9FFF]/g, '')   // CJK 한자
    .replace(/[\u0400-\u04FF]/g, '')   // 키릴 문자
    .replace(/[\u3040-\u309F\u30A0-\u30FF]/g, ''); // 히라가나/카타카나
}
```

**근본 대책**: 보고서 생성은 Claude(`@ai-sdk/anthropic`)로 전환 고려 (한국어 품질 월등). Groq는 속도 중요한 파싱/점수 산출에 사용.

### 버그 6: 정보공개서 파싱 실패 (가맹비 1원)

**원인**: PDF 텍스트 추출 후 숫자 파싱 실패 → 기본값(1) 저장. 브랜드별 포맷 차이 미대응.

**해결 — 다단계 파싱 + 검증**:
```
1단계: 정규식 패턴 매칭 (가맹비\s*[:\s]*(\d[\d,]*)\s*만?\s*원)
  ↓ 실패 시
2단계: 테이블 구조 분석 (구분|금액|비고 패턴)
  ↓ 실패 시
3단계: LLM 보조 추출 (Groq generateObject)
  ↓ 추출 완료
4단계: 상식적 범위 검증 (가맹비 < 10만원이면 경고)
  ↓
5단계: 사용자 검토 화면에서 확인/수정
```

**파싱 검토 UI 필수 기능**:
- ✅ 정상 추출 항목: 초록색 표시
- ⚠️ 신뢰도 낮은 항목: 노란색 + "확인 필요" 표시
- ❌ 미추출 항목: 빨간색 + "직접 입력" 버튼
- 전체 신뢰도 점수 표시 (예: 78%)
- "검토 완료" 버튼 클릭 전까지는 상권분석에 사용 불가

---

## 📊 보고서 HTML 렌더링 사양 (v2 목표 품질)

### 보고서 페이지 구조

```tsx
// components/analysis/ReportPage.tsx — 전체 구조
<div className="max-w-4xl mx-auto bg-white p-8 shadow-lg">
  
  {/* 1. 상단 요약 카드 — 수집 데이터 기반 (LLM 미사용) */}
  <SummaryCard score={58.2} grade="B-" recommendation="조건부 출점" bep="1,550만/월" />
  
  {/* 2. 지도 + 핵심 지표 — 수집 데이터 기반 (LLM 미사용) */}
  <div className="grid grid-cols-2 gap-4 my-6">
    <AnalysisMap competitors={collectedData.competitors} />
    <KeyMetrics data={collectedData} />
  </div>
  
  {/* 3. 차트 — 수집 데이터 기반 (LLM 미사용) */}
  <div className="grid grid-cols-2 gap-4 my-6">
    <PopulationChart data={collectedData.population_data} />
    <CompetitorChart data={collectedData.competitor_data} />
  </div>
  
  {/* 4. AI 분석 보고서 본문 — 마크다운 스트리밍 → HTML */}
  <ReportViewer content={streamingContent} />
  
  {/* 5. docx 다운로드 */}
  <DocxDownloadButton analysisId={analysis.id} />
</div>
```

### LLM 응답 포맷 규칙

```typescript
// lib/ai/prompts/system.ts — LLM이 지켜야 할 마크다운 포맷
export const FORMAT_RULES = `
## 응답 포맷 규칙
1. 섹션 제목: ## (h2)
2. 소제목: ### (h3)
3. 테이블: 마크다운 테이블 | 항목 | 값 | 비고 |
4. 강조: **볼드**
5. 리스트: - 또는 1. 2. 3.
6. 출처: 괄호 안에 이탤릭 *(출처: 정보공개서)*
7. 금액: 만원 단위 (550만원 ○ / 5,500,000원 ✕)
8. 퍼센트: 소수점 1자리 (13.9% ○ / 13.877% ✕)
9. 코드블록(\`\`\`) 사용 금지
10. 한국어 외 언어 사용 금지
`;
