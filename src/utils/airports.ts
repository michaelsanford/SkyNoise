export interface LocalAirport {
  code: string; // ICAO (e.g. CYHU)
  iata: string; // IATA (e.g. YHU)
  name: string;
  lat: number;
  lon: number;
}

export const NORTH_AMERICAN_AIRPORTS: LocalAirport[] = [
  { code: 'CYHU', iata: 'YHU', name: 'Montreal Saint-Hubert Airport', lat: 45.5175, lon: -73.4169 },
  {
    code: 'CYUL',
    iata: 'YUL',
    name: 'Montreal-Trudeau International Airport',
    lat: 45.4706,
    lon: -73.7408
  },
  {
    code: 'CYYZ',
    iata: 'YYZ',
    name: 'Toronto Pearson International Airport',
    lat: 43.6777,
    lon: -79.6248
  },
  {
    code: 'CYVR',
    iata: 'YVR',
    name: 'Vancouver International Airport',
    lat: 49.1967,
    lon: -123.1815
  },
  {
    code: 'CYOW',
    iata: 'YOW',
    name: 'Ottawa Macdonald-Cartier International Airport',
    lat: 45.3225,
    lon: -75.6672
  },
  {
    code: 'KJFK',
    iata: 'JFK',
    name: 'John F. Kennedy International Airport',
    lat: 40.6398,
    lon: -73.7789
  },
  { code: 'KLGA', iata: 'LGA', name: 'LaGuardia Airport', lat: 40.7769, lon: -73.874 },
  { code: 'KORD', iata: 'ORD', name: "O'Hare International Airport", lat: 41.9742, lon: -87.9073 },
  {
    code: 'KLAX',
    iata: 'LAX',
    name: 'Los Angeles International Airport',
    lat: 33.9416,
    lon: -118.4085
  },
  {
    code: 'KBOS',
    iata: 'BOS',
    name: 'Boston Logan International Airport',
    lat: 42.3643,
    lon: -71.0051
  },
  {
    code: 'KSEA',
    iata: 'SEA',
    name: 'Seattle-Tacoma International Airport',
    lat: 47.4502,
    lon: -122.3088
  },
  {
    code: 'KSFO',
    iata: 'SFO',
    name: 'San Francisco International Airport',
    lat: 37.6213,
    lon: -122.379
  },
  {
    code: 'KDFW',
    iata: 'DFW',
    name: 'Dallas/Fort Worth International Airport',
    lat: 32.8998,
    lon: -97.0403
  },
  { code: 'KDEN', iata: 'DEN', name: 'Denver International Airport', lat: 39.8561, lon: -104.6737 },
  {
    code: 'KATL',
    iata: 'ATL',
    name: 'Hartsfield-Jackson Atlanta International Airport',
    lat: 33.6407,
    lon: -84.4277
  },
  { code: 'KMIA', iata: 'MIA', name: 'Miami International Airport', lat: 25.7959, lon: -80.287 }
];

export function lookupAirport(code: string): LocalAirport | null {
  const clean = code.trim().toUpperCase();
  return NORTH_AMERICAN_AIRPORTS.find(ap => ap.code === clean || ap.iata === clean) || null;
}
