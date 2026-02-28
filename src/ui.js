/**
 * UI Controls: temperature buttons, stats panel, histogram, location fly-to, comparison.
 */
import { Chart, registerables } from "chart.js";
import { Cartesian3, Math as CesiumMath } from "cesium";
import { runSimulation, getImpactDescription, POPULATION_AT_RISK } from "./simulation.js";
import { LOCATIONS, getLocationById } from "./locations.js";
import {
  setFloodLevel,
  clearFlood,
  showComparison,
  hideComparison,
  getComparisonDelta,
  hasPreviousSnapshot,
} from "./floodVisualization.js";

Chart.register(...registerables);

let histogramChart = null;
let currentActiveTemp = 0;
let currentLocationId = null;
let currentSimulationResult = null;
let currentFloodMetric = "p95";

const TEMP_LEVELS = [1, 2, 3, 5, 8, 10];
const TEMP_STEP = 0.05;
const TEMP_MAX = 10;
const TEMP_MIN = 0;
const MONTE_CARLO_ITERATIONS = 5000;
const MONTE_CARLO_BASE_SEED = 1337;
const FLOOD_METRICS = {
  median: { key: "median", label: "Median (50th)" },
  p95: { key: "p95", label: "High-end (95th)" },
};

/**
 * Initialize all UI components.
 */
export function initUI(viewer) {
  createTempButtons(viewer);
  createFloodMetricToggle(viewer);
  createLocationButtons(viewer);
  setupComparisonButton(viewer);
}

/**
 * Create temperature increase buttons.
 */
function createTempButtons(viewer) {
  const container = document.getElementById("tempButtons");

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.className = "temp-btn reset-btn active";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => {
    currentActiveTemp = 0;
    currentSimulationResult = null;
    clearFlood(viewer);
    updateStatsPanel(null);
    updateHistogram(null);
    updateInfoOverlay(0, 0, "median");
    updateCompareButton();
    setActiveButton(container, resetBtn);
    updateTempDisplay();
  });
  container.appendChild(resetBtn);

  // Temperature preset buttons
  for (const temp of TEMP_LEVELS) {
    const btn = document.createElement("button");
    btn.className = "temp-btn";
    btn.textContent = `+${temp}°C`;
    btn.dataset.temp = temp;

    // Color gradient from yellow to red
    const hue = Math.round(60 - (temp / 5) * 60); // 60 (yellow) to 0 (red)
    btn.style.setProperty("--btn-hue", hue);

    btn.addEventListener("click", () => {
      runAndVisualize(viewer, temp);
      setActiveButton(container, btn);
      updateTempDisplay();
    });

    container.appendChild(btn);
  }

  // Fine-grained +/- controls
  const fineControl = document.createElement("div");
  fineControl.className = "fine-temp-control";

  const minusBtn = document.createElement("button");
  minusBtn.className = "temp-adj-btn";
  minusBtn.textContent = "−";
  minusBtn.title = `Decrease by ${TEMP_STEP}°C`;

  const tempDisplay = document.createElement("span");
  tempDisplay.id = "tempDisplay";
  tempDisplay.className = "temp-display";
  tempDisplay.textContent = "0.00°C";

  const plusBtn = document.createElement("button");
  plusBtn.className = "temp-adj-btn";
  plusBtn.textContent = "+";
  plusBtn.title = `Increase by ${TEMP_STEP}°C`;

  minusBtn.addEventListener("click", () => {
    const newTemp = Math.max(TEMP_MIN, parseFloat((currentActiveTemp - TEMP_STEP).toFixed(2)));
    if (newTemp <= 0) {
      currentActiveTemp = 0;
      currentSimulationResult = null;
      clearFlood(viewer);
      updateStatsPanel(null);
      updateHistogram(null);
      updateInfoOverlay(0, 0, "median");
      updateCompareButton();
      setActiveButton(container, resetBtn);
    } else {
      runAndVisualize(viewer, newTemp);
      clearPresetActive(container);
    }
    updateTempDisplay();
  });

  plusBtn.addEventListener("click", () => {
    const newTemp = Math.min(TEMP_MAX, parseFloat((currentActiveTemp + TEMP_STEP).toFixed(2)));
    if (newTemp > 0) {
      runAndVisualize(viewer, newTemp);
      clearPresetActive(container);
    }
    updateTempDisplay();
  });

  fineControl.appendChild(minusBtn);
  fineControl.appendChild(tempDisplay);
  fineControl.appendChild(plusBtn);
  container.appendChild(fineControl);
}

/**
 * Run simulation and update visualization.
 */
function runAndVisualize(viewer, tempIncrease) {
  currentActiveTemp = tempIncrease;
  const statusEl = document.getElementById("simulationStatus");
  statusEl.innerHTML = `<div class="running">Running ${MONTE_CARLO_ITERATIONS} Monte Carlo iterations...</div>`;

  // Use requestAnimationFrame to let the UI update before running simulation
  requestAnimationFrame(() => {
    const result = runSimulation(tempIncrease, MONTE_CARLO_ITERATIONS, {
      seed: buildSeedForTemp(tempIncrease),
    });
    currentSimulationResult = result;
    applySimulationResult(viewer, result, true);

    statusEl.innerHTML = `<div class="done">✓ Simulation complete</div>`;
    setTimeout(() => {
      statusEl.innerHTML = "";
    }, 2000);
  });
}

/**
 * Update the temperature display.
 */
function updateTempDisplay() {
  const display = document.getElementById("tempDisplay");
  if (display) {
    display.textContent = `${currentActiveTemp.toFixed(2)}°C`;
  }
}

/**
 * Clear preset button active state (used when +/- adjusts to a non-preset value).
 */
function clearPresetActive(container) {
  container.querySelectorAll(".temp-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
}

/**
 * Set active button styling.
 */
function setActiveButton(container, activeBtn) {
  container.querySelectorAll(".temp-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  activeBtn.classList.add("active");
}

/**
 * Update the stats panel with simulation results.
 */
function updateStatsPanel(result) {
  const panel = document.getElementById("statsPanel");

  if (!result || result.tempIncrease === 0) {
    panel.innerHTML = "<p>Select a temperature to run simulation</p>";
    return;
  }

  const s = result.stats;
  const impact = getImpactDescription(s.median);

  // Build contributor breakdown
  let contributorHTML = "";
  for (const [key, cs] of Object.entries(result.contributorStats)) {
    const pct = ((cs.mean / s.mean) * 100).toFixed(0);
    contributorHTML += `
      <div class="contributor">
        <span class="contributor-name">${cs.name}</span>
        <span class="contributor-value">${(cs.mean * 100).toFixed(1)} cm (${pct}%)</span>
        <div class="contributor-bar" style="width: ${pct}%"></div>
      </div>
    `;
  }

  // Location-specific info
  let locationHTML = "";
  if (currentLocationId) {
    const loc = getLocationById(currentLocationId);
    const popFn = POPULATION_AT_RISK[currentLocationId];
    if (loc && popFn) {
      const popAtRisk = popFn(s.median);
      locationHTML = `
        <div class="location-impact">
          <h4>${loc.name} Impact</h4>
          <p>Avg elevation: ${loc.avgElevation}m</p>
          <p>Est. population at risk: <strong>${formatNumber(popAtRisk)}</strong></p>
          <p>Coastal population: ${formatNumber(loc.coastalPopulation)}</p>
        </div>
      `;
    }
  }

  panel.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <span class="stat-label">Median SLR</span>
        <span class="stat-value">${(s.median * 100).toFixed(1)} cm</span>
      </div>
      <div class="stat">
        <span class="stat-label">Mean SLR</span>
        <span class="stat-value">${(s.mean * 100).toFixed(1)} cm</span>
      </div>
      <div class="stat">
        <span class="stat-label">5th Percentile</span>
        <span class="stat-value">${(s.p5 * 100).toFixed(1)} cm</span>
      </div>
      <div class="stat">
        <span class="stat-label">95th Percentile</span>
        <span class="stat-value">${(s.p95 * 100).toFixed(1)} cm</span>
      </div>
    </div>
    <div class="impact-text">${impact}</div>
    <h4>Contributors</h4>
    <div class="contributors">${contributorHTML}</div>
    ${locationHTML}
  `;
}

/**
 * Update or create the histogram chart.
 */
function updateHistogram(result) {
  const canvas = document.getElementById("histogramCanvas");
  const container = document.getElementById("histogramContainer");

  if (!result || result.tempIncrease === 0) {
    container.style.display = "none";
    if (histogramChart) {
      histogramChart.destroy();
      histogramChart = null;
    }
    return;
  }

  container.style.display = "block";

  // Create histogram bins
  const data = result.results;
  const min = Math.floor(data[0] * 100) / 100;
  const max = Math.ceil(data[data.length - 1] * 100) / 100;
  const binCount = 30;
  const binWidth = (max - min) / binCount;

  const bins = new Array(binCount).fill(0);
  const labels = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    labels.push(`${(binStart * 100).toFixed(0)}`);
  }

  for (const value of data) {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[binIndex]++;
  }

  // Color bins based on severity
  const colors = bins.map((_, i) => {
    const value = min + (i + 0.5) * binWidth;
    if (value < 0.3) return "rgba(52, 152, 219, 0.8)";
    if (value < 0.6) return "rgba(241, 196, 15, 0.8)";
    if (value < 1.0) return "rgba(230, 126, 34, 0.8)";
    return "rgba(231, 76, 60, 0.8)";
  });

  if (histogramChart) {
    histogramChart.destroy();
  }

  histogramChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Frequency",
          data: bins,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace("0.8", "1")),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Sea Level Rise Distribution (+${result.tempIncrease}°C)`,
          color: "#e0e0e0",
          font: { size: 12 },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Sea Level Rise (cm)",
            color: "#aaa",
            font: { size: 10 },
          },
          ticks: {
            color: "#aaa",
            maxTicksLimit: 8,
            font: { size: 9 },
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          title: {
            display: true,
            text: "Frequency",
            color: "#aaa",
            font: { size: 10 },
          },
          ticks: {
            color: "#aaa",
            font: { size: 9 },
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

/**
 * Update the bottom info overlay.
 */
function updateInfoOverlay(tempIncrease, floodLevelMeters, floodMetric) {
  const tempEl = document.getElementById("currentTemp");
  const slrEl = document.getElementById("currentSLR");

  if (tempIncrease === 0) {
    tempEl.textContent = "Baseline (Current)";
    slrEl.textContent = "";
  } else {
    tempEl.textContent = `+${Number.isInteger(tempIncrease) ? tempIncrease : tempIncrease.toFixed(2)}°C`;
    slrEl.textContent = `Sea Level: +${(floodLevelMeters * 100).toFixed(1)} cm (${floodMetric.toUpperCase()})`;
  }
}

/**
 * Create flood metric toggle (median vs p95).
 */
function createFloodMetricToggle(viewer) {
  const statusEl = document.getElementById("simulationStatus");
  const wrapper = document.createElement("div");
  wrapper.className = "flood-metric-toggle";
  wrapper.innerHTML = `
    <span class="flood-metric-label">Flood Display Level</span>
    <div class="flood-metric-buttons">
      <button class="flood-metric-btn" data-metric="median">${FLOOD_METRICS.median.label}</button>
      <button class="flood-metric-btn active" data-metric="p95">${FLOOD_METRICS.p95.label}</button>
    </div>
  `;

  wrapper.querySelectorAll(".flood-metric-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const metric = btn.dataset.metric;
      if (!FLOOD_METRICS[metric] || metric === currentFloodMetric) return;

      currentFloodMetric = metric;
      wrapper.querySelectorAll(".flood-metric-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (currentSimulationResult && currentActiveTemp > 0) {
        applySimulationResult(viewer, currentSimulationResult, false);
      }
    });
  });

  statusEl.parentNode.insertBefore(wrapper, statusEl);
}

/**
 * Apply a simulation result to globe + UI with selected flood metric.
 */
function applySimulationResult(viewer, result, recordSnapshot) {
  const floodLevelMeters = getFloodLevelFromResult(result);
  setFloodLevel(viewer, floodLevelMeters, result, recordSnapshot);
  updateStatsPanel(result);
  updateHistogram(result);
  updateInfoOverlay(result.tempIncrease, floodLevelMeters, currentFloodMetric);
  updateCompareButton();
}

/**
 * Return currently selected flood level statistic.
 */
function getFloodLevelFromResult(result) {
  const metricConfig = FLOOD_METRICS[currentFloodMetric] || FLOOD_METRICS.median;
  return result.stats[metricConfig.key];
}

/**
 * Build deterministic seed from temperature so each scenario is reproducible.
 */
function buildSeedForTemp(tempIncrease) {
  return (MONTE_CARLO_BASE_SEED + Math.round(tempIncrease * 1000)) >>> 0;
}

/**
 * Create location fly-to buttons.
 */
function createLocationButtons(viewer) {
  const container = document.getElementById("locationButtons");

  for (const loc of LOCATIONS) {
    const btn = document.createElement("button");
    btn.className = "location-btn";
    btn.textContent = loc.name;
    btn.title = loc.description;

    btn.addEventListener("click", () => {
      currentLocationId = loc.id;

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          loc.longitude,
          loc.latitude,
          loc.height
        ),
        orientation: {
          heading: CesiumMath.toRadians(loc.heading),
          pitch: CesiumMath.toRadians(loc.pitch),
        },
        duration: 2,
      });

      // Update stats panel for location-specific info
      if (currentActiveTemp > 0 && currentSimulationResult) {
        updateStatsPanel(currentSimulationResult);
      }

      // Highlight active location
      container.querySelectorAll(".location-btn").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    });

    container.appendChild(btn);
  }
}

/**
 * Setup comparison button.
 */
function setupComparisonButton(viewer) {
  const btn = document.getElementById("compareBtn");
  let comparing = false;

  btn.addEventListener("click", () => {
    if (comparing) {
      hideComparison(viewer);
      comparing = false;
      btn.textContent = "Compare with Previous";
      btn.classList.remove("active");
      document.getElementById("comparisonStats").innerHTML = "";
    } else {
      const shown = showComparison(viewer);
      if (shown) {
        comparing = true;
        btn.textContent = "Hide Comparison";
        btn.classList.add("active");

        const delta = getComparisonDelta();
        if (delta) {
          document.getElementById("comparisonStats").innerHTML = `
            <div class="comparison-info">
              <p>Previous: +${delta.previousTemp}°C → ${(delta.previousSLR * 100).toFixed(1)} cm</p>
              <p>Current: +${delta.currentTemp}°C → ${(delta.currentSLR * 100).toFixed(1)} cm</p>
              <p class="delta ${delta.delta > 0 ? "increase" : "decrease"}">
                Δ ${delta.delta > 0 ? "+" : ""}${(delta.delta * 100).toFixed(1)} cm
              </p>
            </div>
          `;
        }
      }
    }
  });
}

/**
 * Update compare button state.
 */
function updateCompareButton() {
  const btn = document.getElementById("compareBtn");
  btn.disabled = !hasPreviousSnapshot();
  btn.textContent = "Compare with Previous";
  btn.classList.remove("active");
  document.getElementById("comparisonStats").innerHTML = "";
}

/**
 * Format a number with commas.
 */
function formatNumber(num) {
  return num.toLocaleString("en-US");
}
