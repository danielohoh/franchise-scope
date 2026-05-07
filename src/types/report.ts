// ============================================================================
// Report domain types — v2.0
// ============================================================================

import type { DbAnalysisReport } from './database';
import type { ReportSections } from './analysis';

export type { ReportSections };
export type AnalysisReport = DbAnalysisReport;

/** 보고서 생성 요청 */
export type ReportGenerateRequest = {
  analysis_id: string;
};

/** 보고서 스트리밍 이벤트 (SSE) */
export type ReportStreamEvent =
  | { type: 'section_start';    section: keyof ReportSections }
  | { type: 'section_delta';    section: keyof ReportSections; delta: string }
  | { type: 'section_complete'; section: keyof ReportSections; html: string }
  | { type: 'score_update';     scores: { [k: string]: number }; total: number }
  | { type: 'complete';         report_id: string }
  | { type: 'error';            message: string };

/** 매출 시뮬레이션 */
export type SalesScenario = {
  label: '보수적' | '기본' | '낙관적';
  monthly_revenue: number;      // 원
  raw_material_cost: number;    // 원재료비
  labor_cost: number;           // 인건비
  rent: number;                 // 임대료
  royalty: number;              // 로열티
  delivery_fee: number;         // 배달수수료
  other_cost: number;           // 기타
  operating_income: number;     // 영업이익
  bep: number;                  // 손익분기점 매출
};

/** BEP 분석 */
export type BepAnalysis = {
  bep_monthly_revenue: number;
  fixed_costs: number;
  variable_cost_ratio: number;
  scenarios: SalesScenario[];
};

/** DOCX 다운로드 상태 */
export type DocxStatus = 'idle' | 'generating' | 'ready' | 'error';
