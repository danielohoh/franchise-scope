export type GeocodeRequest = {
  address: string;
};

export type GeocodeResponse = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

export type CompetitorsRequest = {
  lat: number;
  lng: number;
  industry: string;
  radius?: number;
};

export type CompetitorType = "프랜차이즈" | "개인점";

export type CompetitorItem = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  rating: number | null;
  review_count: number;
  is_open: boolean | null;
  place_id: string;
  type: CompetitorType;
};

export type CompetitorsResponse = {
  competitors: CompetitorItem[];
  total: number;
};

export type PopulationRequest = {
  lat: number;
  lng: number;
};

export type PopulationRadius = {
  residential: number;
  households: number;
  workers: number;
};

export type PopulationTrafficByDay = {
  weekday: number;
  weekend: number;
};

export type PopulationResponse = {
  radius_500m: PopulationRadius;
  radius_1km: PopulationRadius;
  radius_2km: PopulationRadius;
  core_age_group: string;
  gender_ratio: string;
  commercial_area_type: string;
  hourly_traffic: {
    morning: PopulationTrafficByDay;
    lunch: PopulationTrafficByDay;
    afternoon: PopulationTrafficByDay;
    evening: PopulationTrafficByDay;
    night: PopulationTrafficByDay;
  };
  is_mock?: boolean;
};

// ───────────────────────────────────────────────
// 상권정보 (소상공인시장진흥공단 CSV 기반)
// ───────────────────────────────────────────────

export type CommercialAreaRequest = {
  lat: number;
  lng: number;
  industry: string;
  radius_m?: number;
};

export type CommercialAreaIndustryDistribution = {
  category: string;
  count: number;
  ratio: number;
};

export type CommercialAreaCompetitionDensity = {
  score: number;
  level: "낮음" | "보통" | "높음" | "매우높음";
  sameIndustryCount: number;
  totalShopCount: number;
};

export type CommercialAreaShop = {
  shopId: string;
  name: string;
  branchName: string;
  industryMajor: string;
  industryMid: string;
  industrySub: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
};

export type CommercialAreaResponse = {
  shops: CommercialAreaShop[];
  total: number;
  industryDistribution: CommercialAreaIndustryDistribution[];
  commercialAreaType: string;
  competitionDensity: CommercialAreaCompetitionDensity;
  searchRadiusM: number;
};
