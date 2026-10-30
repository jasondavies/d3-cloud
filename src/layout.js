// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import { createSpriteContext, rasterizeSprite, spriteFields, spriteMask } from "./sprite.js";

// Coordinates and layout sizes are limited so that block indices and strategy
// offsets remain exact integers.
const MAX_COORDINATE = 1 << 24;
const MAX_BLOCK_SIZE = 4096;
const MIN_SEARCH_BUDGET = 100000;

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
    // Maps each placed word returned by place() to the mask and position
    // needed to erase it. Results that are dropped are garbage collected.
    this._placements = new WeakMap();
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
    this._placements = new WeakMap();
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
    if (this._bounds) {
      throw new Error("Cannot change blockSize after placement; call clear() first");
    }
    this._blockSize = nextBlockSize;
    this._blocks = createOccupancyBlocks(this._blockSize);
    return this;
  }

  getSprite(source, options) {
    if (options == null) {
      options = {};
    } else if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("getSprite() expects an options object");
    }

    const fields = spriteFields(source, options);
    if (!fields) {
      return null;
    }
    const state = this._getContext();
    try {
      return rasterizeSprite(fields, state);
    } catch (error) {
      // A failed draw or readback, for example after a cross-origin image
      // taints the canvas, must not break later sprites, so start over with a
      // new canvas from the factory.
      this._spriteContext = null;
      throw error;
    }
  }

  erase(word) {
    const placement = word && typeof word === "object" ? this._placements.get(word) : undefined;
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
    if (options == null) {
      options = {};
    } else if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("place() expects an options object");
    }

    const { x: optionX, y: optionY, strategy: optionStrategy } = options;
    const strategy = optionStrategy == null ? this._strategy : resolveStrategy(optionStrategy);
    const x = optionX == null ? seedCoordinate(this._size[0], this._random) : placeCoordinate(optionX);
    const y = optionY == null ? seedCoordinate(this._size[1], this._random) : placeCoordinate(optionY);
    const position = tryPlaceSprite(this._blocks, mask, x, y, this._bounds, strategy, this._size, this._overflow, this._random);
    if (!position) {
      return null;
    }

    extendBounds(this, mask, position.x, position.y);
    const word = createPlacedWord(sprite, position.x, position.y);
    this._placements.set(word, { mask, x: position.x, y: position.y });
    return word;
  }

  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvasFactory());
    }
    return this._spriteContext;
  }
}

// Returns the first position at which the sprite fits, after inserting it into
// the occupancy blocks there, or null.
function tryPlaceSprite(blocks, mask, seedX, seedY, bounds, strategy, size, overflow, random) {
  var range = anchorRange(mask, bounds, size, overflow),
      startX,
      startY,
      next,
      candidate;

  if (!range) {
    return null;
  }
  if (withinRange(range, seedX, seedY) && !blocks.collides(mask, seedX, seedY)) {
    blocks.insert(mask, seedX, seedY);
    return { x: seedX, y: seedY };
  }

  // Search from the nearest anchor at which the sprite could be placed, so
  // seeds outside a fixed box or far from the cloud need no long search.
  startX = Math.min(Math.max(seedX, range.x0), range.x1);
  startY = Math.min(Math.max(seedY, range.y0), range.y1);

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

  // Candidates outside the range cannot be placed. Stop once one is beyond
  // the range, and the box or cloud the sprite is placed against, on both
  // axes; after trying at least as many candidates inside the range as it has
  // anchors; or after a long run outside it, so generators that repeat points
  // or move along only one axis also stop.
  var envelope = mask.envelope,
      limitX = Math.max(startX - range.x0, range.x1 - startX) + envelope.x1 - envelope.x0 + 1,
      limitY = Math.max(startY - range.y0, range.y1 - startY) + envelope.y1 - envelope.y0 + 1,
      insideLimit = Math.max(MIN_SEARCH_BUDGET, (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1)),
      outsideLimit = Math.max(MIN_SEARCH_BUDGET, 4 * limitX * limitY),
      inside = 0,
      outside = 0;
  while ((candidate = normalizeStrategyCandidate(next()))) {
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

// Returns the integer anchors at which the sprite could be placed: inside the
// box when overflow is disabled, and with its envelope overlapping the cloud
// bounds once there are any, or null if there are none. Without overflow or
// bounds the layout is empty, so the seed itself always fits.
function anchorRange(mask, bounds, size, overflow) {
  var x0 = -MAX_COORDINATE,
      y0 = -MAX_COORDINATE,
      x1 = MAX_COORDINATE,
      y1 = MAX_COORDINATE,
      envelope = mask.envelope;

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
  const blocks = new Map();
  const blockWords = blockSize >>> 5;

  // Applies visit to each block region the sprite overlaps at x, y, stopping
  // early if it returns true. Missing blocks are created when inserting, and
  // emptied blocks are pruned when removing.
  function visitBlocks(mask, x, y, visit, create, prune) {
    var data = mask.data,
        words = mask.words,
        left = x + mask.x0,
        top = y + mask.y0,
        right = x + mask.x1,
        bottom = y + mask.y1,
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

function createPlacedWord(sprite, x, y) {
  // The placed word copies the sprite's public fields, except its mask.
  const { sprite: _mask, spriteWidth: _spriteWidth, ...fields } = sprite;
  return { ...fields, x, y };
}

function extendBounds(layout, mask, x, y) {
  var left = x + mask.x0,
      top = y + mask.y0,
      right = x + mask.x1,
      bottom = y + mask.y1,
      bounds = layout._bounds;
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
  var rings = rectangularRings(context.aspectRatio),
      // Mirroring the rings vertically reverses the spiral's direction.
      sign = context.random() < .5 ? 1 : -1,
      ring = 0,
      points = rings.get(0),
      index = 0;

  return function() {
    while (index === points.length) {
      points = rings.get(++ring);
      index = 0;
    }
    var x = points[index++],
        y = points[index++];
    return {
      x: initial.x + 4 * x,
      y: initial.y + 4 * sign * y
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

// Rings depend only on the aspect ratio, so they are shared by every search
// with the same ratio. Only the most recent ratios are kept.
var rectangularRingCache = new Map();

function rectangularRings(aspectRatio) {
  var e = normalizeAspectRatio(aspectRatio),
      rings = rectangularRingCache.get(e);
  if (rings) {
    rectangularRingCache.delete(e);
  } else {
    var scaleX = Math.max(1, e),
        scaleY = Math.max(1, 1 / e),
        list = [new Int32Array(2)];
    rings = {
      get(k) {
        while (list.length <= k) {
          list.push(rectangularRing(list.length, scaleX, scaleY));
        }
        return list[k];
      }
    };
    if (rectangularRingCache.size >= 4) {
      rectangularRingCache.delete(rectangularRingCache.keys().next().value);
    }
  }
  rectangularRingCache.set(e, rings);
  return rings;
}

// Returns the points of a 4px grid in ring k > 0 of a rectangular spiral, as
// interleaved x and y steps: inside a rectangle k steps from the center along
// the shorter axis, and proportionally farther along the longer one, but not
// inside ring k - 1. Points are ordered by distance, then by angle, so every
// grid point is visited once regardless of the aspect ratio.
function rectangularRing(k, scaleX, scaleY) {
  var a = Math.floor(k * scaleX),
      b = Math.floor(k * scaleY),
      innerA = Math.floor((k - 1) * scaleX),
      innerB = Math.floor((k - 1) * scaleY),
      points = [];

  for (var y = -b; y <= b; y++) {
    var innerRow = Math.abs(y) <= innerB;
    for (var x = -a; x <= a; x++) {
      if (innerRow && x === -innerA) {
        x = innerA;
        continue;
      }
      points.push([x, y, Math.max(Math.abs(x) / scaleX, Math.abs(y) / scaleY), Math.atan2(y, x)]);
    }
  }
  points.sort(function(p, q) { return p[2] - q[2] || p[3] - q[3]; });

  var steps = new Int32Array(points.length * 2);
  for (var i = 0; i < points.length; i++) {
    steps[i * 2] = points[i][0];
    steps[i * 2 + 1] = points[i][1];
  }
  return steps;
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
  if (!(value > 0 && value <= MAX_BLOCK_SIZE)) {
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
    throw new RangeError(`place() expects x and y coordinates within ±${MAX_COORDINATE}`);
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
  if (!(value >= 0 && value < 1)) {
    throw new RangeError("random() must return a number in [0, 1)");
  }
  return Math.floor((value - 0.5) * (size / 2));
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
    const x = +value.x;
    const y = +value.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError("strategy candidates must have finite x and y");
    }
    return { x: Math.floor(x), y: Math.floor(y) };
  }
  throw new TypeError("strategy candidates must be {x, y} or null");
}
