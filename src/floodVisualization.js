/**
 * Flood Visualization using Globe Material shader with per-fragment geoid correction.
 *
 * Samples an EGM96 geoid texture per-fragment to compute the local geoid
 * undulation, then compares terrain height against (geoidUndulation + seaLevelRise).
 * This produces globally correct flooding without needing a per-location offset.
 *
 * Fallback: if no geoid texture is provided, uses the original single-uniform
 * shader (correct only at one location at a time).
 */
import { Material } from "cesium";
import { GEOID_MIN, GEOID_RANGE } from "./geoid.js";

let floodMaterial = null;
let previousSnapshot = null;
let currentSnapshot = null;
let animationFrame = null;

// Animated water alpha
let waterAlpha = 0;
let targetAlpha = 0;
let alphaAnimating = false;

/**
 * GLSL shader with per-fragment geoid lookup.
 *
 * Computes lon/lat from the fragment's world-space position, samples the
 * EGM96 geoid texture, decodes the 2-channel 16-bit value to get local
 * geoid undulation, and compares terrain height against the flood surface.
 */
const FLOOD_SHADER_GEOID = `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    material.alpha = 0.0;

    // Skip ocean fragments — only flood land
    if (materialInput.waterMask > 0.5) {
      return material;
    }

    float h = materialInput.height;

    // Fragment position in world coordinates (ECEF)
    // positionToEyeEC points FROM fragment TO eye, so negate to get fragment position in eye coords
    vec3 posWC = (czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0)).xyz;

    // ECEF to geodetic lon/lat
    float lon = atan(posWC.y, posWC.x);                    // radians, -pi..+pi
    float lat = atan(posWC.z, length(posWC.xy));            // radians, -pi/2..+pi/2

    // Convert to UV for texture sampling
    // U: -180°..+180° maps to 0..1
    // V: Cesium's flipY=true means v=0 is canvas bottom (90°S), v=1 is canvas top (90°N)
    //    So: lat=+90° → v=1, lat=-90° → v=0
    float u = lon / (2.0 * czm_pi) + 0.5;
    float v = lat / czm_pi + 0.5;

    // Sample geoid texture and decode 2-channel 16-bit value
    vec4 geoidSample = texture(geoidTexture, vec2(u, v));
    float encoded = geoidSample.r * (255.0 * 256.0 / 65535.0) + geoidSample.g * (255.0 / 65535.0);
    float geoidUndulation = encoded * geoidRange + geoidMin;

    // Current flood: land terrain below (geoid + SLR) is underwater
    float floodSurface = geoidUndulation + seaLevelRise;
    if (seaLevelRise > 0.0 && h < floodSurface) {
      // Amber/orange color — visible against the blue ocean
      material.diffuse = vec3(1.0, 0.65, 0.0);
      material.alpha = waterAlpha;
    }

    // Comparison overlay: highlight delta between current and previous SLR
    if (comparisonSLR > 0.0) {
      float compSurface = geoidUndulation + comparisonSLR;
      float lower = min(floodSurface, compSurface);
      float upper = max(floodSurface, compSurface);
      if (h >= lower && h < upper) {
        material.diffuse = vec3(1.0, 0.3, 0.1);
        material.alpha = 0.5;
      }
    }

    return material;
  }
`;

/**
 * Fallback GLSL shader without geoid texture (original behavior).
 */
const FLOOD_SHADER_FALLBACK = `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    material.alpha = 0.0;

    // Skip ocean fragments — only flood land
    if (materialInput.waterMask > 0.5) {
      return material;
    }

    float h = materialInput.height;

    if (floodLevel != 0.0 && h < floodLevel) {
      material.diffuse = vec3(1.0, 0.65, 0.0);
      material.alpha = waterAlpha;
    }

    if (comparisonLevel != 0.0) {
      float lower = min(floodLevel, comparisonLevel);
      float upper = max(floodLevel, comparisonLevel);
      if (h >= lower && h < upper) {
        material.diffuse = vec3(1.0, 0.3, 0.1);
        material.alpha = 0.5;
      }
    }

    return material;
  }
`;

let useGeoidTexture = false;

/**
 * Initialize flood visualization on the viewer.
 * @param {object} viewer - Cesium Viewer
 * @param {HTMLCanvasElement|null} geoidCanvas - EGM96 geoid texture canvas, or null for fallback
 */
export function initFloodVisualization(viewer, geoidCanvas) {
  viewer.scene.globe.depthTestAgainstTerrain = true;

  useGeoidTexture = geoidCanvas != null;

  if (useGeoidTexture) {
    floodMaterial = new Material({
      fabric: {
        type: "FloodGeoid",
        uniforms: {
          seaLevelRise: 0.0,
          comparisonSLR: 0.0,
          waterAlpha: 0.0,
          geoidTexture: geoidCanvas,
          geoidMin: GEOID_MIN,
          geoidRange: GEOID_RANGE,
        },
        source: FLOOD_SHADER_GEOID,
      },
    });
  } else {
    console.warn("Geoid texture not available, using fallback single-offset shader");
    floodMaterial = new Material({
      fabric: {
        type: "FloodFallback",
        uniforms: {
          floodLevel: 0.0,
          waterAlpha: 0.0,
          comparisonLevel: 0.0,
        },
        source: FLOOD_SHADER_FALLBACK,
      },
    });
  }

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
 * @param {number} seaLevelRise - Sea level rise in meters above MSL
 * @param {object} simulationResult - Full simulation result for snapshot
 * @param {boolean} recordSnapshot - Whether to store this state for comparison history
 */
export function setFloodLevel(viewer, seaLevelRise, simulationResult, recordSnapshot = true) {
  if (recordSnapshot) {
    // Save previous snapshot
    if (currentSnapshot) {
      previousSnapshot = { ...currentSnapshot };
    }

    currentSnapshot = {
      seaLevelRise,
      simulationResult,
      timestamp: Date.now(),
    };
  }

  if (seaLevelRise <= 0) {
    clearFlood(viewer);
    return;
  }

  if (useGeoidTexture) {
    floodMaterial.uniforms.seaLevelRise = seaLevelRise;
    floodMaterial.uniforms.comparisonSLR = 0.0;
  } else {
    // Fallback: use raw SLR as floodLevel (no geoid correction)
    floodMaterial.uniforms.floodLevel = seaLevelRise;
    floodMaterial.uniforms.comparisonLevel = 0.0;
  }

  viewer.scene.globe.material = floodMaterial;

  // Animate alpha fade-in
  waterAlpha = 0;
  floodMaterial.uniforms.waterAlpha = 0;
  targetAlpha = 0.55;
  alphaAnimating = true;
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
    if (useGeoidTexture) {
      floodMaterial.uniforms.comparisonSLR = 0.0;
    } else {
      floodMaterial.uniforms.comparisonLevel = 0.0;
    }
  }
}

/**
 * Show comparison with previous snapshot.
 */
export function showComparison(viewer) {
  if (!previousSnapshot || !currentSnapshot || !floodMaterial) return false;

  if (useGeoidTexture) {
    floodMaterial.uniforms.comparisonSLR = previousSnapshot.seaLevelRise;
  } else {
    floodMaterial.uniforms.comparisonLevel = previousSnapshot.seaLevelRise;
  }

  viewer.scene.requestRender();
  return true;
}

/**
 * Hide comparison overlay.
 */
export function hideComparison(viewer) {
  if (floodMaterial) {
    if (useGeoidTexture) {
      floodMaterial.uniforms.comparisonSLR = 0.0;
    } else {
      floodMaterial.uniforms.comparisonLevel = 0.0;
    }
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
