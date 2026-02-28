/**
 * Predefined coastal locations for fly-to navigation.
 * Each location has camera parameters and contextual information.
 */

export const LOCATIONS = [
  {
    id: "bangladesh",
    name: "🇧🇩 Bangladesh",
    description: "Low-lying delta, one of the most vulnerable nations",
    longitude: 90.35,
    latitude: 23.0,
    height: 150_000,
    pitch: -30,
    heading: 0,
    avgElevation: 5, // meters above sea level
    population: 170_000_000,
    coastalPopulation: 40_000_000,
    geoidUndulation: -45, // EGM96 approx, meters
  },
  {
    id: "srilanka",
    name: "🇱🇰 Sri Lanka",
    description: "Island nation with extensive low-lying coastal areas",
    longitude: 80.77,
    latitude: 7.87,
    height: 200_000,
    pitch: -35,
    heading: 0,
    avgElevation: 15,
    population: 22_000_000,
    coastalPopulation: 5_000_000,
    geoidUndulation: -90,
  },
  {
    id: "maldives",
    name: "🇲🇻 Maldives",
    description: "Average elevation ~1.5m — existential threat",
    longitude: 73.22,
    latitude: 3.20,
    height: 100_000,
    pitch: -40,
    heading: 0,
    avgElevation: 1.5,
    population: 520_000,
    coastalPopulation: 520_000,
    geoidUndulation: -100,
  },
  {
    id: "netherlands",
    name: "🇳🇱 Netherlands",
    description: "~26% below sea level, protected by extensive dike systems",
    longitude: 4.90,
    latitude: 52.10,
    height: 200_000,
    pitch: -30,
    heading: 0,
    avgElevation: -2,
    population: 17_500_000,
    coastalPopulation: 9_000_000,
    geoidUndulation: 46,
  },
  {
    id: "nyc",
    name: "🇺🇸 New York City",
    description: "Low-lying boroughs, major infrastructure at risk",
    longitude: -74.00,
    latitude: 40.71,
    height: 80_000,
    pitch: -25,
    heading: 0,
    avgElevation: 10,
    population: 8_300_000,
    coastalPopulation: 3_000_000,
    geoidUndulation: -33,
  },
  {
    id: "mumbai",
    name: "🇮🇳 Mumbai",
    description: "Built on reclaimed land, western coast extremely low",
    longitude: 72.88,
    latitude: 19.07,
    height: 100_000,
    pitch: -30,
    heading: 0,
    avgElevation: 8,
    population: 20_000_000,
    coastalPopulation: 10_000_000,
    geoidUndulation: -75,
  },
  {
    id: "shanghai",
    name: "🇨🇳 Shanghai",
    description: "Yangtze River delta, vast low-lying urban area",
    longitude: 121.47,
    latitude: 31.23,
    height: 120_000,
    pitch: -30,
    heading: 0,
    avgElevation: 4,
    population: 28_000_000,
    coastalPopulation: 15_000_000,
    geoidUndulation: -22,
  },
];

/**
 * Get a location by its ID.
 */
export function getLocationById(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}
