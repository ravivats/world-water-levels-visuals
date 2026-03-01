# 🌊 World Water Levels Visualization

A 3D globe visualization of sea level rise using Monte Carlo simulation, built with CesiumJS.

## Features

- **3D Globe** — Interactive Earth with satellite imagery and high-resolution terrain
- **Monte Carlo Simulation** — 5,000-iteration simulation modeling 5 contributors to sea level rise (thermal expansion, glaciers, Greenland, Antarctica, land water storage)
- **Temperature Controls** — Preset buttons for +1°C, +2°C, +3°C, +5°C, +8°C, +10°C, plus fine-grained ±0.05°C increment buttons (range: 0–10°C)
- **Time Projections** — Scenario presets (`SSP1-2.6`, `SSP2-4.5`, `SSP5-8.5`) with year slider (`2030`, `2050`, `2100`) to map time pathways to warming
- **Flood Visualization** — Custom Globe.material GLSL shader that colors terrain fragments below the projected flood height, with per-fragment EGM96 geoid correction for regional accuracy
- **Flood Display Modes** — Toggle flood rendering between Median (P50) and High-end (P95), with P95 selected by default
- **Location Go-to** — Expanded global quick navigation across North America, South America, South Asia, Southeast Asia, Europe, and China
- **Comparison Mode** — Compare current simulation with previous snapshot; the shader highlights the delta in orange
- **Statistics** — Median, mean, 5th/95th percentile SLR, contributor breakdown, and population-at-risk estimates
- **Onboarding Walkthrough** — 4-slide introductory overlay explaining sea level rise, Monte Carlo simulation, and how to use the tool

## Setup

### 1. Get a Cesium Ion Access Token (free)

1. Sign up at [https://ion.cesium.com/signup/](https://ion.cesium.com/signup/)
2. After signing in, go to **Access Tokens**
3. Copy your default access token

### 2. Set Environment Variable

The token is read from the `CESIUM_ION_ACCESS_TOKEN` environment variable at build/dev time:

```bash
export CESIUM_ION_ACCESS_TOKEN="your-token-here"
```

To make it permanent, add the line above to your `~/.zshrc` (or `~/.bashrc`).

### 3. Install and Run

```bash
npm install
npm run dev
```

If the environment variable is not set, the app will prompt for the token on load.

## How It Works

### Monte Carlo Model

The simulation models sea level rise from 5 physical contributors, each with uncertainty distributions based on IPCC AR5/AR6 data:

- **Thermal Expansion** — 0.12 m/°C ± 0.04, linear scaling
- **Mountain Glaciers** — 0.10 m/°C ± 0.03, slightly sub-linear (glaciers deplete)
- **Greenland Ice Sheet** — 0.06 m/°C ± 0.04, super-linear (exponent 1.4)
- **Antarctic Ice Sheet** — 0.05 m/°C ± 0.08, highly non-linear (exponent 1.8, MICI risk)
- **Land Water Storage** — 0.01 m/°C ± 0.01, linear

Antarctic contribution has the highest uncertainty due to Marine Ice Cliff Instability (MICI) risk.

#### Monte Carlo Implementation Details (Exact)

- **Iterations per simulation run:** `5000`
- **Primary input variable:** Relative temperature increase in °C (`tempIncrease`, from UI controls in the `0.00` to `10.00` range)
- **Projection mode inputs (optional):**
  - Scenario preset: `SSP1-2.6`, `SSP2-4.5`, or `SSP5-8.5`
  - Year: `2030`, `2050`, or `2100`
  - Projected temperature is resolved from scenario/year before simulation
- **Contributors sampled each iteration (5 total):**
  - Thermal Expansion
  - Mountain Glaciers
  - Greenland Ice Sheet
  - Antarctic Ice Sheet
  - Land Water Storage
- **Per-contributor sampling formula per iteration:**
  - `scaledTemp = tempIncrease ^ nonLinearExponent`
  - `mean = meanPerDeg * scaledTemp`
  - `std = stdPerDeg * sqrt(tempIncrease)`
  - sampled value uses a Gaussian draw via Box-Muller transform
  - sampled value is clamped to non-negative (`max(0, sampledValue)`)
- **Total SLR per iteration:** Sum of all 5 sampled contributor values (meters)
- **Output statistics computed from sorted iteration totals:**
  - `mean`, `median (p50)`, `p5`, `p95`, `min`, `max`
- **Seeded reproducibility:**
  - PRNG: deterministic `Mulberry32` when a seed is provided
  - Seed used by UI:
    - Manual temperature mode: `seed = 1337 + round(tempIncrease * 1000)`
    - Projection mode: seed is derived from scenario id hash + year + base seed
  - This makes both manual and scenario/year runs deterministic/repeatable
- **Optimization/shortcuts used to reduce runs:** None
  - No early stopping
  - No adaptive sampling
  - No variance-reduction methods (e.g., Latin Hypercube, antithetic variates)
  - Full fixed-size Monte Carlo (`5000` samples) every run
- **Performance note:** Histogram and statistics reuse the same sampled run; switching flood display mode (Median vs P95) does not rerun Monte Carlo.

### Flood Visualization

A custom GLSL shader is applied to the Cesium globe via `Globe.material`. The shader checks each terrain fragment's ellipsoidal height against the flood level and tints it amber if below. This avoids the depth-testing issues of translucent entity overlays.

The flood level is computed as:

```
ellipsoidal flood height = geoid undulation + sea level rise
```

Flooding uses an EGM96 geoid texture sampled per-fragment (the offset between the WGS84 ellipsoid and mean sea level), so correction is global and continuous rather than tied to a single location offset.

The geoid lookup uses globe texture coordinates so flood behavior remains consistent across Cesium scene modes (3D and 2D).

**Note:** This is a simplified model. Real sea level rise is not uniform globally and depends on ocean dynamics, gravitational effects of ice sheets, and local land subsidence.

## Tech Stack

- [CesiumJS](https://cesium.com/cesiumjs/) — 3D globe rendering with terrain
- [Chart.js](https://www.chartjs.org/) — Monte Carlo histogram
- [Vite](https://vitejs.dev/) — Build tool

## Project Structure

- `src/main.js` — Entry point, Cesium viewer setup, token handling
- `src/ui.js` — Temperature controls, projection controls, stats panel, histogram, location navigation
- `src/simulation.js` — Monte Carlo sea level rise simulation engine
- `src/projections.js` — Scenario/year projection presets and temperature resolution logic
- `src/floodVisualization.js` — Globe.material shader for terrain-based flood coloring
- `src/geoid.js` — EGM96 geoid loader and texture encoding for shader sampling
- `src/locations.js` — Predefined coastal locations with geoid undulation data
- `src/onboarding.js` — Introductory walkthrough overlay
- `src/style.css` — All styles

All rights reserved. No license is granted to use, copy, reproduce, distribute, or modify this code in any form.

Use of this content for training, fine-tuning, evaluating, or otherwise incorporating into any artificial intelligence (AI) or machine learning (ML) systems, including but not limited to large language models (LLMs) such as GPT, BERT, or similar technologies, is strictly prohibited.

📄 License: All rights reserved. See [LICENSE](./LICENSE) for details.
