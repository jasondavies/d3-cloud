import { createRandom, drawText, placeAll } from "./shared.js";
import CloudLayout from "../build/d3-cloud.js";

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

  const placedSprites = placeAll(layout, createSprites(layout, createWords(sizeRandom), rotateRandom));

  draw(placedSprites, layout.bounds());
  status.textContent = `Placed ${placedSprites.length} sprites after ${fontFamily} finished loading`;
  rerender.disabled = false;
}

async function waitForFont(font) {
  if (!document.fonts) {
    throw new Error("This browser does not expose document.fonts.");
  }

  const faces = await document.fonts.load(font);
  await document.fonts.ready;

  if (!faces.length || faces.some(face => face.status !== "loaded")) {
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
  drawText(displaySvg, sprites, { bounds, size: [width, height], color: pickColor });
}

function pickColor(sprite) {
  const palette = ["#111111", "#8f5b00", "#1d4e89", "#8c2f39", "#2f6b3b"];
  return palette[sprite.text.length % palette.length];
}
