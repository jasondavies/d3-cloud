import CloudLayout from "../build/d3-cloud.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const width = 720;
const height = 480;
const fontFamily = "Bungee";
const fontSpec = `72px "${fontFamily}"`;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const rerender = document.querySelector("[data-rerender]");
const wordQualifiers = [
  "Loaded", "Custom", "Font", "Canvas", "Vector", "Signal", "Layout",
  "Impact", "Glyph", "Module", "Browser", "Kernel", "Pixel", "Stream",
  "Contour", "Weight", "Orbit", "Current", "Bundle", "Render"
];
const wordSubjects = [
  "Cloud", "Sprite", "Thread", "Surface", "Field",
  "Cluster", "Module", "Bitmap", "Library", "Canvas"
];
let renderSeed = 0x9e3779b9;

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", () => {
  void render();
});
void render();

async function render() {
  rerender.disabled = true;
  status.textContent = `Waiting for ${fontFamily} to load...`;
  displaySvg.replaceChildren();

  try {
    await waitForFont(fontSpec);
  } catch (error) {
    rerender.disabled = false;
    status.textContent = error instanceof Error ? error.message : String(error);
    return;
  }

  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const sizeRandom = createRandom(renderSeed ^ 0x85ebca6b);
  const rotateRandom = createRandom(renderSeed ^ 0xc2b2ae35);
  const layoutRandom = createRandom(renderSeed);
  const layout = new CloudLayout()
    .size([width, height])
    .random(layoutRandom);

  const placedSprites = [];
  for (const sprite of createSprites(layout, createWords(sizeRandom), rotateRandom)) {
    const placed = layout.place(sprite);
    if (placed) {
      placedSprites.push(placed);
    }
  }

  draw(placedSprites, layout.bounds());
  status.textContent = `Placed ${placedSprites.length} sprites after ${fontFamily} finished loading`;
  rerender.disabled = false;
}

async function waitForFont(font) {
  if (!document.fonts) {
    throw new Error("This browser does not expose document.fonts.");
  }

  await document.fonts.load(font);
  await document.fonts.ready;

  if (!document.fonts.check(font)) {
    throw new Error(`The ${fontFamily} font did not finish loading.`);
  }
}

function createWords(random) {
  return wordQualifiers
    .flatMap(qualifier => wordSubjects.map(subject => `${qualifier} ${subject}`))
    .map(text => ({
      text,
      size: 18 + Math.floor(random() * 68)
    }))
    .sort((a, b) => b.size - a.size);
}

function createSprites(layout, words, rotateRandom) {
  return words
    .map(word => layout.getSprite(word.text, {
      ...word,
      font: fontFamily,
      padding: 1,
      rotate: rotateRandom() < 0.16 ? 90 : 0
    }))
    .filter(Boolean);
}

function draw(sprites, bounds) {
  const extent = bounds || measureBounds(sprites);
  const padding = 28;
  const extentWidth = Math.max(1, extent[1].x - extent[0].x);
  const extentHeight = Math.max(1, extent[1].y - extent[0].y);
  const fragment = document.createDocumentFragment();

  for (const sprite of sprites) {
    const textNode = document.createElementNS(SVG_NS, "text");
    textNode.setAttribute("transform", `translate(${sprite.x} ${sprite.y}) rotate(${sprite.rotate})`);
    textNode.setAttribute("text-anchor", "middle");
    textNode.setAttribute("dominant-baseline", "middle");
    textNode.setAttribute("font-family", sprite.font);
    textNode.setAttribute("font-size", `${sprite.size + 1}px`);
    textNode.setAttribute("font-style", sprite.style);
    textNode.setAttribute("font-weight", sprite.weight);
    textNode.setAttribute("fill", pickColor(sprite));
    textNode.textContent = sprite.text;
    fragment.append(textNode);
  }

  displaySvg.setAttribute(
    "viewBox",
    `${extent[0].x - padding} ${extent[0].y - padding} ${extentWidth + padding * 2} ${extentHeight + padding * 2}`
  );
  displaySvg.replaceChildren(fragment);
}

function pickColor(sprite) {
  const palette = ["#111111", "#8f5b00", "#1d4e89", "#8c2f39", "#2f6b3b"];
  return palette[sprite.text.length % palette.length];
}

function measureBounds(sprites) {
  if (!sprites.length) {
    return [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 }
    ];
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (const sprite of sprites) {
    x0 = Math.min(x0, sprite.x + sprite.x0);
    y0 = Math.min(y0, sprite.y + sprite.y0);
    x1 = Math.max(x1, sprite.x + sprite.x1);
    y1 = Math.max(y1, sprite.y + sprite.y1);
  }

  return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
}

function createRandom(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
