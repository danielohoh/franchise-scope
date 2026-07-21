// ============================================
// 투자 수익성 계산 — 순수 함수 (외부 의존 없음)
// ============================================

import type { DbNaverListing } from "@/types/recommend";
import type { InvestmentScenario, InvestmentSection } from "@/types/analysis";

// 초기 시설 투자비 가정 (만원) — 평당 100만원 × 최대 30평 캡
const SETUP_COST_PER_PYEONG_WAN = 100;
const SETUP_COST_MAX_WAN = 3_000;

// 월 마진 시나리오 (만원/월): 보수적 / 표준 / 낙관적
const MARGIN_SCENARIOS: Array<{
  label: "보수적" | "표준" | "낙관적";
  monthlyMargin: number;
}> = [
  { label: "보수적", monthlyMargin: 400 },
  { label: "표준", monthlyMargin: 800 },
  { label: "낙관적", monthlyMargin: 1_400 },
];

function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function round1(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

function roundInt(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value);
}

/**
 * 매물 정보로부터 투자 수익성 섹션 데이터를 계산합니다.
 * 순수 함수 — 외부 API 호출 없음.
 */
export function calcInvestment(listing: DbNaverListing): InvestmentSection {
  const area = listing.area_pyeong;
  const tradeType = (listing.trade_type ?? "").trim();

  // ---- 평당 가격 ----
  const depositPerPyeong = roundInt(safeDiv(listing.deposit, area));
  const monthlyRentPerPyeong = round1(safeDiv(listing.monthly_rent, area));
  const salePerPyeong = roundInt(safeDiv(listing.sale_price, area));

  // ---- 연간 비용 ----
  const annualRent = listing.monthly_rent != null ? listing.monthly_rent * 12 : null;
  const annualMaintenance = listing.maintenance_cost != null ? listing.maintenance_cost * 12 : null;
  const annualTotal =
    annualRent != null || annualMaintenance != null
      ? (annualRent ?? 0) + (annualMaintenance ?? 0)
      : null;

  // ---- 표면 임대수익률 (매매 매물에 한정) ----
  let surfaceYieldPercent: number | null = null;
  if (
    tradeType.includes("매매") &&
    listing.sale_price != null &&
    listing.sale_price > 0 &&
    listing.monthly_rent != null
  ) {
    const annualIncome = (listing.monthly_rent + (listing.maintenance_cost ?? 0)) * 12;
    surfaceYieldPercent = round1((annualIncome / listing.sale_price) * 100);
  }

  // ---- 보증금/매매가 비율 ----
  let depositToSaleRatio: number | null = null;
  if (listing.sale_price != null && listing.sale_price > 0 && listing.deposit != null) {
    depositToSaleRatio = round1((listing.deposit / listing.sale_price) * 100);
  }

  // ---- BEP 시나리오 (보증금이 있을 때만) ----
  let breakEvenScenarios: InvestmentScenario[] | null = null;
  if (listing.deposit != null) {
    const estimatedSetup =
      area != null
        ? Math.min(Math.round(area * SETUP_COST_PER_PYEONG_WAN), SETUP_COST_MAX_WAN)
        : SETUP_COST_MAX_WAN;
    const initialCost = listing.deposit + estimatedSetup;

    breakEvenScenarios = MARGIN_SCENARIOS.map((s) => ({
      label: s.label,
      monthlyMargin: s.monthlyMargin,
      breakEvenMonths: Math.ceil(initialCost / s.monthlyMargin),
    }));
  }

  return {
    tradeType,
    pricePerPyeong: {
      deposit: depositPerPyeong,
      monthlyRent: monthlyRentPerPyeong,
      sale: salePerPyeong,
    },
    annualCost: {
      rent: annualRent,
      maintenance: annualMaintenance,
      total: annualTotal,
    },
    surfaceYieldPercent,
    depositToSaleRatio,
    breakEvenScenarios,
  };
}
