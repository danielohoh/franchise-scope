const EARTH_RADIUS_METERS = 6_371_000;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// 두 지점 간 거리를 미터(m)로 반환
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);

  const radLat1 = degreesToRadians(lat1);
  const radLat2 = degreesToRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
