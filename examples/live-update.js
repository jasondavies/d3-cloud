import CloudLayout from "../build/d3-cloud.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const width = 720;
const height = 480;
const animationMs = 280;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const nextButton = document.querySelector("[data-next]");
const nodes = new Map();
let revisionIndex = -1;
const sharedTail = [
  "anchor", "atlas", "bundle", "channel", "cluster", "drift", "echo", "field",
  "filter", "frame", "graph", "grid", "kernel", "layer", "matrix", "module",
  "patch", "pulse", "queue", "raster", "route", "scale", "signal", "surface",
  "thread", "trace", "vector", "weight"
];

const revisions = [
  createRevision("Revision 1", {
    cloud: 72, layout: 64, sprite: 56, render: 52, browser: 48, module: 42,
    worker: 38, bitmap: 34, canvas: 44, alpha: 30, signal: 28, vector: 32,
    scale: 26, glyph: 24, orbit: 20, density: 18, contour: 16, stream: 14,
    kernel: 22, archive: 20, motion: 18, field: 16, cluster: 15, ribbon: 14,
    static: 13, current: 12, surface: 12, spiral: 11, weight: 11, tangent: 10
  }),
  createRevision("Revision 2", {
    cloud: 78, layout: 58, sprite: 44, render: 60, browser: 40, module: 34,
    worker: 46, bitmap: 28, canvas: 50, alpha: 24, signal: 22, vector: 36,
    update: 42, transition: 38, enter: 32, exit: 30, key: 26, animate: 24,
    cluster: 20, weight: 18, state: 17, patch: 16, frame: 15, merge: 14,
    revise: 13, queue: 12, motion: 12, focus: 11, stream: 10, signaler: 10
  }),
  createRevision("Revision 3", {
    cloud: 54, layout: 66, sprite: 36, render: 48, browser: 28, module: 32,
    worker: 52, update: 46, transition: 40, enter: 30, exit: 34, key: 44,
    animation: 38, timeline: 26, revise: 24, state: 22, patch: 20, diff: 18,
    surface: 18, measure: 17, cluster: 16, kernel: 15, bridge: 14, layer: 13,
    reconcile: 13, bundle: 12, glyph: 12, current: 11, contour: 10, archive: 10
  }),
  createRevision("Revision 4", {
    layout: 62, worker: 34, update: 58, key: 52, transition: 48, state: 42,
    snapshot: 40, reconcile: 54, animate: 36, sprite: 28, cloud: 32, svg: 46,
    browser: 24, render: 30, remove: 26, insert: 24, persist: 22, frame: 20,
    diff: 19, patch: 18, queue: 17, signal: 16, focus: 15, density: 14,
    contour: 13, vector: 12, archive: 11, module: 11, bitmap: 10, layer: 10
  })
];

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

nextButton.addEventListener("click", showNextRevision);
showNextRevision();

function showNextRevision() {
  revisionIndex = (revisionIndex + 1) % revisions.length;
  const revision = revisions[revisionIndex];
  const layout = new CloudLayout()
    .size([500, 340])
    .random(createRandom(revision.seed));
  const sprites = revision.words
    .map(word => layout.getSprite(word.text, {
      ...word,
      font: "Impact",
      padding: 1,
      rotate: word.rotate
    }))
    .filter(Boolean);
  const placedSprites = [];

  for (const sprite of sprites) {
    const placed = layout.place(sprite);
    if (placed) {
      placedSprites.push(placed);
    }
  }

  reconcile(placedSprites, layout.bounds());
  status.textContent = `${revision.label} · ${placedSprites.length} sprites`;
}

function reconcile(placedSprites, bounds) {
  const nextTexts = new Set(placedSprites.map(sprite => sprite.text));

  for (const [text, entry] of nodes) {
    if (nextTexts.has(text)) {
      continue;
    }
    nodes.delete(text);
    animateEntry(
      entry,
      { ...entry.state, size: 1, opacity: 0 },
      () => entry.node.remove()
    );
  }

  for (const sprite of placedSprites) {
    const target = {
      x: sprite.x,
      y: sprite.y,
      rotate: sprite.rotate,
      size: sprite.size,
      opacity: 1
    };
    let entry = nodes.get(sprite.text);

    if (!entry) {
      const node = document.createElementNS(SVG_NS, "text");
      node.classList.add("cloud-word");
      node.setAttribute("text-anchor", "middle");
      node.setAttribute("dominant-baseline", "middle");
      node.textContent = sprite.text;
      displaySvg.append(node);

      entry = {
        node,
        frame: 0,
        state: { x: 0, y: 0, rotate: sprite.rotate, size: 1, opacity: 0 }
      };
      nodes.set(sprite.text, entry);
      applyNode(entry.node, sprite, entry.state);
      animateEntry(entry, target);
      continue;
    }

    applyNode(entry.node, sprite, entry.state);
    animateEntry(entry, target);
  }

  updateViewBox(bounds || measureBounds(placedSprites));
}

function animateEntry(entry, target, onDone = undefined) {
  const start = { ...entry.state };
  const startedAt = performance.now();

  cancelAnimationFrame(entry.frame);
  entry.frame = requestAnimationFrame(function step(now) {
    const progress = Math.min(1, (now - startedAt) / animationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    entry.state = {
      x: lerp(start.x, target.x, eased),
      y: lerp(start.y, target.y, eased),
      rotate: lerp(start.rotate, target.rotate, eased),
      size: lerp(start.size, target.size, eased),
      opacity: lerp(start.opacity, target.opacity, eased)
    };

    entry.node.setAttribute(
      "transform",
      `translate(${entry.state.x} ${entry.state.y}) rotate(${entry.state.rotate})`
    );
    entry.node.setAttribute("font-size", `${Math.max(1, Math.ceil(entry.state.size))}px`);
    entry.node.style.opacity = String(entry.state.opacity);

    if (progress < 1) {
      entry.frame = requestAnimationFrame(step);
      return;
    }

    entry.state = { ...target };
    entry.frame = 0;
    if (onDone) {
      onDone();
    }
  });
}

function applyNode(node, sprite, state) {
  node.setAttribute("font-family", sprite.font);
  node.setAttribute("font-style", sprite.style);
  node.setAttribute("font-weight", sprite.weight);
  node.setAttribute("fill", pickColor(sprite));
  node.setAttribute("transform", `translate(${state.x} ${state.y}) rotate(${state.rotate})`);
  node.setAttribute("font-size", `${Math.max(1, Math.ceil(state.size))}px`);
  node.style.opacity = String(state.opacity);
}

function updateViewBox(bounds) {
  const padding = 28;
  const widthExtent = Math.max(1, bounds[1].x - bounds[0].x);
  const heightExtent = Math.max(1, bounds[1].y - bounds[0].y);
  displaySvg.setAttribute(
    "viewBox",
    `${bounds[0].x - padding} ${bounds[0].y - padding} ${widthExtent + padding * 2} ${heightExtent + padding * 2}`
  );
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

function createRevision(label, counts) {
  const mergedCounts = { ...counts };

  for (let index = 0; index < sharedTail.length; index += 1) {
    const text = sharedTail[index];
    if (!(text in mergedCounts)) {
      mergedCounts[text] = Math.max(8, 15 - Math.floor(index / 3));
    }
  }

  return {
    label,
    seed: hashString(label),
    words: Object.entries(mergedCounts)
      .map(([text, size], index) => ({
        text,
        size: Math.max(12, Math.round(size * 0.92)),
        rotate: index % 10 === 0 ? 90 : 0
      }))
      .sort((a, b) => b.size - a.size)
  };
}

function pickColor(sprite) {
  const palette = ["#111111", "#6b3fa0", "#1d4e89", "#8c2f39", "#2f6b3b"];
  return palette[sprite.text.length % palette.length];
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

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
