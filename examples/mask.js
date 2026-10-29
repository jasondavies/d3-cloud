import { createRandom, placeAll, drawText } from "./shared.js";
import CloudLayout from "../build/d3-cloud.js";

const width = 1024;
const height = 1024;
const HEART_PATH = "M512 903C475 873 350 759 232 640C140 548 90 470 90 384C90 256 184 162 313 162C394 162 466 204 512 276C558 204 630 162 711 162C840 162 934 256 934 384C934 470 884 548 792 640C674 759 549 873 512 903Z";
const INVERTED_HEART_PATH = `M0 0H${width}V${height}H0Z ${HEART_PATH}`;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const rerender = document.querySelector("[data-rerender]");
const wordQualifiers = [
  "Aurora", "Signal", "Canvas", "Vector", "Pixel", "Archive", "Render",
  "Orbit", "Ribbon", "Current", "Spiral", "Impact", "Glyph", "Scale",
  "Kernel", "Drift", "Contour", "Static", "Tangent", "Density"
];
const wordSubjects = [
  "Cloud", "Layout", "Bitmap", "Browser", "Module",
  "Library", "Bundle", "Sprite", "Field", "Weight"
];
const wordBank = wordQualifiers.flatMap(qualifier =>
  wordSubjects.map(subject => `${qualifier} ${subject}`)
);
let renderSeed = 0x51a6d97b;

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", () => {
  void render();
});

void render();

async function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const sizeRandom = createRandom(renderSeed ^ 0x9e3779b9);
  const rotateRandom = createRandom(renderSeed ^ 0x85ebca6b);
  const layoutRandom = createRandom(renderSeed);

  status.textContent = "Loading mask...";
  displaySvg.replaceChildren();

  try {
    const maskImage = await loadMaskImage();
    const layout = new CloudLayout()
      .size([width, height])
      .overflow(false)
      .random(layoutRandom);

    placeMask(layout, maskImage);
    const sprites = createSprites(layout, createWords(sizeRandom), rotateRandom);
    const placedWords = placeAll(layout, sprites);
    draw(placedWords, layout.bounds());
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function placeMask(layout, maskImage) {
  const maskSprite = layout.getSprite(maskImage, {
    width,
    height
  });

  if (!maskSprite) {
    throw new Error("Mask image could not be rasterized.");
  }

  if (!layout.place(maskSprite, { x: 0, y: 0 })) {
    throw new Error("Mask image could not be placed.");
  }
}

function createWords(random) {
  return wordBank
    .map(text => ({
      text,
      size: 1 + Math.floor(random() * 72)
    }))
    .sort((a, b) => b.size - a.size);
}

function createSprites(layout, words, rotateRandom) {
  return words
    .map(word => layout.getSprite(word.text, {
      size: word.size,
      datum: word,
      font: "Impact",
      padding: 2,
      rotate: rotateRandom() < 0.18 ? 90 : 0
    }))
    .filter(Boolean);
}

function draw(words, bounds) {
  const extent = drawText(displaySvg, words, { bounds, size: [width, height], color: pickColor });
  status.textContent = `Placed ${words.length} words around the mask · extent ${Math.round(extent.width)} × ${Math.round(extent.height)}`;
}

function loadMaskImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG mask."));
    image.src = createMaskDataUrl();
  });
}

function createMaskDataUrl() {
  const markup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="${INVERTED_HEART_PATH}" fill="#000000" fill-rule="evenodd" />
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function pickColor(word) {
  const palette = ["#111111", "#8c2f39", "#1d4e89", "#8f5b00", "#2f6b3b"];
  return palette[word.text.length % palette.length];
}
