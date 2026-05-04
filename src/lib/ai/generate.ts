import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";

import { ReportAnalysisSchema, type ReportAnalysis } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { DbBrand } from "@/types/database";
import type { CollectedData } from "@/types/database";

// ============================================
// 경쟁점 보완 — LLM이 빈 배열 반환 시 fallback
// ============================================

type CompetitorEntry = ReportAnalysis["competitors"][number];
type RiskLevel = CompetitorEntry["risk_level"];

/** 업종별 대표 프랜차이즈 경쟁점 풀 */
const FRANCHISE_POOL: Record<string, Array<{ name: string; risk: RiskLevel; rev: number }>> = {
  치킨: [
    { name: "교촌치킨", risk: "높음", rev: 45_000_000 },
    { name: "BBQ", risk: "높음", rev: 42_000_000 },
    { name: "bhc치킨", risk: "높음", rev: 40_000_000 },
    { name: "굽네치킨", risk: "보통", rev: 35_000_000 },
    { name: "60계치킨", risk: "보통", rev: 30_000_000 },
  ],
  카페: [
    { name: "스타벅스", risk: "높음", rev: 65_000_000 },
    { name: "메가커피", risk: "높음", rev: 45_000_000 },
    { name: "컴포즈커피", risk: "높음", rev: 40_000_000 },
    { name: "이디야커피", risk: "보통", rev: 32_000_000 },
    { name: "빽다방", risk: "보통", rev: 30_000_000 },
  ],
  커피: [
    { name: "스타벅스", risk: "높음", rev: 65_000_000 },
    { name: "메가커피", risk: "높음", rev: 45_000_000 },
    { name: "컴포즈커피", risk: "높음", rev: 40_000_000 },
    { name: "이디야커피", risk: "보통", rev: 32_000_000 },
    { name: "투썸플레이스", risk: "보통", rev: 38_000_000 },
  ],
  한식: [
    { name: "한솥도시락", risk: "높음", rev: 25_000_000 },
    { name: "본죽", risk: "보통", rev: 20_000_000 },
    { name: "새마을식당", risk: "보통", rev: 28_000_000 },
    { name: "김가네", risk: "보통", rev: 18_000_000 },
    { name: "고봉민김밥", risk: "낮음", rev: 15_000_000 },
  ],
  분식: [
    { name: "죠스떡볶이", risk: "높음", rev: 18_000_000 },
    { name: "엽기떡볶이", risk: "높음", rev: 20_000_000 },
    { name: "신전떡볶이", risk: "보통", rev: 15_000_000 },
    { name: "이삭토스트", risk: "보통", rev: 12_000_000 },
    { name: "국대떡볶이", risk: "낮음", rev: 12_000_000 },
  ],
  편의점: [
    { name: "GS25", risk: "치명적", rev: 60_000_000 },
    { name: "CU", risk: "치명적", rev: 58_000_000 },
    { name: "세븐일레븐", risk: "높음", rev: 50_000_000 },
    { name: "이마트24", risk: "높음", rev: 45_000_000 },
    { name: "미니스톱", risk: "보통", rev: 35_000_000 },
  ],
  피자: [
    { name: "도미노피자", risk: "높음", rev: 40_000_000 },
    { name: "피자헛", risk: "높음", rev: 45_000_000 },
    { name: "피자알볼로", risk: "보통", rev: 30_000_000 },
    { name: "7번가피자", risk: "보통", rev: 25_000_000 },
    { name: "미스터피자", risk: "낮음", rev: 22_000_000 },
  ],
  햄버거: [
    { name: "맥도날드", risk: "높음", rev: 55_000_000 },
    { name: "버거킹", risk: "높음", rev: 50_000_000 },
    { name: "롯데리아", risk: "보통", rev: 40_000_000 },
    { name: "맘스터치", risk: "보통", rev: 35_000_000 },
    { name: "서브웨이", risk: "낮음", rev: 28_000_000 },
  ],
  "피자·햄버거": [
    { name: "맥도날드", risk: "높음", rev: 55_000_000 },
    { name: "버거킹", risk: "높음", rev: 50_000_000 },
    { name: "도미노피자", risk: "높음", rev: 40_000_000 },
    { name: "롯데리아", risk: "보통", rev: 40_000_000 },
    { name: "피자헛", risk: "보통", rev: 45_000_000 },
  ],
};

const FALLBACK_FRANCHISE_POOL: Array<{ name: string; risk: RiskLevel; rev: number }> = [
  { name: "맥도날드", risk: "높음", rev: 55_000_000 },
  { name: "스타벅스", risk: "높음", rev: 65_000_000 },
  { name: "GS25", risk: "보통", rev: 60_000_000 },
  { name: "이디야커피", risk: "보통", rev: 32_000_000 },
  { name: "파리바게뜨", risk: "낮음", rev: 28_000_000 },
];

// 고정 오프셋 값 (Math.random 미사용 — 재현성 보장)
const FILL_FR_DIST   = [480, 580, 680, 760, 850] as const;
const FILL_FR_RATING = [4.1, 3.9, 4.2, 3.8, 4.0] as const;
const FILL_FR_REVIEW = [180, 120, 250,  90, 150] as const;

const FILL_IN_DIST   = [280, 380, 480, 620, 750] as const;
const FILL_IN_RATING = [3.8, 3.5, 4.0, 3.7, 3.6] as const;
const FILL_IN_REVIEW = [ 65,  30,  90,  45,  20] as const;
const FILL_IN_REV    = [14_000_000, 10_000_000, 18_000_000, 12_000_000, 9_000_000] as const;
const FILL_IN_RISK: ReadonlyArray<RiskLevel> = ["보통", "낮음", "높음", "보통", "낮음"];

/**
 * LLM이 경쟁점을 채우지 않은 경우 서버에서 기본값으로 보완.
 * 프랜차이즈·개인점 각각 최소 5개를 보장한다.
 */
function fillMissingCompetitors(
  competitors: CompetitorEntry[],
  subIndustry: string | null,
  industry: string,
): CompetitorEntry[] {
  const franchises = competitors.filter((c) => c.type === "프랜차이즈");
  const individuals = competitors.filter((c) => c.type === "개인점");

  if (franchises.length >= 5 && individuals.length >= 5) return competitors;

  const result = [...competitors];
  const poolKey = subIndustry ?? industry;
  const pool = FRANCHISE_POOL[poolKey] ?? FALLBACK_FRANCHISE_POOL;
  const indLabel = subIndustry ?? industry;

  // 프랜차이즈 채우기 (5개까지)
  for (let i = franchises.length; i < 5; i++) {
    const p = pool[i % pool.length];
    result.push({
      rank: result.length + 1,
      name: p.name,
      distance_m: FILL_FR_DIST[i] ?? 600,
      type: "프랜차이즈",
      rating: FILL_FR_RATING[i] ?? 4.0,
      review_count: FILL_FR_REVIEW[i] ?? 100,
      estimated_monthly_revenue: p.rev,
      risk_level: p.risk,
      note: "(AI 추정 — 실데이터 미수집)",
    });
  }

  // 개인점 채우기 (5개까지)
  for (let i = individuals.length; i < 5; i++) {
    result.push({
      rank: result.length + 1,
      name: `인근 ${indLabel} 소형매장 ${i + 1}호`,
      distance_m: FILL_IN_DIST[i] ?? 500,
      type: "개인점",
      rating: FILL_IN_RATING[i] ?? 3.7,
      review_count: FILL_IN_REVIEW[i] ?? 40,
      estimated_monthly_revenue: FILL_IN_REV[i] ?? 12_000_000,
      risk_level: FILL_IN_RISK[i] ?? "보통",
      note: "(AI 추정 — 실데이터 미수집)",
    });
  }

  return result;
}

// ============================================
// Vercel AI SDK 기반 LLM 추상화
// 환경변수 LLM_PROVIDER로 provider 전환
// ============================================

type LLMProvider = "anthropic" | "openai" | "groq";

function getProvider(provider: LLMProvider) {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim();

  if (!apiKey) throw new Error("LLM_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!model) throw new Error("LLM_MODEL 환경변수가 설정되지 않았습니다.");
  // 한글 등 비ASCII 문자가 포함된 placeholder 키 감지
  if (!/^[\x00-\x7F]+$/.test(apiKey)) {
    throw new Error("LLM_API_KEY에 유효하지 않은 문자가 포함되어 있습니다. .env.local에 실제 API 키를 입력해주세요.");
  }

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "groq": {
      const groq = createGroq({ apiKey });
      return groq(model);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`지원하지 않는 LLM 프로바이더: ${String(_exhaustive)}`);
    }
  }
}

export interface GenerateReportInput {
  brand: DbBrand;
  address: string;
  lat: number;
  lng: number;
  collectedData: CollectedData;
}

// ============================================
// JSON 추출 헬퍼 — 마크다운 코드블록 제거
// ============================================

function extractJSON(text: string): string {
  // ```json ... ``` 또는 ``` ... ``` 블록 제거
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // JSON 객체 경계 직접 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

// ============================================
// AI 출력 repair — 흔한 스키마 불일치 수정
// 평탈(flat) 구조 → 중첩(nested) 구조 변환 포함
// ============================================

function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) || v === null || v === undefined ? fallback : n;
}

function repairAnalysis(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  // ---- location_info 정규화 ----
  if (!obj.location_info || typeof obj.location_info !== "object") {
    obj.location_info = {};
  }
  {
    const li = { ...(obj.location_info as Record<string, unknown>) };
    if (!li.candidate_name) li.candidate_name = "분석 대상 입지";
    if (!li.address) li.address = "";
    li.estimated_area_pyeong = toNum(li.estimated_area_pyeong, 20);
    li.deposit = toNum(li.deposit, 10000000);
    li.monthly_rent = toNum(li.monthly_rent, 1500000);
    li.key_money = toNum(li.key_money, 0);
    li.maintenance_fee = toNum(li.maintenance_fee, 200000);
    obj.location_info = li;
  }

  // ---- population 정규화 (누락 시 기본값) ----
  if (!obj.population || typeof obj.population !== "object") {
    obj.population = {};
  }
  {
    const pop = { ...(obj.population as Record<string, unknown>) };
    const defaultRadius = { residential: 5000, households: 2000, workers: 1000 };
    if (!pop.radius_500m || typeof pop.radius_500m !== "object") pop.radius_500m = { ...defaultRadius };
    if (!pop.radius_1km || typeof pop.radius_1km !== "object") pop.radius_1km = { residential: 15000, households: 6000, workers: 3000 };
    if (!pop.radius_2km || typeof pop.radius_2km !== "object") pop.radius_2km = { residential: 40000, households: 16000, workers: 8000 };
    if (!pop.core_age_group) pop.core_age_group = "30~50대";
    if (!pop.gender_ratio) pop.gender_ratio = "남 50% / 여 50%";
    if (!pop.commercial_area_type) pop.commercial_area_type = "주거 상권";
    if (!pop.hourly_traffic || typeof pop.hourly_traffic !== "object") {
      pop.hourly_traffic = {
        morning:   { weekday: 500, weekend: 300 },
        lunch:     { weekday: 1000, weekend: 800 },
        afternoon: { weekday: 600, weekend: 700 },
        evening:   { weekday: 900, weekend: 1000 },
        night:     { weekday: 700, weekend: 800 },
      };
    }
    obj.population = pop;
  }

  // ---- competitors 배열 정규화 ----
  if (!Array.isArray(obj.competitors)) {
    obj.competitors = [];
  }
  obj.competitors = (obj.competitors as unknown[]).map((c: unknown, i: number) => {
    if (!c || typeof c !== "object") {
      return {
        rank: i + 1, name: `경쟁점 ${i + 1}`, distance_m: 500,
        type: "개인점", rating: null, review_count: 0,
        estimated_monthly_revenue: 20000000, risk_level: "보통", note: "",
      };
    }
    const raw = c as Record<string, unknown>;

    // 한국어 필드명 → 영문 필드명 매핑
    const comp: Record<string, unknown> = { ...raw };
    if (comp.순위 !== undefined && comp.rank === undefined) comp.rank = comp.순위;
    if (comp.상호명 !== undefined && comp.name === undefined) comp.name = comp.상호명;
    if (comp.이름 !== undefined && comp.name === undefined) comp.name = comp.이름;
    if ((comp["거리(m)"] ?? comp.거리) !== undefined && comp.distance_m === undefined) comp.distance_m = comp["거리(m)"] ?? comp.거리;
    if (comp.유형 !== undefined && comp.type === undefined) comp.type = comp.유형;
    if (comp.평점 !== undefined && comp.rating === undefined) comp.rating = comp.평점;
    if ((comp["리뷰 수"] ?? comp.리뷰수) !== undefined && comp.review_count === undefined) comp.review_count = comp["리뷰 수"] ?? comp.리뷰수;
    if ((comp["추정 월 매출"] ?? comp.월매출 ?? comp["월 매출"]) !== undefined && comp.estimated_monthly_revenue === undefined)
      comp.estimated_monthly_revenue = comp["추정 월 매출"] ?? comp.월매출 ?? comp["월 매출"];
    if (comp.위험도 !== undefined && comp.risk_level === undefined) comp.risk_level = comp.위험도;
    if (comp.비고 !== undefined && comp.note === undefined) comp.note = comp.비고;

    // rank
    comp.rank = toNum(comp.rank, i + 1);
    // name
    if (!comp.name || typeof comp.name !== "string") comp.name = `경쟁점 ${i + 1}`;
    // distance_m
    comp.distance_m = toNum(comp.distance_m, 500);
    // rating: 숫자가 아니거나 없으면 null
    if (comp.rating !== null && comp.rating !== undefined) {
      const n = Number(comp.rating);
      comp.rating = isNaN(n) ? null : n;
    } else {
      comp.rating = null;
    }
    // review_count
    comp.review_count = toNum(comp.review_count, 0);
    // estimated_monthly_revenue
    comp.estimated_monthly_revenue = toNum(comp.estimated_monthly_revenue, 20000000);
    // risk_level enum 정규화
    const riskMap: Record<string, string> = {
      치명: "치명적", fatal: "치명적", critical: "치명적",
      high: "높음", 위험: "높음",
      medium: "보통", moderate: "보통", normal: "보통",
      low: "낮음", safe: "낮음", minimal: "낮음",
    };
    if (typeof comp.risk_level === "string") {
      comp.risk_level = riskMap[comp.risk_level] ?? comp.risk_level;
    }
    if (!["치명적", "높음", "보통", "낮음"].includes(comp.risk_level as string)) comp.risk_level = "보통";
    // type enum 정규화
    if (["프렌차이즈", "franchise", "Franchise", "체인"].includes(comp.type as string)) comp.type = "프랜차이즈";
    if (["개인", "independent", "개인사업", "로컬", "local"].includes(comp.type as string)) comp.type = "개인점";
    if (!["프랜차이즈", "개인점"].includes(comp.type as string)) comp.type = "개인점";
    // note
    if (!comp.note || typeof comp.note !== "string") comp.note = "";
    return comp;
  });

  // ---- revenue_simulation 정규화 ----
  // 모델이 {conservative: 숫자, ...} 형태로 내보내는 경우 처리
  if (!obj.revenue_simulation || typeof obj.revenue_simulation !== "object") {
    obj.revenue_simulation = {};
  }
  {
    const rev = { ...(obj.revenue_simulation as Record<string, unknown>) };
    const buildScenario = (monthlyRevenue: number, multiplier: number) => {
      const monthly = Math.round(monthlyRevenue * multiplier);
      const daily = Math.round(monthly / 30);
      // avg_ticket이 시나리오에 이미 있으면 사용, 없으면 12,000원 기본값 (업종 불명 시 보수적 추정)
      const existingTicket =
        typeof (rev[multiplier === 0.7 ? "conservative" : multiplier === 1.0 ? "standard" : "optimistic"] as Record<string, unknown>)?.avg_ticket === "number"
          ? (rev[multiplier === 0.7 ? "conservative" : multiplier === 1.0 ? "standard" : "optimistic"] as Record<string, unknown>).avg_ticket as number
          : 12_000;
      const ticket = existingTicket > 0 ? existingTicket : 12_000;
      return { daily_customers: Math.round(daily / ticket), avg_ticket: ticket, daily_revenue: daily, monthly_revenue: monthly };
    };
    const refMonthly = toNum(
      (rev.standard as Record<string, unknown>)?.monthly_revenue ?? rev.standard,
      20000000
    );
    for (const [key, mult] of [["conservative", 0.7], ["standard", 1.0], ["optimistic", 1.4]] as const) {
      const s = rev[key];
      if (!s || typeof s !== "object") {
        // 숫자이거나 없는 경우 → 기본 시나리오 구성
        const base = typeof s === "number" ? s : refMonthly * mult;
        rev[key] = buildScenario(base, 1.0);
      } else {
        // 객체이지만 필드가 누락된 경우 보완
        const scenario = { ...(s as Record<string, unknown>) };
        scenario.monthly_revenue = toNum(scenario.monthly_revenue, refMonthly * mult);
        scenario.daily_revenue   = toNum(scenario.daily_revenue, Math.round((scenario.monthly_revenue as number) / 30));
        scenario.avg_ticket      = toNum(scenario.avg_ticket, 20000);
        scenario.daily_customers = toNum(scenario.daily_customers, Math.round((scenario.daily_revenue as number) / (scenario.avg_ticket as number)));
        rev[key] = scenario;
      }
    }
    obj.revenue_simulation = rev;
  }

  // ---- cost_simulation 정규화 ----
  if (!obj.cost_simulation || typeof obj.cost_simulation !== "object") {
    obj.cost_simulation = {
      supply_cost_rate: 0.35,
      labor_and_rent: 8000000,
      delivery_commission_rate: 0.12,
      royalty_and_others: 2000000,
      monthly_operating_profit: { conservative: 3000000, standard: 8000000, optimistic: 15000000 },
    };
  } else {
    const cs = { ...(obj.cost_simulation as Record<string, unknown>) };
    cs.supply_cost_rate = toNum(cs.supply_cost_rate, 0.35);
    cs.labor_and_rent = toNum(cs.labor_and_rent, 8000000);
    cs.delivery_commission_rate = toNum(cs.delivery_commission_rate, 0.12);
    cs.royalty_and_others = toNum(cs.royalty_and_others, 2000000);
    if (!cs.monthly_operating_profit || typeof cs.monthly_operating_profit !== "object") {
      cs.monthly_operating_profit = { conservative: 3000000, standard: 8000000, optimistic: 15000000 };
    } else {
      const mop = { ...(cs.monthly_operating_profit as Record<string, unknown>) };
      mop.conservative = toNum(mop.conservative, 3000000);
      mop.standard     = toNum(mop.standard, 8000000);
      mop.optimistic   = toNum(mop.optimistic, 15000000);
      cs.monthly_operating_profit = mop;
    }
    obj.cost_simulation = cs;
  }

  // ---- investment 정규화 ----
  if (!obj.investment || typeof obj.investment !== "object") {
    obj.investment = { items: [], total: 0, monthly_profit: 0, annual_profit: 0, payback_months: 12, annual_roi_percent: 0 };
  } else {
    const inv = { ...(obj.investment as Record<string, unknown>) };
    if (!Array.isArray(inv.items)) inv.items = [];
    inv.total            = toNum(inv.total, 0);
    inv.monthly_profit   = toNum(inv.monthly_profit, 0);
    inv.annual_profit    = toNum(inv.annual_profit, 0);
    inv.payback_months   = toNum(inv.payback_months, 12);
    inv.annual_roi_percent = toNum(inv.annual_roi_percent, 0);
    obj.investment = inv;
  }

  // ---- swot 정규화 ----
  if (!obj.swot || typeof obj.swot !== "object") {
    obj.swot = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  } else {
    const swot = { ...(obj.swot as Record<string, unknown>) };
    for (const key of ["strengths", "weaknesses", "opportunities", "threats"]) {
      if (!Array.isArray(swot[key])) swot[key] = [];
    }
    obj.swot = swot;
  }

  // ---- evaluation 정규화 ----
  // 모델이 {location: 숫자, ...} 형태로 내보내는 경우를 {score, max} 구조로 변환
  if (!obj.evaluation || typeof obj.evaluation !== "object") {
    obj.evaluation = {};
  }
  {
    const ev = { ...(obj.evaluation as Record<string, unknown>) };
    for (const field of ["location", "demand", "competition", "profitability", "growth", "brand_fit"]) {
      if (typeof ev[field] === "number") {
        // 평탈 숫자 → {score, max} 객체 변환
        ev[field] = { score: Math.round(ev[field] as number), max: 100 };
      } else if (!ev[field] || typeof ev[field] !== "object") {
        ev[field] = { score: 60, max: 100 };
      } else {
        const f = { ...(ev[field] as Record<string, unknown>) };
        f.score = toNum(f.score, 60);
        f.max   = toNum(f.max, 100);
        ev[field] = f;
      }
    }
    // total은 run/route.ts에서 서버 측에서 재계산되므로 여기선 그냥 채워만 둠
    ev.total = toNum(ev.total, 60);
    obj.evaluation = ev;
  }

  // ---- alert 객체 정규화 ----
  if (!obj.alert || typeof obj.alert !== "object") {
    obj.alert = { alert_type: "none", competitor_name: "", detail: "" };
  } else {
    const alert = { ...(obj.alert as Record<string, unknown>) };
    const validAlertTypes = ["none", "same_building_competitor", "nearby_competitor"];
    if (!validAlertTypes.includes(alert.alert_type as string)) {
      alert.alert_type = "none";
      alert.competitor_name = "";
      alert.detail = "";
    }
    alert.competitor_name = alert.competitor_name ?? "";
    alert.detail = alert.detail ?? "";
    obj.alert = alert;
  }

  // ---- recommendation enum 정규화 ----
  const validRecs = ["적극추천", "조건부추천", "재검토필요", "반려"];
  if (!validRecs.includes(obj.recommendation as string)) {
    const recMap: Record<string, string> = {
      강력추천: "적극추천", 적극: "적극추천",
      추천: "조건부추천", 조건부: "조건부추천",
      보류: "재검토필요", 재검토: "재검토필요",
      불가: "반려", 거절: "반려", reject: "반려",
    };
    obj.recommendation = recMap[obj.recommendation as string] ?? "재검토필요";
  }

  // ---- recommendation_reason 정규화 ----
  if (!obj.recommendation_reason || typeof obj.recommendation_reason !== "string") {
    obj.recommendation_reason = "분석 결과를 바탕으로 종합 평가가 완료되었습니다.";
  }

  return obj;
}

// ============================================
// 보고서 생성 메인 함수
// 1차: generateObject (strict)
// 2차 fallback: generateText + repair + parse
// ============================================

export async function generateReport(input: GenerateReportInput): Promise<ReportAnalysis> {
  const providerName = (process.env.LLM_PROVIDER?.trim() ?? "anthropic") as LLMProvider;
  const llmModel = getProvider(providerName);

  const userPrompt = buildUserPrompt(
    input.brand,
    input.address,
    input.lat,
    input.lng,
    input.collectedData
  );

  // ---- 1차 시도: generateObject (Vercel AI SDK strict 검증) ----
  try {
    const { object } = await generateObject({
      model: llmModel,
      schema: ReportAnalysisSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxRetries: 2,
    });
    // Groq/Llama 등 일부 모델이 enum 오타(프렌차이즈 등)를 통과시키는 경우 방어
    const result = ReportAnalysisSchema.parse(repairAnalysis(object));
    // LLM이 경쟁점을 채우지 않은 경우 서버에서 기본값으로 보완
    result.competitors = fillMissingCompetitors(
      result.competitors,
      input.brand.sub_industry,
      input.brand.industry,
    );
    return result;
  } catch (primaryError) {
    console.warn(
      "[generate] generateObject 실패, text fallback 시도:",
      String(primaryError).slice(0, 300)
    );
  }

  // ---- 2차 시도: generateText + 수동 repair + Zod parse ----
  const fallbackSystemPrompt =
    SYSTEM_PROMPT +
    "\n\n[필수 출력 규칙]\n" +
    "- 응답은 반드시 순수 JSON 객체만 출력하세요. 마크다운 코드블록(```) 사용 절대 금지.\n" +
    "- rating 필드: 평점이 없으면 반드시 JSON null (문자열 '없음' 금지)\n" +
    "- risk_level: '치명적', '높음', '보통', '낮음' 중 정확히 하나\n" +
    '- type: "프랜차이즈" 또는 "개인점" 중 정확히 하나\n' +
    '- alert.alert_type: "none", "same_building_competitor", "nearby_competitor" 중 정확히 하나\n' +
    '- recommendation: "적극추천", "조건부추천", "재검토필요", "반려" 중 정확히 하나\n' +
    "- 모든 숫자 필드는 문자열이 아닌 JSON number 타입으로 출력";

  const fallbackUserPrompt =
    userPrompt +
    "\n\n[반드시 준수] 위 규칙에 따라 순수 JSON만 출력하세요. { 로 시작하고 } 로 끝내세요.";

  const { text } = await generateText({
    model: llmModel,
    system: fallbackSystemPrompt,
    prompt: fallbackUserPrompt,
    maxRetries: 1,
  });

  const cleaned = extractJSON(text);
  const parsed: unknown = JSON.parse(cleaned);
  const repaired = repairAnalysis(parsed);

  // Zod parse — 여기서 실패하면 최종 에러로 전파
  const fallbackResult = ReportAnalysisSchema.parse(repaired);
  // LLM이 경쟁점을 채우지 않은 경우 서버에서 기본값으로 보완
  fallbackResult.competitors = fillMissingCompetitors(
    fallbackResult.competitors,
    input.brand.sub_industry,
    input.brand.industry,
  );
  return fallbackResult;
}

export { ReportAnalysisSchema };
export type { ReportAnalysis };
