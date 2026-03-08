import cloud from "../build/d3-cloud.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const width = 720;
const height = 480;
const displaySvg = document.querySelector("[data-cloud]");
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

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", render);
render();

function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const sizeRandom = createRandom(renderSeed ^ 0x9e3779b9);
  const layoutRandom = createRandom(renderSeed);

  status.textContent = "Placing words...";
  displaySvg.replaceChildren();

  if (currentLayout) {
    currentLayout.stop();
  }

  const layout = cloud()
    .aspectRatio(width / height)
    .startBox([width, height])
    .words(createWords(sizeRandom))
    .padding(0)
    .rotate(() => (layoutRandom() < 0.18 ? 90 : 0))
    .font("Impact")
    .fontSize(d => d.size)
    .random(layoutRandom)
    .on("end", (words, bounds) => {
      if (layout !== currentLayout) {
        return;
      }
      draw(words, bounds || measureBounds(words));
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

function draw(words, bounds) {
  const extent = bounds || measureBounds(words);
  const padding = 28;
  const extentWidth = Math.max(1, extent[1].x - extent[0].x);
  const extentHeight = Math.max(1, extent[1].y - extent[0].y);
  const viewBoxX = extent[0].x - padding;
  const viewBoxY = extent[0].y - padding;
  const viewBoxWidth = extentWidth + padding * 2;
  const viewBoxHeight = extentHeight + padding * 2;
  const fragment = document.createDocumentFragment();

  for (const word of words) {
    const textNode = document.createElementNS(SVG_NS, "text");
    textNode.setAttribute("transform", `translate(${word.x} ${word.y}) rotate(${word.rotate})`);
    textNode.setAttribute("text-anchor", "middle");
    textNode.setAttribute("font-family", word.font);
    textNode.setAttribute("font-size", `${word.size + 1}px`);
    textNode.setAttribute("font-style", word.style);
    textNode.setAttribute("font-weight", word.weight);
    textNode.setAttribute("fill", pickColor(word));
    textNode.textContent = word.text;
    fragment.append(textNode);
  }

  displaySvg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
  displaySvg.replaceChildren(fragment);
  status.textContent = `Placed ${words.length} words · extent ${Math.round(extentWidth)} × ${Math.round(extentHeight)}`;
}

function pickColor(word) {
  const palette = ["#111111", "#8c2f39", "#1d4e89", "#8f5b00", "#2f6b3b"];
  return palette[word.text.length % palette.length];
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

function measureBounds(words) {
  if (!words.length) {
    return [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (const word of words) {
    if (word.x + word.x0 < x0) x0 = word.x + word.x0;
    if (word.y + word.y0 < y0) y0 = word.y + word.y0;
    if (word.x + word.x1 > x1) x1 = word.x + word.x1;
    if (word.y + word.y1 > y1) y1 = word.y + word.y1;
  }

  return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
}
