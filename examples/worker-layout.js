import { createRandom, placeAll } from "./shared.js";
import CloudLayout from "../build/d3-cloud.js";

const wordQualifiers = [
  "Worker", "Thread", "Canvas", "Module", "Signal", "Orbit", "Render",
  "Bitmap", "Archive", "Vector", "Spiral", "Cluster", "Pixel", "Kernel",
  "Stream", "Layout", "Glyph", "Current", "Contour", "Ribbon"
];
const wordSubjects = [
  "Cloud", "Sprite", "Worker", "Layout", "Bundle",
  "Browser", "Surface", "Signal", "Field", "Module"
];

self.addEventListener("message", event => {
  const message = event.data;
  if (!message || message.type !== "render") {
    return;
  }

  try {
    if (typeof OffscreenCanvas !== "function") {
      throw new Error("This browser does not support OffscreenCanvas in workers.");
    }

    const startedAt = performance.now();
    const random = createRandom(message.seed);
    const sizeRandom = createRandom(message.seed ^ 0x9e3779b9);
    const rotateRandom = createRandom(message.seed ^ 0x85ebca6b);
    const layout = new CloudLayout()
      .size([message.width, message.height])
      .random(random)
      .canvas(() => new OffscreenCanvas(1, 1));

    const placedSprites = placeAll(layout, createSprites(layout, createWords(sizeRandom), rotateRandom));

    self.postMessage({
      type: "result",
      requestId: message.requestId,
      placedSprites,
      bounds: layout.bounds(),
      elapsedMs: performance.now() - startedAt
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

function createWords(random) {
  return wordQualifiers
    .flatMap(qualifier => wordSubjects.map(subject => `${qualifier} ${subject}`))
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
