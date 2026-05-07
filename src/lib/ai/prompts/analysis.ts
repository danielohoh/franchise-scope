import type { CollectedData } from '@/types/analysis';
import type { ReportSections } from '@/types/report';

import { SECTION_LABELS, SECTION_PROMPTS } from './report-sections';

export type BrandData = {
  brand_name: string;
  company_name: string | null;
  category: string | null;
  industry: string;
  franchise_fee: number | null;
  education_fee: number | null;
  royalty_type: string | null;
  royalty_amount: number | null;
  interior_cost_per_pyeong: number | null;
  avg_monthly_revenue: number | null;
  total_stores: number | null;
  avg_sales?: {
    total?: { avg_annual: number; per_3_3sqm: number };
    by_region?: Array<{ region: string; avg_annual: number }>;
  } | null;
  fees?: {
    opening_costs?: {
      total_min: number | null;
      total_max: number | null;
      base_size_sqm: number | null;
    } | null;
  } | null;
};

const toJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const formatCurrency = (amount: number): string => {
  if (!Number.isFinite(amount)) return '0만원';
  return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만원`;
};

export const formatNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ko-KR');
};

export const buildCollectionPrompt = (brand: BrandData, collected: CollectedData): string => {
  return [
    '아래는 보고서 작성에 사용할 수집 데이터입니다. 반드시 JSON에 있는 사실만 사용하십시오.',
    '',
    '=== 브랜드 데이터 (정보공개서 기준) ===',
    toJson(brand),
    '',
    '=== 상권 데이터 (공공API) ===',
    toJson(collected.commercial),
    '',
    '=== 인구/유동 데이터 (공공API) ===',
    toJson(collected.population),
    '',
    '=== 경쟁점 데이터 (Google Places) ===',
    toJson(collected.competitors),
    '',
    '=== 임대 시세 데이터 ===',
    toJson(collected.rent),
    '',
    '=== 위치/교통 데이터 ===',
    toJson(collected.location),
    '',
    '=== 수집 출처 메타 ===',
    toJson(collected.data_sources),
  ].join('\n');
};

export const buildSectionPrompt = (
  section: keyof ReportSections,
  brand: BrandData,
  collected: CollectedData,
): string => {
  const label = SECTION_LABELS[section];
  const sectionInstruction = SECTION_PROMPTS[section];
  const collectionPrompt = buildCollectionPrompt(brand, collected);

  return [
    `현재 작성 섹션: ${label} (${section})`,
    sectionInstruction,
    '',
    '작성 규칙:',
    '- JSON에 없는 수치를 만들지 마십시오.',
    '- 모든 수치/사실 문장 끝에 출처를 괄호로 표기하십시오.',
    '- 데이터가 없으면 "해당 데이터 미수집"으로 작성하십시오.',
    '',
    collectionPrompt,
  ].join('\n');
};
