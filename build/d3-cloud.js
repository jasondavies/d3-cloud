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
      image = null,
      imageWidth = null,
      imageHeight = null,
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
      "y"
    ]);
    Object.assign(this, rest);
    this.text = text == null ? "" : String(text);
    this.image = image;
    this.imageWidth = normalizeOptionalInteger(imageWidth);
    this.imageHeight = normalizeOptionalInteger(imageHeight);
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
    this.spriteWidth = 0;
    this.trimX = 0;
    this.trimY = 0;
    this.trimWidth = 0;
    this.trimHeight = 0;
    this.renderWidth = 0;
    this.renderHeight = 0;
    this.renderX0 = 0;
    this.renderY0 = 0;
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
    resetSprite(this);
    return this.image ? rasterizeImageSprite(this, contextAndRatio) : rasterizeTextSprite(this, contextAndRatio);
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
function resetSprite(sprite) {
  sprite.hasText = false;
  sprite.width = 0;
  sprite.height = 0;
  sprite.spriteWidth = 0;
  sprite.trimX = 0;
  sprite.trimY = 0;
  sprite.trimWidth = 0;
  sprite.trimHeight = 0;
  sprite.renderWidth = 0;
  sprite.renderHeight = 0;
  sprite.renderX0 = 0;
  sprite.renderY0 = 0;
  sprite.x0 = 0;
  sprite.y0 = 0;
  sprite.x1 = 0;
  sprite.y1 = 0;
  sprite.sprite = void 0;
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
  const ratio = contextAndRatio.ratio;
  const pixelWidth = contextAndRatio.pixelWidth;
  context.save();
  context.font = `${sprite.style} ${sprite.weight} ${Math.trunc((sprite.size + 1) / ratio)}px ${sprite.font}`;
  const metrics = context.measureText(sprite.text);
  const anchor = -Math.floor(metrics.width / 2);
  let width = (metrics.width + 1) * ratio;
  let height = sprite.size << 1;
  if (sprite.rotate) {
    const sine = Math.sin(sprite.rotate * RADIANS);
    const cosine = Math.cos(sprite.rotate * RADIANS);
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
    return sprite;
  }
  context.translate((width >> 1) / ratio, (height >> 1) / ratio);
  if (sprite.rotate) {
    context.rotate(sprite.rotate * RADIANS);
  }
  context.fillText(sprite.text, anchor, 0);
  if (sprite.padding) {
    context.lineWidth = 2 * sprite.padding;
    context.strokeText(sprite.text, anchor, 0);
  }
  context.restore();
  contextAndRatio.clearWidth = width;
  contextAndRatio.clearHeight = height;
  sprite.width = width;
  sprite.height = height;
  sprite.spriteWidth = width;
  sprite.x1 = width >> 1;
  sprite.y1 = height >> 1;
  sprite.x0 = -sprite.x1;
  sprite.y0 = -sprite.y1;
  sprite.trimWidth = width;
  sprite.renderWidth = width;
  sprite.renderHeight = height;
  sprite.renderX0 = sprite.x0;
  sprite.renderY0 = sprite.y0;
  sprite.hasText = true;
  const pixels = context.getImageData(0, 0, width / ratio, height / ratio).data;
  const scratch = contextAndRatio.sprite;
  const wordsPerRow = width >>> 5;
  let spriteHeight = sprite.y1 - sprite.y0;
  scratch.fill(0, 0, spriteHeight * wordsPerRow);
  let seen = 0;
  let seenRow = -1;
  let topOffset = 0;
  for (let row = 0; row < spriteHeight; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const wordIndex = wordsPerRow * row + (column >>> 5);
      const bit = pixels[((topOffset + row) * width + column << 2) + 3] ? 1 << 31 - (column & 31) : 0;
      scratch[wordIndex] |= bit;
      seen |= bit;
    }
    if (seen) {
      seenRow = row;
    } else {
      sprite.y0 += 1;
      spriteHeight -= 1;
      row -= 1;
      topOffset += 1;
    }
  }
  if (seenRow < 0) {
    sprite.hasText = false;
    return sprite;
  }
  sprite.trimY = sprite.y0 + (height >> 1);
  sprite.y1 = sprite.y0 + seenRow;
  sprite.trimHeight = sprite.y1 - sprite.y0;
  const spriteLength = (sprite.y1 - sprite.y0) * wordsPerRow;
  sprite.sprite = new Uint32Array(spriteLength);
  sprite.sprite.set(scratch.subarray(0, spriteLength));
  return sprite;
}
function rasterizeImageSprite(sprite, contextAndRatio) {
  const context = clearContext(contextAndRatio);
  const ratio = contextAndRatio.ratio;
  const pixelWidth = contextAndRatio.pixelWidth;
  const imageSize = resolveImageSize(sprite.image, sprite.imageWidth, sprite.imageHeight);
  if (!imageSize) {
    contextAndRatio.clearWidth = 0;
    contextAndRatio.clearHeight = 0;
    return sprite;
  }
  const { drawWidth, drawHeight } = imageSize;
  const bounds = rotatedBounds(drawWidth, drawHeight, sprite.rotate);
  const rasterWidth = bounds.width;
  const rasterHeight = bounds.height;
  if (rasterWidth > pixelWidth || rasterHeight > ch) {
    contextAndRatio.clearWidth = 0;
    contextAndRatio.clearHeight = 0;
    return sprite;
  }
  context.save();
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
  context.restore();
  contextAndRatio.clearWidth = rasterWidth;
  contextAndRatio.clearHeight = rasterHeight;
  const pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
  const alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);
  if (!alphaBounds) {
    return sprite;
  }
  const packedWidth = alphaBounds.width + 31 >>> 5 << 5;
  const wordsPerRow = packedWidth >>> 5;
  const originX = -(rasterWidth >> 1);
  const originY = -(rasterHeight >> 1);
  sprite.width = alphaBounds.width;
  sprite.height = alphaBounds.height;
  sprite.spriteWidth = packedWidth;
  sprite.imageWidth = drawWidth;
  sprite.imageHeight = drawHeight;
  sprite.trimX = alphaBounds.x0;
  sprite.trimY = alphaBounds.y0;
  sprite.trimWidth = alphaBounds.width;
  sprite.trimHeight = alphaBounds.height;
  sprite.renderWidth = drawWidth;
  sprite.renderHeight = drawHeight;
  sprite.renderX0 = -(drawWidth >> 1);
  sprite.renderY0 = -(drawHeight >> 1);
  sprite.x0 = originX + alphaBounds.x0;
  sprite.y0 = originY + alphaBounds.y0;
  sprite.x1 = sprite.x0 + sprite.width;
  sprite.y1 = sprite.y0 + sprite.height;
  sprite.hasText = true;
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
  return sprite;
}
function resolveImageSize(image, imageWidth, imageHeight) {
  const sourceWidth = resolveImageDimension(image, "naturalWidth", "width", "videoWidth");
  const sourceHeight = resolveImageDimension(image, "naturalHeight", "height", "videoHeight");
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
    if (typeof value === "number" && value > 0 && Number.isFinite(value)) {
      return Math.trunc(value);
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
  getSprite(source, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("getSprite() expects an options object");
    }
    const sprite = createCloudSprite(source, options);
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (isTextSource(text)) {
    return new CloudSprite(__spreadProps(__spreadValues({}, options), {
      text,
      style: (_a = options.style) != null ? _a : options.fontStyle,
      weight: (_b = options.weight) != null ? _b : options.fontWeight,
      size: (_c = options.size) != null ? _c : options.fontSize,
      padding: (_d = options.padding) != null ? _d : 1
    }));
  }
  if (isImageSource(text)) {
    return new CloudSprite(__spreadProps(__spreadValues({}, options), {
      text: (_f = (_e = options.text) != null ? _e : text.alt) != null ? _f : "",
      image: text,
      imageWidth: options.width,
      imageHeight: options.height,
      style: (_g = options.style) != null ? _g : options.fontStyle,
      weight: (_h = options.weight) != null ? _h : options.fontWeight,
      size: (_i = options.size) != null ? _i : options.fontSize,
      padding: (_j = options.padding) != null ? _j : 0
    }));
  }
  throw new TypeError("getSprite() expects text or an image-like source");
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
function spriteWords(sprite) {
  var _a;
  return ((_a = sprite.spriteWidth) != null ? _a : sprite.width) >>> 5;
}
function isTextSource(source) {
  return typeof source === "string" || typeof source === "number" || typeof source === "boolean" || source instanceof String;
}
function isImageSource(source) {
  return !!source && typeof source === "object" && !Array.isArray(source) && (typeof source.width === "number" || typeof source.naturalWidth === "number" || typeof source.videoWidth === "number");
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
