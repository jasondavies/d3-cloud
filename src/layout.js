// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import CloudSprite, { createSpriteContext } from "./sprite.js";

const IMAGE_SLACK = 4;
const FAR_LIMIT_SCALE = 8;
const STALL_LIMIT = 100000;

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
    this._canvasFactory = defaultCanvasFactory;
    this._spriteContext = null;
    this._bounds = null;
    this._blocks = createOccupancyBlocks(this._blockSize);
    this._generation = 0;
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
    // Invalidate every placement without retaining the placed sprites.
    this._generation++;
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

    const sprite = createCloudSprite(source, options);
    sprite.rasterize(this._getContext());
    return sprite.hasPixels ? sprite : null;
  }

  eraseSprite(sprite) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("eraseSprite() expects a CloudSprite");
    }
    if (!isPlacedIn(sprite, this)) {
      throw new Error("eraseSprite() expects a sprite placed in this layout");
    }

    this._blocks.remove(sprite);
    sprite._placedLayout = null;
    if (this._blocks.isEmpty()) {
      this._bounds = null;
    }
  }

  place(sprite, options = undefined) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite");
    }
    if (options != null && (!options || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("place() expects an options object");
    }
    if (sprite._placedLayout && isPlacedIn(sprite, sprite._placedLayout)) {
      throw new Error("Cannot place a CloudSprite that is already placed; call eraseSprite() first");
    }

    const strategy = options?.strategy == null ? this._strategy : resolveStrategy(options.strategy);
    sprite.x = options?.x == null ? seedCoordinate(this._size[0], this._random) : normalizeCoordinate(options.x);
    sprite.y = options?.y == null ? seedCoordinate(this._size[1], this._random) : normalizeCoordinate(options.y);

    sprite.rasterize(this._getContext());
    if (!sprite.hasPixels) {
      return null;
    }
    if (!tryPlaceSprite(this._blocks, sprite, this._bounds, strategy, this._size, this._overflow, this._random)) {
      return null;
    }

    extendBounds(this, sprite);
    sprite._placedLayout = this;
    sprite._placedGeneration = this._generation;

    return snapshotPlacedSprite(sprite);
  }

  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvasFactory());
    }
    return this._spriteContext;
  }
}

function createCloudSprite(source, options) {
  const spriteOptions = normalizeSpriteOptions(options, isImageSource(source) ? 0 : 1);

  if (isTextSource(source)) {
    return new CloudSprite({
      ...spriteOptions,
      text: source
    });
  }

  if (isImageSource(source)) {
    return new CloudSprite({
      ...spriteOptions,
      text: spriteOptions.text ?? source.alt ?? "",
      image: source,
      imageWidth: options.width,
      imageHeight: options.height
    });
  }

  throw new TypeError("getSprite() expects text or an image-like source");
}

function tryPlaceSprite(blocks, sprite, bounds, strategy, size, overflow, random) {
  var startX = sprite.x,
      startY = sprite.y,
      deltaLimit = resolveMaxDelta(sprite, bounds, size, overflow),
      limitX = deltaLimit[0],
      limitY = deltaLimit[1],
      clipBounds = overflow ? null : sizeBounds(size),
      next,
      candidate,
      dx,
      dy,
      distance;

  if ((!clipBounds || withinBounds(sprite, clipBounds)) &&
      (!bounds || collideRects(sprite, bounds)) &&
      !blocks.collides(sprite)) {
    blocks.insert(sprite);
    return true;
  }

  next = strategy(
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

  // Stop once a candidate is beyond the limits on both axes, or far beyond
  // either, so narrow spirals and single-axis generators terminate. Stop
  // generators that repeat points once they stop moving away from the seed.
  var farX = limitX * FAR_LIMIT_SCALE,
      farY = limitY * FAR_LIMIT_SCALE,
      reach = 0,
      stalled = 0;
  while ((candidate = normalizeStrategyCandidate(next()))) {
    dx = Math.abs(candidate.x - startX);
    dy = Math.abs(candidate.y - startY);

    distance = Math.max(dx, dy);

    if ((dx >= limitX && dy >= limitY) || dx >= farX || dy >= farY) break;
    if (distance > reach) {
      reach = distance;
      stalled = 0;
    } else if (++stalled >= STALL_LIMIT) {
      break;
    }

    sprite.x = candidate.x;
    sprite.y = candidate.y;

    if (clipBounds && !withinBounds(sprite, clipBounds)) continue;

    if (!bounds || collideRects(sprite, bounds)) {
      if (!blocks.collides(sprite)) {
        blocks.insert(sprite);
        return true;
      }
    }
  }
  return false;
}

function createOccupancyBlocks(cellSize) {
  const blocks = new Map();
  const blockSize = normalizeBlockSize(cellSize);
  const blockWords = blockSize >>> 5;

  // Applies visit to each block region the sprite overlaps, stopping early
  // if it returns true. Missing blocks are created when inserting, and
  // emptied blocks are pruned when removing.
  function visitBlocks(sprite, visit, create, prune) {
    var data = sprite.sprite,
        words = spriteWords(sprite),
        left = sprite.x + sprite.x0,
        top = sprite.y + sprite.y0,
        right = sprite.x + sprite.x1,
        bottom = sprite.y + sprite.y1,
        firstX = Math.floor(left / blockSize),
        lastX = Math.floor((right - 1) / blockSize),
        firstY = Math.floor(top / blockSize),
        lastY = Math.floor((bottom - 1) / blockSize);

    for (var blockY = firstY; blockY <= lastY; blockY++) {
      var blockRow = blocks.get(blockY);
      if (!blockRow) {
        if (!create) continue;
        blockRow = new Map();
        blocks.set(blockY, blockRow);
      }
      var blockTop = blockY * blockSize,
          overlapTop = Math.max(top, blockTop),
          overlapBottom = Math.min(bottom, blockTop + blockSize);
      for (var blockX = firstX; blockX <= lastX; blockX++) {
        var blockLeft = blockX * blockSize,
            overlapLeft = Math.max(left, blockLeft),
            overlapRight = Math.min(right, blockLeft + blockSize);
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
    collides(sprite) {
      return visitBlocks(sprite, packedRegionCollides, false, false);
    },
    insert(sprite) {
      visitBlocks(sprite, stampPackedRegion, true, false);
    },
    remove(sprite) {
      visitBlocks(sprite, clearPackedRegion, false, true);
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

function resolveMaxDelta(sprite, bounds, size, overflow) {
  if (!overflow) {
    // A fixed box cannot benefit from searching farther as the cloud grows,
    // and no anchor farther along either axis than the box allows can fit.
    // Include the distance to fitting anchors for explicit seeds outside it;
    // the extra pixel keeps anchors on the limit eligible for placement.
    return [
      Math.max(
        size[0],
        Math.abs(sprite.x + sprite.x0 + size[0] / 2) + 1,
        Math.abs(sprite.x + sprite.x1 - size[0] / 2) + 1
      ),
      Math.max(
        size[1],
        Math.abs(sprite.y + sprite.y0 + size[1] / 2) + 1,
        Math.abs(sprite.y + sprite.y1 - size[1] / 2) + 1
      )
    ];
  }

  var wordExtent = Math.max(sprite.width || 0, sprite.height || 0),
      boundsExtent = bounds
        ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y)
        : 0,
      limit = Math.max(256, wordExtent * 4, boundsExtent * 2);
  return [limit, limit];
}

function snapshotPlacedSprite(d) {
  const { hasPixels, sprite, spriteWidth, _rasterWidth, _placedLayout, _placedGeneration, ...word } = d;
  return word;
}

function isPlacedIn(sprite, layout) {
  return sprite._placedLayout === layout && sprite._placedGeneration === layout._generation;
}

function extendBounds(layout, sprite) {
  if (layout._bounds) {
    expandBounds(layout._bounds, sprite);
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

function expandBounds(bounds, d) {
  var b0 = bounds[0],
      b1 = bounds[1];
  if (d.x + d.x0 < b0.x) b0.x = d.x + d.x0;
  if (d.y + d.y0 < b0.y) b0.y = d.y + d.y0;
  if (d.x + d.x1 > b1.x) b1.x = d.x + d.x1;
  if (d.y + d.y1 > b1.y) b1.y = d.y + d.y1;
}

function collideRects(a, b) {
  // Rectangle overlap keeps the cloud compact, but tight or opaque masks
  // must be allowed beside it without their pixels overlapping. Text keeps
  // its horizontal raster slack; image masks get an envelope at least as
  // wide as the rectangular spiral's step so some candidate can touch.
  var x0, x1, y0, y1;
  if (a._rasterWidth == null) {
    x0 = a.x0 - IMAGE_SLACK;
    x1 = a.x1 + IMAGE_SLACK;
    y0 = a.y0 - IMAGE_SLACK;
    y1 = a.y1 + IMAGE_SLACK;
  } else {
    x0 = a.x0 - a.trimX;
    x1 = x0 + a._rasterWidth;
    y0 = a.y0;
    y1 = a.y1;
  }
  return a.x + x1 > b[0].x && a.x + x0 < b[1].x && a.y + y1 > b[0].y && a.y + y0 < b[1].y;
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
  return Number.isFinite(value) ? Math.floor(value) : 0;
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
  return Math.floor((random() - 0.5) * (size / 2));
}

function resolveStrategy(value) {
  const strategy = typeof value === "string" && Object.prototype.hasOwnProperty.call(STRATEGIES, value)
    ? STRATEGIES[value] : value;
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
