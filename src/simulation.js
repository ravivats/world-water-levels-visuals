/**
 * Monte Carlo Sea Level Rise Simulation
 *
 * Based on IPCC AR5/AR6 semi-empirical approach.
 * Models 5 contributors to sea level rise, each with uncertainty.
 * Uses non-linear scaling for ice sheet dynamics at higher temperatures.
 */

// Box-Muller transform for normal distribution sampling
function sampleNormal(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// Clamp to non-negative
function clampPositive(val) {
  return Math.max(0, val);
}

/**
 * Sea level rise contributors per degree of warming.
 * Mean and standard deviation in meters.
 * Based on IPCC AR6 WG1 Chapter 9 ranges.
 */
const CONTRIBUTORS = {
  thermalExpansion: {
    name: "Thermal Expansion",
    meanPerDeg: 0.12,
    stdPerDeg: 0.04,
    nonLinearExponent: 1.0, // linear
  },
  glaciers: {
    name: "Mountain Glaciers",
    meanPerDeg: 0.10,
    stdPerDeg: 0.03,
    nonLinearExponent: 0.9, // slightly sub-linear (glaciers deplete)
  },
  greenland: {
    name: "Greenland Ice Sheet",
    meanPerDeg: 0.06,
    stdPerDeg: 0.04,
    nonLinearExponent: 1.4, // super-linear at higher temps
  },
  antarctic: {
    name: "Antarctic Ice Sheet",
    meanPerDeg: 0.05,
    stdPerDeg: 0.08,
    nonLinearExponent: 1.8, // highly non-linear (MICI risk)
  },
  landWater: {
    name: "Land Water Storage",
    meanPerDeg: 0.01,
    stdPerDeg: 0.01,
    nonLinearExponent: 1.0,
  },
};

/**
 * Run a single Monte Carlo iteration for a given temperature increase.
 * @param {number} tempIncrease - Temperature increase in °C
 * @returns {object} - { total, breakdown }
 */
function singleIteration(tempIncrease) {
  const breakdown = {};
  let total = 0;

  for (const [key, contributor] of Object.entries(CONTRIBUTORS)) {
    // Apply non-linear scaling: contribution scales as T^exponent
    const scaledTemp = Math.pow(tempIncrease, contributor.nonLinearExponent);
    const mean = contributor.meanPerDeg * scaledTemp;
    // Standard deviation scales with sqrt of temperature for stability
    const std = contributor.stdPerDeg * Math.sqrt(tempIncrease);

    const value = clampPositive(sampleNormal(mean, std));
    breakdown[key] = value;
    total += value;
  }

  return { total, breakdown };
}

/**
 * Run the full Monte Carlo simulation.
 * @param {number} tempIncrease - Temperature increase in °C (1-5)
 * @param {number} iterations - Number of Monte Carlo iterations (default 1000)
 * @returns {object} - Simulation results
 */
export function runSimulation(tempIncrease, iterations = 1000) {
  if (tempIncrease <= 0) {
    return {
      tempIncrease: 0,
      iterations: 0,
      results: [],
      stats: {
        mean: 0,
        median: 0,
        p5: 0,
        p95: 0,
        min: 0,
        max: 0,
      },
      contributorStats: {},
    };
  }

  const results = [];
  const contributorTotals = {};

  for (const key of Object.keys(CONTRIBUTORS)) {
    contributorTotals[key] = [];
  }

  for (let i = 0; i < iterations; i++) {
    const { total, breakdown } = singleIteration(tempIncrease);
    results.push(total);

    for (const [key, value] of Object.entries(breakdown)) {
      contributorTotals[key].push(value);
    }
  }

  // Sort results for percentile calculation
  results.sort((a, b) => a - b);

  const stats = computeStats(results);
  const contributorStats = {};

  for (const [key, values] of Object.entries(contributorTotals)) {
    const sorted = [...values].sort((a, b) => a - b);
    contributorStats[key] = {
      name: CONTRIBUTORS[key].name,
      ...computeStats(sorted),
    };
  }

  return {
    tempIncrease,
    iterations,
    results,
    stats,
    contributorStats,
  };
}

/**
 * Compute basic statistics from a sorted array.
 */
function computeStats(sorted) {
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    mean: sum / n,
    median: sorted[Math.floor(n * 0.5)],
    p5: sorted[Math.floor(n * 0.05)],
    p95: sorted[Math.floor(n * 0.95)],
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Get human-readable description of sea level rise impact.
 * @param {number} slrMeters - Sea level rise in meters
 * @returns {string}
 */
export function getImpactDescription(slrMeters) {
  if (slrMeters < 0.1) return "Minimal visible change";
  if (slrMeters < 0.3) return "Minor coastal flooding during storms";
  if (slrMeters < 0.5) return "Significant coastal erosion, regular tidal flooding";
  if (slrMeters < 1.0) return "Major coastal city flooding, island nations at risk";
  if (slrMeters < 2.0) return "Catastrophic: many coastal cities partially submerged";
  if (slrMeters < 5.0) return "Extreme: massive land loss, hundreds of millions displaced";
  return "Civilization-altering: major population centers underwater";
}

/**
 * Estimate population at risk for a given location and sea level rise.
 * These are rough estimates based on published literature.
 */
export const POPULATION_AT_RISK = {
  bangladesh: (slr) => Math.round(slr * 20_000_000), // ~20M per meter
  srilanka: (slr) => Math.round(slr * 2_000_000),
  maldives: (slr) => Math.min(520_000, Math.round(slr > 0.5 ? 520_000 : slr * 1_040_000)),
  netherlands: (slr) => Math.round(slr * 4_000_000),
  nyc: (slr) => Math.round(slr * 800_000),
  mumbai: (slr) => Math.round(slr * 3_000_000),
  shanghai: (slr) => Math.round(slr * 5_000_000),
};
