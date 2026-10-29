var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
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
var CREATE = Symbol("CloudSprite");
var CloudSprite = class {
  constructor(token, fields) {
    if (token !== CREATE) {
      throw new TypeError("CloudSprite instances are created by CloudLayout.getSprite()");
    }
    const _a = fields, { _rasterWidth } = _a, rest = __objRest(_a, ["_rasterWidth"]);
    Object.assign(this, rest);
    Object.defineProperty(this, "_rasterWidth", { value: _rasterWidth });
    Object.freeze(this);
  }
};
function createSprite(source, options, contextAndRatio) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const image = isImageSource(source) ? source : null;
  if (!image && !isTextSource(source)) {
    throw new TypeError("getSprite() expects text or an image-like source");
  }
  const fields = {
    text: String(image ? (_b = (_a = options.text) != null ? _a : source.alt) != null ? _b : "" : source),
    image,
    imageWidth: image ? normalizeOptionalInteger(options.width) : null,
    imageHeight: image ? normalizeOptionalInteger(options.height) : null,
    font: (_c = options.font) != null ? _c : "serif",
    style: (_e = (_d = options.style) != null ? _d : options.fontStyle) != null ? _e : "normal",
    weight: (_g = (_f = options.weight) != null ? _f : options.fontWeight) != null ? _g : "normal",
    rotate: normalizeNumber((_h = options.rotate) != null ? _h : 0),
    size: normalizeInteger((_j = (_i = options.size) != null ? _i : options.fontSize) != null ? _j : 1),
    padding: normalizeNumber((_k = options.padding) != null ? _k : image ? 0 : 1),
    datum: options.datum,
    width: 0,
    height: 0,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    trimX: 0,
    trimY: 0,
    trimWidth: 0,
    trimHeight: 0,
    spriteWidth: 0,
    sprite: null,
    _rasterWidth: null
  };
  const rasterized = image ? rasterizeImageSprite(fields, contextAndRatio) : rasterizeTextSprite(fields, contextAndRatio);
  return rasterized ? new CloudSprite(CREATE, fields) : null;
}
function createSpriteContext(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = canvas.height = 1;
  const ratio = Math.sqrt(context.getImageData(0, 0, 1, 1).data.length >> 2);
  canvas.width = SCRATCH_WIDTH / ratio;
  canvas.height = SCRATCH_HEIGHT / ratio;
  context.fillStyle = context.strokeStyle = "red";
  return {
    context,
    ratio,
    pixelWidth: SCRATCH_WIDTH,
    clearWidth: 0,
    clearHeight: 0
  };
}
function normalizeInteger(value) {
  value = +value;
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
function normalizeOptionalInteger(value) {
  if (value == null) {
    return null;
  }
  value = +value;
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}
function normalizeNumber(value) {
  value = +value;
  return Number.isFinite(value) ? value : 0;
}
function ceilToRatio(value, ratio) {
  return Math.max(1, Math.ceil(value / ratio) * ratio);
}
function clearContext(contextAndRatio) {
  const context = contextAndRatio.context;
  const ratio = contextAndRatio.ratio;
  if (contextAndRatio.clearWidth && contextAndRatio.clearHeight) {
    context.clearRect(0, 0, contextAndRatio.clearWidth / ratio, contextAndRatio.clearHeight / ratio);
  }
  return context;
}
function rasterizeTextSprite(sprite, contextAndRatio) {
  const context = clearContext(contextAndRatio);
  context.save();
  try {
    return drawTextSprite(sprite, contextAndRatio, context);
  } finally {
    context.restore();
  }
}
function drawTextSprite(sprite, contextAndRatio, context) {
  const ratio = contextAndRatio.ratio;
  const pixelWidth = contextAndRatio.pixelWidth;
  context.font = `${sprite.style} ${sprite.weight} ${Math.max(1, Math.ceil(sprite.size / ratio))}px ${sprite.font}`;
  context.textAlign = "center";
  const metrics = context.measureText(sprite.text);
  let width = (metrics.width + 1) * ratio;
  let height = sprite.size * 2;
  const hasInkBounds = Number.isFinite(metrics.actualBoundingBoxLeft) && Number.isFinite(metrics.actualBoundingBoxRight) && Number.isFinite(metrics.actualBoundingBoxAscent) && Number.isFinite(metrics.actualBoundingBoxDescent);
  if (hasInkBounds) {
    const strokeExtent = Math.abs(sprite.padding);
    width = Math.max(width, 2 * ratio * (strokeExtent + Math.max(
      Math.abs(metrics.actualBoundingBoxLeft),
      Math.abs(metrics.actualBoundingBoxRight)
    )));
    height = Math.max(height, 2 * ratio * (strokeExtent + Math.max(
      Math.abs(metrics.actualBoundingBoxAscent),
      Math.abs(metrics.actualBoundingBoxDescent)
    )));
  }
  if (sprite.rotate) {
    const sine = Math.sin(sprite.rotate * RADIANS);
    const cosine = Math.cos(sprite.rotate * RADIANS);
    const widthCosine = width * cosine;
    const widthSine = width * sine;
    const heightCosine = height * cosine;
    const heightSine = height * sine;
    width = Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine));
    height = Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine));
  }
  const overscan = Math.max(4, Math.ceil((sprite.padding + 2) * ratio * 2));
  const maxWidth = Math.floor(pixelWidth / ratio) * ratio;
  const maxHeight = Math.floor(SCRATCH_HEIGHT / ratio) * ratio;
  const overhang = hasInkBounds ? 0 : 2 * sprite.size;
  const envelopeWidth = ceilToRatio(width + overscan * 2, ratio);
  let rasterWidth = envelopeWidth;
  let rasterHeight = ceilToRatio(height + overscan * 2, ratio);
  let redrawn = false;
  let pixels;
  let alphaBounds;
  for (; ; ) {
    if (rasterWidth > maxWidth || rasterHeight > maxHeight) {
      contextAndRatio.clearWidth = 0;
      contextAndRatio.clearHeight = 0;
      return false;
    }
    context.save();
    try {
      context.translate((rasterWidth >> 1) / ratio, (rasterHeight >> 1) / ratio);
      if (sprite.rotate) {
        context.rotate(sprite.rotate * RADIANS);
      }
      context.fillText(sprite.text, 0, 0);
      if (sprite.padding) {
        context.lineWidth = 2 * sprite.padding;
        context.lineJoin = "round";
        context.strokeText(sprite.text, 0, 0);
      }
    } finally {
      context.restore();
      contextAndRatio.clearWidth = Math.min(pixelWidth, rasterWidth + overhang);
      contextAndRatio.clearHeight = Math.min(SCRATCH_HEIGHT, rasterHeight + overhang);
    }
    pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
    alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);
    if (!alphaBounds) {
      break;
    }
    const growWidth = alphaBounds.x0 === 0 || alphaBounds.x0 + alphaBounds.width === rasterWidth;
    const growHeight = alphaBounds.y0 === 0 || alphaBounds.y0 + alphaBounds.height === rasterHeight;
    if (!growWidth && !growHeight) {
      break;
    }
    redrawn = true;
    contextAndRatio.clearWidth = pixelWidth;
    contextAndRatio.clearHeight = SCRATCH_HEIGHT;
    clearContext(contextAndRatio);
    const nextWidth = growWidth ? Math.min(maxWidth, rasterWidth * 2) : rasterWidth;
    const nextHeight = growHeight ? Math.min(maxHeight, rasterHeight * 2) : rasterHeight;
    if (nextWidth === rasterWidth && nextHeight === rasterHeight) {
      alphaBounds = null;
      break;
    }
    rasterWidth = nextWidth;
    rasterHeight = nextHeight;
  }
  if (redrawn) {
    contextAndRatio.clearWidth = pixelWidth;
    contextAndRatio.clearHeight = SCRATCH_HEIGHT;
  }
  if (!alphaBounds) {
    return false;
  }
  sprite._rasterWidth = envelopeWidth;
  return extractSpritePixels(sprite, pixels, rasterWidth, rasterHeight, alphaBounds);
}
function rasterizeImageSprite(sprite, contextAndRatio) {
  const context = clearContext(contextAndRatio);
  const ratio = contextAndRatio.ratio;
  const pixelWidth = contextAndRatio.pixelWidth;
  const imageSize = resolveImageSize(sprite.image, sprite.imageWidth, sprite.imageHeight);
  if (!imageSize) {
    contextAndRatio.clearWidth = 0;
    contextAndRatio.clearHeight = 0;
    return false;
  }
  const { drawWidth, drawHeight } = imageSize;
  const bounds = rotatedBounds(drawWidth, drawHeight, sprite.rotate);
  const rasterWidth = ceilToRatio(bounds.width + 2 * ratio, ratio);
  const rasterHeight = ceilToRatio(bounds.height + 2 * ratio, ratio);
  if (rasterWidth > pixelWidth || rasterHeight > SCRATCH_HEIGHT) {
    contextAndRatio.clearWidth = 0;
    contextAndRatio.clearHeight = 0;
    return false;
  }
  context.save();
  try {
    context.translate((rasterWidth >> 1) / ratio, (rasterHeight >> 1) / ratio);
    if (sprite.rotate) {
      context.rotate(sprite.rotate * RADIANS);
    }
    context.drawImage(
      sprite.image,
      -drawWidth / (2 * ratio),
      -drawHeight / (2 * ratio),
      drawWidth / ratio,
      drawHeight / ratio
    );
  } finally {
    context.restore();
    contextAndRatio.clearWidth = rasterWidth;
    contextAndRatio.clearHeight = rasterHeight;
  }
  const pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
  const alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);
  if (!alphaBounds) {
    return false;
  }
  sprite.imageWidth = drawWidth;
  sprite.imageHeight = drawHeight;
  return extractSpritePixels(sprite, pixels, rasterWidth, rasterHeight, alphaBounds);
}
function extractSpritePixels(sprite, pixels, rasterWidth, rasterHeight, alphaBounds) {
  const packedWidth = alphaBounds.width + 31 >>> 5 << 5;
  const wordsPerRow = packedWidth >>> 5;
  const originX = -(rasterWidth >> 1);
  const originY = -(rasterHeight >> 1);
  sprite.width = alphaBounds.width;
  sprite.height = alphaBounds.height;
  sprite.spriteWidth = packedWidth;
  sprite.trimX = alphaBounds.x0;
  sprite.trimY = alphaBounds.y0;
  sprite.trimWidth = alphaBounds.width;
  sprite.trimHeight = alphaBounds.height;
  sprite.x0 = originX + alphaBounds.x0;
  sprite.y0 = originY + alphaBounds.y0;
  sprite.x1 = sprite.x0 + sprite.width;
  sprite.y1 = sprite.y0 + sprite.height;
  sprite.sprite = new Uint32Array(wordsPerRow * sprite.height);
  for (let row = 0; row < sprite.height; row += 1) {
    const sourceRow = alphaBounds.y0 + row;
    const rowOffset = row * wordsPerRow;
    for (let column = 0; column < sprite.width; column += 1) {
      const sourceColumn = alphaBounds.x0 + column;
      if (pixels[(sourceRow * rasterWidth + sourceColumn << 2) + 3]) {
        sprite.sprite[rowOffset + (column >>> 5)] |= 1 << 31 - (column & 31);
      }
    }
  }
  return true;
}
function resolveImageSize(image, imageWidth, imageHeight) {
  const sourceWidth = resolveImageDimension(image, "naturalWidth", "videoWidth", "width");
  const sourceHeight = resolveImageDimension(image, "naturalHeight", "videoHeight", "height");
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
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
  return {
    drawWidth,
    drawHeight
  };
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
function rotatedBounds(width, height, rotate) {
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
    width: Math.max(1, Math.ceil(Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)))),
    height: Math.max(1, Math.ceil(Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine))))
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
var IMAGE_SLACK = 4;
var STALL_LIMIT = 1e5;
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
    if (this._bounds) {
      throw new Error("Cannot change blockSize after placement; call clear() first");
    }
    this._blockSize = nextBlockSize;
    this._blocks = createOccupancyBlocks(this._blockSize);
    return this;
  }
  getSprite(source, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("getSprite() expects an options object");
    }
    return createSprite(source, options, this._getContext());
  }
  erase(word) {
    const placement = word && typeof word === "object" ? this._placements.get(word) : void 0;
    if (!placement) {
      throw new Error("erase() expects a word returned by place() on this layout since it was last cleared");
    }
    this._blocks.remove(placement.sprite, placement.x, placement.y);
    this._placements.delete(word);
    if (this._blocks.isEmpty()) {
      this._bounds = null;
    }
  }
  place(sprite, options = void 0) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite from getSprite()");
    }
    if (options != null && (!options || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("place() expects an options object");
    }
    const strategy = (options == null ? void 0 : options.strategy) == null ? this._strategy : resolveStrategy(options.strategy);
    const x = (options == null ? void 0 : options.x) == null ? seedCoordinate(this._size[0], this._random) : normalizeCoordinate(options.x);
    const y = (options == null ? void 0 : options.y) == null ? seedCoordinate(this._size[1], this._random) : normalizeCoordinate(options.y);
    const position = tryPlaceSprite(this._blocks, sprite, x, y, this._bounds, strategy, this._size, this._overflow, this._random);
    if (!position) {
      return null;
    }
    extendBounds(this, sprite, position.x, position.y);
    const word = createPlacedWord(sprite, position.x, position.y);
    this._placements.set(word, { sprite, x: position.x, y: position.y });
    return word;
  }
  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvasFactory());
    }
    return this._spriteContext;
  }
};
function tryPlaceSprite(blocks, sprite, startX, startY, bounds, strategy, size, overflow, random) {
  var deltaLimit = resolveMaxDelta(sprite, startX, startY, bounds, size, overflow), limitX = deltaLimit[0], limitY = deltaLimit[1], clipBounds = overflow ? null : sizeBounds(size), aspectRatio = sizeAspectRatio(size), next, candidate, dx, dy, progress;
  if ((!clipBounds || withinBounds(sprite, startX, startY, clipBounds)) && (!bounds || collideRects(sprite, startX, startY, bounds)) && !blocks.collides(sprite, startX, startY)) {
    blocks.insert(sprite, startX, startY);
    return { x: startX, y: startY };
  }
  next = strategy(
    { x: startX, y: startY },
    {
      size: size.slice(),
      aspectRatio,
      bounds: cloneBounds(bounds),
      overflow,
      random
    }
  );
  if (typeof next !== "function") {
    throw new TypeError("strategy factories must return a candidate generator");
  }
  var reach = 0, stalled = 0;
  while (candidate = normalizeStrategyCandidate(next())) {
    dx = Math.abs(candidate.x - startX);
    dy = Math.abs(candidate.y - startY);
    if (dx >= limitX && dy >= limitY) break;
    progress = Math.min(dx / limitX, dy / limitY);
    if (progress > reach) {
      reach = progress;
      stalled = 0;
    } else if (++stalled >= STALL_LIMIT) {
      break;
    }
    if (clipBounds && !withinBounds(sprite, candidate.x, candidate.y, clipBounds)) continue;
    if (!bounds || collideRects(sprite, candidate.x, candidate.y, bounds)) {
      if (!blocks.collides(sprite, candidate.x, candidate.y)) {
        blocks.insert(sprite, candidate.x, candidate.y);
        return candidate;
      }
    }
  }
  return null;
}
function createOccupancyBlocks(cellSize) {
  const blocks = /* @__PURE__ */ new Map();
  const blockSize = normalizeBlockSize(cellSize);
  const blockWords = blockSize >>> 5;
  function visitBlocks(sprite, x, y, visit, create, prune) {
    var data = sprite.sprite, words = spriteWords(sprite), left = x + sprite.x0, top = y + sprite.y0, right = x + sprite.x1, bottom = y + sprite.y1, firstX = Math.floor(left / blockSize), lastX = Math.floor((right - 1) / blockSize), firstY = Math.floor(top / blockSize), lastY = Math.floor((bottom - 1) / blockSize);
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
          block = new Uint32Array(blockWords * blockSize);
          blockRow.set(blockX, block);
        }
        if (visit(
          data,
          words,
          left,
          top,
          block,
          blockWords,
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
    collides(sprite, x, y) {
      return visitBlocks(sprite, x, y, packedRegionCollides, false, false);
    },
    insert(sprite, x, y) {
      visitBlocks(sprite, x, y, stampPackedRegion, true, false);
    },
    remove(sprite, x, y) {
      visitBlocks(sprite, x, y, clearPackedRegion, false, true);
    }
  };
}
function packedRegionCollides(aData, aWidth, aLeft, aTop, bData, bWidth, bLeft, bTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, aStartBit = overlapLeft - aLeft, bStartBit = overlapLeft - bLeft, aStartRow = overlapTop - aTop, bStartRow = overlapTop - bTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var aRowOffset = (aStartRow + row) * aWidth, bRowOffset = (bStartRow + row) * bWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, aWord = readPackedWord(aData, aRowOffset, aWidth, aStartBit + (word << 5)), bWord = readPackedWord(bData, bRowOffset, bWidth, bStartBit + (word << 5));
      if ((aWord & bWord & mask) !== 0) {
        return true;
      }
    }
  }
  return false;
}
function stampPackedRegion(sourceData, sourceWidth, sourceLeft, sourceTop, targetData, targetWidth, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, sourceStartBit = overlapLeft - sourceLeft, targetStartBit = overlapLeft - targetLeft, sourceStartRow = overlapTop - sourceTop, targetStartRow = overlapTop - targetTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWidth, targetRowOffset = (targetStartRow + row) * targetWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWidth, sourceStartBit + (word << 5)) & mask;
      orPackedWord(targetData, targetRowOffset, targetWidth, targetStartBit + (word << 5), sourceWord);
    }
  }
}
function clearPackedRegion(sourceData, sourceWidth, sourceLeft, sourceTop, targetData, targetWidth, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop, words = overlapRight - overlapLeft + 31 >>> 5, sourceStartBit = overlapLeft - sourceLeft, targetStartBit = overlapLeft - targetLeft, sourceStartRow = overlapTop - sourceTop, targetStartRow = overlapTop - targetTop, trailing = overlapRight - overlapLeft & 31, lastMask = trailing ? ~0 << 32 - trailing >>> 0 : 4294967295;
  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWidth, targetRowOffset = (targetStartRow + row) * targetWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 4294967295, sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWidth, sourceStartBit + (word << 5)) & mask;
      clearPackedWord(targetData, targetRowOffset, targetWidth, targetStartBit + (word << 5), sourceWord);
    }
  }
}
function readPackedWord(sprite, rowOffset, rowWidth, bitIndex) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31, current = wordIndex < rowWidth ? sprite[rowOffset + wordIndex] : 0;
  if (!bitOffset) {
    return current;
  }
  var next = wordIndex + 1 < rowWidth ? sprite[rowOffset + wordIndex + 1] : 0;
  return (current << bitOffset | next >>> 32 - bitOffset) >>> 0;
}
function orPackedWord(target, rowOffset, rowWidth, bitIndex, value) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31;
  if (!bitOffset) {
    target[rowOffset + wordIndex] |= value;
    return;
  }
  target[rowOffset + wordIndex] |= value >>> bitOffset;
  if (wordIndex + 1 < rowWidth) {
    target[rowOffset + wordIndex + 1] |= value << 32 - bitOffset >>> 0;
  }
}
function clearPackedWord(target, rowOffset, rowWidth, bitIndex, value) {
  var wordIndex = bitIndex >>> 5, bitOffset = bitIndex & 31;
  if (!bitOffset) {
    target[rowOffset + wordIndex] &= ~value >>> 0;
    return;
  }
  target[rowOffset + wordIndex] &= ~(value >>> bitOffset) >>> 0;
  if (wordIndex + 1 < rowWidth) {
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
function resolveMaxDelta(sprite, x, y, bounds, size, overflow) {
  if (!overflow) {
    return [
      Math.max(
        size[0],
        Math.abs(x + sprite.x0 + size[0] / 2) + 1,
        Math.abs(x + sprite.x1 - size[0] / 2) + 1
      ),
      Math.max(
        size[1],
        Math.abs(y + sprite.y0 + size[1] / 2) + 1,
        Math.abs(y + sprite.y1 - size[1] / 2) + 1
      )
    ];
  }
  var wordExtent = Math.max(sprite.width || 0, sprite.height || 0), boundsExtent = bounds ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y) : 0, limit = Math.max(256, wordExtent * 4, boundsExtent * 2);
  if (!bounds) {
    return [limit, limit];
  }
  return [
    Math.max(
      limit,
      Math.abs(x + sprite.x0 - bounds[1].x) + 1,
      Math.abs(x + sprite.x1 - bounds[0].x) + 1
    ),
    Math.max(
      limit,
      Math.abs(y + sprite.y0 - bounds[1].y) + 1,
      Math.abs(y + sprite.y1 - bounds[0].y) + 1
    )
  ];
}
function createPlacedWord(sprite, x, y) {
  return {
    text: sprite.text,
    image: sprite.image,
    imageWidth: sprite.imageWidth,
    imageHeight: sprite.imageHeight,
    font: sprite.font,
    style: sprite.style,
    weight: sprite.weight,
    rotate: sprite.rotate,
    size: sprite.size,
    padding: sprite.padding,
    datum: sprite.datum,
    x,
    y,
    width: sprite.width,
    height: sprite.height,
    x0: sprite.x0,
    y0: sprite.y0,
    x1: sprite.x1,
    y1: sprite.y1,
    trimX: sprite.trimX,
    trimY: sprite.trimY,
    trimWidth: sprite.trimWidth,
    trimHeight: sprite.trimHeight
  };
}
function extendBounds(layout, sprite, x, y) {
  var left = x + sprite.x0, top = y + sprite.y0, right = x + sprite.x1, bottom = y + sprite.y1, bounds = layout._bounds;
  if (!bounds) {
    layout._bounds = [{ x: left, y: top }, { x: right, y: bottom }];
    return;
  }
  if (left < bounds[0].x) bounds[0].x = left;
  if (top < bounds[0].y) bounds[0].y = top;
  if (right > bounds[1].x) bounds[1].x = right;
  if (bottom > bounds[1].y) bounds[1].y = bottom;
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
function collideRects(a, x, y, b) {
  var x0, x1, y0, y1;
  if (a._rasterWidth == null) {
    x0 = a.x0 - IMAGE_SLACK;
    x1 = a.x1 + IMAGE_SLACK;
    y0 = a.y0 - IMAGE_SLACK;
    y1 = a.y1 + IMAGE_SLACK;
  } else {
    x0 = -(a._rasterWidth >> 1);
    x1 = Math.max(a.x1, x0 + a._rasterWidth);
    x0 = Math.min(a.x0, x0);
    y0 = a.y0;
    y1 = a.y1;
  }
  return x + x1 > b[0].x && x + x0 < b[1].x && y + y1 > b[0].y && y + y0 < b[1].y;
}
function withinBounds(a, x, y, b) {
  return x + a.x0 >= b[0].x && x + a.x1 <= b[1].x && y + a.y0 >= b[0].y && y + a.y1 <= b[1].y;
}
function archimedeanStrategy(initial, context) {
  var spiral = archimedeanOffsets(context.aspectRatio), dt = context.random() < 0.5 ? 1 : -1, t = 0;
  return function() {
    var dxdy = spiral(t += dt);
    return {
      x: initial.x + ~~dxdy[0],
      y: initial.y + ~~dxdy[1]
    };
  };
}
function rectangularStrategy(initial, context) {
  var spiral = rectangularOffsets(context.aspectRatio), dt = context.random() < 0.5 ? 1 : -1, t = 0;
  return function() {
    var dxdy = spiral(t += dt);
    return {
      x: initial.x + ~~dxdy[0],
      y: initial.y + ~~dxdy[1]
    };
  };
}
function noneStrategy() {
  return function() {
    return null;
  };
}
function archimedeanOffsets(aspectRatio) {
  var e = normalizeAspectRatio(aspectRatio);
  return function(t) {
    t *= 0.1;
    return [e * t * Math.cos(t), t * Math.sin(t)];
  };
}
function rectangularOffsets(aspectRatio) {
  var dy = 4, dx = dy * normalizeAspectRatio(aspectRatio), x = 0, y = 0;
  return function(t) {
    var sign = t < 0 ? -1 : 1;
    switch (Math.sqrt(1 + 4 * sign * t) - sign & 3) {
      case 0:
        x += dx;
        break;
      case 1:
        y += dy;
        break;
      case 2:
        x -= dx;
        break;
      default:
        y -= dy;
        break;
    }
    return [x, y];
  };
}
function defaultCanvasFactory() {
  return document.createElement("canvas");
}
function normalizeAspectRatio(value) {
  value = +value;
  return value > 0 && Number.isFinite(value) ? value : 1;
}
function normalizeBlockSize(value) {
  value = +value;
  value = value > 0 && Number.isFinite(value) ? Math.max(1, value | 0) : 512;
  return value + 31 >>> 5 << 5;
}
function normalizeCoordinate(value) {
  value = +value;
  return Number.isFinite(value) ? Math.floor(value) : 0;
}
function spriteWords(sprite) {
  var _a;
  return ((_a = sprite.spriteWidth) != null ? _a : sprite.width) >>> 5;
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
  return value > 0 && Number.isFinite(value) ? value : 0;
}
function sizeAspectRatio(size) {
  return normalizeAspectRatio(size[0] / size[1]);
}
function sizeBounds(size) {
  return [
    { x: -size[0] / 2, y: -size[1] / 2 },
    { x: size[0] / 2, y: size[1] / 2 }
  ];
}
function seedCoordinate(size, random) {
  if (!(size > 0)) {
    return 0;
  }
  return Math.floor((random() - 0.5) * (size / 2));
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
    return {
      x: normalizeCoordinate(value.x),
      y: normalizeCoordinate(value.y)
    };
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
