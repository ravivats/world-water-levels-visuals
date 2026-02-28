/**
 * World Water Level Visualization
 * 3D Globe with Monte Carlo Sea Level Rise Simulation
 *
 * Entry point: initializes CesiumJS viewer, loads EGM96 geoid texture,
 * sets up flood visualization with per-fragment geoid correction, and UI.
 */
import {
  Ion,
  Viewer,
  Terrain,
  Cartesian3,
  Math as CesiumMath,
  SceneMode,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";

import { loadGeoidTexture } from "./geoid.js";
import { initFloodVisualization } from "./floodVisualization.js";
import { initUI } from "./ui.js";
import { showOnboarding } from "./onboarding.js";

// ============================================================
// Cesium Ion Access Token
// Set via environment variable: export CESIUM_ION_ACCESS_TOKEN="your-token"
// ============================================================
/* global __CESIUM_ION_ACCESS_TOKEN__ */
const envToken = typeof __CESIUM_ION_ACCESS_TOKEN__ !== "undefined" ? __CESIUM_ION_ACCESS_TOKEN__ : "";

if (envToken) {
  Ion.defaultAccessToken = envToken;
} else {
  // Fallback: prompt the user if no env token is set
  const token = prompt(
    "No CESIUM_ION_ACCESS_TOKEN environment variable found.\n\n" +
      "Either set it and restart the dev server:\n" +
      "  export CESIUM_ION_ACCESS_TOKEN=your-token\n\n" +
      "Or paste your token below.\n" +
      "Get a free one at: https://ion.cesium.com/signup/"
  );
  if (token && token.trim()) {
    Ion.defaultAccessToken = token.trim();
  }
}

// ============================================================
// Initialize Cesium Viewer
// ============================================================
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain({
    requestWaterMask: true,
    requestVertexNormals: true,
  }),
  sceneMode: SceneMode.SCENE3D,
  baseLayerPicker: true,
  geocoder: true,
  homeButton: true,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  selectionIndicator: false,
  infoBox: false,
  shadows: false,
});

// Enable lighting for a more realistic look
viewer.scene.globe.enableLighting = true;

// Set initial camera to show Earth from a nice angle
viewer.camera.flyTo({
  destination: Cartesian3.fromDegrees(78.0, 15.0, 8_000_000),
  orientation: {
    heading: CesiumMath.toRadians(0),
    pitch: CesiumMath.toRadians(-90),
  },
  duration: 0,
});

// ============================================================
// Initialize Modules (async for geoid texture loading)
// ============================================================
async function init() {
  // Load EGM96 geoid texture (2MB binary → canvas texture)
  let geoidCanvas = null;
  try {
    geoidCanvas = await loadGeoidTexture();
  } catch (err) {
    console.error("Geoid texture loading failed, using fallback:", err);
  }

  // Set up flood visualization with per-fragment geoid correction
  initFloodVisualization(viewer, geoidCanvas);

  // Set up UI (temperature controls, stats, histogram, locations)
  initUI(viewer);

  // Show onboarding walkthrough, then log ready
  await showOnboarding();
  console.log(
    "%c🌊 World Water Level Viz ready",
    "color: #3498db; font-size: 14px; font-weight: bold;"
  );
  console.log(
    "Select a temperature increase to run Monte Carlo simulation.\n" +
      "Zoom into coastal areas to see flooding effects."
  );
}

init();
