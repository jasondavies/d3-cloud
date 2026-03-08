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
var cw = 1 << 11 >>> 5;
var ch = 1 << 11;
var CloudSprite = class {
  constructor(_a = {}) {
    var _b = _a, {
      text = "",
      font = "serif",
      style = "normal",
      weight = "normal",
      rotate = 0,
      size = 1,
      padding = 1,
      x = 0,
      y = 0
    } = _b, rest = __objRest(_b, [
      "text",
      "font",
      "style",
      "weight",
      "rotate",
      "size",
      "padding",
      "x",
      "y"
    ]);
    Object.assign(this, rest);
    this.text = text == null ? "" : String(text);
    this.font = font;
    this.style = style;
    this.weight = weight;
    this.rotate = normalizeNumber(rotate);
    this.size = normalizeInteger(size);
    this.padding = normalizeNumber(padding);
    this.x = normalizeNumber(x);
    this.y = normalizeNumber(y);
    this.hasText = false;
    this.width = 0;
    this.height = 0;
    this.x0 = 0;
    this.y0 = 0;
    this.x1 = 0;
    this.y1 = 0;
    this.sprite = void 0;
  }
  rasterize(contextAndRatio) {
    if (this.sprite) {
      return this;
    }
    this.hasText = false;
    this.width = 0;
    this.height = 0;
    this.x0 = 0;
    this.y0 = 0;
    this.x1 = 0;
    this.y1 = 0;
    this.sprite = void 0;
    const context = contextAndRatio.context;
    const ratio = contextAndRatio.ratio;
    const pixelWidth = contextAndRatio.pixelWidth;
    if (contextAndRatio.clearWidth && contextAndRatio.clearHeight) {
      context.clearRect(0, 0, contextAndRatio.clearWidth / ratio, contextAndRatio.clearHeight / ratio);
    }
    context.save();
    context.font = `${this.style} ${this.weight} ${Math.trunc((this.size + 1) / ratio)}px ${this.font}`;
    const metrics = context.measureText(this.text);
    const anchor = -Math.floor(metrics.width / 2);
    let width = (metrics.width + 1) * ratio;
    let height = this.size << 1;
    if (this.rotate) {
      const sine = Math.sin(this.rotate * RADIANS);
      const cosine = Math.cos(this.rotate * RADIANS);
      const widthCosine = width * cosine;
      const widthSine = width * sine;
      const heightCosine = height * cosine;
      const heightSine = height * sine;
      width = Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)) + 31 >>> 5 << 5;
      height = Math.trunc(Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine)));
    } else {
      width = width + 31 >>> 5 << 5;
    }
    if (width > pixelWidth || height > ch) {
      context.restore();
      contextAndRatio.clearWidth = 0;
      contextAndRatio.clearHeight = 0;
      return this;
    }
    context.translate((width >> 1) / ratio, (height >> 1) / ratio);
    if (this.rotate) {
      context.rotate(this.rotate * RADIANS);
    }
    context.fillText(this.text, anchor, 0);
    if (this.padding) {
      context.lineWidth = 2 * this.padding;
      context.strokeText(this.text, anchor, 0);
    }
    context.restore();
    contextAndRatio.clearWidth = width;
    contextAndRatio.clearHeight = height;
    this.width = width;
    this.height = height;
    this.x1 = width >> 1;
    this.y1 = height >> 1;
    this.x0 = -this.x1;
    this.y0 = -this.y1;
    this.hasText = true;
    const pixels = context.getImageData(0, 0, width / ratio, height / ratio).data;
    const sprite = contextAndRatio.sprite;
    const wordsPerRow = width >>> 5;
    let spriteHeight = this.y1 - this.y0;
    sprite.fill(0, 0, spriteHeight * wordsPerRow);
    let seen = 0;
    let seenRow = -1;
    let topOffset = 0;
    for (let row = 0; row < spriteHeight; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const wordIndex = wordsPerRow * row + (column >>> 5);
        const bit = pixels[(topOffset + row) * width + column << 2] ? 1 << 31 - (column & 31) : 0;
        sprite[wordIndex] |= bit;
        seen |= bit;
      }
      if (seen) {
        seenRow = row;
      } else {
        this.y0 += 1;
        spriteHeight -= 1;
        row -= 1;
        topOffset += 1;
      }
    }
    if (seenRow < 0) {
      this.hasText = false;
      return this;
    }
    this.y1 = this.y0 + seenRow;
    const spriteLength = (this.y1 - this.y0) * wordsPerRow;
    this.sprite = new Uint32Array(spriteLength);
    this.sprite.set(sprite.subarray(0, spriteLength));
    return this;
  }
};
function createSpriteContext(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const pixelWidth = cw << 5;
  canvas.width = canvas.height = 1;
  const ratio = Math.sqrt(context.getImageData(0, 0, 1, 1).data.length >> 2);
  canvas.width = pixelWidth / ratio;
  canvas.height = ch / ratio;
  context.fillStyle = context.strokeStyle = "red";
  return {
    context,
    ratio,
    pixelWidth,
    clearWidth: 0,
    clearHeight: 0,
    sprite: new Uint32Array(cw * ch)
  };
}
function normalizeInteger(value) {
  value = +value;
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
function normalizeNumber(value) {
  value = +value;
  return Number.isFinite(value) ? value : 0;
}

// src/layout.js
var SPIRALS = {
  archimedean: archimedeanSpiral,
  rectangular: rectangularSpiral
};
var CloudLayout = class {
  constructor() {
    this._aspectRatio = 1;
    this._startBox = [256, 256];
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
  aspectRatio(_) {
    if (!arguments.length) {
      return this._aspectRatio;
    }
    this._aspectRatio = normalizeAspectRatio(_);
    return this;
  }
  startBox(_) {
    if (!arguments.length) {
      return this._startBox.slice();
    }
    this._startBox = normalizeStartBox(_);
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
  getSprite(text, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("getSprite() expects an options object");
    }
    const sprite = createCloudSprite(text, options);
    sprite.rasterize(this._getContext());
    return sprite.hasText ? sprite : null;
  }
  place(sprite) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("place() expects a CloudSprite");
    }
    const placedSprite = sprite;
    placedSprite.x = seedCoordinate(this._startBox[0], this._random);
    placedSprite.y = seedCoordinate(this._startBox[1], this._random);
    placedSprite.rasterize(this._getContext());
    if (!placedSprite.hasText) {
      return null;
    }
    if (!placeTag(this._blockState, placedSprite, this._bounds, this._spiral, this._aspectRatio, this._random, this._maxDelta)) {
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
  placeAll(sprites) {
    const placedWords = [];
    const batch = normalizeSpriteBatch(sprites);
    for (let index = 0; index < batch.length; index += 1) {
      const placed = this.place(batch[index]);
      if (placed) {
        placedWords.push(placed);
      }
    }
    return placedWords;
  }
  _getContext() {
    if (!this._spriteContext) {
      this._spriteContext = createSpriteContext(this._canvas());
    }
    return this._spriteContext;
  }
};
function createCloudSprite(text, options) {
  var _a, _b, _c, _d;
  return new CloudSprite(__spreadProps(__spreadValues({}, options), {
    text,
    style: (_a = options.style) != null ? _a : options.fontStyle,
    weight: (_b = options.weight) != null ? _b : options.fontWeight,
    size: (_c = options.size) != null ? _c : options.fontSize,
    padding: (_d = options.padding) != null ? _d : 1
  }));
}
function placeTag(state, tag, bounds, spiral, aspectRatio, random, maxDelta) {
  var startX = tag.x, startY = tag.y, deltaLimit = resolveMaxDelta(tag, bounds, maxDelta), s = spiral(aspectRatio), dt = random() < 0.5 ? 1 : -1, t = -dt, dxdy, dx, dy;
  while (dxdy = s(t += dt)) {
    dx = ~~dxdy[0];
    dy = ~~dxdy[1];
    if (Math.min(Math.abs(dx), Math.abs(dy)) >= deltaLimit) break;
    tag.x = startX + dx;
    tag.y = startY + dy;
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
  const blocks = /* @__PURE__ */ new Map();
  const blockSize = normalizeBlockSize(cellSize);
  const blockWords = blockSize >>> 5;
  return {
    collides(tag) {
      var left = tag.x + tag.x0, top = tag.y + tag.y0, right = tag.x + tag.x1, bottom = tag.y + tag.y1, range = getRangeForBounds(left, top, right, bottom, blockSize);
      for (var blockY = range.y0; blockY <= range.y1; blockY++) {
        var blockTop = blockY * blockSize, overlapTop = Math.max(top, blockTop), overlapBottom = Math.min(bottom, blockTop + blockSize);
        for (var blockX = range.x0; blockX <= range.x1; blockX++) {
          var block = blocks.get(blockKey(blockX, blockY));
          if (!block) continue;
          var blockLeft = blockX * blockSize, overlapLeft = Math.max(left, blockLeft), overlapRight = Math.min(right, blockLeft + blockSize);
          if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
          if (packedRegionCollides(
            tag.sprite,
            tag.width >>> 5,
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
      var left = tag.x + tag.x0, top = tag.y + tag.y0, right = tag.x + tag.x1, bottom = tag.y + tag.y1, range = getRangeForBounds(left, top, right, bottom, blockSize);
      for (var blockY = range.y0; blockY <= range.y1; blockY++) {
        var blockTop = blockY * blockSize, overlapTop = Math.max(top, blockTop), overlapBottom = Math.min(bottom, blockTop + blockSize);
        for (var blockX = range.x0; blockX <= range.x1; blockX++) {
          var blockLeft = blockX * blockSize, overlapLeft = Math.max(left, blockLeft), overlapRight = Math.min(right, blockLeft + blockSize);
          if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;
          var key = blockKey(blockX, blockY), block = blocks.get(key);
          if (!block) {
            block = new Uint32Array(blockWords * blockSize);
            blocks.set(key, block);
          }
          stampPackedRegion(
            tag.sprite,
            tag.width >>> 5,
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
function resolveMaxDelta(tag, bounds, maxDelta) {
  if (maxDelta != null) {
    return maxDelta;
  }
  var wordExtent = Math.max(tag.width || 0, tag.height || 0), boundsExtent = bounds ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y) : 0;
  return Math.max(256, wordExtent * 4, boundsExtent * 2);
}
function outputWord(d) {
  return __spreadProps(__spreadValues({}, d), {
    sprite: void 0
  });
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
  var b0 = bounds[0], b1 = bounds[1];
  if (d.x + d.x0 < b0.x) b0.x = d.x + d.x0;
  if (d.y + d.y0 < b0.y) b0.y = d.y + d.y0;
  if (d.x + d.x1 > b1.x) b1.x = d.x + d.x1;
  if (d.y + d.y1 > b1.y) b1.y = d.y + d.y1;
}
function collideRects(a, b) {
  return a.x + a.x1 > b[0].x && a.x + a.x0 < b[1].x && a.y + a.y1 > b[0].y && a.y + a.y0 < b[1].y;
}
function archimedeanSpiral(aspectRatio) {
  var e = normalizeAspectRatio(aspectRatio);
  return function(t) {
    t *= 0.1;
    return [e * t * Math.cos(t), t * Math.sin(t)];
  };
}
function rectangularSpiral(aspectRatio) {
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
  return value + 31 >>> 5 << 5;
}
function normalizeSpriteBatch(sprites) {
  if (sprites == null) {
    return [];
  }
  const batch = typeof sprites[Symbol.iterator] === "function" ? Array.from(sprites) : typeof sprites.length === "number" ? Array.from(sprites) : null;
  if (!batch) {
    throw new TypeError("placeAll() expects an iterable or array-like collection of CloudSprite instances");
  }
  for (const sprite of batch) {
    if (!(sprite instanceof CloudSprite)) {
      throw new TypeError("placeAll() expects CloudSprite instances");
    }
  }
  return batch;
}
function normalizeStartBox(value) {
  if (!Array.isArray(value)) {
    value = [value, value];
  }
  return [
    normalizeStartBoxSize(value[0]),
    normalizeStartBoxSize(value[1])
  ];
}
function normalizeStartBoxSize(value) {
  value = +value;
  return value > 0 && Number.isFinite(value) ? value : 0;
}
function seedCoordinate(size, random) {
  if (!(size > 0)) {
    return 0;
  }
  return Math.floor((random() - 0.5) * size);
}
function functor(d) {
  return typeof d === "function" ? d : function() {
    return d;
  };
}
export {
  CloudLayout,
  CloudSprite,
  CloudLayout as default
};
