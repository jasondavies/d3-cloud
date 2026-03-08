const RADIANS = Math.PI / 180;
const cw = (1 << 11) >>> 5;
const ch = 1 << 11;

export default class CloudSprite {
  constructor({
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
    y = 0,
    ...rest
  } = {}) {
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
    this.x0 = 0;
    this.y0 = 0;
    this.x1 = 0;
    this.y1 = 0;
    this.sprite = undefined;
  }

  rasterize(contextAndRatio) {
    if (this.sprite) {
      return this;
    }

    resetSprite(this);
    return this.image
      ? rasterizeImageSprite(this, contextAndRatio)
      : rasterizeTextSprite(this, contextAndRatio);
  }
}

export function createSpriteContext(canvas) {
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
  sprite.x0 = 0;
  sprite.y0 = 0;
  sprite.x1 = 0;
  sprite.y1 = 0;
  sprite.sprite = undefined;
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
  context.textBaseline = "middle";

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
    width = (Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)) + 0x1f) >>> 5 << 5;
    height = Math.trunc(Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine)));
  } else {
    width = (width + 0x1f) >>> 5 << 5;
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
      const bit = pixels[(((topOffset + row) * width + column) << 2) + 3] ? 1 << (31 - (column & 31)) : 0;
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

  const packedWidth = ((alphaBounds.width + 31) >>> 5) << 5;
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
      if (pixels[((sourceRow * rasterWidth + sourceColumn) << 2) + 3]) {
        sprite.sprite[rowOffset + (column >>> 5)] |= 1 << (31 - (column & 31));
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
    const value = image?.[key];
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
      if (!pixels[((row * width + column) << 2) + 3]) {
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
