var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};

// src/sprite.js
var RADIANS = Math.PI / 180;
var SCRATCH_WIDTH = 1 << 11;
var SCRATCH_HEIGHT = 1 << 11;
var IMAGE_SLACK = 4;
var CREATE = Symbol("CloudSprite");
var MASKS = /* @__PURE__ */ new WeakMap();
var CANVAS_STATES = /* @__PURE__ */ new WeakMap();
var CloudSprite = class {
  constructor(token, fields) {
    if (token !== CREATE) {
      throw new TypeError("CloudSprite instances are created by CloudLayout.getSprite()");
    }
    Object.assign(this, fields);
    Object.freeze(this);
  }
};
function spriteMask(sprite) {
  return MASKS.get(sprite);
}
function spriteFields(source, options) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const image = isImageSource(source) ? source : null;
  if (!image && !isTextSource(source)) {
    throw new TypeError("getSprite() expects text or an image-like source");
  }
  const size = finiteOption((_a = options.size) != null ? _a : options.fontSize, "size", 1);
  const padding = finiteOption(options.padding, "padding", image ? 0 : 1);
  if (padding < 0) {
    throw new RangeError("getSprite() expects a nonnegative padding");
  }
  const fields = {
    text: String(image ? (_c = (_b = options.text) != null ? _b : source.alt) != null ? _c : "" : source),
    image,
    imageWidth: image ? imageDimensionOption(options.width, "width") : null,
    imageHeight: image ? imageDimensionOption(options.height, "height") : null,
    font: String((_d = options.font) != null ? _d : "serif"),
    style: String((_f = (_e = options.style) != null ? _e : options.fontStyle) != null ? _f : "normal"),
    weight: fontWeightOption((_h = (_g = options.weight) != null ? _g : options.fontWeight) != null ? _h : "normal"),
    rotate: finiteOption(options.rotate, "rotate", 0),
    size: Math.trunc(size),
    padding,
    datum: options.datum
  };
  const empty = image ? fields.imageWidth === 0 || fields.imageHeight === 0 : fields.size < 1;
  return empty ? null : fields;
}
function rasterizeSprite(fields, state) {
  var _a, _b;
  if (state.drawing) {
    throw new Error("getSprite() cannot be called while a sprite is being drawn to the same canvas");
  }
  const font = fields.image ? null : textFont(fields, state);
  let raster;
  state.drawing = true;
  try {
    raster = fields.image ? rasterizeImageSprite(fields, state) : rasterizeTextSprite(fields, font, state);
  } catch (error) {
    state.invalid = true;
    throw error;
  } finally {
    state.drawing = false;
  }
  if (!raster) {
    return null;
  }
  const { data, spriteWidth, x0, y0, x1, y1 } = raster;
  const sprite = new CloudSprite(CREATE, __spreadProps(__spreadValues({}, fields), {
    imageWidth: (_a = raster.imageWidth) != null ? _a : fields.imageWidth,
    imageHeight: (_b = raster.imageHeight) != null ? _b : fields.imageHeight,
    width: raster.width,
    height: raster.height,
    x0,
    y0,
    x1,
    y1,
    spriteWidth,
    sprite: data.slice()
  }));
  MASKS.set(sprite, { data, words: spriteWidth >>> 5, x0, y0, x1, y1, envelope: raster.envelope });
  return sprite;
}
function createSpriteContext(canvas) {
  let state = CANVAS_STATES.get(canvas);
  if (state && !state.invalid) {
    return state;
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new TypeError("canvas() factories must return a canvas with a 2d context");
  }
  canvas.width = SCRATCH_WIDTH;
  canvas.height = SCRATCH_HEIGHT;
  if (context.getImageData(0, 0, 1, 1).data.length !== 4) {
    throw new TypeError("canvas() factories must return a canvas that reads back one pixel per unit");
  }
  context.fillStyle = context.strokeStyle = "red";
  state = Object.assign(state || {}, {
    context,
    invalid: false,
    drawing: false,
    clearWidth: 0,
    clearHeight: 0
  });
  CANVAS_STATES.set(canvas, state);
  return state;
}
function finiteOption(value, name, defaultValue) {
  if (value == null) {
    return defaultValue;
  }
  value = +value;
  if (!Number.isFinite(value)) {
    throw new TypeError(`getSprite() expects a finite ${name}`);
  }
  return value;
}
function fontWeightOption(value) {
  return typeof value === "number" ? value : String(value);
}
function imageDimensionOption(value, name) {
  value = finiteOption(value, name, null);
  return value == null ? null : Math.max(0, Math.trunc(value));
}
function clearContext(state, width = state.clearWidth, height = state.clearHeight) {
  const context = state.context;
  if (width && height) {
    context.clearRect(0, 0, width, height);
  }
  return context;
}
function setClearExtent(state, width, height) {
  state.clearWidth = width;
  state.clearHeight = height;
}
function drawAtRasterCenter(context, rasterWidth, rasterHeight, rotate, draw) {
  context.save();
  try {
    context.translate(rasterWidth >> 1, rasterHeight >> 1);
    if (rotate) {
      context.rotate(rotate * RADIANS);
    }
    draw();
  } finally {
    context.restore();
  }
}
function textFont(sprite, state) {
  const context = state.context;
  const font = `${sprite.style} ${sprite.weight} ${sprite.size}px ${sprite.font}`;
  context.font = `${sprite.size + 1}px serif`;
  const previousFont = context.font;
  context.font = font;
  if (context.font === previousFont) {
    throw new TypeError(`getSprite() font "${font}" was rejected by the canvas`);
  }
  return font;
}
function rasterizeTextSprite(sprite, font, state) {
  const context = clearContext(state);
  context.font = font;
  context.textAlign = "center";
  const { width, height, hasInkBounds } = textRasterSize(sprite, context.measureText(sprite.text));
  const overscan = Math.max(4, Math.ceil((sprite.padding + 2) * 2));
  const overhang = hasInkBounds ? 0 : 2 * sprite.size;
  const envelopeWidth = Math.ceil(width + overscan * 2);
  let rasterWidth = envelopeWidth;
  let rasterHeight = Math.ceil(height + overscan * 2);
  let redrawn = false;
  let pixels;
  let alphaBounds;
  for (; ; ) {
    if (rasterWidth > SCRATCH_WIDTH || rasterHeight > SCRATCH_HEIGHT) {
      setClearExtent(state, 0, 0);
      return null;
    }
    try {
      drawAtRasterCenter(context, rasterWidth, rasterHeight, sprite.rotate, () => {
        context.fillText(sprite.text, 0, 0);
        if (sprite.padding) {
          context.lineWidth = 2 * sprite.padding;
          context.lineJoin = "round";
          context.strokeText(sprite.text, 0, 0);
        }
      });
    } finally {
      setClearExtent(
        state,
        redrawn ? SCRATCH_WIDTH : Math.min(SCRATCH_WIDTH, rasterWidth + overhang),
        redrawn ? SCRATCH_HEIGHT : Math.min(SCRATCH_HEIGHT, rasterHeight + overhang)
      );
    }
    pixels = context.getImageData(0, 0, rasterWidth, rasterHeight).data;
    alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);
    if (!alphaBounds) {
      return null;
    }
    const growWidth = alphaBounds.x0 === 0 || alphaBounds.x0 + alphaBounds.width === rasterWidth;
    const growHeight = alphaBounds.y0 === 0 || alphaBounds.y0 + alphaBounds.height === rasterHeight;
    if (!growWidth && !growHeight) {
      break;
    }
    const nextWidth = growWidth ? Math.min(SCRATCH_WIDTH, rasterWidth * 2) : rasterWidth;
    const nextHeight = growHeight ? Math.min(SCRATCH_HEIGHT, rasterHeight * 2) : rasterHeight;
    if (nextWidth === rasterWidth && nextHeight === rasterHeight) {
      return null;
    }
    redrawn = true;
    setClearExtent(state, SCRATCH_WIDTH, SCRATCH_HEIGHT);
    clearContext(state, nextWidth, nextHeight);
    rasterWidth = nextWidth;
    rasterHeight = nextHeight;
  }
  const raster = extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds);
  const left = -(envelopeWidth >> 1);
  raster.envelope = {
    x0: Math.min(raster.x0, left),
    y0: raster.y0,
    x1: Math.max(raster.x1, left + envelopeWidth),
    y1: raster.y1
  };
  return raster;
}
function textRasterSize(sprite, metrics) {
  let width = metrics.width + 1;
  let height = sprite.size * 2;
  const hasInkBounds = Number.isFinite(metrics.actualBoundingBoxLeft) && Number.isFinite(metrics.actualBoundingBoxRight) && Number.isFinite(metrics.actualBoundingBoxAscent) && Number.isFinite(metrics.actualBoundingBoxDescent);
  if (hasInkBounds) {
    width = Math.max(width, 2 * (sprite.padding + Math.max(
      Math.abs(metrics.actualBoundingBoxLeft),
      Math.abs(metrics.actualBoundingBoxRight)
    )));
    height = Math.max(height, 2 * (sprite.padding + Math.max(
      Math.abs(metrics.actualBoundingBoxAscent),
      Math.abs(metrics.actualBoundingBoxDescent)
    )));
  }
  return __spreadProps(__spreadValues({}, rotatedExtent(width, height, sprite.rotate)), { hasInkBounds });
}
function rasterizeImageSprite(sprite, state) {
  const context = clearContext(state);
  const imageSize = resolveImageSize(sprite.image, sprite.imageWidth, sprite.imageHeight);
  if (!imageSize) {
    setClearExtent(state, 0, 0);
    return null;
  }
  const { drawWidth, drawHeight, intrinsic } = imageSize;
  const bounds = rotatedExtent(drawWidth, drawHeight, sprite.rotate);
  const rasterWidth = Math.ceil(bounds.width + 2);
  const rasterHeight = Math.ceil(bounds.height + 2);
  if (rasterWidth > SCRATCH_WIDTH || rasterHeight > SCRATCH_HEIGHT) {
    setClearExtent(state, 0, 0);
    return null;
  }
  try {
    drawAtRasterCenter(context, rasterWidth, rasterHeight, sprite.rotate, () => {
      context.drawImage(sprite.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    });
  } catch (error) {
    if (intrinsic) {
      throw error;
    }
    return null;
  } finally {
    setClearExtent(state, rasterWidth, rasterHeight);
  }
  const pixels = context.getImageData(0, 0, rasterWidth, rasterHeight).data;
  const alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);
  if (!alphaBounds) {
    return null;
  }
  const raster = extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds);
  raster.imageWidth = drawWidth;
  raster.imageHeight = drawHeight;
  raster.envelope = {
    x0: raster.x0 - IMAGE_SLACK,
    y0: raster.y0 - IMAGE_SLACK,
    x1: raster.x1 + IMAGE_SLACK,
    y1: raster.y1 + IMAGE_SLACK
  };
  return raster;
}
function extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds) {
  const width = alphaBounds.width;
  const height = alphaBounds.height;
  const spriteWidth = width + 31 >>> 5 << 5;
  const wordsPerRow = spriteWidth >>> 5;
  const x0 = alphaBounds.x0 - (rasterWidth >> 1);
  const y0 = alphaBounds.y0 - (rasterHeight >> 1);
  const data = new Uint32Array(wordsPerRow * height);
  for (let row = 0; row < height; row += 1) {
    const sourceRow = alphaBounds.y0 + row;
    const rowOffset = row * wordsPerRow;
    for (let column = 0; column < width; column += 1) {
      const sourceColumn = alphaBounds.x0 + column;
      if (pixels[(sourceRow * rasterWidth + sourceColumn << 2) + 3]) {
        data[rowOffset + (column >>> 5)] |= 1 << 31 - (column & 31);
      }
    }
  }
  return {
    data,
    spriteWidth,
    width,
    height,
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height
  };
}
function resolveImageSize(image, imageWidth, imageHeight) {
  const sourceWidth = resolveImageDimension(image, "naturalWidth", "videoWidth", "width");
  const sourceHeight = resolveImageDimension(image, "naturalHeight", "videoHeight", "height");
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    if (imageWidth != null && imageHeight != null && typeof image.naturalWidth === "number" && image.complete === true) {
      return { drawWidth: imageWidth, drawHeight: imageHeight, intrinsic: false };
    }
    return null;
  }
  let drawWidth = imageWidth;
  let drawHeight = imageHeight;
  if (drawWidth == null && drawHeight == null) {
    drawWidth = sourceWidth;
    drawHeight = sourceHeight;
  } else if (drawWidth == null) {
    drawWidth = Math.max(1, Math.round(sourceWidth * (drawHeight / sourceHeight)));
  } else if (drawHeight == null) {
    drawHeight = Math.max(1, Math.round(sourceHeight * (drawWidth / sourceWidth)));
  }
  return { drawWidth, drawHeight, intrinsic: true };
}
function resolveImageDimension(image, ...keys) {
  for (const key of keys) {
    const value = image == null ? void 0 : image[key];
    if (typeof value === "number") {
      return value > 0 && Number.isFinite(value) ? Math.trunc(value) : 0;
    }
  }
  return 0;
}
function rotatedExtent(width, height, rotate) {
  if (!rotate) {
    return { width, height };
  }
  const sine = Math.sin(rotate * RADIANS);
  const cosine = Math.cos(rotate * RADIANS);
  const widthCosine = width * cosine;
  const widthSine = width * sine;
  const heightCosine = height * cosine;
  const heightSine = height * sine;
  return {
    width: Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)),
    height: Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine))
  };
}
function findAlphaBounds(pixels, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (!pixels[(row * width + column << 2) + 3]) {
        continue;
      }
      if (column < minX) minX = column;
      if (row < minY) minY = row;
      if (column > maxX) maxX = column;
      if (row > maxY) maxY = row;
    }
  }
  if (maxX < minX || maxY < minY) {
    return null;
  }
  return {
    x0: minX,
    y0: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}
function isTextSource(source) {
  return typeof source === "string" || typeof source === "number" || typeof source === "boolean" || source instanceof String;
}
function isImageSource(source) {
  return !!source && typeof source === "object" && !Array.isArray(source) && (typeof source.width === "number" || typeof source.naturalWidth === "number" || typeof source.videoWidth === "number");
}

// src/layout.js
var MAX_COORDINATE = 1 << 24;
var MAX_BLOCK_SIZE = 4096;
var MIN_SEARCH_BUDGET = 1e5;
var MAX_SPIRAL_ASPECT_RATIO = 64;
var STRATEGIES = {
  archimedean: archimedeanStrategy,
  rectangular: rectangularStrategy,
  none: noneStrategy
};
var CloudLayout = class {
  constructor() {
    this._size = [256, 256];
    this._overflow = true;
    this._strategy = archimedeanStrategy;
    this._random = Math.random;
    this._blockSize = 512;
    this._canvasFactory = defaultCanvasFactory;
    this._spriteContext = null;
    this._bounds = null;
    this._blocks = createOccupancyBlocks(this._blockSize);
    this._searches = 0;
    this._placements = /* @__PURE__ */ new WeakMap();
  }
  canvas(_) {
    if (!arguments.length) {
      return this._canvasFactory;
    }
    if (typeof _ !== "function") {
      throw new TypeError("canvas() expects a canvas factory function");
    }
    this._canvasFactory = _;
    this._spriteContext = null;
    return this;
  }
  clear() {
    this._assertNotSearching("clear()");
    this._placements = /* @__PURE__ */ new WeakMap();
    this._bounds = null;
    this._blocks = createOccupancyBlocks(this._blockSize);
    return this;
  }
  bounds() {
    return cloneBounds(this._bounds);
  }
  size(_) {
    if (!arguments.length) {
      return this._size.slice();
    }
    this._size = normalizeSize(_);
    return this;
  }
  overflow(_) {
    if (!arguments.length) {
      return this._overflow;
    }
    this._overflow = !!_;
    return this;
  }
  strategy(_) {
    if (!arguments.length) {
      return this._strategy;
    }
    this._strategy = resolveStrategy(_);
    return this;
  }
  random(_) {
    if (!arguments.length) {
      return this._random;
    }
    if (typeof _ !== "function") {
      throw new TypeError("random() expects a function");
    }
    this._random = _;
    return this;
  }
  blockSize(_) {
    if (!arguments.length) {
      return this._blockSize;
    }
    const nextBlockSize = normalizeBlockSize(_);
    if (nextBlockSize === this._blockSize) {
      return this;
    }
    this._assertNotSearching("blockSize()");
    if (this._bounds) {
      throw new Error("Cannot change blockSize after placement; call clear() first");
    }
    this._blockSize = nextBlockSize;
    this._blocks = createOccupancyBlocks(this._blockSize);
    return this;
  }
  getSprite(source, options) {
    const fields = spriteFields(source, optionsObject(options, "getSprite()"));
    if (!fields) {
      return null;
    }
    return rasterizeSprite(fields, this._getContext());
  }
  erase(word) {
    const placement = word && typeof word === "object" ? this._placements.get(word) : void 0;
    if (!placement) {
      throw new Error("erase() expects a word returned by place() on this layout since it was last cleared");
    }
    this._blocks.remove(placement.mask, placement.x, placement.y);
    this._placements.delete(word);
    if (this._blocks.isEmpty()) {
      this._bounds = null;
    }
  }
  place(sprite, options) {
    const mask = spriteMask(sprite);
    if (!mask) {
      throw new TypeError("place() expects a CloudSprite from getSprite() on a layout from the same copy of d3-cloud");
    }
    const { x: optionX, y: optionY, strategy: optionStrategy } = optionsObject(options, "place()");
    const strategy = optionStrategy == null ? this._strategy : resolveStrategy(optionStrategy);
    const x = optionX == null ? seedCoordinate(this._size[0], this._random) : placeCoordinate(optionX);
    const y = optionY == null ? seedCoordinate(this._size[1], this._random) : placeCoordinate(optionY);
    let position;
    this._searches++;
    try {
      position = tryPlaceSprite(this._blocks, mask, x, y, this._bounds, strategy, this._size, this._overflow, this._random);
    } finally {
      this._searches--;
    }
    if (!position) {
      return null;
    }
    this._bounds = extendBounds(this._bounds, mask, position.x, position.y);
    const word = createPlacedWord(sprite, position.x, position.y);
    this._placements.set(word, { mask, x: position.x, y: position.y });
    return word;
  }
  // A search holds the occupancy blocks it started with. Replacing them
  // mid-search would leave the word out of the new blocks, where later words
  // could overlap it.
  _assertNotSearching(method) {
    if (this._searches) {
      throw new Error(`${method} cannot be called while place() is searching`);
    }
  }
  _getContext() {
    if (!this._spriteContext || this._spriteContext.invalid) {
      this._spriteContext = createSpriteContext(this._canvasFactory());
    }
    return this._spriteContext;
  }
};
function tryPlaceSprite(blocks, mask, seedX, seedY, bounds, strategy, size, overflow, random) {
  var range = anchorRange(mask, bounds, size, overflow);
  if (!range) {
    return null;
  }
  if (withinRange(range, seedX, seedY) && !blocks.collides(mask, seedX, seedY)) {
    blocks.insert(mask, seedX, seedY);
    return { x: seedX, y: seedY };
  }
  var startX = Math.min(Math.max(seedX, range.x0), range.x1), startY = Math.min(Math.max(seedY, range.y0), range.y1);
  var next = strategy(
    { x: startX, y: startY },
    {
      size: size.slice(),
      aspectRatio: sizeAspectRatio(size),
      bounds: cloneBounds(bounds),
      overflow,
      random
    }
  );
  if (typeof next !== "function") {
    throw new TypeError("strategy factories must return a candidate generator");
  }
  var envelope = mask.envelope, candidate, limitX = Math.max(startX - range.x0, range.x1 - startX) + envelope.x1 - envelope.x0 + 1, limitY = Math.max(startY - range.y0, range.y1 - startY) + envelope.y1 - envelope.y0 + 1, insideLimit = Math.max(MIN_SEARCH_BUDGET, (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1)), outsideLimit = Math.max(MIN_SEARCH_BUDGET, 4 * limitX * limitY), inside = 0, outside = 0;
  while (candidate = normalizeStrategyCandidate(next())) {
    if (!withinRange(range, candidate.x, candidate.y)) {
      if (Math.abs(candidate.x - startX) >= limitX && Math.abs(candidate.y - startY) >= limitY) break;
      if (++outside >= outsideLimit) break;
      continue;
    }
    outside = 0;
    if (++inside > insideLimit) break;
    if (!blocks.collides(mask, candidate.x, candidate.y)) {
      blocks.insert(mask, candidate.x, candidate.y);
      return candidate;
    }
  }
  return null;
}
function anchorRange(mask, bounds, size, overflow) {
  var x0 = -MAX_COORDINATE, y0 = -MAX_COORDINATE, x1 = MAX_COORDINATE, y1 = MAX_COORDINATE, envelope = mask.envelope;
  if (!overflow) {
    x0 = Math.max(x0, Math.ceil(-size[0] / 2 - mask.x0));
    y0 = Math.max(y0, Math.ceil(-size[1] / 2 - mask.y0));
    x1 = Math.min(x1, Math.floor(size[0] / 2 - mask.x1));
    y1 = Math.min(y1, Math.floor(size[1] / 2 - mask.y1));
  }
  if (bounds) {
    x0 = Math.max(x0, Math.floor(bounds[0].x - envelope.x1) + 1);
    y0 = Math.max(y0, Math.floor(bounds[0].y - envelope.y1) + 1);
    x1 = Math.min(x1, Math.ceil(bounds[1].x - envelope.x0) - 1);
    y1 = Math.min(y1, Math.ceil(bounds[1].y - envelope.y0) - 1);
  }
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : null;
}
function withinRange(range, x, y) {
  return x >= range.x0 && x <= range.x1 && y >= range.y0 && y <= range.y1;
}
function createOccupancyBlocks(blockSize) {
  const blocks = /* @__PURE__ */ new Map();
  const blockWordsPerRow = blockSize >>> 5;
  function visitBlocks(mask, x, y, visit, create, prune) {
    var data = mask.data, wordsPerRow = mask.words, left = x + mask.x0, top = y + mask.y0, right = x + mask.x1, bottom = y + mask.y1, firstX = Math.floor(left / blockSize), lastX = Math.floor((right - 1) / blockSize), firstY = Math.floor(top / blockSize), lastY = Math.floor((bottom - 1) / blockSize);
    for (var blockY = firstY; blockY <= lastY; blockY++) {
      var blockRow = blocks.get(blockY);
      if (!blockRow) {
        if (!create) continue;
        blockRow = /* @__PURE__ */ new Map();
        blocks.set(blockY, blockRow);
      }
      var blockTop = blockY * blockSize, overlapTop = Math.max(top, blockTop), overlapBottom = Math.min(bottom, blockTop + blockSize);
      for (var blockX = firstX; blockX <= lastX; blockX++) {
        var blockLeft = blockX * blockSize, overlapLeft = Math.max(left, blockLeft), overlapRight = Math.min(right, blockLeft + blockSize);
        if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
        var block = blockRow.get(blockX);
        if (!block) {
          if (!create) continue;
          block = new Uint32Array(blockWordsPerRow * blockSize);
          blockRow.set(blockX, block);
        }
        if (visit(
          data,
          wordsPerRow,
          left,
          top,
          block,
          blockWordsPerRow,
          blockLeft,
          blockTop,
          overlapLeft,
          overlapTop,
          overlapRight,
          overlapBottom
        )) {
          return true;
        }
        if (prune && isZeroBlock(block)) {
          blockRow.delete(blockX);
        }
      }
      if (prune && blockRow.size === 0) blocks.delete(blockY);
    }
    return false;
  }
  return {
    isEmpty() {
      return blocks.size === 0;
    },
    collides(mask, x, y) {
      return visitBlocks(mask, x, y, packedRegionCollides, false, false);
    },
    insert(mask, x, y) {
      visitBlocks(mask, x, y, stampPackedRegion, true, false);
    },
    remove(mask, x, y) {
      visitBlocks(mask, x, y, clearPackedRegion, false, true);
    }
  };
}
function packedRegionCollides(aData, aWordsPerRow, aLeft, aTop, bData, bWordsPerRow, bLeft, bTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, aStartBit = overlapLeft - aLeft, bStartBit = overlapLeft - bLeft, aStartRow = overlapTop - aTop, bStartRow = overlapTop - bTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var aRowOffset = (aStartRow + row) * aWordsPerRow, bRowOffset = (bStartRow + row) * bWordsPerRow;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, aWord = readPackedWord(aData, aRowOffset, aWordsPerRow, aStartBit + (word << 5)), bWord = readPackedWord(bData, bRowOffset, bWordsPerRow, bStartBit + (word << 5));
      if ((aWord & bWord & mask) !== 0) {
        return true;
      }
    }
  }
  return false;
}
function stampPackedRegion(sourceData, sourceWordsPerRow, sourceLeft, sourceTop, targetData, targetWordsPerRow, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, sourceStartBit = overlapLeft - sourceLeft, targetStartBit = overlapLeft - targetLeft, sourceStartRow = overlapTop - sourceTop, targetStartRow = overlapTop - targetTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWordsPerRow, targetRowOffset = (targetStartRow + row) * targetWordsPerRow;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWordsPerRow, sourceStartBit + (word << 5)) & mask;
      orPackedWord(targetData, targetRowOffset, targetWordsPerRow, targetStartBit + (word << 5), sourceWord);
    }
  }
}
function clearPackedRegion(sourceData, sourceWordsPerRow, sourceLeft, sourceTop, targetData, targetWordsPerRow, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, sourceStartBit = overlapLeft - sourceLeft, targetStartBit = overlapLeft - targetLeft, sourceStartRow = overlapTop - sourceTop, targetStartRow = overlapTop - targetTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWordsPerRow, targetRowOffset = (targetStartRow + row) * targetWordsPerRow;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWordsPerRow, sourceStartBit + (word << 5)) & mask;
      clearPackedWord(targetData, targetRowOffset, targetWordsPerRow, targetStartBit + (word << 5), sourceWord);
    }
  }
}
function readPackedWord(sprite, rowOffset, wordsPerRow, bitIndex) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31, current = wordIndex < wordsPerRow ? sprite[rowOffset + wordIndex] : 0;
  if (!bitOffset) {
    return current;
  }
  var next = wordIndex + 1 < wordsPerRow ? sprite[rowOffset + wordIndex + 1] : 0;
  return (current << bitOffset | next >>> 32 - bitOffset) >>> 0;
}
function orPackedWord(target, rowOffset, wordsPerRow, bitIndex, value) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31;
  if (!bitOffset) {
    target[rowOffset + wordIndex] |= value;
    return;
  }
  target[rowOffset + wordIndex] |= value >>> bitOffset;
  if (wordIndex + 1 < wordsPerRow) {
    target[rowOffset + wordIndex + 1] |= value << 32 - bitOffset >>> 0;
  }
}
function clearPackedWord(target, rowOffset, wordsPerRow, bitIndex, value) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31;
  if (!bitOffset) {
    target[rowOffset + wordIndex] &= ~value >>> 0;
    return;
  }
  target[rowOffset + wordIndex] &= ~(value >>> bitOffset) >>> 0;
  if (wordIndex + 1 < wordsPerRow) {
    target[rowOffset + wordIndex + 1] &= ~(value << 32 - bitOffset >>> 0) >>> 0;
  }
}
function isZeroBlock(block) {
  for (var index = 0; index < block.length; index++) {
    if (block[index] !== 0) {
      return false;
    }
  }
  return true;
}
function createPlacedWord(sprite, x, y) {
  const _a = sprite, { sprite: _mask, spriteWidth: _spriteWidth } = _a, fields = __objRest(_a, ["sprite", "spriteWidth"]);
  return __spreadProps(__spreadValues({}, fields), { x, y });
}
function extendBounds(bounds, mask, x, y) {
  var left = x + mask.x0, top = y + mask.y0, right = x + mask.x1, bottom = y + mask.y1;
  if (!bounds) {
    return [{ x: left, y: top }, { x: right, y: bottom }];
  }
  if (left < bounds[0].x) bounds[0].x = left;
  if (top < bounds[0].y) bounds[0].y = top;
  if (right > bounds[1].x) bounds[1].x = right;
  if (bottom > bounds[1].y) bounds[1].y = bottom;
  return bounds;
}
function cloneBounds(bounds) {
  if (!bounds) {
    return bounds;
  }
  return [
    { x: bounds[0].x, y: bounds[0].y },
    { x: bounds[1].x, y: bounds[1].y }
  ];
}
function archimedeanStrategy(initial, context) {
  var e = spiralAspectRatio(context.aspectRatio), dt = context.random() < 0.5 ? 1 : -1, t = -dt;
  return function() {
    var angle = (t += dt) * 0.1;
    return {
      x: initial.x + ~~(e * angle * Math.cos(angle)),
      y: initial.y + ~~(angle * Math.sin(angle))
    };
  };
}
function rectangularStrategy(initial, context) {
  var e = spiralAspectRatio(context.aspectRatio), sign = context.random() < 0.5 ? 1 : -1, a = 0, b = 0, runs = [], run = 0, x = 0, y = 0, dx = 0, dy = 0, count = 1;
  function grow() {
    var nextX = e >= 1 ? (a + 1) / e : a + 1, nextY = e >= 1 ? b + 1 : (b + 1) * e, growX = nextX <= nextY, growY = nextY <= nextX;
    if (growX) a++;
    if (growY) b++;
    if (growX && growY) {
      runs = [
        -a,
        -1,
        0,
        -1,
        b,
        -a + 1,
        -b,
        1,
        0,
        2 * a,
        a,
        -b + 1,
        0,
        1,
        2 * b,
        a - 1,
        b,
        -1,
        0,
        2 * a,
        -a,
        b - 1,
        0,
        -1,
        b
      ];
    } else if (growX) {
      runs = [
        -a,
        -1,
        0,
        -1,
        b,
        a,
        -b,
        0,
        1,
        2 * b + 1,
        -a,
        b,
        0,
        -1,
        b + 1
      ];
    } else {
      runs = [
        -a,
        -b,
        1,
        0,
        2 * a + 1,
        a,
        b,
        -1,
        0,
        2 * a + 1
      ];
    }
    run = 0;
  }
  return function() {
    while (!count) {
      if (run === runs.length) grow();
      x = runs[run++];
      y = runs[run++];
      dx = runs[run++];
      dy = runs[run++];
      count = runs[run++];
    }
    var candidate = {
      x: initial.x + 4 * x,
      y: initial.y + 4 * sign * y
    };
    x += dx;
    y += dy;
    count--;
    return candidate;
  };
}
function noneStrategy() {
  return function() {
    return null;
  };
}
function defaultCanvasFactory() {
  return document.createElement("canvas");
}
function normalizeAspectRatio(value) {
  value = +value;
  return value > 0 && Number.isFinite(value) ? value : 1;
}
function spiralAspectRatio(value) {
  return Math.min(Math.max(normalizeAspectRatio(value), 1 / MAX_SPIRAL_ASPECT_RATIO), MAX_SPIRAL_ASPECT_RATIO);
}
function normalizeBlockSize(value) {
  value = +value;
  if (!(value >= 1 && value <= MAX_BLOCK_SIZE)) {
    throw new RangeError(`blockSize() expects a size from 1 to ${MAX_BLOCK_SIZE}`);
  }
  return Math.ceil(value / 32) * 32;
}
function placeCoordinate(value) {
  value = +value;
  if (!Number.isFinite(value)) {
    throw new TypeError("place() expects finite x and y coordinates");
  }
  if (Math.abs(value) > MAX_COORDINATE) {
    throw new RangeError(`place() expects x and y coordinates within \xB1${MAX_COORDINATE}`);
  }
  return Math.floor(value);
}
function normalizeSize(value) {
  if (!Array.isArray(value)) {
    value = [value, value];
  }
  return [
    normalizeSizeDimension(value[0]),
    normalizeSizeDimension(value[1])
  ];
}
function normalizeSizeDimension(value) {
  value = +value;
  if (!(value >= 0 && value <= MAX_COORDINATE)) {
    throw new RangeError(`size() expects dimensions from 0 to ${MAX_COORDINATE}`);
  }
  return value;
}
function sizeAspectRatio(size) {
  return normalizeAspectRatio(size[0] / size[1]);
}
function seedCoordinate(size, random) {
  if (!(size > 0)) {
    return 0;
  }
  const value = random();
  if (!(typeof value === "number" && value >= 0 && value < 1)) {
    throw new RangeError("random() must return a number in [0, 1)");
  }
  return Math.floor((value - 0.5) * (size / 2));
}
function optionsObject(options, method) {
  if (options == null) {
    return {};
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError(`${method} expects an options object`);
  }
  return options;
}
function resolveStrategy(value) {
  const strategy = typeof value === "string" && Object.prototype.hasOwnProperty.call(STRATEGIES, value) ? STRATEGIES[value] : value;
  if (typeof strategy !== "function") {
    throw new TypeError("strategy() expects a built-in strategy name or strategy factory");
  }
  return strategy;
}
function normalizeStrategyCandidate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    const x = +value.x;
    const y = +value.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError("strategy candidates must have finite x and y");
    }
    return { x: Math.floor(x), y: Math.floor(y) };
  }
  throw new TypeError("strategy candidates must be {x, y} or null");
}
export {
  CloudLayout,
  CloudSprite,
  archimedeanStrategy,
  CloudLayout as default,
  noneStrategy,
  rectangularStrategy
};
