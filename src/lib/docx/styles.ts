import {
  BorderStyle,
  type IBorderOptions,
  type ITableBordersOptions,
} from "docx";

// ============================================
// FranchiseScope docx 디자인 시스템
// ============================================

// 컬러 (RGB hex without #)
export const COLORS = {
  primary: "1F4E79",       // 네이비 (섹션 헤더 배경)
  primaryLight: "D6E4F0",  // 연한 네이비
  labelBg: "E9EFF7",       // 라벨 셀 배경
  highlight: "FFF2CC",     // 강조 수치 (긍정)
  danger: "FCE4E4",        // 강조 수치 (부정)
  alertBg: "FF0000",       // 반려/경고 배너
  white: "FFFFFF",
  black: "000000",
  gray: "595959",
  lightGray: "F2F2F2",
  // SWOT 4색
  swotStrength: "E2EFDA",  // 강점 - 연녹색
  swotWeakness: "FCE4D6",  // 약점 - 연주황
  swotOpportunity: "DEEAF1", // 기회 - 연파랑
  swotThreat: "FFF2CC",    // 위협 - 연노랑
} as const;

// 폰트
export const FONTS = {
  ko: "맑은 고딕",
  fallback: "Arial",
} as const;

// 폰트 사이즈 (half-points)
export const FONT_SIZES = {
  sectionHeader: 22,  // 11pt
  body: 18,           // 9pt
  small: 16,          // 8pt
  title: 28,          // 14pt
} as const;

// 공통 테두리 (얇은 실선)
export const THIN_BORDER: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "AAAAAA",
};

export const ALL_BORDERS: ITableBordersOptions = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

// 숫자 포맷 헬퍼
export function formatKRW(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = (amount / 100_000_000).toFixed(1);
    return `${eok}억원`;
  }
  if (amount >= 10_000) {
    const man = Math.round(amount / 10_000);
    return `${man.toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
