const RADIANS = Math.PI / 180;
const cw = (1 << 11) >>> 5;
const ch = 1 << 11;

export default class CloudSprite {
  constructor({
    text = "",
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
    this.sprite = undefined;
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
    this.sprite = undefined;

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
      width = (Math.max(Math.abs(widthCosine + heightSine), Math.abs(widthCosine - heightSine)) + 0x1f) >>> 5 << 5;
      height = Math.trunc(Math.max(Math.abs(widthSine + heightCosine), Math.abs(widthSine - heightCosine)));
    } else {
      width = (width + 0x1f) >>> 5 << 5;
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
        const bit = pixels[((topOffset + row) * width + column) << 2] ? 1 << (31 - (column & 31)) : 0;
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

function normalizeNumber(value) {
  value = +value;
  return Number.isFinite(value) ? value : 0;
}
