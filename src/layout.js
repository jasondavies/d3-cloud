// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import CloudSprite, { createSprite, createSpriteContext } from "./sprite.js";

const IMAGE_SLACK = 4;
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
    // Maps each placed word returned by place() to the sprite and position
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
    const placement = word && typeof word === "object" ? this._placements.get(word) : undefined;
    if (!placement) {
      throw new Error("erase() expects a word returned by place() on this layout since it was last cleared");
    }

    this._blocks.remove(placement.sprite, placement.x, placement.y);
    this._placements.delete(word);
    if (this._blocks.isEmpty()) {
      this._bounds = null;
    }
  }

  place(sprite, options = undefined) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite from getSprite()");
    }
    if (options != null && (!options || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("place() expects an options object");
    }

    const strategy = options?.strategy == null ? this._strategy : resolveStrategy(options.strategy);
    const x = options?.x == null ? seedCoordinate(this._size[0], this._random) : normalizeCoordinate(options.x);
    const y = options?.y == null ? seedCoordinate(this._size[1], this._random) : normalizeCoordinate(options.y);
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
}

// Returns the first position at which the sprite fits, after inserting it into
// the occupancy blocks there, or null.
function tryPlaceSprite(blocks, sprite, startX, startY, bounds, strategy, size, overflow, random) {
  var deltaLimit = resolveMaxDelta(sprite, startX, startY, bounds, size, overflow),
      limitX = deltaLimit[0],
      limitY = deltaLimit[1],
      clipBounds = overflow ? null : sizeBounds(size),
      aspectRatio = sizeAspectRatio(size),
      next,
      candidate,
      dx,
      dy,
      progress;

  if ((!clipBounds || withinBounds(sprite, startX, startY, clipBounds)) &&
      (!bounds || collideRects(sprite, startX, startY, bounds)) &&
      !blocks.collides(sprite, startX, startY)) {
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

  // Stop once a candidate is beyond the limits on both axes. Progress is
  // measured on the axis furthest from its limit, so generators that repeat
  // points or move along only one axis stop after a run without progress.
  var reach = 0,
      stalled = 0;
  while ((candidate = normalizeStrategyCandidate(next()))) {
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
  const blocks = new Map();
  const blockSize = normalizeBlockSize(cellSize);
  const blockWords = blockSize >>> 5;

  // Applies visit to each block region the sprite overlaps at x, y, stopping
  // early if it returns true. Missing blocks are created when inserting, and
  // emptied blocks are pruned when removing.
  function visitBlocks(sprite, x, y, visit, create, prune) {
    var data = sprite.sprite,
        words = spriteWords(sprite),
        left = x + sprite.x0,
        top = y + sprite.y0,
        right = x + sprite.x1,
        bottom = y + sprite.y1,
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

function resolveMaxDelta(sprite, x, y, bounds, size, overflow) {
  if (!overflow) {
    // A fixed box cannot benefit from searching farther as the cloud grows,
    // and no anchor farther along either axis than the box allows can fit.
    // Include the distance to fitting anchors for explicit seeds outside it;
    // the extra pixel keeps anchors on the limit eligible for placement.
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

  var wordExtent = Math.max(sprite.width || 0, sprite.height || 0),
      boundsExtent = bounds
        ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y)
        : 0,
      limit = Math.max(256, wordExtent * 4, boundsExtent * 2);
  if (!bounds) {
    return [limit, limit];
  }

  // Seeds may lie far from the cloud, so also reach every anchor at which
  // the sprite still overlaps the current bounds.
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
  var left = x + sprite.x0,
      top = y + sprite.y0,
      right = x + sprite.x1,
      bottom = y + sprite.y1,
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

function collideRects(a, x, y, b) {
  // Rectangle overlap keeps the cloud compact, but tight or opaque masks
  // must be allowed beside it without their pixels overlapping. Text keeps
  // the horizontal slack of its measured raster, centered on the origin.
  // Image masks get a small envelope on every side. The rectangular spiral
  // always steps 4px vertically, so it can land beside the cloud on that
  // axis even when wide layouts stretch its horizontal step past the slack.
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
