/**
 * Onboarding overlay — introductory walkthrough shown before the user
 * interacts with the simulator. Covers core concepts in 4 slides.
 */

const SLIDES = [
  {
    title: "Rising Seas, Changing Coastlines",
    body: `
      <p>Global sea levels have risen about <strong>20 cm</strong> since 1900, and the rate is accelerating.
      Ice sheets in Greenland and Antarctica are melting faster each decade, thermal expansion of warming
      oceans adds volume, and mountain glaciers are retreating worldwide.</p>
      <p>By 2100, seas could rise anywhere from <strong>0.3 m to over 2 m</strong> depending on how much
      the planet warms — reshaping coastlines, displacing hundreds of millions of people, and threatening
      critical infrastructure.</p>
      <p class="slide-highlight">This simulator lets you explore what different warming scenarios mean
      for sea levels around the world.</p>
    `,
    icon: "🌊",
  },
  {
    title: "Monte Carlo Simulation",
    body: `
      <p>Rather than producing a single estimate, this tool runs <strong>1,000 Monte Carlo iterations</strong>
      for each temperature scenario. Each iteration randomly samples from scientific uncertainty ranges
      for five contributors to sea level rise:</p>
      <ul>
        <li><strong>Thermal expansion</strong> — oceans absorb heat and expand</li>
        <li><strong>Mountain glaciers</strong> — ice loss from glaciers worldwide</li>
        <li><strong>Greenland ice sheet</strong> — accelerating melt, non-linear at higher temps</li>
        <li><strong>Antarctic ice sheet</strong> — highest uncertainty, potential for rapid collapse</li>
        <li><strong>Land water storage</strong> — groundwater extraction, reservoir changes</li>
      </ul>
      <p>The result is a <strong>probability distribution</strong> — not one number, but a range showing
      how likely different outcomes are:</p>
      <canvas id="onboardingChart" width="360" height="120"></canvas>
      <p class="slide-caption">Example distribution for +2°C warming. The median, 5th and 95th percentiles
      give a confidence range.</p>
    `,
    icon: "🎲",
    onShow: drawMiniDistribution,
  },
  {
    title: "Visualizing the Impact",
    body: `
      <p>The simulation's median sea level rise is applied to a <strong>3D globe</strong> using real-world
      terrain elevation data from Cesium World Terrain.</p>
      <p>A custom shader colors every terrain fragment whose elevation falls below the projected flood
      height. The result: you can see exactly which coastal areas, cities, and islands would be affected.</p>
      <div class="slide-features">
        <div class="slide-feature">
          <span class="feature-icon">🌡️</span>
          <span>Choose a warming scenario (+1°C to +5°C) or fine-tune with ±0.05°C steps</span>
        </div>
        <div class="slide-feature">
          <span class="feature-icon">📍</span>
          <span>Fly to vulnerable locations — Bangladesh, Maldives, Netherlands, and more</span>
        </div>
        <div class="slide-feature">
          <span class="feature-icon">🔄</span>
          <span>Compare scenarios side-by-side to see how each degree matters</span>
        </div>
      </div>
      <p class="slide-highlight">Heights are corrected for the local geoid so flooding is regionally accurate.</p>
    `,
    icon: "🗺️",
  },
  {
    title: "Ready to Explore",
    body: `
      <p>Use the controls on the left to pick a temperature increase and run the simulation. Results
      appear instantly — including statistics, contributor breakdowns, and a histogram of outcomes.</p>
      <p>Fly to specific coastal cities on the right panel to see local impacts up close. Zoom, pan,
      and tilt the globe to explore freely.</p>
      <div class="slide-steps">
        <div class="slide-step"><span class="step-num">1</span> Pick a temperature increase</div>
        <div class="slide-step"><span class="step-num">2</span> View the flood overlay on the globe</div>
        <div class="slide-step"><span class="step-num">3</span> Fly to vulnerable locations</div>
        <div class="slide-step"><span class="step-num">4</span> Compare different scenarios</div>
      </div>
    `,
    icon: "🚀",
  },
];

let currentSlide = 0;
let overlayEl = null;

/**
 * Show the onboarding overlay. Returns a Promise that resolves when the user dismisses it.
 */
export function showOnboarding() {
  return new Promise((resolve) => {
    // Hide control panels during onboarding
    document.getElementById("controlPanel").style.display = "none";
    document.getElementById("locationsPanel").style.display = "none";
    document.getElementById("infoOverlay").style.display = "none";

    overlayEl = document.createElement("div");
    overlayEl.id = "onboardingOverlay";
    overlayEl.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-content" id="onboardingContent"></div>
        <div class="onboarding-footer">
          <div class="onboarding-dots" id="onboardingDots"></div>
          <div class="onboarding-nav">
            <button id="onboardingPrev" class="onboarding-btn">Previous</button>
            <button id="onboardingNext" class="onboarding-btn primary">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    // Build dots
    const dotsEl = document.getElementById("onboardingDots");
    for (let i = 0; i < SLIDES.length; i++) {
      const dot = document.createElement("span");
      dot.className = "onboarding-dot";
      dot.addEventListener("click", () => goToSlide(i));
      dotsEl.appendChild(dot);
    }

    document.getElementById("onboardingPrev").addEventListener("click", () => {
      if (currentSlide > 0) goToSlide(currentSlide - 1);
    });

    document.getElementById("onboardingNext").addEventListener("click", () => {
      if (currentSlide < SLIDES.length - 1) {
        goToSlide(currentSlide + 1);
      } else {
        dismiss(resolve);
      }
    });

    currentSlide = 0;
    goToSlide(0);

    // Fade in
    requestAnimationFrame(() => {
      overlayEl.classList.add("visible");
    });
  });
}

function goToSlide(index) {
  currentSlide = index;
  const slide = SLIDES[index];

  const contentEl = document.getElementById("onboardingContent");
  contentEl.innerHTML = `
    <div class="slide-icon">${slide.icon}</div>
    <h2 class="slide-title">${slide.title}</h2>
    <div class="slide-body">${slide.body}</div>
  `;

  // Update dots
  document.querySelectorAll(".onboarding-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });

  // Update buttons
  const prevBtn = document.getElementById("onboardingPrev");
  const nextBtn = document.getElementById("onboardingNext");
  prevBtn.style.visibility = index === 0 ? "hidden" : "visible";
  nextBtn.textContent = index === SLIDES.length - 1 ? "Get Started" : "Next";

  // Run slide-specific callback (e.g. draw chart)
  if (slide.onShow) {
    requestAnimationFrame(() => slide.onShow());
  }
}

function dismiss(resolve) {
  overlayEl.classList.remove("visible");
  setTimeout(() => {
    overlayEl.remove();
    overlayEl = null;

    // Show panels
    document.getElementById("controlPanel").style.display = "";
    document.getElementById("locationsPanel").style.display = "";
    document.getElementById("infoOverlay").style.display = "";

    resolve();
  }, 300);
}

/**
 * Draw a small bell-curve distribution on the onboarding canvas.
 */
function drawMiniDistribution() {
  const canvas = document.getElementById("onboardingChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);

  // Generate a skewed normal-ish distribution (representative of SLR output)
  const mean = 0.6;
  const std = 0.18;
  const skew = 0.4;
  const bins = 40;
  const binW = W / bins;

  // Compute density values
  const values = [];
  let maxVal = 0;
  for (let i = 0; i < bins; i++) {
    const x = 0.15 + (i / bins) * 1.2;
    const z = (x - mean) / std;
    // Skew-normal approximation
    let density = Math.exp(-0.5 * z * z) * (1 + erf(skew * z / Math.SQRT2));
    values.push({ x, density });
    if (density > maxVal) maxVal = density;
  }

  // Normalize
  values.forEach((v) => (v.density /= maxVal));

  // Color gradient
  const p5x = W * 0.18;
  const p95x = W * 0.78;
  const medianX = W * 0.46;

  // Draw bars
  for (let i = 0; i < bins; i++) {
    const barH = values[i].density * (H - 30);
    const bx = i * binW;

    // Color based on severity
    const t = i / bins;
    if (t < 0.3) ctx.fillStyle = "rgba(52, 152, 219, 0.7)";
    else if (t < 0.55) ctx.fillStyle = "rgba(241, 196, 15, 0.7)";
    else if (t < 0.75) ctx.fillStyle = "rgba(230, 126, 34, 0.7)";
    else ctx.fillStyle = "rgba(231, 76, 60, 0.7)";

    ctx.fillRect(bx + 1, H - 16 - barH, binW - 2, barH);
  }

  // Annotation lines
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;

  // P5
  ctx.beginPath();
  ctx.moveTo(p5x, 4);
  ctx.lineTo(p5x, H - 16);
  ctx.stroke();

  // Median
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(medianX, 4);
  ctx.lineTo(medianX, H - 16);
  ctx.stroke();

  // P95
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p95x, 4);
  ctx.lineTo(p95x, H - 16);
  ctx.stroke();

  // Labels
  ctx.setLineDash([]);
  ctx.fillStyle = "#aaa";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("5th %ile", p5x, H - 2);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillText("Median", medianX, H - 2);
  ctx.fillStyle = "#aaa";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.fillText("95th %ile", p95x, H - 2);

  // X-axis label
  ctx.fillStyle = "#666";
  ctx.font = "9px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Sea Level Rise (cm) →", 4, H - 2);
}

/** Approximate error function for skew-normal distribution. */
function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
