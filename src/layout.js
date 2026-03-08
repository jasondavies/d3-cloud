// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import CloudSprite, { createSpriteContext } from "./sprite.js";

const SPIRALS = {
  archimedean: archimedeanSpiral,
  rectangular: rectangularSpiral
};

export default class CloudLayout {
  constructor() {
    this._size = [256, 256];
    this._overflow = true;
    this._spiral = archimedeanSpiral;
    this._random = Math.random;
    this._blockSize = 512;
    this._maxDelta = null;
    this._canvas = cloudCanvas;
    this._spriteContext = null;
    this._bounds = null;
    this._blockState = createSparseBlocks(this._blockSize);
  }

  canvas(_) {
    if (!arguments.length) {
      return this._canvas;
    }
    this._canvas = functor(_);
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

  spiral(_) {
    if (!arguments.length) {
      return this._spiral;
    }
    this._spiral = SPIRALS[_] || _;
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

  place(sprite, options = undefined) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite");
    }
    if (options != null && (!options || typeof options !== "object" || Array.isArray(options))) {
      throw new TypeError("place() expects an options object");
    }

    const placedSprite = sprite;
    placedSprite.x = options?.x == null ? seedCoordinate(this._size[0], this._random) : normalizeCoordinate(options.x);
    placedSprite.y = options?.y == null ? seedCoordinate(this._size[1], this._random) : normalizeCoordinate(options.y);

    placedSprite.rasterize(this._getContext());
    if (!placedSprite.hasText) {
      return null;
    }
    if (!placeTag(this._blockState, placedSprite, this._bounds, this._spiral, this._size, this._overflow, this._random, this._maxDelta)) {
      return null;
    }

    if (this._bounds) {
      cloudBounds(this._bounds, placedSprite);
    } else {
      this._bounds = [
        { x: placedSprite.x + placedSprite.x0, y: placedSprite.y + placedSprite.y0 },
        { x: placedSprite.x + placedSprite.x1, y: placedSprite.y + placedSprite.y1 }
      ];
    }

    return outputWord(placedSprite);
  }

  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvas());
    }
    return this._spriteContext;
  }
}

function createCloudSprite(text, options) {
  if (isTextSource(text)) {
    return new CloudSprite({
      ...options,
      text,
      style: options.style ?? options.fontStyle,
      weight: options.weight ?? options.fontWeight,
      size: options.size ?? options.fontSize,
      padding: options.padding ?? 1
    });
  }

  if (isImageSource(text)) {
    return new CloudSprite({
      ...options,
      text: options.text ?? text.alt ?? "",
      image: text,
      imageWidth: options.width,
      imageHeight: options.height,
      style: options.style ?? options.fontStyle,
      weight: options.weight ?? options.fontWeight,
      size: options.size ?? options.fontSize,
      padding: options.padding ?? 0
    });
  }

  throw new TypeError("getSprite() expects text or an image-like source");
}

function placeTag(state, tag, bounds, spiral, size, overflow, random, maxDelta) {
  var startX = tag.x,
      startY = tag.y,
      deltaLimit = resolveMaxDelta(tag, bounds, maxDelta, size, overflow),
      s = spiral(sizeAspectRatio(size)),
      clipBounds = overflow ? null : sizeBounds(size),
      dt = random() < .5 ? 1 : -1,
      t = -dt,
      dxdy,
      dx,
      dy;

  while (dxdy = s(t += dt)) {
    dx = ~~dxdy[0];
    dy = ~~dxdy[1];

    if (Math.min(Math.abs(dx), Math.abs(dy)) >= deltaLimit) break;

    tag.x = startX + dx;
    tag.y = startY + dy;

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
  const word = {};

  for (const key in d) {
    if (!Object.prototype.hasOwnProperty.call(d, key) || INTERNAL_WORD_FIELDS.has(key) || PUBLIC_WORD_FIELDS.has(key)) {
      continue;
    }
    word[key] = d[key];
  }

  word.text = d.text;
  word.image = d.image;
  word.imageWidth = d.imageWidth;
  word.imageHeight = d.imageHeight;
  word.font = d.font;
  word.style = d.style;
  word.weight = d.weight;
  word.rotate = d.rotate;
  word.size = d.size;
  word.padding = d.padding;
  word.x = d.x;
  word.y = d.y;
  word.width = d.width;
  word.height = d.height;
  word.trimX = d.trimX;
  word.trimY = d.trimY;
  word.trimWidth = d.trimWidth;
  word.trimHeight = d.trimHeight;
  word.x0 = d.x0;
  word.y0 = d.y0;
  word.x1 = d.x1;
  word.y1 = d.y1;
  return word;
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

function archimedeanSpiral(aspectRatio) {
  var e = normalizeAspectRatio(aspectRatio);
  return function(t) {
    t *= .1;
    return [e * t * Math.cos(t), t * Math.sin(t)];
  };
}

function rectangularSpiral(aspectRatio) {
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

function cloudCanvas() {
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

function functor(d) {
  return typeof d === "function" ? d : function() { return d; };
}

const INTERNAL_WORD_FIELDS = new Set([
  "hasText",
  "sprite",
  "spriteWidth"
]);

const PUBLIC_WORD_FIELDS = new Set([
  "text",
  "image",
  "imageWidth",
  "imageHeight",
  "font",
  "style",
  "weight",
  "rotate",
  "size",
  "padding",
  "x",
  "y",
  "width",
  "height",
  "trimX",
  "trimY",
  "trimWidth",
  "trimHeight",
  "x0",
  "y0",
  "x1",
  "y1"
]);
