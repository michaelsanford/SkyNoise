/**
 * Calculates distance between two coordinates in kilometers.
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates bearing from start to end coordinate in degrees (0-360).
 */
export function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Computes whether an aircraft is heading towards a specific target location,
 * its Cross-Track Distance (distance of closest approach), and CPA Time (seconds to arrival).
 */
export function calculateCPA(
  acLat: number,
  acLon: number,
  track: number,
  speedKnots: number,
  targetLat: number,
  targetLon: number
): { isHeadingTowards: boolean; crossTrackDistanceKm: number; cpaTimeSeconds: number | null } {
  const distKm = getDistanceKm(acLat, acLon, targetLat, targetLon);
  const bearingToTarget = getBearing(acLat, acLon, targetLat, targetLon);

  // Angle difference between current track and bearing to home
  let angleDiff = Math.abs(track - bearingToTarget);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  // If angle difference is < 90, it is moving towards
  const isHeadingTowards = angleDiff < 90;

  // Cross-track distance (using planar math local approximation)
  const angleDiffRad = (angleDiff * Math.PI) / 180;
  const crossTrackDistanceKm = distKm * Math.sin(angleDiffRad);

  let cpaTimeSeconds: number | null = null;
  if (isHeadingTowards && speedKnots > 10) {
    const speedKmh = speedKnots * 1.852; // Convert knots to km/h
    const alongTrackDist = distKm * Math.cos(angleDiffRad);
    cpaTimeSeconds = (alongTrackDist / speedKmh) * 3600;
  }

  return {
    isHeadingTowards,
    crossTrackDistanceKm,
    cpaTimeSeconds
  };
}
