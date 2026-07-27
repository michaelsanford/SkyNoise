import { describe, it, expect } from 'vitest';
import { angularDeltaDeg } from './geo';

describe('angularDeltaDeg', () => {
  it('returns the direct difference when it does not wrap', () => {
    expect(angularDeltaDeg(10, 15)).toBe(5);
    expect(angularDeltaDeg(15, 10)).toBe(5);
    expect(angularDeltaDeg(90, 180)).toBe(90);
  });

  it('takes the short way around the compass', () => {
    // The whole reason this helper exists: naive subtraction gives 358.
    expect(angularDeltaDeg(359, 1)).toBe(2);
    expect(angularDeltaDeg(1, 359)).toBe(2);
    expect(angularDeltaDeg(350, 10)).toBe(20);
  });

  it('never exceeds 180', () => {
    expect(angularDeltaDeg(0, 180)).toBe(180);
    expect(angularDeltaDeg(0, 181)).toBe(179);
    for (let a = 0; a < 360; a += 7) {
      for (let b = 0; b < 360; b += 11) {
        expect(angularDeltaDeg(a, b)).toBeLessThanOrEqual(180);
      }
    }
  });

  it('is zero for identical bearings and handles out-of-range input', () => {
    expect(angularDeltaDeg(42, 42)).toBe(0);
    expect(angularDeltaDeg(0, 360)).toBe(0);
    expect(angularDeltaDeg(-10, 350)).toBe(0);
  });
});

import { getDistanceKm, getBearing, calculateCPA } from './geo';

describe('Geo Utilities', () => {
  // Coordinates for CYHU (Saint-Hubert) and CYUL (Montreal Trudeau)
  const cyhuLat = 45.5175;
  const cyhuLon = -73.4169;
  
  const cyulLat = 45.4706;
  const cyulLon = -73.7408;

  describe('getDistanceKm', () => {
    it('should calculate distance correctly between CYHU and CYUL', () => {
      const distance = getDistanceKm(cyhuLat, cyhuLon, cyulLat, cyulLon);
      // Distance is roughly 25-27 km
      expect(distance).toBeGreaterThan(24);
      expect(distance).toBeLessThan(28);
    });

    it('should return 0 for identical coordinates', () => {
      const distance = getDistanceKm(cyhuLat, cyhuLon, cyhuLat, cyhuLon);
      expect(distance).toBe(0);
    });
  });

  describe('getBearing', () => {
    it('should compute correct compass bearing direction', () => {
      // East-facing coordinates
      const startLat = 45.0000;
      const startLon = -73.0000;
      const endLat = 45.0000;
      const endLon = -72.0000;
      const bearing = getBearing(startLat, startLon, endLat, endLon);
      // Heading East is 90 degrees (with small spherical curvature drift)
      expect(bearing).toBeGreaterThan(88);
      expect(bearing).toBeLessThan(92);
    });
  });

  describe('calculateCPA', () => {
    it('should detect when an aircraft is heading towards a target', () => {
      // Plane is West of target, flying East (090 heading) -> moving towards target
      const result = calculateCPA(
        45.0000, -73.5000, // Plane
        90, 150,            // Track, Speed (knots)
        45.0000, -73.0000  // Target
      );
      expect(result.isHeadingTowards).toBe(true);
      expect(result.cpaTimeSeconds).not.toBeNull();
      expect(result.cpaTimeSeconds).toBeGreaterThan(0);
    });

    it('should detect when an aircraft is heading away from a target', () => {
      // Plane is West of target, flying West (270 heading) -> moving away from target
      const result = calculateCPA(
        45.0000, -73.5000, // Plane
        270, 150,           // Track, Speed
        45.0000, -73.0000  // Target
      );
      expect(result.isHeadingTowards).toBe(false);
      expect(result.cpaTimeSeconds).toBeNull();
    });
  });
});
