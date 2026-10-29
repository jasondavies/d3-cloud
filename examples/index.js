import { createRandom, placeAll, drawText } from "./shared.js";
import CloudLayout from "../build/d3-cloud.js";

const width = 720;
const height = 480;
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
let renderSeed = 0x243f6a88;

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", render);
render();

function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const sizeRandom = createRandom(renderSeed ^ 0x9e3779b9);
  const rotateRandom = createRandom(renderSeed ^ 0x85ebca6b);
  const layoutRandom = createRandom(renderSeed);

  status.textContent = "Placing words...";
  displaySvg.replaceChildren();

  const layout = new CloudLayout()
    .size([width, height])
    .random(layoutRandom);

  const sprites = createSprites(layout, createWords(sizeRandom), rotateRandom);
  const placedWords = placeAll(layout, sprites);
  draw(placedWords, layout.bounds());
}

function createWords(random) {
  return wordBank
    .map(text => ({
      text,
      size: 18 + Math.floor(random() * 72)
    }))
    .sort((a, b) => b.size - a.size);
}

function createSprites(layout, words, rotateRandom) {
  return words
    .map(word => layout.getSprite(word.text, {
      size: word.size,
      datum: word,
      font: "Impact",
      padding: 0,
      rotate: rotateRandom() < 0.18 ? 90 : 0
    }))
    .filter(Boolean);
}

function draw(words, bounds) {
  const extent = drawText(displaySvg, words, { bounds, size: [width, height], color: pickColor });
  status.textContent = `Placed ${words.length} words · extent ${Math.round(extent.width)} × ${Math.round(extent.height)}`;
}

function pickColor(word) {
  const palette = ["#111111", "#8c2f39", "#1d4e89", "#8f5b00", "#2f6b3b"];
  return palette[word.text.length % palette.length];
}
