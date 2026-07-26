import React, { useState, useEffect, useRef } from 'react';
import type { RawAircraft, AircraftUpdate, UserSettings, OverheadEvent } from './types';
import { getDistanceKm, getBearing, calculateCPA } from './utils/geo';
import { determineTrajectory, classifyNoise } from './utils/noise';
import { lookupAirport } from './utils/airports';

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// Inline SVGs for lightweight, zero-dependency rendering
const Icons = {
  Radar: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m19.07 4.93-1.41 1.41M12 12V2M12 12l5 5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  History: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  ),
  Settings: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Plane: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.8 20.19 19.8 22h1.5l-1.63-4.83 2.15-2.15a2 2 0 0 0-2.83-2.83l-2.15 2.15L12 12.72V5.5a3 3 0 0 0-6 0v1.27L1.8 11.6l-1.6 1.6h1.5l1.9-1.9 4.3 1.9L2 19.34c-.4.4-.3 1 .1 1.4s1 .5 1.4.1l4.14-5.9 4.3 1.9z" />
    </svg>
  ),
  GPS: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M12 9v3h3" />
    </svg>
  ),
  Volume2: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  VolumeX: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  ),
  Trash: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Shield: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Check: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#34d399' }} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  XCircle: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f43f5e' }} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
};

const DEFAULT_SETTINGS: UserSettings = {
  homeLat: null,
  homeLon: null,
  airportLat: null,
  airportLon: null,
  airportCode: '',
  maxAltitudeFt: 10000,
  detectionRadiusKm: 15,
  overheadRadiusKm: 1.5,
  useGPS: true
};

// Internal interface for tracking active passes over the house
interface ActivePass {
  hex: string;
  flight: string;
  type: string;
  desc: string;
  registration: string;
  minDistanceKm: number;
  minAltitudeFt: number;
  trajectory: 'landing' | 'departing' | 'transit' | 'unknown';
  noiseLevel: 'high' | 'medium' | 'low';
  lastSeen: number; // timestamp
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'settings'>('live');
  
  // Settings State
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('skynoise_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Force migration for newer properties
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Aircraft & History State
  const [aircraft, setAircraft] = useState<AircraftUpdate[]>([]);
  const [history, setHistory] = useState<OverheadEvent[]>(() => {
    const saved = localStorage.getItem('skynoise_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  // App system states
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<string>('unknown');
  
  // Local state for Settings form
  const [tempLat, setTempLat] = useState<string>('');
  const [tempLon, setTempLon] = useState<string>('');
  const [tempAirport, setTempAirport] = useState<string>('');
  const [airportResolutionMsg, setAirportResolutionMsg] = useState<string>('');

  // Ref to track passes to prevent multiple logs for a single flight overhead
  const activePassesRef = useRef<{ [hex: string]: ActivePass }>({});

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('skynoise_settings', JSON.stringify(settings));
    if (settings.homeLat !== null && settings.homeLon !== null) {
      setTempLat(settings.homeLat.toString());
      setTempLon(settings.homeLon.toString());
    }
    if (settings.airportCode) {
      setTempAirport(settings.airportCode);
    }
  }, [settings]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('skynoise_history', JSON.stringify(history));
  }, [history]);

  // Monitor Geolocation permissions if browser supports API query
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setGpsPermissionState(result.state);
        result.onchange = () => {
          setGpsPermissionState(result.state);
        };
      }).catch(() => {
        setGpsPermissionState('prompt');
      });
    } else {
      setGpsPermissionState('not-supported');
    }
  }, []);

  // Update Location using GPS if enabled
  useEffect(() => {
    if (!settings.useGPS) return;

    let watchId: number;

    const onSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setSettings(prev => ({
        ...prev,
        homeLat: parseFloat(latitude.toFixed(6)),
        homeLon: parseFloat(longitude.toFixed(6))
      }));
      setGpsPermissionState('granted');
      setFetchError(null);
    };

    const onError = (error: GeolocationPositionError) => {
      console.warn('GPS position error:', error.message);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsPermissionState('denied');
        setSettings(prev => ({ ...prev, useGPS: false }));
        setFetchError('GPS Permission Denied. Please input coordinates manually or use an Airport Code fallback.');
      } else {
        setFetchError(`GPS error: ${error.message}`);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(onSuccess, onError);
      // Continuous updates
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } else {
      setGpsPermissionState('not-supported');
      setSettings(prev => ({ ...prev, useGPS: false }));
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [settings.useGPS]);

  // Aircraft tracking loop
  useEffect(() => {
    if (settings.homeLat === null || settings.homeLon === null) {
      setAircraft([]);
      return;
    }

    let intervalId: number;
    let isFetching = false;

    const fetchAircraftData = async () => {
      if (isFetching) return;
      if (settings.homeLat === null || settings.homeLon === null) return;
      isFetching = true;
      setIsPolling(true);

      const lat = settings.homeLat;
      const lon = settings.homeLon;
      // Radius in Nautical Miles (API expects NM). 1 km = 0.539957 NM.
      const radiusNm = Math.max(1, Math.ceil(settings.detectionRadiusKm * 0.539957));

      try {
        const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${radiusNm}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawList: RawAircraft[] = data.ac || [];
        setLastFetchTime(new Date());
        setFetchError(null);

        // Process aircraft updates
        const updatedList: AircraftUpdate[] = rawList
          .map((ac) => {
            const acLat = ac.lat || 0;
            const acLon = ac.lon || 0;
            const distanceKm = getDistanceKm(acLat, acLon, lat, lon);
            const bearingDeg = getBearing(acLat, acLon, lat, lon);
            const altFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : 0;
            
            const cpa = calculateCPA(
              acLat,
              acLon,
              ac.track || 0,
              ac.gs || 0,
              lat,
              lon
            );

            const trajectory = determineTrajectory(ac);
            const noise = classifyNoise(ac);

            return {
              ...ac,
              id: ac.hex,
              cleanFlight: (ac.flight || '').trim(),
              distanceKm: parseFloat(distanceKm.toFixed(2)),
              altitudeFt: altFt,
              bearingDeg: Math.round(bearingDeg),
              isHeadingTowards: cpa.isHeadingTowards,
              crossTrackDistanceKm: parseFloat(cpa.crossTrackDistanceKm.toFixed(2)),
              cpaTimeSeconds: cpa.cpaTimeSeconds ? Math.round(cpa.cpaTimeSeconds) : null,
              trajectory,
              noiseLevel: noise.level,
            } as AircraftUpdate;
          })
          // Filter to only include flights below maxAltitudeFt
          .filter(ac => ac.altitudeFt <= settings.maxAltitudeFt && ac.lat !== undefined && ac.lon !== undefined);

        setAircraft(updatedList);
        processPasses(updatedList);

      } catch (err: any) {
        console.error('Fetch error:', err);
        setFetchError(`Network error fetching radar data: ${err.message}`);
      } finally {
        isFetching = false;
        setIsPolling(false);
      }
    };

    // Helper to evaluate and save overhead passes
    const processPasses = (currentAircraft: AircraftUpdate[]) => {
      const now = Date.now();
      const currentHexes = new Set(currentAircraft.map(ac => ac.hex));
      
      // Update active passes and log new entry if an aircraft goes inside overhead radius
      currentAircraft.forEach((ac) => {
        if (ac.distanceKm <= settings.overheadRadiusKm) {
          const existing = activePassesRef.current[ac.hex];
          
          if (!existing) {
            // New pass starts!
            activePassesRef.current[ac.hex] = {
              hex: ac.hex,
              flight: ac.cleanFlight || 'N/A',
              type: ac.t || 'UNKN',
              desc: ac.desc || 'Unknown Aircraft',
              registration: ac.r || 'N/A',
              minDistanceKm: ac.distanceKm,
              minAltitudeFt: ac.altitudeFt,
              trajectory: ac.trajectory,
              noiseLevel: ac.noiseLevel,
              lastSeen: now
            };
          } else {
            // Update existing pass properties with minimum distance seen
            activePassesRef.current[ac.hex] = {
              ...existing,
              minDistanceKm: Math.min(existing.minDistanceKm, ac.distanceKm),
              minAltitudeFt: Math.min(existing.minAltitudeFt, ac.altitudeFt),
              lastSeen: now
            };
          }
        }
      });

      // Find passes that have finished (either moved away or disappeared from radar)
      Object.keys(activePassesRef.current).forEach((hex) => {
        const pass = activePassesRef.current[hex];
        const currentMatch = currentAircraft.find(ac => ac.hex === hex);
        const isOutsideNow = currentMatch && currentMatch.distanceKm > settings.overheadRadiusKm;
        const hasDisappeared = !currentHexes.has(hex) && (now - pass.lastSeen > 35000); // 35 seconds buffer

        if (isOutsideNow || hasDisappeared) {
          // Finalize overhead event and save to persistent History state
          const newEvent: OverheadEvent = {
            hex: pass.hex,
            flight: pass.flight,
            type: pass.type,
            desc: pass.desc,
            registration: pass.registration,
            timestamp: Date.now(),
            minDistanceKm: parseFloat(pass.minDistanceKm.toFixed(2)),
            altitudeFt: Math.round(pass.minAltitudeFt),
            trajectory: pass.trajectory,
            noiseLevel: pass.noiseLevel
          };

          setHistory(prev => {
            // Prevent duplicate adjacent logs for same hex within 5 mins
            const duplicate = prev.find(
              h => h.hex === newEvent.hex && (newEvent.timestamp - h.timestamp < 300000)
            );
            if (duplicate) return prev;
            return [newEvent, ...prev].slice(0, 100); // Cap at 100 history elements
          });

          // Delete from active passes
          delete activePassesRef.current[hex];
        }
      });
    };

    // Trigger immediately on load
    fetchAircraftData();

    // Trigger every 8 seconds
    intervalId = window.setInterval(fetchAircraftData, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [settings.homeLat, settings.homeLon, settings.detectionRadiusKm, settings.overheadRadiusKm, settings.maxAltitudeFt]);

  // Clean active passes on component unmount
  useEffect(() => {
    return () => {
      activePassesRef.current = {};
    };
  }, []);

  // Request GPS permission manually
  const requestGPS = () => {
    if ('geolocation' in navigator) {
      setSettings(prev => ({ ...prev, useGPS: true }));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSettings(prev => ({
            ...prev,
            homeLat: parseFloat(pos.coords.latitude.toFixed(6)),
            homeLon: parseFloat(pos.coords.longitude.toFixed(6)),
            useGPS: true
          }));
          setGpsPermissionState('granted');
          setFetchError(null);
        },
        (err) => {
          console.error(err);
          setGpsPermissionState('denied');
          setSettings(prev => ({ ...prev, useGPS: false }));
          setFetchError('GPS Request Refused. Enable location permission in your browser settings.');
        }
      );
    }
  };

  // Form submission handler
  const saveManualLocation = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(tempLat);
    const lon = parseFloat(tempLon);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setSettings(prev => ({
        ...prev,
        homeLat: lat,
        homeLon: lon,
        useGPS: false
      }));
      setFetchError(null);
    } else {
      setFetchError('Invalid coordinates entered. Please input valid decimal numbers.');
    }
  };

  // Airport resolution handler
  const handleAirportLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = lookupAirport(tempAirport);
    if (resolved) {
      setSettings(prev => ({
        ...prev,
        homeLat: resolved.lat,
        homeLon: resolved.lon,
        airportLat: resolved.lat,
        airportLon: resolved.lon,
        airportCode: resolved.code,
        useGPS: false
      }));
      setTempLat(resolved.lat.toString());
      setTempLon(resolved.lon.toString());
      setAirportResolutionMsg(`Found: ${resolved.name} (${resolved.code})`);
      setFetchError(null);
    } else {
      setAirportResolutionMsg('Airport code not found in offline database.');
    }
  };

  // Trajectory direction display helper
  const renderTrajectoryLabel = (tr: string) => {
    switch (tr) {
      case 'landing':
        return <span style={{ color: '#38bdf8', fontWeight: 600 }}>Landing ↘</span>;
      case 'departing':
        return <span style={{ color: '#fbbf24', fontWeight: 600 }}>Departing ↗</span>;
      case 'transit':
        return <span style={{ color: '#94a3b8' }}>Overflight →</span>;
      default:
        return <span style={{ color: '#64748b' }}>Unknown</span>;
    }
  };

  // Compass bearing text resolver
  const getCompassDirection = (bearing: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(bearing / 45) % 8];
  };

  // Find the single loudest flight currently overhead (closest + below threshold)
  const loudestFlight = aircraft
    .filter(ac => ac.distanceKm <= settings.overheadRadiusKm)
    .sort((a, b) => {
      // Prioritize High Noise, then lower altitude
      const noiseScore = { high: 3, medium: 2, low: 1 };
      const scoreDiff = noiseScore[b.noiseLevel] - noiseScore[a.noiseLevel];
      if (scoreDiff !== 0) return scoreDiff;
      return a.altitudeFt - b.altitudeFt;
    })[0];

  return (
    <div>
      <header>
        <h1>SkyNoise</h1>
        <div className="subtitle">Privacy-First Overhead Flight Tracker</div>
      </header>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
            <Icons.Radar /> Live Tracker
          </span>
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
            <Icons.History /> Who Was That?
          </span>
        </button>
        <button 
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
            <Icons.Settings /> Settings
          </span>
        </button>
      </div>

      {/* Status Bar */}
      <div className="status-row">
        <span className={`status-indicator ${settings.homeLat !== null ? 'status-active' : 'status-offline'}`}></span>
        {settings.homeLat !== null ? (
          <>
            Scanning ({settings.homeLat}, {settings.homeLon}) 
            {isPolling ? ' • Loading...' : lastFetchTime ? ` • Updated ${lastFetchTime.toLocaleTimeString()}` : ''}
          </>
        ) : (
          'Radar Offline (Needs Location)'
        )}
      </div>

      {/* Errors */}
      {fetchError && (
        <div className="card" style={{ borderLeft: '4px solid #f43f5e', background: 'rgba(244,63,94,0.06)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Icons.XCircle />
            <div>
              <div style={{ fontWeight: 600, color: '#f43f5e', marginBottom: '0.2rem' }}>Location Error</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{fetchError}</div>
              {gpsPermissionState === 'denied' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => setActiveTab('settings')}
                >
                  Configure Fallback Coordinates
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Views */}
      {activeTab === 'live' && (
        <div>
          {/* Welcome Screen / No coordinates configured */}
          {settings.homeLat === null && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <Icons.Radar />
              <h2 style={{ marginTop: '1rem' }}>Welcome to SkyNoise</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0.75rem 0 1.5rem 0', lineHeight: 1.5 }}>
                We need your location to calculate real-time flight noise overhead. 
                Everything is processed completely in your browser to respect Loi 25 & GDPR.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn" onClick={requestGPS}>
                  <Icons.GPS /> Use My GPS Location
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('settings')}>
                  Lookup Airport or Input Manually
                </button>
              </div>
            </div>
          )}

          {settings.homeLat !== null && (
            <>
              {/* Loudest aircraft warning banner */}
              {loudestFlight ? (
                <div className="noise-alert-banner">
                  <Icons.Volume2 className="status-offline" style={{ animation: 'beacon 1s infinite' }} />
                  <div className="noise-alert-content">
                    <div className="noise-alert-title">Flight Overhead Now</div>
                    <div className="noise-alert-desc">
                      Flight <strong>{loudestFlight.cleanFlight || 'Unknown'}</strong> ({loudestFlight.desc || 'Aircraft'}) is overhead at {loudestFlight.altitudeFt.toLocaleString()} ft. 
                      Trajectory: <strong>{loudestFlight.trajectory.toUpperCase()}</strong>.
                    </div>
                  </div>
                  <span className={`badge badge-${loudestFlight.noiseLevel}`}>{loudestFlight.noiseLevel} Noise</span>
                </div>
              ) : (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <Icons.VolumeX />
                  <div style={{ fontSize: '0.9rem', color: '#a7f3d0' }}>
                    No noisy aircraft currently overhead (below {settings.overheadRadiusKm} km).
                  </div>
                </div>
              )}

              {/* Radar Sweep Widget */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="radar-wrapper">
                  <div className="radar-container">
                    <div className="radar-sweep"></div>
                    <div className="radar-grid"></div>
                    <div className="radar-grid-v"></div>
                    <div className="radar-circle" style={{ width: '70px', height: '70px' }}></div>
                    <div className="radar-circle" style={{ width: '140px', height: '140px' }}></div>
                    <div className="radar-circle" style={{ width: '210px', height: '210px' }}></div>
                    
                    {/* Compass Cardinals */}
                    <div className="radar-cardinal cardinal-n">N</div>
                    <div className="radar-cardinal cardinal-e">E</div>
                    <div className="radar-cardinal cardinal-s">S</div>
                    <div className="radar-cardinal cardinal-w">W</div>

                    {/* Render target center */}
                    <div className="radar-dot" style={{ top: 'calc(50% - 4px)', left: 'calc(50% - 4px)', backgroundColor: '#38bdf8', boxShadow: 'none' }}></div>
                    
                    {/* Render aircraft on radar */}
                    {aircraft.map((ac) => {
                      const maxR = settings.detectionRadiusKm;
                      // Calculate polar coordinates mapping to radar canvas
                      const radiusPercent = (ac.distanceKm / maxR) * 50; // max radius is 50% from center
                      const angleRad = ((ac.bearingDeg - 90) * Math.PI) / 180;
                      
                      const left = 50 + radiusPercent * Math.cos(angleRad);
                      const top = 50 + radiusPercent * Math.sin(angleRad);
                      
                      // Map noise levels to dot colors
                      const dotColors = { high: '#f43f5e', medium: '#fbbf24', low: '#34d399' };
                      const activeColor = dotColors[ac.noiseLevel];
                      const heading = ac.track || 0;
                      
                      return (
                        <div 
                          key={ac.hex}
                          className="radar-aircraft"
                          title={`${ac.cleanFlight || 'Unknown'} (${ac.distanceKm} km, Alt: ${ac.altitudeFt} ft, Heading: ${heading}°)`}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                          }}
                        >
                          {/* Pulsing beacon effect for loud planes */}
                          {ac.noiseLevel === 'high' && (
                            <div 
                              className="radar-aircraft-beacon"
                              style={{ backgroundColor: activeColor }}
                            />
                          )}
                          
                          {/* Stylized rotated airplane icon */}
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                            style={{
                              transform: `rotate(${heading}deg)`,
                              color: activeColor,
                              filter: `drop-shadow(0 0 3px ${activeColor})`,
                              transition: 'transform 0.5s ease'
                            }}
                          >
                            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                          </svg>

                          {/* Callsign and altitude tag */}
                          <div className="radar-aircraft-tag">
                            {ac.cleanFlight || 'UNKN'}
                            <br/>
                            {Math.round(ac.altitudeFt / 100) / 10}k ft
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Scanning Radius: {settings.detectionRadiusKm} km • Radar shows {aircraft.length} aircraft
                  </div>
                </div>
              </div>

              {/* Overhead Flight Details */}
              <div className="card">
                <h2>Currently Overhead</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {aircraft.filter(ac => ac.distanceKm <= settings.overheadRadiusKm).length === 0 ? (
                    <div className="empty-state">No flights within immediate overhead radius.</div>
                  ) : (
                    aircraft
                      .filter(ac => ac.distanceKm <= settings.overheadRadiusKm)
                      .map((ac) => (
                        <div key={ac.hex} className="aircraft-card">
                          <div className="aircraft-header">
                            <div>
                              <span className="flight-number">{ac.cleanFlight || 'No Callsign'}</span>
                              <div className="aircraft-type">{ac.desc || 'Unknown Aircraft'}</div>
                            </div>
                            <span className={`badge badge-${ac.noiseLevel}`}>{ac.noiseLevel} Noise</span>
                          </div>
                          <div className="aircraft-details">
                            <div>
                              <div className="detail-label">Distance</div>
                              <div className="detail-value">{ac.distanceKm} km ({getCompassDirection(ac.bearingDeg)})</div>
                            </div>
                            <div>
                              <div className="detail-label">Altitude</div>
                              <div className="detail-value">{ac.altitudeFt.toLocaleString()} ft</div>
                            </div>
                            <div>
                              <div className="detail-label">Trajectory</div>
                              <div className="detail-value">{renderTrajectoryLabel(ac.trajectory)}</div>
                            </div>
                            <div>
                              <div className="detail-label">Details</div>
                              <div className="detail-value">Reg: {ac.r || 'N/A'} • Speed: {ac.gs || 0} kt</div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Incoming Flight Details */}
              <div className="card">
                <h2>Heading Towards You</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {aircraft.filter(ac => ac.isHeadingTowards && ac.distanceKm > settings.overheadRadiusKm).length === 0 ? (
                    <div className="empty-state">No flights heading towards your location.</div>
                  ) : (
                    aircraft
                      .filter(ac => ac.isHeadingTowards && ac.distanceKm > settings.overheadRadiusKm)
                      // Sort by ETA
                      .sort((a, b) => (a.cpaTimeSeconds || 9999) - (b.cpaTimeSeconds || 9999))
                      .map((ac) => (
                        <div key={ac.hex} className="aircraft-card">
                          <div className="aircraft-header">
                            <div>
                              <span className="flight-number">{ac.cleanFlight || 'No Callsign'}</span>
                              <div className="aircraft-type">{ac.desc || 'Unknown Aircraft'}</div>
                            </div>
                            <span className={`badge badge-${ac.noiseLevel}`}>{ac.noiseLevel} Noise</span>
                          </div>
                          <div className="aircraft-details">
                            <div>
                              <div className="detail-label">ETA Overhead</div>
                              <div className="detail-value" style={{ color: '#38bdf8', fontWeight: 600 }}>
                                {ac.cpaTimeSeconds ? `~${Math.floor(ac.cpaTimeSeconds / 60)}m ${ac.cpaTimeSeconds % 60}s` : 'Unknown'}
                              </div>
                            </div>
                            <div>
                              <div className="detail-label">Altitude</div>
                              <div className="detail-value">{ac.altitudeFt.toLocaleString()} ft</div>
                            </div>
                            <div>
                              <div className="detail-label">Current Distance</div>
                              <div className="detail-value">{ac.distanceKm} km away ({getCompassDirection(ac.bearingDeg)})</div>
                            </div>
                            <div>
                              <div className="detail-label">Trajectory</div>
                              <div className="detail-value">{renderTrajectoryLabel(ac.trajectory)}</div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* History View */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, flex: 1 }}>"Who Was That?" Log</h2>
            {history.length > 0 && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}
                onClick={() => {
                  if (confirm('Clear local history list?')) setHistory([]);
                }}
              >
                <Icons.Trash /> Clear Log
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            {history.length === 0 ? (
              <div className="empty-state">
                <Icons.Plane className="detail-label" style={{ width: '32px', height: '32px', display: 'block', margin: '0 auto 0.5rem auto' }} />
                No overhead flights logged yet.<br/>
                Flights entering within {settings.overheadRadiusKm} km of your coordinates are recorded here.
              </div>
            ) : (
              history.map((ev, idx) => (
                <div key={`${ev.hex}-${ev.timestamp}-${idx}`} className="history-item">
                  <div className="history-meta">
                    <span className="flight-number">{ev.flight}</span>
                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {ev.desc}
                    </span>
                    <span className="history-time">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • Reg: {ev.registration}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span className={`badge badge-${ev.noiseLevel}`}>{ev.noiseLevel} Noise</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Closest: {ev.minDistanceKm} km ({ev.altitudeFt.toLocaleString()} ft)
                    </span>
                    <span style={{ fontSize: '0.75rem' }}>
                      {renderTrajectoryLabel(ev.trajectory)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings View */}
      {activeTab === 'settings' && (
        <div>
          {/* Geolocation Permissions Dashboard */}
          <div className="card">
            <h2>Device Geolocation Status</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>GPS Permission Status:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 600 }}>
                {gpsPermissionState === 'granted' ? (
                  <><Icons.Check /> Granted</>
                ) : gpsPermissionState === 'denied' ? (
                  <><Icons.XCircle /> Denied / Blocked</>
                ) : (
                  <><span className="status-indicator status-offline" style={{ marginRight: '0.25rem', width: '6px', height: '6px' }}></span> Prompt Required</>
                )}
              </span>
            </div>

            <div className="switch-container">
              <div>
                <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>Use Geolocation (GPS)</span>
                <div className="switch-label-desc">Automatically track coordinates from device sensor</div>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={settings.useGPS} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSettings(prev => ({ ...prev, useGPS: checked }));
                    if (!checked) {
                      setTempLat(settings.homeLat?.toString() || '');
                      setTempLon(settings.homeLon?.toString() || '');
                    } else {
                      requestGPS();
                    }
                  }}
                />
                <span className="slider"></span>
              </label>
            </div>
            
            {settings.useGPS && (
              <div className="permissions-badge">
                Sensor Accuracy: Active • GPS Position: ({settings.homeLat || 'searching...'}, {settings.homeLon || 'searching...'})
              </div>
            )}
          </div>

          {/* Offline Fallback Airport Lookup */}
          {!settings.useGPS && (
            <div className="card">
              <h2>IATA/ICAO Airport Lookup</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                If GPS is denied or you want to monitor from a different location, type in a North American airport code (e.g. CYHU, YUL, KJFK, KLAX).
              </p>
              <form onSubmit={handleAirportLookup} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="e.g. CYHU or YHU" 
                  value={tempAirport}
                  onChange={(e) => setTempAirport(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                />
                <button type="submit" className="btn btn-secondary">Lookup</button>
              </form>
              {airportResolutionMsg && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: airportResolutionMsg.includes('Found') ? '#34d399' : '#f43f5e', fontWeight: 500 }}>
                  {airportResolutionMsg}
                </div>
              )}
            </div>
          )}

          {/* Manual coordinate entry */}
          {!settings.useGPS && (
            <form onSubmit={saveManualLocation} className="card">
              <h2>Manual Coordinates Override</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Latitude</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    placeholder="e.g. 45.5175"
                    value={tempLat} 
                    onChange={(e) => setTempLat(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    placeholder="e.g. -73.4169" 
                    value={tempLon} 
                    onChange={(e) => setTempLon(e.target.value)} 
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn">Save Coordinates</button>
            </form>
          )}

          {/* Threshold configurations */}
          <div className="card">
            <h2>Tracker Thresholds</h2>
            <div className="form-group">
              <label>Detection Radius: {settings.detectionRadiusKm} km</label>
              <input 
                type="range" 
                min="5" 
                max="40" 
                step="5"
                value={settings.detectionRadiusKm}
                onChange={(e) => setSettings(prev => ({ ...prev, detectionRadiusKm: parseInt(e.target.value) }))}
                style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
              />
            </div>
            
            <div className="form-group">
              <label>Overhead Logging Radius: {settings.overheadRadiusKm} km</label>
              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.5"
                value={settings.overheadRadiusKm}
                onChange={(e) => setSettings(prev => ({ ...prev, overheadRadiusKm: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
              />
            </div>

            <div className="form-group">
              <label>Maximum Audible Altitude: {settings.maxAltitudeFt.toLocaleString()} feet</label>
              <input 
                type="range" 
                min="3000" 
                max="15000" 
                step="1000"
                value={settings.maxAltitudeFt}
                onChange={(e) => setSettings(prev => ({ ...prev, maxAltitudeFt: parseInt(e.target.value) }))}
                style={{ width: '100%', accentColor: '#38bdf8', padding: 0 }}
              />
            </div>
          </div>

          {/* Compliance & Privacy Disclosure Card */}
          <div className="privacy-box">
            <div className="privacy-title" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Icons.Shield /> GDPR, PIPEDA, & Loi 25 Compliance
            </div>
            This application operates entirely in your client browser. Your device GPS location sensor data and IATA airport lookups are processed strictly on your machine and stored locally in browser <code>localStorage</code>. No coordinate tracking, flight histories, IP logs, or cookies are sent to, stored on, or gathered by any central server. Real-time aviation telemetry queries are made directly from your device to the open-source, CORS-enabled <code>api.airplanes.live</code> server.
          </div>
        </div>
      )}
    </div>
  );
}
