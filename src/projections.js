/**
 * Scenario-based time projections for temperature increase.
 *
 * This module encapsulates projection data and lookup logic so UI code only
 * handles presentation/events.
 */

export const PROJECTION_YEARS = [2030, 2050, 2100];

const SCENARIO_DATA = {
  ssp126: {
    id: "ssp126",
    label: "SSP1-2.6",
    description: "Strong mitigation, lower warming pathway",
    temperaturesByYear: {
      2030: 1.5,
      2050: 1.8,
      2100: 2.0,
    },
  },
  ssp245: {
    id: "ssp245",
    label: "SSP2-4.5",
    description: "Intermediate emissions pathway",
    temperaturesByYear: {
      2030: 1.6,
      2050: 2.2,
      2100: 2.9,
    },
  },
  ssp585: {
    id: "ssp585",
    label: "SSP5-8.5",
    description: "High emissions, high warming pathway",
    temperaturesByYear: {
      2030: 1.8,
      2050: 2.7,
      2100: 4.4,
    },
  },
};

/**
 * Return list of available scenario presets.
 */
export function getScenarioPresets() {
  return Object.values(SCENARIO_DATA);
}

/**
 * Return scenario by id.
 */
export function getScenarioById(id) {
  return SCENARIO_DATA[id] || null;
}

/**
 * Resolve projected temperature increase for a scenario/year pair.
 * Supports interpolation for future extensibility.
 */
export function getProjectedTemp(scenarioId, year) {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario id: ${scenarioId}`);
  }

  const years = Object.keys(scenario.temperaturesByYear)
    .map((y) => Number(y))
    .sort((a, b) => a - b);

  if (scenario.temperaturesByYear[year] != null) {
    return scenario.temperaturesByYear[year];
  }

  // Clamp outside known range.
  if (year <= years[0]) return scenario.temperaturesByYear[years[0]];
  if (year >= years[years.length - 1]) return scenario.temperaturesByYear[years[years.length - 1]];

  // Linear interpolation between nearest known anchors.
  for (let i = 0; i < years.length - 1; i++) {
    const y0 = years[i];
    const y1 = years[i + 1];
    if (year >= y0 && year <= y1) {
      const t0 = scenario.temperaturesByYear[y0];
      const t1 = scenario.temperaturesByYear[y1];
      const alpha = (year - y0) / (y1 - y0);
      return t0 + (t1 - t0) * alpha;
    }
  }

  return scenario.temperaturesByYear[years[0]];
}

