const SVG_NS = "http://www.w3.org/2000/svg";
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
  const extent = bounds || measureBounds(sprites);
  const padding = 28;
  const extentWidth = Math.max(1, extent[1].x - extent[0].x);
  const extentHeight = Math.max(1, extent[1].y - extent[0].y);
  const viewBoxX = extent[0].x - padding;
  const viewBoxY = extent[0].y - padding;
  const viewBoxWidth = extentWidth + padding * 2;
  const viewBoxHeight = extentHeight + padding * 2;
  const fragment = document.createDocumentFragment();

  for (const sprite of sprites) {
    const textNode = document.createElementNS(SVG_NS, "text");
    textNode.setAttribute("transform", `translate(${sprite.x} ${sprite.y}) rotate(${sprite.rotate})`);
    textNode.setAttribute("text-anchor", "middle");
    textNode.setAttribute("dominant-baseline", "middle");
    textNode.setAttribute("font-family", sprite.font);
    textNode.setAttribute("font-size", `${Math.max(1, Math.ceil(sprite.size))}px`);
    textNode.setAttribute("font-style", sprite.style);
    textNode.setAttribute("font-weight", sprite.weight);
    textNode.setAttribute("fill", pickColor(sprite));
    textNode.textContent = sprite.text;
    fragment.append(textNode);
  }

  displaySvg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
  displaySvg.replaceChildren(fragment);
}

function pickColor(sprite) {
  const palette = ["#111111", "#1d4e89", "#8c2f39", "#2f6b3b", "#8f5b00"];
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

function nextSeed() {
  renderSeed = (renderSeed + 0x9e3779b9) >>> 0;
  return renderSeed;
}
