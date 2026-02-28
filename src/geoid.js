/**
 * EGM96 Geoid Model Loader
 *
 * Loads the EGM96 15-minute geoid undulation grid (WW15MGH.DAC) and encodes
 * it into a canvas texture for GPU sampling. The texture uses 2-channel
 * encoding (R=high byte, G=low byte) to represent undulation values with
 * ~3mm precision over the -107m to +86m range.
 *
 * Grid format: 721 rows × 1440 cols, signed 16-bit big-endian integers
 * in centimeters. Rows go from 90°N to 90°S, columns from 0°E to 359.75°E.
 */

const ROWS = 721;
const COLS = 1440;

// Geoid undulation range (meters)
export const GEOID_MIN = -107.0;
export const GEOID_MAX = 86.0;
export const GEOID_RANGE = GEOID_MAX - GEOID_MIN; // 193.0

/**
 * Load the EGM96 geoid data and encode it into a canvas for use as a GPU texture.
 *
 * The output canvas is (COLS+1) × ROWS pixels. The extra column duplicates
 * the first column so that CLAMP_TO_EDGE sampling works across the antimeridian.
 *
 * Columns are rearranged from 0°E..359.75°E to -180°..+179.75°E (shift by 720 cols).
 *
 * @returns {HTMLCanvasElement|null} Canvas element, or null on failure
 */
export async function loadGeoidTexture() {
  try {
    const response = await fetch("/data/WW15MGH.DAC");
    if (!response.ok) {
      console.error(`Failed to fetch EGM96 data: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== ROWS * COLS * 2) {
      console.error(`EGM96 data wrong size: expected ${ROWS * COLS * 2}, got ${buffer.byteLength}`);
      return null;
    }

    const view = new DataView(buffer);

    // Parse Int16 big-endian values (centimeters) and rearrange columns
    // Original: cols 0..1439 = 0°E..359.75°E
    // Target:   cols 0..1439 = -180°..+179.75°E (shift by 720)
    const width = COLS + 1; // extra column for antimeridian wrapping
    const height = ROWS;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Rearrange: source col for target col is (col + 720) % 1440
        const srcCol = (col + 720) % COLS;
        const byteOffset = (row * COLS + srcCol) * 2;
        const valueCm = view.getInt16(byteOffset, false); // big-endian
        const valueM = valueCm / 100.0;

        // Normalize to 0..1 range using known min/max
        const normalized = (valueM - GEOID_MIN) / GEOID_RANGE;
        const clamped = Math.max(0, Math.min(1, normalized));

        // Encode as 16-bit across R and G channels
        const encoded = Math.round(clamped * 65535);
        const hi = (encoded >> 8) & 0xff;
        const lo = encoded & 0xff;

        const pixelIdx = (row * width + col) * 4;
        pixels[pixelIdx] = hi;     // R = high byte
        pixels[pixelIdx + 1] = lo; // G = low byte
        pixels[pixelIdx + 2] = 0;  // B unused
        pixels[pixelIdx + 3] = 255; // A = opaque
      }

      // Extra column: duplicate first column for antimeridian wrapping
      const srcPixel = (row * width + 0) * 4;
      const dstPixel = (row * width + COLS) * 4;
      pixels[dstPixel] = pixels[srcPixel];
      pixels[dstPixel + 1] = pixels[srcPixel + 1];
      pixels[dstPixel + 2] = pixels[srcPixel + 2];
      pixels[dstPixel + 3] = pixels[srcPixel + 3];
    }

    ctx.putImageData(imageData, 0, 0);
    console.log("EGM96 geoid texture loaded successfully");
    return canvas;
  } catch (err) {
    console.error("Failed to load EGM96 geoid data:", err);
    return null;
  }
}
