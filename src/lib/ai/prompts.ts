import type { CollectedData, DbBrand } from "@/types/database";

// ============================================
// LLM 프롬프트 템플릿 (기획서 7-1 기반)
// ============================================

export const SYSTEM_PROMPT = `당신은 프랜차이즈 본사의 상권개발팀 전문 분석가입니다.
주어진 상권 데이터와 브랜드 정보를 기반으로 신규 가맹점 입지 분석 보고서를 JSON 형식으로 작성합니다.

분석 원칙:
1. 실제 수집된 데이터에 근거한 객관적 분석을 제공합니다.
2. 매출 추정은 브랜드의 평균 데이터와 상권 특성을 결합하여 보수적·기본·낙관적 3가지 시나리오로 제시합니다.
3. 동일 건물 또는 50m 이내에 동종업 경쟁점이 있으면 recommendation을 반드시 "반려"로 설정합니다.
4. 반려 시 매출 추정치를 정상 대비 40~60% 감산 적용합니다.
5. 한국어로 작성하며, 수치는 정확하고 구체적이어야 합니다.

업종별 분석 기준:
- 치킨: 배달 비중 강조, 야간(17~02시) 시간대 분석, 배달권역 2km 기준
- 카페: 객단가·회전율 강조, 오전/점심 피크, 도보 500m 상권 기준
- 한식/일반 외식: 점심·저녁 2피크, 홀 중심, 주차 여부 강조
- 편의점: 24시간 시간대별 매출, 유동인구 중심, 반경 300m 밀집도
- 서비스업: 타깃 인구 연령대 매칭, 수요 밀도 중심`;

export function buildUserPrompt(
  brand: DbBrand,
  address: string,
  lat: number,
  lng: number,
  collectedData: CollectedData
): string {
  const competitorSummary = collectedData.competitors
    .slice(0, 10)
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} | 유형: ${c.type} | 거리: ${c.distance_m}m | 평점: ${c.rating ?? "없음"} | 리뷰: ${c.review_count}건`
    )
    .join("\n");

  // 동일건물/50m 이내 경쟁점 감지
  const nearbyCompetitor = collectedData.competitors.find((c) => c.distance_m <= 50);
  const nearbyAlert = nearbyCompetitor
    ? `⚠️ 경고: "${nearbyCompetitor.name}"이(가) ${nearbyCompetitor.distance_m}m 이내에 있습니다. recommendation을 반드시 "반려"로 설정하세요.`
    : "";

  const brandInfo = `
브랜드명: ${brand.brand_name}
업종: ${brand.industry}${brand.sub_industry ? ` / ${brand.sub_industry}` : ""}
평균 점포 면적: ${brand.avg_store_size_pyeong ?? "미입력"}평
가맹비: ${brand.franchise_fee ? formatKRW(brand.franchise_fee) : "미입력"}
교육비: ${brand.education_fee ? formatKRW(brand.education_fee) : "미입력"}
보증금: ${brand.deposit ? formatKRW(brand.deposit) : "미입력"}
${brand.avg_ticket_price ? `평균 객단가: ${formatKRW(brand.avg_ticket_price)}` : ""}
${brand.avg_monthly_revenue ? `자사 가맹점 평균 월매출: ${formatKRW(brand.avg_monthly_revenue)}` : ""}
${brand.royalty_rate != null ? `로열티율: ${brand.royalty_rate}%` : ""}
${brand.supply_cost_rate != null ? `본사 공급원가율: ${brand.supply_cost_rate}%` : ""}
${brand.delivery_ratio != null ? `배달 비중: ${brand.delivery_ratio}%` : ""}
${brand.peak_hours ? `피크 시간대: ${brand.peak_hours}` : ""}
${brand.target_customer ? `핵심 타깃: ${brand.target_customer}` : ""}
${brand.total_stores != null ? `전체 가맹점 수: ${brand.total_stores}개` : ""}
${brand.min_store_requirement ? `개설 기준: ${brand.min_store_requirement}` : ""}`;

  const populationInfo = `
반경 500m: 주거인구 ${collectedData.population.radius_500m.residential.toLocaleString()}명, 세대 ${collectedData.population.radius_500m.households.toLocaleString()}세대, 직장인구 ${collectedData.population.radius_500m.workers.toLocaleString()}명
반경 1km: 주거인구 ${collectedData.population.radius_1km.residential.toLocaleString()}명, 세대 ${collectedData.population.radius_1km.households.toLocaleString()}세대, 직장인구 ${collectedData.population.radius_1km.workers.toLocaleString()}명
반경 2km: 주거인구 ${collectedData.population.radius_2km.residential.toLocaleString()}명, 세대 ${collectedData.population.radius_2km.households.toLocaleString()}세대, 직장인구 ${collectedData.population.radius_2km.workers.toLocaleString()}명
핵심 연령대: ${collectedData.population.core_age_group}
성별 비율: ${collectedData.population.gender_ratio}
상권 유형: ${collectedData.population.commercial_area_type}
${collectedData.population.is_mock ? "(⚠️ 공공데이터 API 미연동 — 추정값 사용)" : ""}`;

  // 임대 조건 지시문 분기
  const property = collectedData.property;
  const hasDeposit = property?.deposit != null;
  const hasRent = property?.monthly_rent != null;
  const hasMaintenance = property?.maintenance_fee != null;
  const hasAnyProperty = hasDeposit || hasRent || hasMaintenance;

  const propertyInstruction = hasAnyProperty
    ? `- 아래는 사용자가 직접 입력한 실제 임대 조건입니다. location_info와 cost_simulation 계산에 반드시 정확히 사용하세요:
${hasDeposit ? `  · 보증금: ${formatKRW(property!.deposit!)}` : ""}
${hasRent ? `  · 월 임대료: ${formatKRW(property!.monthly_rent!)}` : ""}
${hasMaintenance ? `  · 관리비: ${formatKRW(property!.maintenance_fee!)}` : ""}
- 위에서 입력되지 않은 항목(key_money 등)은 상권 평균 시세로 추정합니다.
- cost_simulation.labor_and_rent 계산 시 위 임대료+관리비를 인건비에 합산하여 반드시 반영하세요.`
    : `- location_info의 deposit, monthly_rent, key_money, maintenance_fee는 분석 대상 상권의 평균 시세 기준으로 추정합니다.`;

  return `다음 데이터를 기반으로 상권분석 보고서를 작성해주세요.

${nearbyAlert}

[브랜드 정보]
${brandInfo}

[분석 대상 주소]
주소: ${address}
위도: ${lat}, 경도: ${lng}

[배후 인구 데이터]
${populationInfo}

[주변 경쟁점 현황] (총 ${collectedData.competitors.length}개 발견)
${competitorSummary || "경쟁점 없음"}

[분석 요청]
위 정보를 종합하여 입지 분석 보고서를 작성하세요.
${propertyInstruction}
- revenue_simulation은 브랜드 데이터와 배후인구를 결합하여 현실적으로 추정합니다.
- evaluation 각 항목의 score는 max를 초과할 수 없습니다.
- total은 모든 항목 score의 합계여야 합니다.

[경쟁점 분석 필수 지침]
- 브랜드 업종(${brand.industry}${brand.sub_industry ? ` / ${brand.sub_industry}` : ""})과 직접 경쟁하는 업소만 선정합니다.
- 각 경쟁점이 프랜차이즈(본사가 있는 체인 브랜드)인지 개인점인지는 **입력 데이터의 "유형" 값을 무시하고 당신의 지식으로 직접 판단**하세요. 입력 유형은 단순 키워드 매칭 결과로 부정확합니다.
- 프랜차이즈 판단 기준: 전국 체인망을 가진 브랜드(푸라닭·굽네치킨·BBQ·교촌치킨·bhc·처갓집·네네치킨·60계치킨·노랑통닭·스타벅스·이디야 등). 이름 자체가 고유 로컬 상호이면 개인점.
- 프랜차이즈 경쟁점 최대 5개, 개인점 최대 5개를 각각 위험도 높은 순(치명적→높음→보통→낮음)으로 정렬하여 총 최대 10개를 competitors 배열에 담습니다. 각 항목의 type 필드를 판단 결과("프랜차이즈" 또는 "개인점")로 반드시 올바르게 설정하세요.
- 업종과 무관한 업소(예: 부동산, 편의점 등)는 제외합니다.
- alert 필드: 동일 건물 또는 50m 이내 동종 경쟁점이 있으면 해당 type/competitor_name/detail을 채우고, 없으면 반드시 type:"none", competitor_name:"", detail:""로 설정하세요. 절대 생략 금지.

[경쟁점 추정 월매출 기준 — 반드시 아래 범위에서 현실적으로 산출]
한국 외식업 프랜차이즈 실제 월매출 기준 (소규모 단독 매장 기준, 단위: 원):
- 치킨 프랜차이즈 (교촌·BBQ·BHC·굽네·네네·처갓집·60계 등): 25,000,000~70,000,000 (평균 35,000,000~50,000,000)
- 카페 프랜차이즈 (스타벅스·메가커피·이디야·컴포즈): 30,000,000~80,000,000 (평균 40,000,000~55,000,000)
- 한식·분식 프랜차이즈 (본죽·한솥도시락 등): 15,000,000~40,000,000 (평균 20,000,000~30,000,000)
- 피자·햄버거 프랜차이즈 (맥도날드·버거킹·도미노피자 등): 30,000,000~100,000,000 (평균 45,000,000~60,000,000)
- 개인 치킨집·포장마차·소규모 음식점: 8,000,000~25,000,000
- 보정 기준: 평점 4.3 이상이면 +20%, 리뷰 500건 이상이면 +10%, 거리 100m 이내이면 +10% 추가 적용
- 주의: 단위는 반드시 "원(KRW)"이며 "만원" 단위가 아닙니다. 3,000만원 = 30,000,000 으로 입력.`;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}
