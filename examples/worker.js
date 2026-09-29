import { drawText } from "./shared.js";
const width = 720;
const height = 480;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const rerender = document.querySelector("[data-rerender]");
let requestId = 0;
let renderSeed = 0x243f6a88;
let worker = null;

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", render);
render();

function render() {
  if (typeof Worker !== "function") {
    status.textContent = "This browser does not support web workers.";
    rerender.disabled = true;
    return;
  }
  if (typeof OffscreenCanvas !== "function") {
    status.textContent = "This browser does not support OffscreenCanvas in workers.";
    rerender.disabled = true;
    return;
  }

  if (!worker) {
    worker = new Worker(new URL("./worker-layout.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", onWorkerMessage);
    worker.addEventListener("error", onWorkerError);
  }

  requestId += 1;
  rerender.disabled = true;
  status.textContent = "Placing sprites in the worker...";
  displaySvg.replaceChildren();
  worker.postMessage({ type: "render", requestId, width, height, seed: nextSeed() });
}

function onWorkerMessage(event) {
  const message = event.data;
  if (!message || message.requestId !== requestId) {
    return;
  }

  rerender.disabled = false;

  if (message.type === "error") {
    status.textContent = message.error;
    return;
  }

  draw(message.placedSprites, message.bounds);
  status.textContent =
    `Placed ${message.placedSprites.length} sprites in ${Math.round(message.elapsedMs)} ms on the worker`;
}

function onWorkerError() {
  rerender.disabled = false;
  status.textContent = "The worker failed while building the layout.";
}

function draw(sprites, bounds) {
  drawText(displaySvg, sprites, { bounds, size: [width, height], color: pickColor });
}

function pickColor(sprite) {
  const palette = ["#111111", "#1d4e89", "#8c2f39", "#2f6b3b", "#8f5b00"];
  return palette[sprite.text.length % palette.length];
}

function nextSeed() {
  renderSeed = (renderSeed + 0x9e3779b9) >>> 0;
  return renderSeed;
}
