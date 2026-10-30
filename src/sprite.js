const RADIANS = Math.PI / 180;
const SCRATCH_WIDTH = 1 << 11;
const SCRATCH_HEIGHT = 1 << 11;
const IMAGE_SLACK = 4;
const CREATE = Symbol("CloudSprite");

// The mask and geometry used for placement, keyed by each sprite this module
// created. Placement reads only this private copy, so changing a sprite's
// public mask cannot corrupt a layout, and objects missing from this map were
// not created by getSprite().
const MASKS = new WeakMap();

// Clearing state for each scratch context, shared by every layout that draws
// to the same canvas.
const CONTEXT_STATES = new WeakMap();

// An immutable, rasterized mask for a text or image source. Sprites are only
// created by CloudLayout.getSprite() and can be placed any number of times.
export default class CloudSprite {
  constructor(token, fields) {
    if (token !== CREATE) {
      throw new TypeError("CloudSprite instances are created by CloudLayout.getSprite()");
    }
    Object.assign(this, fields);
    Object.freeze(this);
  }
}

export function spriteMask(sprite) {
  return MASKS.get(sprite);
}

// Validates the source and options, returning the fields to rasterize, or
// null if there is nothing to draw.
export function spriteFields(source, options) {
  const image = isImageSource(source) ? source : null;
  if (!image && !isTextSource(source)) {
    throw new TypeError("getSprite() expects text or an image-like source");
  }

  const size = finiteOption(options.size ?? options.fontSize, "size", 1);
  const padding = finiteOption(options.padding, "padding", image ? 0 : 1);
  if (padding < 0) {
    throw new RangeError("getSprite() expects a nonnegative padding");
  }
  const fields = {
    text: String(image ? options.text ?? source.alt ?? "" : source),
    image,
    imageWidth: image ? imageDimensionOption(options.width, "width") : null,
    imageHeight: image ? imageDimensionOption(options.height, "height") : null,
    font: String(options.font ?? "serif"),
    style: String(options.style ?? options.fontStyle ?? "normal"),
    weight: options.weight ?? options.fontWeight ?? "normal",
    rotate: finiteOption(options.rotate, "rotate", 0),
    size: Math.trunc(size),
    padding,
    datum: options.datum
  };

  const empty = image ? fields.imageWidth === 0 || fields.imageHeight === 0 : fields.size < 1;
  return empty ? null : fields;
}

export function rasterizeSprite(fields, state) {
  const raster = fields.image
    ? rasterizeImageSprite(fields, state)
    : rasterizeTextSprite(fields, state);
  if (!raster) {
    return null;
  }

  const sprite = new CloudSprite(CREATE, {
    ...fields,
    imageWidth: raster.imageWidth ?? fields.imageWidth,
    imageHeight: raster.imageHeight ?? fields.imageHeight,
    width: raster.width,
    height: raster.height,
    x0: raster.x0,
    y0: raster.y0,
    x1: raster.x1,
    y1: raster.y1,
    trimX: raster.trimX,
    trimY: raster.trimY,
    trimWidth: raster.width,
    trimHeight: raster.height,
    spriteWidth: raster.spriteWidth,
    sprite: raster.data.slice()
  });
  MASKS.set(sprite, {
    data: raster.data,
    words: raster.spriteWidth >>> 5,
    x0: raster.x0,
    y0: raster.y0,
    x1: raster.x1,
    y1: raster.y1,
    width: raster.width,
    height: raster.height,
    envelope: raster.envelope
  });
  return sprite;
}

export function createSpriteContext(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let state = CONTEXT_STATES.get(context);
  if (state && !state.invalid) {
    return state;
  }

  canvas.width = canvas.height = 1;
  const ratio = Math.sqrt(context.getImageData(0, 0, 1, 1).data.length >> 2);
  canvas.width = SCRATCH_WIDTH / ratio;
  canvas.height = SCRATCH_HEIGHT / ratio;

  context.fillStyle = context.strokeStyle = "red";

  // Keep the state object shared by layouts, including those that already
  // hold a reference to it when another layout invalidates the context.
  state = Object.assign(state || {}, {
    context,
    ratio,
    invalid: false,
    pixelWidth: SCRATCH_WIDTH,
    clearWidth: 0,
    clearHeight: 0
  });
  CONTEXT_STATES.set(context, state);
  return state;
}

function finiteOption(value, name, defaultValue) {
  if (value == null) {
    return defaultValue;
  }
  value = +value;
  if (!Number.isFinite(value)) {
    throw new TypeError(`getSprite() expects a finite ${name}`);
  }
  return value;
}

function imageDimensionOption(value, name) {
  value = finiteOption(value, name, null);
  return value == null ? null : Math.max(0, Math.trunc(value));
}

function ceilToRatio(value, ratio) {
  return Math.max(1, Math.ceil(value / ratio) * ratio);
}

function clearContext(state, width = state.clearWidth, height = state.clearHeight) {
  const context = state.context;
  const ratio = state.ratio;

  if (width && height) {
    context.clearRect(0, 0, width / ratio, height / ratio);
  }

  return context;
}

function rasterizeTextSprite(sprite, state) {
  const context = clearContext(state);

  context.save();
  try {
    return drawTextSprite(sprite, state, context);
  } finally {
    // A failed measure or draw must not affect the font, alignment, or
    // transform of the next sprite.
    context.restore();
  }
}

function drawTextSprite(sprite, state, context) {
  const ratio = state.ratio;
  const pixelWidth = state.pixelWidth;
  const fontSize = Math.max(1, Math.ceil(sprite.size / ratio));
  const font = `${sprite.style} ${sprite.weight} ${fontSize}px ${sprite.font}`;

  // Canvases ignore fonts they cannot parse and keep drawing with the previous
  // one, which would leave a mask that does not match the rendered text. Set a
  // font of a different size first, so a rejected font is detectable.
  context.font = `${fontSize + 1}px serif`;
  const previousFont = context.font;
  context.font = font;
  if (context.font === previousFont) {
    throw new TypeError(`getSprite() font "${font}" was rejected by the canvas`);
  }
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
    width = Math.max(width, 2 * ratio * (sprite.padding + Math.max(
      Math.abs(metrics.actualBoundingBoxLeft),
      Math.abs(metrics.actualBoundingBoxRight)
    )));
    height = Math.max(height, 2 * ratio * (sprite.padding + Math.max(
      Math.abs(metrics.actualBoundingBoxAscent),
      Math.abs(metrics.actualBoundingBoxDescent)
    )));
  }

  ({ width, height } = rotatedExtent(width, height, sprite.rotate));

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
      state.clearWidth = 0;
      state.clearHeight = 0;
      return null;
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
      state.clearWidth = redrawn ? pixelWidth : Math.min(pixelWidth, rasterWidth + overhang);
      state.clearHeight = redrawn ? SCRATCH_HEIGHT : Math.min(SCRATCH_HEIGHT, rasterHeight + overhang);
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
    // metrics underestimated it, so redraw larger along each axis the ink
    // reached. Metrics that under-reported once cannot bound where the ink
    // went, so the whole scratch canvas is cleared before the next sprite.
    const nextWidth = growWidth ? Math.min(maxWidth, rasterWidth * 2) : rasterWidth;
    const nextHeight = growHeight ? Math.min(maxHeight, rasterHeight * 2) : rasterHeight;
    if (nextWidth === rasterWidth && nextHeight === rasterHeight) {
      alphaBounds = null;
      break;
    }
    redrawn = true;
    state.clearWidth = pixelWidth;
    state.clearHeight = SCRATCH_HEIGHT;
    clearContext(state, nextWidth, nextHeight);
    rasterWidth = nextWidth;
    rasterHeight = nextHeight;
  }

  if (!alphaBounds) {
    return null;
  }

  const raster = extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds);
  // Rectangle checks against the cloud use the measured raster width,
  // centered on the origin and widened only to contain the ink.
  const left = -(envelopeWidth >> 1);
  raster.envelope = {
    x0: Math.min(raster.x0, left),
    y0: raster.y0,
    x1: Math.max(raster.x1, left + envelopeWidth),
    y1: raster.y1
  };
  return raster;
}

function rasterizeImageSprite(sprite, state) {
  const context = clearContext(state);
  const ratio = state.ratio;
  const pixelWidth = state.pixelWidth;
  const imageSize = resolveImageSize(sprite.image, sprite.imageWidth, sprite.imageHeight);

  if (!imageSize) {
    state.clearWidth = 0;
    state.clearHeight = 0;
    return null;
  }

  const { drawWidth, drawHeight, intrinsic } = imageSize;
  const bounds = rotatedExtent(drawWidth, drawHeight, sprite.rotate);
  // Leave room on both sides of the integer raster origin for half-pixel
  // image edges and antialiasing after rotation or resizing.
  const rasterWidth = ceilToRatio(bounds.width + 2 * ratio, ratio);
  const rasterHeight = ceilToRatio(bounds.height + 2 * ratio, ratio);

  if (rasterWidth > pixelWidth || rasterHeight > SCRATCH_HEIGHT) {
    state.clearWidth = 0;
    state.clearHeight = 0;
    return null;
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
  } catch (error) {
    // Without intrinsic dimensions, the source may be broken rather than
    // merely unsized, and browsers refuse to draw broken images.
    if (intrinsic) {
      throw error;
    }
    return null;
  } finally {
    context.restore();
    // A failed draw must not affect the transform or pixels of the next sprite.
    state.clearWidth = rasterWidth;
    state.clearHeight = rasterHeight;
  }

  const pixels = context.getImageData(0, 0, rasterWidth / ratio, rasterHeight / ratio).data;
  const alphaBounds = findAlphaBounds(pixels, rasterWidth, rasterHeight);

  if (!alphaBounds) {
    return null;
  }

  const raster = extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds);
  raster.imageWidth = drawWidth;
  raster.imageHeight = drawHeight;
  // Opaque image masks get a small envelope on every side, so they can be
  // placed beside the cloud without their pixels overlapping it.
  raster.envelope = {
    x0: raster.x0 - IMAGE_SLACK,
    y0: raster.y0 - IMAGE_SLACK,
    x1: raster.x1 + IMAGE_SLACK,
    y1: raster.y1 + IMAGE_SLACK
  };
  return raster;
}

function extractSpritePixels(pixels, rasterWidth, rasterHeight, alphaBounds) {
  const width = alphaBounds.width;
  const height = alphaBounds.height;
  const spriteWidth = ((width + 31) >>> 5) << 5;
  const wordsPerRow = spriteWidth >>> 5;
  const x0 = alphaBounds.x0 - (rasterWidth >> 1);
  const y0 = alphaBounds.y0 - (rasterHeight >> 1);
  const data = new Uint32Array(wordsPerRow * height);

  for (let row = 0; row < height; row += 1) {
    const sourceRow = alphaBounds.y0 + row;
    const rowOffset = row * wordsPerRow;
    for (let column = 0; column < width; column += 1) {
      const sourceColumn = alphaBounds.x0 + column;
      if (pixels[((sourceRow * rasterWidth + sourceColumn) << 2) + 3]) {
        data[rowOffset + (column >>> 5)] |= 1 << (31 - (column & 31));
      }
    }
  }

  return {
    data,
    spriteWidth,
    width,
    height,
    trimX: alphaBounds.x0,
    trimY: alphaBounds.y0,
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height
  };
}

function resolveImageSize(image, imageWidth, imageHeight) {
  const sourceWidth = resolveImageDimension(image, "naturalWidth", "videoWidth", "width");
  const sourceHeight = resolveImageDimension(image, "naturalHeight", "videoHeight", "height");

  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    // Images without intrinsic dimensions, such as SVGs with only a viewBox,
    // can still be drawn at an explicit size once they have loaded.
    if (imageWidth != null && imageHeight != null &&
        typeof image.naturalWidth === "number" && image.complete === true) {
      return { drawWidth: imageWidth, drawHeight: imageHeight, intrinsic: false };
    }
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

  return { drawWidth, drawHeight, intrinsic: true };
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

function rotatedExtent(width, height, rotate) {
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
    width: Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)),
    height: Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine))
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
