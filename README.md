# 🌊 World Water Level Visualization

A 3D globe visualization of sea level rise using Monte Carlo simulation, built with CesiumJS.

## Features

- **3D Globe** — Interactive Earth with satellite imagery and high-resolution terrain
- **Monte Carlo Simulation** — 1,000-iteration simulation modeling 5 contributors to sea level rise (thermal expansion, glaciers, Greenland, Antarctica, land water storage)
- **Temperature Controls** — Preset buttons for +1°C, +2°C, +3°C, plus fine-grained ±0.05°C increment buttons (range: 0–5°C)
- **Flood Visualization** — Custom Globe.material GLSL shader that colors terrain fragments below the projected flood height, with per-location geoid correction for regional accuracy
- **Location Fly-to** — Quick navigation to vulnerable regions: Bangladesh, Sri Lanka, Maldives, Netherlands, NYC, Mumbai, Shanghai
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

### Flood Visualization

A custom GLSL shader is applied to the Cesium globe via `Globe.material`. The shader checks each terrain fragment's ellipsoidal height against the flood level and tints it blue if below. This avoids the depth-testing issues of translucent entity overlays.

The flood level is computed as:

```
ellipsoidal flood height = geoid undulation + sea level rise
```

Each predefined location includes an approximate EGM96 geoid undulation value (the offset between the WGS84 ellipsoid and mean sea level), so flooding is regionally accurate rather than globally uniform.

**Note:** This is a simplified model. Real sea level rise is not uniform globally and depends on ocean dynamics, gravitational effects of ice sheets, and local land subsidence.

## Tech Stack

- [CesiumJS](https://cesium.com/cesiumjs/) — 3D globe rendering with terrain
- [Chart.js](https://www.chartjs.org/) — Monte Carlo histogram
- [Vite](https://vitejs.dev/) — Build tool

## Project Structure

- `src/main.js` — Entry point, Cesium viewer setup, token handling
- `src/ui.js` — Temperature controls, stats panel, histogram, location navigation
- `src/simulation.js` — Monte Carlo sea level rise simulation engine
- `src/floodVisualization.js` — Globe.material shader for terrain-based flood coloring
- `src/locations.js` — Predefined coastal locations with geoid undulation data
- `src/onboarding.js` — Introductory walkthrough overlay
- `src/style.css` — All styles
