import CloudLayout from "../build/d3-cloud.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const width = 720;
const height = 480;
const displaySvg = document.querySelector("[data-cloud]");
const status = document.querySelector("[data-status]");
const source = document.querySelector("[data-source]");
const renderButton = document.querySelector("[data-render]");
const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but",
  "by", "for", "from", "had", "has", "have", "he", "her", "hers", "him",
  "his", "i", "in", "into", "is", "it", "its", "itself", "me", "my",
  "of", "on", "or", "our", "ours", "she", "so", "that", "the", "their",
  "them", "there", "they", "this", "to", "was", "we", "were", "with",
  "you", "your"
]);
let renderSeed = 0x243f6a88;

source.value = [
  "Word clouds are only as useful as the preprocessing behind them.",
  "This example counts raw word frequencies in the browser, filters out short stopwords,",
  "and then feeds the resulting terms into d3-cloud as prepared sprites.",
  "",
  "A good word cloud workflow starts with text cleaning. You usually normalize case,",
  "strip punctuation, remove filler words, and decide whether singular and plural forms",
  "should be merged. Only then does the layout become meaningful, because the sizes reflect",
  "something closer to the language patterns in the source material instead of random noise.",
  "",
  "The layout engine itself only needs prepared sprites and placement rules. Frequency",
  "analysis, stemming, tokenization, stopword filtering, and ranking are all separate",
  "concerns. Keeping those steps outside the core library makes the layout easier to reuse",
  "for browser text, chat logs, transcripts, articles, or any other corpus.",
  "",
  "Try pasting your own essay, article, meeting notes, or README text here. Words that",
  "appear again and again will become visually dominant, while rare descriptive terms",
  "stay smaller. A longer passage produces a denser and more interesting cloud because",
  "there are more repeated terms competing for space across the page."
].join("\n");

displaySvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
displaySvg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);

renderButton.addEventListener("click", render);
render();

function render() {
  renderSeed = (renderSeed * 1664525 + 1013904223) >>> 0;
  const rotateRandom = createRandom(renderSeed ^ 0x85ebca6b);
  const layoutRandom = createRandom(renderSeed);
  const frequencies = computeFrequencies(source.value);
  const words = sizeWords(frequencies);
  const layout = new CloudLayout()
    .size([width, height])
    .random(layoutRandom);
  const sprites = createSprites(layout, words, rotateRandom);
  const placedSprites = placeSprites(layout, sprites);

  draw(placedSprites, layout.bounds());
  status.textContent =
    `Counted ${frequencies.totalWords} words, kept ${words.length} terms, placed ${placedSprites.length} sprites`;
}

function computeFrequencies(text) {
  const matches = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const counts = new Map();
  let totalWords = 0;

  for (const token of matches) {
    if (token.length < 3 || stopWords.has(token)) {
      continue;
    }
    totalWords += 1;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return {
    totalWords,
    entries: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  };
}

function sizeWords(frequencies) {
  const entries = frequencies.entries.slice(0, 180);
  if (!entries.length) {
    return [];
  }

  const minCount = entries[entries.length - 1][1];
  const maxCount = entries[0][1];
  const minLog = Math.log(minCount);
  const maxLog = Math.log(maxCount);
  const spread = Math.max(1, maxLog - minLog);

  return entries.map(([text, count]) => ({
    text,
    count,
    size: Math.round(18 + 74 * ((Math.log(count) - minLog) / spread))
  }));
}

function createSprites(layout, words, rotateRandom) {
  return words
    .map(word => layout.getSprite(word.text, {
      ...word,
      font: "Impact",
      padding: 3,
      rotate: rotateRandom() < 0.16 ? 90 : 0
    }))
    .filter(Boolean);
}

function placeSprites(layout, sprites) {
  const placedSprites = [];

  for (const sprite of sprites) {
    const placed = layout.place(sprite);
    if (placed) {
      placedSprites.push(placed);
    }
  }

  return placedSprites;
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
    textNode.setAttribute("font-size", `${Math.max(1, Math.ceil(sprite.size))}px`);
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
  const palette = ["#111111", "#2f6b3b", "#1d4e89", "#8c2f39", "#8f5b00"];
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
