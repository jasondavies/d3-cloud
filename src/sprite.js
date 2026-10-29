const RADIANS = Math.PI / 180;
const SCRATCH_WIDTH = 1 << 11;
const SCRATCH_HEIGHT = 1 << 11;

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
    this.x = 0;
    this.y = 0;
    // Metadata copied from a placed sprite must not carry its placement.
    this._placedLayout = null;
    this._placedGeneration = 0;
    resetSprite(this);
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

function resetSprite(sprite) {
  sprite.hasPixels = false;
  sprite.width = 0;
  sprite.height = 0;
  sprite.spriteWidth = 0;
  sprite._rasterWidth = null;
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
  context.font = `${sprite.style} ${sprite.weight} ${Math.max(1, Math.ceil(sprite.size / ratio))}px ${sprite.font}`;

  const metrics = context.measureText(sprite.text);
  const anchor = -metrics.width / 2;
  let width = (metrics.width + 1) * ratio;
  let height = sprite.size * 2;
  const hasInkBounds = Number.isFinite(metrics.actualBoundingBoxLeft) &&
    Number.isFinite(metrics.actualBoundingBoxRight) &&
    Number.isFinite(metrics.actualBoundingBoxAscent) &&
    Number.isFinite(metrics.actualBoundingBoxDescent);

  if (hasInkBounds) {
    // Advance width and font size do not bound italic overhang or accents.
    // Enclose the ink symmetrically around the rendering origin before
    // rotation; round stroke joins extend at most padding beyond the ink.
    const strokeExtent = Math.abs(sprite.padding);
    width = Math.max(width, 2 * ratio * (strokeExtent + Math.max(
      Math.abs(anchor - metrics.actualBoundingBoxLeft),
      Math.abs(anchor + metrics.actualBoundingBoxRight)
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
  // Width-only canvas adapters cannot tell us how far glyphs actually drew,
  // so clear two extra ems past the raster before the next sprite.
  const overhang = hasInkBounds ? 0 : 2 * sprite.size;
  let rasterWidth = ceilToRatio(width + overscan * 2, ratio);
  let rasterHeight = ceilToRatio(height + overscan * 2, ratio);
  let pixels;
  let alphaBounds;

  for (;;) {
    if (rasterWidth > maxWidth || rasterHeight > maxHeight) {
      context.restore();
      contextAndRatio.clearWidth = 0;
      contextAndRatio.clearHeight = 0;
      return sprite;
    }

    context.save();
    context.translate((rasterWidth >> 1) / ratio, (rasterHeight >> 1) / ratio);
    if (sprite.rotate) {
      context.rotate(sprite.rotate * RADIANS);
    }
    context.fillText(sprite.text, anchor, 0);
    if (sprite.padding) {
      context.lineWidth = 2 * sprite.padding;
      context.lineJoin = "round";
      context.strokeText(sprite.text, anchor, 0);
    }
    context.restore();

    contextAndRatio.clearWidth = Math.min(pixelWidth, rasterWidth + overhang);
    contextAndRatio.clearHeight = Math.min(SCRATCH_HEIGHT, rasterHeight + overhang);

    pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
    alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);

    if (!alphaBounds || !touchesEdge(alphaBounds, rasterWidth, rasterHeight)) {
      break;
    }

    // Ink reaching the raster edge may have been clipped because the font
    // metrics underestimated it, so redraw into a larger raster.
    clearContext(contextAndRatio);
    const nextWidth = Math.min(maxWidth, rasterWidth * 2);
    const nextHeight = Math.min(maxHeight, rasterHeight * 2);
    if (nextWidth === rasterWidth && nextHeight === rasterHeight) {
      alphaBounds = null;
      break;
    }
    rasterWidth = nextWidth;
    rasterHeight = nextHeight;
  }
  context.restore();

  if (!alphaBounds) {
    return sprite;
  }

  // Retain the original horizontal search envelope independently of the
  // pixel-tight public geometry and the packed row stride.
  sprite._rasterWidth = rasterWidth;
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
    return sprite;
  }

  const { drawWidth, drawHeight } = imageSize;
  const bounds = rotatedBounds(drawWidth, drawHeight, sprite.rotate);
  // Leave room on both sides of the integer raster origin for half-pixel
  // image edges and antialiasing after rotation or resizing.
  const rasterWidth = ceilToRatio(bounds.width + 2 * ratio, ratio);
  const rasterHeight = ceilToRatio(bounds.height + 2 * ratio, ratio);

  if (rasterWidth > pixelWidth || rasterHeight > SCRATCH_HEIGHT) {
    contextAndRatio.clearWidth = 0;
    contextAndRatio.clearHeight = 0;
    return sprite;
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
    // A failed draw must not affect the transform or pixels of the next sprite.
    contextAndRatio.clearWidth = rasterWidth;
    contextAndRatio.clearHeight = rasterHeight;
  }

  const pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
  const alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);

  if (!alphaBounds) {
    return sprite;
  }

  sprite.imageWidth = drawWidth;
  sprite.imageHeight = drawHeight;
  return extractSpritePixels(sprite, pixels, rasterWidth, rasterHeight, alphaBounds);
}

function extractSpritePixels(sprite, pixels, rasterWidth, rasterHeight, alphaBounds) {
  const packedWidth = ((alphaBounds.width + 31) >>> 5) << 5;
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
  sprite.hasPixels = true;
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
    const value = image?.[key];
    if (typeof value === "number") {
      // Intrinsic dimensions are authoritative, including zero for unloaded
      // or broken sources; display dimensions must not make them drawable.
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

function touchesEdge(bounds, width, height) {
  return bounds.x0 === 0 || bounds.y0 === 0 ||
    bounds.x0 + bounds.width === width || bounds.y0 + bounds.height === height;
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
