import { describe, it, expect } from 'vitest';
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
