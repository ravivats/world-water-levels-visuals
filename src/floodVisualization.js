/**
 * Flood Visualization using Globe Material shader.
 *
 * Instead of a translucent water plane (which doesn't depth-test properly
 * against terrain for translucent entities), this applies a custom material
 * to the globe that colors terrain fragments below the flood level.
 *
 * The flood level is computed as:
 *   ellipsoidal flood height = geoid undulation + sea level rise
 *
 * This accounts for the difference between the WGS84 ellipsoid and mean
 * sea level (geoid), which can be up to ±100m depending on location.
 */
import { Material } from "cesium";

let floodMaterial = null;
let previousSnapshot = null;
let currentSnapshot = null;
let animationFrame = null;

// Animated water alpha
let waterAlpha = 0;
let targetAlpha = 0;
let alphaAnimating = false;

/**
 * GLSL shader for height-based flood coloring.
 * Uniforms are declared automatically by Cesium’s Material fabric system.
 *   - floodLevel:      ellipsoidal height of the flood surface (geoid + SLR)
 *   - waterAlpha:      animated opacity (0 → 0.55)
 *   - comparisonLevel: ellipsoidal height of the previous flood (0 = inactive)
 */
const FLOOD_SHADER_SOURCE = `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);

    // Default: fully transparent so terrain imagery shows through
    material.alpha = 0.0;

    float h = materialInput.height;

    // Current flood: color terrain below the flood surface
    if (floodLevel != 0.0 && h < floodLevel) {
      material.diffuse = vec3(0.1, 0.42, 1.0);
      material.alpha = waterAlpha;
    }

    // Comparison overlay: highlight the delta between current and previous
    if (comparisonLevel != 0.0) {
      float lower = min(floodLevel, comparisonLevel);
      float upper = max(floodLevel, comparisonLevel);
      if (h >= lower && h < upper) {
        material.diffuse = vec3(1.0, 0.42, 0.1);
        material.alpha = 0.4;
      }
    }

    return material;
  }
`;

/**
 * Initialize flood visualization on the viewer.
 */
export function initFloodVisualization(viewer) {
  viewer.scene.globe.depthTestAgainstTerrain = true;

  floodMaterial = new Material({
    fabric: {
      type: "Flood",
      uniforms: {
        floodLevel: 0.0,
        waterAlpha: 0.0,
        comparisonLevel: 0.0,
      },
      source: FLOOD_SHADER_SOURCE,
    },
  });

  startAlphaAnimation(viewer);
}

/**
 * Animate water alpha for a smooth fade-in effect.
 */
function startAlphaAnimation(viewer) {
  function animate() {
    if (alphaAnimating && floodMaterial) {
      const diff = targetAlpha - waterAlpha;
      if (Math.abs(diff) > 0.005) {
        waterAlpha += diff * 0.08;
        floodMaterial.uniforms.waterAlpha = waterAlpha;
        viewer.scene.requestRender();
      } else {
        waterAlpha = targetAlpha;
        floodMaterial.uniforms.waterAlpha = waterAlpha;
        alphaAnimating = false;

        // Remove material once fully faded out
        if (targetAlpha === 0) {
          viewer.scene.globe.material = undefined;
        }
      }
    }
    animationFrame = requestAnimationFrame(animate);
  }
  animate();
}

/**
 * Set the flood level and apply the globe material.
 * @param {object} viewer - Cesium Viewer
 * @param {number} seaLevelRise - Sea level rise in meters (above MSL)
 * @param {object} simulationResult - Full simulation result for snapshot
 * @param {number} geoidOffset - Local geoid undulation in meters (from location data)
 */
export function setFloodLevel(viewer, seaLevelRise, simulationResult, geoidOffset = 0) {
  // Save previous snapshot
  if (currentSnapshot) {
    previousSnapshot = { ...currentSnapshot };
  }

  currentSnapshot = {
    seaLevelRise,
    simulationResult,
    geoidOffset,
    timestamp: Date.now(),
  };

  if (seaLevelRise <= 0) {
    clearFlood(viewer);
    return;
  }

  // Flood level in ellipsoidal height = geoid undulation + sea level rise
  const ellipsoidalFloodLevel = geoidOffset + seaLevelRise;

  floodMaterial.uniforms.floodLevel = ellipsoidalFloodLevel;
  floodMaterial.uniforms.comparisonLevel = 0.0;
  viewer.scene.globe.material = floodMaterial;

  // Animate alpha fade-in
  waterAlpha = 0;
  floodMaterial.uniforms.waterAlpha = 0;
  targetAlpha = 0.55;
  alphaAnimating = true;
}

/**
 * Update the geoid offset for the current flood level
 * (e.g. when user flies to a new location).
 */
export function updateGeoidOffset(viewer, geoidOffset) {
  if (!currentSnapshot || !floodMaterial) return;

  currentSnapshot.geoidOffset = geoidOffset;
  const ellipsoidalFloodLevel = geoidOffset + currentSnapshot.seaLevelRise;
  floodMaterial.uniforms.floodLevel = ellipsoidalFloodLevel;
  viewer.scene.requestRender();
}

/**
 * Clear flood visualization.
 */
export function clearFlood(viewer) {
  previousSnapshot = currentSnapshot ? { ...currentSnapshot } : null;
  currentSnapshot = null;

  targetAlpha = 0;
  alphaAnimating = true;

  if (floodMaterial) {
    floodMaterial.uniforms.comparisonLevel = 0.0;
  }
}

/**
 * Show comparison with previous snapshot.
 * Uses the current location’s geoid offset for both levels.
 */
export function showComparison(viewer) {
  if (!previousSnapshot || !currentSnapshot || !floodMaterial) return false;

  // Use current geoid offset so both levels reference the same location
  const geoid = currentSnapshot.geoidOffset || 0;
  const prevFloodLevel = geoid + previousSnapshot.seaLevelRise;
  floodMaterial.uniforms.comparisonLevel = prevFloodLevel;
  viewer.scene.requestRender();
  return true;
}

/**
 * Hide comparison overlay.
 */
export function hideComparison(viewer) {
  if (floodMaterial) {
    floodMaterial.uniforms.comparisonLevel = 0.0;
    viewer.scene.requestRender();
  }
}

/**
 * Get the comparison delta between current and previous snapshots.
 */
export function getComparisonDelta() {
  if (!currentSnapshot || !previousSnapshot) return null;

  return {
    currentSLR: currentSnapshot.seaLevelRise,
    previousSLR: previousSnapshot.seaLevelRise,
    delta: currentSnapshot.seaLevelRise - previousSnapshot.seaLevelRise,
    currentTemp: currentSnapshot.simulationResult?.tempIncrease ?? 0,
    previousTemp: previousSnapshot.simulationResult?.tempIncrease ?? 0,
  };
}

/**
 * Check if a previous snapshot exists for comparison.
 */
export function hasPreviousSnapshot() {
  return previousSnapshot !== null;
}

/**
 * Clean up resources.
 */
export function destroyFloodVisualization(viewer) {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  viewer.scene.globe.material = undefined;
}
