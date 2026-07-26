import type { RawAircraft } from '../types';

export function determineTrajectory(
  ac: RawAircraft
): 'landing' | 'departing' | 'transit' | 'unknown' {
  if (ac.lat === undefined || ac.lon === undefined) return 'unknown';

  const alt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;
  const rate = ac.baro_rate || 0;

  // If it's climbing steeply at low alt, it is likely departing
  if (rate > 200 && alt < 8000) {
    return 'departing';
  }
  // If it is descending, it is likely landing
  if (rate < -200 && alt < 8000) {
    return 'landing';
  }

  return 'transit';
}

export function classifyNoise(ac: RawAircraft): { level: 'high' | 'medium' | 'low'; description: string } {
  const typeCode = (ac.t || '').toUpperCase();
  const desc = (ac.desc || '').toUpperCase();
  const alt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 10000;

  // Very quiet above 6,000 ft regardless of type
  if (alt > 6000) {
    return { level: 'low', description: 'Quiet / High Altitude' };
  }

  // Jets and large passenger aircraft (e.g. A320, B738, CRJ9, E190, heavy A330/B777)
  const isJet = /^(A3\d\d|B7\d\d|CRJ|E1\d\d|E2\d\d|MD\d\d|F100|RJ\d\d)/.test(typeCode) || 
                desc.includes('JET') || desc.includes('BOEING') || desc.includes('AIRBUS');

  // Turboprops / regional commuters (e.g., DH8D/Q400, AT76, SF34)
  const isTurboprop = /^(DH8|AT7|SF3|ATR|JS)/.test(typeCode) || desc.includes('TURBOPROP');

  // Helicopters
  const isHelicopter = /^(B06|H125|H135|H145|AW139|R44|R66|EC30|EC20|AS50)/.test(typeCode) || desc.includes('HELICOPTER');

  let level: 'high' | 'medium' | 'low' = 'low';

  if (isJet) {
    level = alt < 3000 ? 'high' : 'medium';
  } else if (isHelicopter) {
    level = alt < 2000 ? 'high' : 'medium';
  } else if (isTurboprop) {
    level = alt < 2000 ? 'medium' : 'low';
  } else {
    // Light general aviation (Cessna, Piper, etc.)
    level = alt < 1000 ? 'medium' : 'low';
  }

  const typeDesc = isJet ? 'Jet' : isHelicopter ? 'Helicopter' : isTurboprop ? 'Turboprop' : 'Light Aircraft';
  return { level, description: `${typeDesc} (${typeCode || 'Unknown'})` };
}
