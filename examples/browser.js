import cloud from "../build/d3-cloud.js";

const width = 720;
const height = 480;
const displayCanvas = document.querySelector("[data-cloud]");
const displayContext = displayCanvas.getContext("2d");
const status = document.querySelector("[data-status]");
const rerender = document.querySelector("[data-rerender]");
const wordBank = [
  "Aurora", "Signal", "Canvas", "Layout", "Cloud", "Vector", "Pixel",
  "Bitmap", "Archive", "Render", "Orbit", "Quiet", "Ribbon", "Current",
  "Library", "Spiral", "Dispatch", "Impact", "Glyph", "Scale", "Kernel",
  "Drift", "Tangent", "Contour", "Static", "Bundle", "Rotate", "Margin",
  "Center", "Browser", "Module", "Density", "Sprite", "Field", "Weight"
];
let currentLayout = null;
let renderSeed = 0x243f6a88;

configureDisplayCanvas();
rerender.addEventListener("click", render);
window.addEventListener("resize", configureDisplayCanvas);
render();

function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const sizeRandom = createRandom(renderSeed ^ 0x9e3779b9);
  const layoutRandom = createRandom(renderSeed);

  status.textContent = "Placing words...";
  clearDisplay();

  if (currentLayout) {
    currentLayout.stop();
  }

  const layout = cloud()
    .size([width, height])
    .words(createWords(sizeRandom))
    .padding(0)
    .rotate(() => (layoutRandom() < 0.18 ? 90 : 0))
    .font("Impact")
    .fontSize(d => d.size)
    .random(layoutRandom)
    .on("end", words => {
      if (layout !== currentLayout) {
        return;
      }
      draw(words);
    });

  currentLayout = layout;
  layout.start();
}

function createWords(random) {
  return wordBank.map(text => ({
    text,
    size: 18 + Math.floor(random() * 72)
  }));
}

function draw(words) {
  clearDisplay();
  displayContext.save();
  displayContext.translate(width / 2, height / 2);
  displayContext.textAlign = "center";
  displayContext.textBaseline = "alphabetic";
  for (const word of words) {
    displayContext.save();
    displayContext.translate(word.x, word.y);
    displayContext.rotate((word.rotate * Math.PI) / 180);
    displayContext.font = formatWordFont(word);
    displayContext.fillStyle = pickColor(word);
    displayContext.fillText(word.text, 0, 0);
    displayContext.restore();
  }
  displayContext.restore();
  status.textContent = `Placed ${words.length} words`;
}

function pickColor(word) {
  const palette = ["#111111", "#8c2f39", "#1d4e89", "#8f5b00", "#2f6b3b"];
  return palette[word.text.length % palette.length];
}

function configureDisplayCanvas() {
  const dpr = window.devicePixelRatio || 1;
  displayCanvas.width = Math.round(width * dpr);
  displayCanvas.height = Math.round(height * dpr);
  displayCanvas.style.aspectRatio = `${width} / ${height}`;
  displayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearDisplay() {
  displayContext.save();
  displayContext.setTransform(1, 0, 0, 1, 0, 0);
  displayContext.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
  displayContext.restore();
}

function createRandom(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatWordFont(word) {
  return `${word.style} ${word.weight} ${word.size + 1}px ${word.font}`;
}
