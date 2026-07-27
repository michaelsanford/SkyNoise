import { describe, it, expect } from 'vitest';
import { determineTrajectory, classifyNoise } from './noise';
import type { RawAircraft } from '../types';

describe('Noise & Trajectory Utilities', () => {
  describe('determineTrajectory', () => {
    it('should identify climbing low-altitude planes as departing', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        lat: 45.5,
        lon: -73.4,
        alt_baro: 3000,
        baro_rate: 1500 // climbing at 1500 ft/min
      };
      expect(determineTrajectory(plane)).toBe('departing');
    });

    it('should identify descending low-altitude planes as landing', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        lat: 45.5,
        lon: -73.4,
        alt_baro: 3500,
        baro_rate: -1200 // descending at 1200 ft/min
      };
      expect(determineTrajectory(plane)).toBe('landing');
    });

    it('should identify high-altitude or non-climbing planes as transit', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        lat: 45.5,
        lon: -73.4,
        alt_baro: 12000,
        baro_rate: 0
      };
      expect(determineTrajectory(plane)).toBe('transit');
    });
  });

  describe('classifyNoise', () => {
    it('should classify planes above 6000 feet as low noise', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        t: 'A320', // Jet
        alt_baro: 7000
      };
      const noise = classifyNoise(plane);
      expect(noise.level).toBe('low');
      expect(noise.description).toContain('Quiet');
    });

    it('should classify jets below 3000 feet as high noise', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        t: 'B738', // Boeing 737
        alt_baro: 2500
      };
      const noise = classifyNoise(plane);
      expect(noise.level).toBe('high');
      expect(noise.description).toContain('Jet');
    });

    it('should classify jets between 3000 and 6000 feet as medium noise', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        t: 'A321', // Airbus 321
        alt_baro: 4500
      };
      const noise = classifyNoise(plane);
      expect(noise.level).toBe('medium');
    });

    it('should classify light aircraft (like C172) below 1000 feet as medium noise', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        t: 'C172', // Cessna 172
        alt_baro: 800
      };
      const noise = classifyNoise(plane);
      expect(noise.level).toBe('medium');
    });

    it('should classify light aircraft (like C172) above 1000 feet as low noise', () => {
      const plane: RawAircraft = {
        hex: 'a123bc',
        t: 'C172',
        alt_baro: 1500
      };
      const noise = classifyNoise(plane);
      expect(noise.level).toBe('low');
    });
  });
});
