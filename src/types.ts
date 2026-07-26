export interface RawAircraft {
  hex: string;
  flight?: string;
  r?: string; // registration
  t?: string; // type
  desc?: string; // description
  alt_baro?: number | string; // barometric altitude in feet (can be "ground")
  alt_geom?: number;
  gs?: number; // ground speed in knots
  track?: number; // track heading in degrees
  baro_rate?: number; // climb/descent rate in ft/min
  lat?: number;
  lon?: number;
  dst?: number; // distance in nautical miles from center
  dir?: number; // bearing in degrees from center
  category?: string;
  seen?: number;
}

export interface AircraftUpdate extends RawAircraft {
  id: string;
  cleanFlight: string;
  distanceKm: number;
  altitudeFt: number;
  bearingDeg: number;
  isHeadingTowards: boolean;
  crossTrackDistanceKm: number;
  cpaTimeSeconds: number | null;
  trajectory: 'landing' | 'departing' | 'transit' | 'unknown';
  noiseLevel: 'high' | 'medium' | 'low';
  lastSeenTime: number;
}

export interface UserSettings {
  homeLat: number | null;
  homeLon: number | null;
  airportLat: number | null;
  airportLon: number | null;
  airportCode: string; // IATA/ICAO
  maxAltitudeFt: number; // default 10,000
  detectionRadiusKm: number; // default 15 km
  overheadRadiusKm: number; // default 1.5 km
  useGPS: boolean;
  pollIntervalSeconds: number; // custom update frequency in seconds
  radarOrientation: 'north-up' | 'heading-up'; // radar alignment option
}

export interface OverheadEvent {
  hex: string;
  flight: string;
  type: string;
  desc: string;
  registration: string;
  timestamp: number;
  minDistanceKm: number;
  altitudeFt: number;
  trajectory: 'landing' | 'departing' | 'transit' | 'unknown';
  noiseLevel: 'high' | 'medium' | 'low';
}
