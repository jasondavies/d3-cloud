import CloudLayout from "../build/d3-cloud.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const MONOCHROME = {
  fill: "#ffffff",
  accent: "#111111",
  stroke: "#111111"
};
const width = 720;
const height = 480;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const rerender = document.querySelector("[data-rerender]");
const iconShapes = ["orbit", "diamond", "triangle", "pill", "burst", "tile"];
const qualifiers = ["North", "West", "South", "East", "Upper", "Lower", "Inner", "Outer"];
const imageCache = new Map();
let renderSeed = 0x517cc1b7;

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

rerender.addEventListener("click", () => {
  void render();
});

await render();

async function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const layoutRandom = createRandom(renderSeed);
  const sizeRandom = createRandom(renderSeed ^ 0x9e3779b9);

  status.textContent = "Generating image sprites...";
  displaySvg.replaceChildren();

  const layout = new CloudLayout()
    .size([width, height])
    .random(layoutRandom);
  const descriptors = createIconDescriptors(sizeRandom);
  const sprites = await createSprites(layout, descriptors);
  const placedWords = placeSprites(layout, sprites);

  draw(placedWords, layout.bounds());
}

function createIconDescriptors(random) {
  const heroDescriptors = [
    {
      label: "Solar Star",
      shape: "star",
      size: 512
    },
    {
      label: "Moon Disk",
      shape: "planet",
      size: 188
    }
  ];
  const iconDescriptors = qualifiers.flatMap((qualifier, qualifierIndex) =>
    iconShapes.map((shape, shapeIndex) => ({
      label: `${qualifier} ${titleCase(shape)}`,
      shape,
      size: 16 + Math.floor(random() * 92) + ((qualifierIndex + shapeIndex) % 5) * 8
    }))
  );

  return [...heroDescriptors, ...iconDescriptors].sort((a, b) => b.size - a.size);
}

async function createSprites(layout, descriptors) {
  const sprites = await Promise.all(descriptors.map(async descriptor => {
    const src = buildIconDataUrl(descriptor);
    const image = await loadImage(src);
    return layout.getSprite(image, {
      text: descriptor.label,
      width: descriptor.size,
      height: descriptor.size,
      padding: descriptor.shape === "star" || descriptor.shape === "planet" ? 4 : 2,
      imageHref: image.currentSrc || image.src,
      shape: descriptor.shape
    });
  }));

  return sprites.filter(Boolean);
}

function placeSprites(layout, sprites) {
  const placedWords = [];

  for (const sprite of sprites) {
    const word = layout.place(sprite);
    if (word) {
      placedWords.push(word);
    }
  }

  return placedWords;
}

function draw(words, bounds) {
  const extent = bounds;
  const padding = 32;
  const extentWidth = Math.max(1, extent[1].x - extent[0].x);
  const extentHeight = Math.max(1, extent[1].y - extent[0].y);
  const viewBoxX = extent[0].x - padding;
  const viewBoxY = extent[0].y - padding;
  const viewBoxWidth = extentWidth + padding * 2;
  const viewBoxHeight = extentHeight + padding * 2;
  const fragment = document.createDocumentFragment();

  for (const word of words) {
    const drawWidth = word.imageWidth || word.width;
    const drawHeight = word.imageHeight || word.height;
    const imageNode = document.createElementNS(SVG_NS, "image");
    imageNode.setAttribute("x", word.x - drawWidth / 2);
    imageNode.setAttribute("y", word.y - drawHeight / 2);
    imageNode.setAttribute("width", drawWidth);
    imageNode.setAttribute("height", drawHeight);
    imageNode.setAttribute("preserveAspectRatio", "none");
    imageNode.setAttributeNS(XLINK_NS, "href", word.imageHref || word.image?.currentSrc || word.image?.src || "");
    imageNode.setAttribute("href", word.imageHref || word.image?.currentSrc || word.image?.src || "");
    imageNode.setAttribute("opacity", "0.98");
    imageNode.setAttribute("aria-label", word.text);
    if (word.rotate) {
      imageNode.setAttribute("transform", `rotate(${word.rotate} ${word.x} ${word.y})`);
    }
    fragment.append(imageNode);
  }

  displaySvg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
  displaySvg.replaceChildren(fragment);
  status.textContent = `Placed ${words.length} image sprites · extent ${Math.round(extentWidth)} × ${Math.round(extentHeight)}`;
}

function buildIconDataUrl(descriptor) {
  const { fill, accent, stroke } = MONOCHROME;
  const markup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <g fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    ${shapeMarkup(descriptor.shape, accent, stroke)}
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function shapeMarkup(shape, accent, stroke) {
  switch (shape) {
    case "diamond":
      return `
        <polygon points="48,10 84,48 48,86 12,48" />
        <polygon points="48,27 69,48 48,69 27,48" fill="${accent}" stroke="none" />
      `;
    case "triangle":
      return `
        <polygon points="48,10 84,78 12,78" />
        <circle cx="48" cy="55" r="11" fill="${accent}" stroke="none" />
      `;
    case "pill":
      return `
        <rect x="14" y="28" width="68" height="40" rx="20" />
        <circle cx="34" cy="48" r="9" fill="${accent}" stroke="none" />
        <circle cx="62" cy="48" r="9" fill="${accent}" stroke="none" />
      `;
    case "burst":
      return `
        <polygon points="48,8 58,30 82,24 70,46 90,58 66,62 68,88 48,74 28,88 30,62 6,58 26,46 14,24 38,30" />
        <circle cx="48" cy="48" r="12" fill="${accent}" stroke="none" />
      `;
    case "tile":
      return `
        <rect x="14" y="14" width="68" height="68" rx="18" />
        <circle cx="33" cy="33" r="7" fill="${accent}" stroke="none" />
        <circle cx="63" cy="33" r="7" fill="${accent}" stroke="none" />
        <circle cx="48" cy="63" r="7" fill="${accent}" stroke="none" />
      `;
    case "star":
      return `
        <polygon
          points="48,7 58,33 87,33 64,50 73,78 48,61 23,78 32,50 9,33 38,33"
          fill="none"
          stroke="${stroke}"
          stroke-width="6"
        />
      `;
    case "planet":
      return `
        <circle cx="48" cy="48" r="28" />
        <ellipse cx="48" cy="50" rx="40" ry="12" fill="none" />
        <circle cx="38" cy="39" r="8" fill="${accent}" stroke="none" />
      `;
    default:
      return `
        <circle cx="48" cy="48" r="26" />
        <circle cx="48" cy="48" r="10" fill="${accent}" stroke="none" />
        <path d="M48 8c14 12 23 23 23 40S62 82 48 88C34 82 25 69 25 48S34 20 48 8Z" fill="none" />
      `;
  }
}

function loadImage(src) {
  const cachedImage = imageCache.get(src);
  if (cachedImage) {
    return cachedImage;
  }

  const imagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image sprite: ${src.slice(0, 48)}...`));
    image.src = src;
  });

  imageCache.set(src, imagePromise);
  return imagePromise;
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

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
