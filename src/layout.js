// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import CloudSprite, { createSpriteContext } from "./sprite.js";

const STRATEGIES = {
  archimedean: archimedeanStrategy,
  rectangular: rectangularStrategy,
  none: noneStrategy
};

export default class CloudLayout {
  constructor() {
    this._size = [256, 256];
    this._overflow = true;
    this._strategy = archimedeanStrategy;
    this._random = Math.random;
    this._blockSize = 512;
    this._maxDelta = null;
    this._canvasFactory = defaultCanvasFactory;
    this._spriteContext = null;
    this._bounds = null;
    this._blockState = createSparseBlocks(this._blockSize);
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
    this._bounds = null;
    this._blockState = createSparseBlocks(this._blockSize);
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
    if (this._bounds && nextBlockSize !== this._blockSize) {
      throw new Error("Cannot change blockSize after placement; call clear() first");
    }
    this._blockSize = nextBlockSize;
    this._blockState = createSparseBlocks(this._blockSize);
    return this;
  }

  maxDelta(_) {
    if (!arguments.length) {
      return this._maxDelta;
    }
    this._maxDelta = _ == null ? null : +_;
    return this;
  }

  getSprite(source, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("getSprite() expects an options object");
    }

    const sprite = createCloudSprite(source, options);
    sprite.rasterize(this._getContext());
    return sprite.hasText ? sprite : null;
  }

  removeSprite(sprite) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("removeSprite() expects a CloudSprite");
    }

    this._blockState.remove(sprite);
    if (this._blockState.isEmpty()) {
      this._bounds = null;
    }
    return true;
  }

  place(sprite, options = undefined) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite");
    }
    if (options != null && (!options || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("place() expects an options object");
    }

    const strategy = options?.strategy == null ? this._strategy : resolveStrategy(options.strategy);
    sprite.x = options?.x == null ? seedCoordinate(this._size[0], this._random) : normalizeCoordinate(options.x);
    sprite.y = options?.y == null ? seedCoordinate(this._size[1], this._random) : normalizeCoordinate(options.y);

    sprite.rasterize(this._getContext());
    if (!sprite.hasText) {
      return null;
    }
    if (!placeTag(this._blockState, sprite, this._bounds, strategy, this._size, this._overflow, this._random, this._maxDelta)) {
      return null;
    }

    extendBounds(this, sprite);

    return outputWord(sprite);
  }

  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvasFactory());
    }
    return this._spriteContext;
  }
}

function createCloudSprite(text, options) {
  const spriteOptions = normalizeSpriteOptions(options, isImageSource(text) ? 0 : 1);

  if (isTextSource(text)) {
    return new CloudSprite({
      ...spriteOptions,
      text
    });
  }

  if (isImageSource(text)) {
    return new CloudSprite({
      ...spriteOptions,
      text: spriteOptions.text ?? text.alt ?? "",
      image: text,
      imageWidth: options.width,
      imageHeight: options.height
    });
  }

  throw new TypeError("getSprite() expects text or an image-like source");
}

function placeTag(state, tag, bounds, strategy, size, overflow, random, maxDelta) {
  var startX = tag.x,
      startY = tag.y,
      deltaLimit = resolveMaxDelta(tag, bounds, maxDelta, size, overflow),
      clipBounds = overflow ? null : sizeBounds(size),
      next,
      candidate,
      dx,
      dy;

  if ((!clipBounds || withinBounds(tag, clipBounds)) &&
      (!bounds || collideRects(tag, bounds)) &&
      !state.collides(tag)) {
    state.insert(tag);
    return true;
  }

  next = strategy(
    { x: startX, y: startY },
    {
      size: size.slice(),
      aspectRatio: sizeAspectRatio(size),
      bounds: cloneBounds(bounds),
      overflow,
      random,
      maxDelta: deltaLimit
    }
  );
  if (typeof next !== "function") {
    throw new TypeError("strategy factories must return a candidate generator");
  }

  while (candidate = normalizeStrategyCandidate(next())) {
    dx = candidate.x - startX;
    dy = candidate.y - startY;

    if (Math.min(Math.abs(dx), Math.abs(dy)) >= deltaLimit) break;

    tag.x = candidate.x;
    tag.y = candidate.y;

    if (clipBounds && !withinBounds(tag, clipBounds)) continue;

    if (!bounds || collideRects(tag, bounds)) {
      if (!state.collides(tag)) {
        state.insert(tag);
        return true;
      }
    }
  }
  return false;
}

function createSparseBlocks(cellSize) {
  const blocks = new Map();
  const blockSize = normalizeBlockSize(cellSize);
  const blockWords = blockSize >>> 5;

  return {
    isEmpty() {
      return blocks.size === 0;
    },
    collides(tag) {
      var left = tag.x + tag.x0,
          top = tag.y + tag.y0,
          right = tag.x + tag.x1,
          bottom = tag.y + tag.y1,
          range = getRangeForBounds(left, top, right, bottom, blockSize);

      for (var blockY = range.y0; blockY <= range.y1; blockY++) {
        var blockTop = blockY * blockSize,
            overlapTop = Math.max(top, blockTop),
            overlapBottom = Math.min(bottom, blockTop + blockSize);
        for (var blockX = range.x0; blockX <= range.x1; blockX++) {
          var block = blocks.get(blockKey(blockX, blockY));
          if (!block) continue;
          var blockLeft = blockX * blockSize,
              overlapLeft = Math.max(left, blockLeft),
              overlapRight = Math.min(right, blockLeft + blockSize);
          if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
          if (packedRegionCollides(
            tag.sprite,
            spriteWords(tag),
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
        }
      }
      return false;
    },
    insert(tag) {
      var left = tag.x + tag.x0,
          top = tag.y + tag.y0,
          right = tag.x + tag.x1,
          bottom = tag.y + tag.y1,
          range = getRangeForBounds(left, top, right, bottom, blockSize);

      for (var blockY = range.y0; blockY <= range.y1; blockY++) {
        var blockTop = blockY * blockSize,
            overlapTop = Math.max(top, blockTop),
            overlapBottom = Math.min(bottom, blockTop + blockSize);
        for (var blockX = range.x0; blockX <= range.x1; blockX++) {
          var blockLeft = blockX * blockSize,
              overlapLeft = Math.max(left, blockLeft),
              overlapRight = Math.min(right, blockLeft + blockSize);
          if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
          var key = blockKey(blockX, blockY),
              block = blocks.get(key);
          if (!block) {
            block = new Uint32Array(blockWords * blockSize);
            blocks.set(key, block);
          }
          stampPackedRegion(
            tag.sprite,
            spriteWords(tag),
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
          );
        }
      }
    },
    remove(tag) {
      var left = tag.x + tag.x0,
          top = tag.y + tag.y0,
          right = tag.x + tag.x1,
          bottom = tag.y + tag.y1,
          range = getRangeForBounds(left, top, right, bottom, blockSize);

      for (var blockY = range.y0; blockY <= range.y1; blockY++) {
        var blockTop = blockY * blockSize,
            overlapTop = Math.max(top, blockTop),
            overlapBottom = Math.min(bottom, blockTop + blockSize);
        for (var blockX = range.x0; blockX <= range.x1; blockX++) {
          var key = blockKey(blockX, blockY),
              block = blocks.get(key);
          if (!block) continue;
          var blockLeft = blockX * blockSize,
              overlapLeft = Math.max(left, blockLeft),
              overlapRight = Math.min(right, blockLeft + blockSize);
          if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
          clearPackedRegion(
            tag.sprite,
            spriteWords(tag),
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
          );
          if (isZeroBlock(block)) {
            blocks.delete(key);
          }
        }
      }
    }
  };
}

function packedRegionCollides(aData, aWidth, aLeft, aTop, bData, bWidth, bLeft, bTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop,
      words = (overlapRight - overlapLeft + 31) >>> 5,
      aStartBit = overlapLeft - aLeft,
      bStartBit = overlapLeft - bLeft,
      aStartRow = overlapTop - aTop,
      bStartRow = overlapTop - bTop,
      trailing = (overlapRight - overlapLeft) & 31,
      lastMask = trailing ? (~0 << (32 - trailing)) >>> 0 : 0xffffffff;

  for (var row = 0; row < rows; row++) {
    var aRowOffset = (aStartRow + row) * aWidth,
        bRowOffset = (bStartRow + row) * bWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 0xffffffff,
          aWord = readPackedWord(aData, aRowOffset, aWidth, aStartBit + (word << 5)),
          bWord = readPackedWord(bData, bRowOffset, bWidth, bStartBit + (word << 5));
      if ((aWord & bWord & mask) !== 0) {
        return true;
      }
    }
  }

  return false;
}

function stampPackedRegion(sourceData, sourceWidth, sourceLeft, sourceTop, targetData, targetWidth, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop,
      words = (overlapRight - overlapLeft + 31) >>> 5,
      sourceStartBit = overlapLeft - sourceLeft,
      targetStartBit = overlapLeft - targetLeft,
      sourceStartRow = overlapTop - sourceTop,
      targetStartRow = overlapTop - targetTop,
      trailing = (overlapRight - overlapLeft) & 31,
      lastMask = trailing ? (~0 << (32 - trailing)) >>> 0 : 0xffffffff;

  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWidth,
        targetRowOffset = (targetStartRow + row) * targetWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 0xffffffff,
          sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWidth, sourceStartBit + (word << 5)) & mask;
      orPackedWord(targetData, targetRowOffset, targetWidth, targetStartBit + (word << 5), sourceWord);
    }
  }
}

function clearPackedRegion(sourceData, sourceWidth, sourceLeft, sourceTop, targetData, targetWidth, targetLeft, targetTop, overlapLeft, overlapTop, overlapRight, overlapBottom) {
  var rows = overlapBottom - overlapTop,
      words = (overlapRight - overlapLeft + 31) >>> 5,
      sourceStartBit = overlapLeft - sourceLeft,
      targetStartBit = overlapLeft - targetLeft,
      sourceStartRow = overlapTop - sourceTop,
      targetStartRow = overlapTop - targetTop,
      trailing = (overlapRight - overlapLeft) & 31,
      lastMask = trailing ? (~0 << (32 - trailing)) >>> 0 : 0xffffffff;

  for (var row = 0; row < rows; row++) {
    var sourceRowOffset = (sourceStartRow + row) * sourceWidth,
        targetRowOffset = (targetStartRow + row) * targetWidth;
    for (var word = 0; word < words; word++) {
      var mask = word === words - 1 ? lastMask : 0xffffffff,
          sourceWord = readPackedWord(sourceData, sourceRowOffset, sourceWidth, sourceStartBit + (word << 5)) & mask;
      clearPackedWord(targetData, targetRowOffset, targetWidth, targetStartBit + (word << 5), sourceWord);
    }
  }
}

function readPackedWord(sprite, rowOffset, rowWidth, bitIndex) {
  var wordIndex = bitIndex >>> 5,
      bitOffset = bitIndex & 31,
      current = wordIndex < rowWidth ? sprite[rowOffset + wordIndex] : 0;

  if (!bitOffset) {
    return current;
  }

  var next = wordIndex + 1 < rowWidth ? sprite[rowOffset + wordIndex + 1] : 0;
  return ((current << bitOffset) | (next >>> (32 - bitOffset))) >>> 0;
}

function orPackedWord(target, rowOffset, rowWidth, bitIndex, value) {
  var wordIndex = bitIndex >>> 5,
      bitOffset = bitIndex & 31;

  if (!bitOffset) {
    target[rowOffset + wordIndex] |= value;
    return;
  }

  target[rowOffset + wordIndex] |= value >>> bitOffset;
  if (wordIndex + 1 < rowWidth) {
    target[rowOffset + wordIndex + 1] |= (value << (32 - bitOffset)) >>> 0;
  }
}

function clearPackedWord(target, rowOffset, rowWidth, bitIndex, value) {
  var wordIndex = bitIndex >>> 5,
      bitOffset = bitIndex & 31;

  if (!bitOffset) {
    target[rowOffset + wordIndex] &= (~value) >>> 0;
    return;
  }

  target[rowOffset + wordIndex] &= (~(value >>> bitOffset)) >>> 0;
  if (wordIndex + 1 < rowWidth) {
    target[rowOffset + wordIndex + 1] &= (~((value << (32 - bitOffset)) >>> 0)) >>> 0;
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

function getRangeForBounds(left, top, right, bottom, cellSize) {
  right -= 1;
  bottom -= 1;
  return {
    x0: Math.floor(left / cellSize),
    y0: Math.floor(top / cellSize),
    x1: Math.floor(right / cellSize),
    y1: Math.floor(bottom / cellSize)
  };
}

function blockKey(x, y) {
  return x + "," + y;
}

function resolveMaxDelta(tag, bounds, maxDelta, size, overflow) {
  if (maxDelta != null) {
    return maxDelta;
  }
  var wordExtent = Math.max(tag.width || 0, tag.height || 0),
      sizeExtent = overflow ? 0 : Math.max(size[0], size[1]),
      boundsExtent = bounds
        ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y)
        : 0;
  return Math.max(256, wordExtent * 4, boundsExtent * 2, sizeExtent);
}

function outputWord(d) {
  const { hasText, sprite, spriteWidth, ...word } = d;
  return word;
}

function extendBounds(layout, sprite) {
  if (layout._bounds) {
    cloudBounds(layout._bounds, sprite);
  } else {
    layout._bounds = [
      { x: sprite.x + sprite.x0, y: sprite.y + sprite.y0 },
      { x: sprite.x + sprite.x1, y: sprite.y + sprite.y1 }
    ];
  }
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

function cloudBounds(bounds, d) {
  var b0 = bounds[0],
      b1 = bounds[1];
  if (d.x + d.x0 < b0.x) b0.x = d.x + d.x0;
  if (d.y + d.y0 < b0.y) b0.y = d.y + d.y0;
  if (d.x + d.x1 > b1.x) b1.x = d.x + d.x1;
  if (d.y + d.y1 > b1.y) b1.y = d.y + d.y1;
}

function collideRects(a, b) {
  return a.x + a.x1 > b[0].x && a.x + a.x0 < b[1].x && a.y + a.y1 > b[0].y && a.y + a.y0 < b[1].y;
}

function withinBounds(a, b) {
  return a.x + a.x0 >= b[0].x && a.x + a.x1 <= b[1].x && a.y + a.y0 >= b[0].y && a.y + a.y1 <= b[1].y;
}

export function archimedeanStrategy(initial, context) {
  var spiral = archimedeanOffsets(context.aspectRatio),
      dt = context.random() < .5 ? 1 : -1,
      t = 0;

  return function() {
    var dxdy = spiral(t += dt);
    return {
      x: initial.x + ~~dxdy[0],
      y: initial.y + ~~dxdy[1]
    };
  };
}

export function rectangularStrategy(initial, context) {
  var spiral = rectangularOffsets(context.aspectRatio),
      dt = context.random() < .5 ? 1 : -1,
      t = 0;

  return function() {
    var dxdy = spiral(t += dt);
    return {
      x: initial.x + ~~dxdy[0],
      y: initial.y + ~~dxdy[1]
    };
  };
}

export function noneStrategy() {
  return function() {
    return null;
  };
}

function archimedeanOffsets(aspectRatio) {
  var e = normalizeAspectRatio(aspectRatio);
  return function(t) {
    t *= .1;
    return [e * t * Math.cos(t), t * Math.sin(t)];
  };
}

function rectangularOffsets(aspectRatio) {
  var dy = 4,
      dx = dy * normalizeAspectRatio(aspectRatio),
      x = 0,
      y = 0;
  return function(t) {
    var sign = t < 0 ? -1 : 1;
    switch ((Math.sqrt(1 + 4 * sign * t) - sign) & 3) {
      case 0:  x += dx; break;
      case 1:  y += dy; break;
      case 2:  x -= dx; break;
      default: y -= dy; break;
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
  return ((value + 31) >>> 5) << 5;
}

function normalizeCoordinate(value) {
  value = +value;
  return Number.isFinite(value) ? value : 0;
}

function spriteWords(sprite) {
  return (sprite.spriteWidth ?? sprite.width) >>> 5;
}

function isTextSource(source) {
  return typeof source === "string" || typeof source === "number" || typeof source === "boolean" || source instanceof String;
}

function isImageSource(source) {
  return !!source &&
    typeof source === "object" &&
    !Array.isArray(source) &&
    (
      typeof source.width === "number" ||
      typeof source.naturalWidth === "number" ||
      typeof source.videoWidth === "number"
    );
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

function normalizeSpriteOptions(options, padding) {
  return {
    ...options,
    style: options.style ?? options.fontStyle,
    weight: options.weight ?? options.fontWeight,
    size: options.size ?? options.fontSize,
    padding: options.padding ?? padding
  };
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
  return Math.floor((random() - 0.5) * size);
}

function resolveStrategy(value) {
  const strategy = STRATEGIES[value] || value;
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
