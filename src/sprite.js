const RADIANS = Math.PI / 180;
const SCRATCH_WIDTH = 1 << 11;
const SCRATCH_HEIGHT = 1 << 11;
const CREATE = Symbol("CloudSprite");

// An immutable, rasterized mask for a text or image source. Sprites are only
// created by CloudLayout.getSprite() and can be placed any number of times.
export default class CloudSprite {
  constructor(token, fields) {
    if (token !== CREATE) {
      throw new TypeError("CloudSprite instances are created by CloudLayout.getSprite()");
    }
    const { _rasterWidth, ...rest } = fields;
    Object.assign(this, rest);
    Object.defineProperty(this, "_rasterWidth", { value: _rasterWidth });
    Object.freeze(this);
  }
}

export function createSprite(source, options, contextAndRatio) {
  const image = isImageSource(source) ? source : null;
  if (!image && !isTextSource(source)) {
    throw new TypeError("getSprite() expects text or an image-like source");
  }

  const fields = {
    text: String(image ? options.text ?? source.alt ?? "" : source),
    image,
    imageWidth: image ? normalizeOptionalInteger(options.width) : null,
    imageHeight: image ? normalizeOptionalInteger(options.height) : null,
    font: options.font ?? "serif",
    style: options.style ?? options.fontStyle ?? "normal",
    weight: options.weight ?? options.fontWeight ?? "normal",
    rotate: normalizeNumber(options.rotate ?? 0),
    size: normalizeInteger(options.size ?? options.fontSize ?? 1),
    padding: normalizeNumber(options.padding ?? (image ? 0 : 1)),
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

  const rasterized = image
    ? rasterizeImageSprite(fields, contextAndRatio)
    : rasterizeTextSprite(fields, contextAndRatio);
  return rasterized ? new CloudSprite(CREATE, fields) : null;
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
    // A failed measure or draw must not affect the font, alignment, or
    // transform of the next sprite.
    context.restore();
  }
}

function drawTextSprite(sprite, contextAndRatio, context) {
  const ratio = contextAndRatio.ratio;
  const pixelWidth = contextAndRatio.pixelWidth;

  context.font = `${sprite.style} ${sprite.weight} ${Math.max(1, Math.ceil(sprite.size / ratio))}px ${sprite.font}`;
  // Match the documented rendering contract exactly: some canvases position
  // centered glyphs differently from a manually offset left-aligned run.
  context.textAlign = "center";

  const metrics = context.measureText(sprite.text);
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
  // Width-only canvas adapters cannot tell us how far glyphs actually drew,
  // so clear two extra ems past the raster before the next sprite.
  const overhang = hasInkBounds ? 0 : 2 * sprite.size;
  // The horizontal search envelope keeps the measured raster width, even if
  // under-reported metrics force the ink into a larger raster.
  const envelopeWidth = ceilToRatio(width + overscan * 2, ratio);
  let rasterWidth = envelopeWidth;
  let rasterHeight = ceilToRatio(height + overscan * 2, ratio);
  let redrawn = false;
  let pixels;
  let alphaBounds;

  for (;;) {
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
      // Clear any partial drawing before the next sprite, even after failure.
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

    // Ink reaching the raster edge may have been clipped because the font
    // metrics underestimated it. Clipped ink may have landed anywhere on the
    // scratch canvas, so clear all of it, then redraw larger along each axis
    // the ink reached.
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
    // Metrics that under-reported once cannot bound where this ink went.
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
  // Leave room on both sides of the integer raster origin for half-pixel
  // image edges and antialiasing after rotation or resizing.
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
    // A failed draw must not affect the transform or pixels of the next sprite.
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
