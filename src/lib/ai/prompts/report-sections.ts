import type { ReportSections } from '@/types/report';

export const SECTION_PROMPTS: Record<keyof ReportSections, string> = {
  executive_summary:
    '핵심 결론을 5문장 이내로 요약하고, 입지/수요/경쟁/수익성의 장단점을 데이터 근거와 함께 제시하십시오.',
  brand_overview:
    '브랜드 기본 정보, 가맹 조건, 공개된 평균 매출/비용 구조를 정리하고 누락 데이터는 명확히 표시하십시오.',
  location_analysis:
    '대상 주소의 접근성, 행정동/상권 유형, 교통 및 주변 인프라를 분석하고 수집 데이터 기준으로 입지 강약점을 제시하십시오.',
  population_analysis:
    '반경별 인구·세대·직장인구와 시간대 유동 특성을 분석하여 주요 고객층과 방문 패턴을 도출하십시오.',
  competition_analysis:
    '경쟁점 수, 거리, 평점/리뷰 및 업종 밀도를 바탕으로 경쟁 강도를 평가하고 차별화 포인트를 제안하십시오.',
  investment_estimate:
    '가맹비/교육비/인테리어/보증금/임대료 등 초기 투자 항목을 표로 정리하고 데이터 범위 내 최소-최대 시나리오를 제시하십시오.',
  sales_simulation:
    '제공된 평균 매출과 비용 데이터만 사용해 보수적/기준/낙관 시나리오를 구성하고 가정값은 반드시 추정으로 표시하십시오.',
  swot: '수집 데이터 기반으로 Strength, Weakness, Opportunity, Threat를 2×2 표로 정리하십시오.',
  evaluation:
    '입지·수요·경쟁·수익성·성장성·브랜드적합성 6개 항목을 각각 100점 만점으로 평가하고, "항목명: XX점" 형식으로 명시하십시오. 마지막 줄에 반드시 "종합점수: XX점" 형식으로 평균 점수를 기재하십시오.',
  recommendation:
    '최종 출점 권고를 다음 네 가지 중 하나로 명확히 제시하십시오: 적극추천 / 조건부추천 / 재검토필요 / 반려. 권고 단어를 첫 문장에 반드시 포함하고, 실행 전 확인할 리스크와 추가 수집 필요 데이터를 체크리스트로 제시하십시오.',
};

export const SECTION_ORDER: Array<keyof ReportSections> = [
  'executive_summary',
  'brand_overview',
  'location_analysis',
  'population_analysis',
  'competition_analysis',
  'investment_estimate',
  'sales_simulation',
  'swot',
  'evaluation',
  'recommendation',
];

export const SECTION_LABELS: Record<keyof ReportSections, string> = {
  executive_summary: '요약',
  brand_overview: '브랜드 개요',
  location_analysis: '입지 분석',
  population_analysis: '인구/유동 분석',
  competition_analysis: '경쟁 분석',
  investment_estimate: '투자비 추정',
  sales_simulation: '매출 시뮬레이션',
  swot: 'SWOT 분석',
  evaluation: '종합 평가',
  recommendation: '최종 권고',
};
