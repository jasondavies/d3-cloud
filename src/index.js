// Word cloud layout by Jason Davies, https://www.jasondavies.com/wordcloud/
// Algorithm due to Jonathan Feinberg, https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf

import { dispatch } from "d3-dispatch";

const RADIANS = Math.PI / 180;

const SPIRALS = {
  archimedean: archimedeanSpiral,
  rectangular: rectangularSpiral
};

const cw = (1 << 11) >>> 5;
const ch = 1 << 11;

export default function() {
  var text = cloudText,
      font = cloudFont,
      fontSize = cloudFontSize,
      fontStyle = cloudFontNormal,
      fontWeight = cloudFontNormal,
      aspectRatio = 1,
      startBox = [256, 256],
      padding = cloudPadding,
      spiral = archimedeanSpiral,
      words = [],
      timeInterval = Infinity,
      event = dispatch("word", "end"),
      timer = null,
      random = Math.random,
      rotate = () => (~~(random() * 6) - 3) * 30,
      blockSize = 512,
      maxDelta = null,
      activeWords = null,
      cloud = {},
      canvas = cloudCanvas;

  cloud.canvas = function(_) {
    return arguments.length ? (canvas = functor(_), cloud) : canvas;
  };

  cloud.start = function() {
    cloud.stop();

    var contextAndRatio = getContext(canvas()),
        blockState = createSparseBlocks(blockSize),
        bounds = null,
        n = words.length,
        i = -1,
        tags = [],
        data = words.map(function(word, i) {
          var d = {...word};
          d.text = text.call(this, d, i);
          d.font = font.call(this, d, i);
          d.style = fontStyle.call(this, d, i);
          d.weight = fontWeight.call(this, d, i);
          d.rotate = rotate.call(this, d, i);
          d.size = ~~fontSize.call(this, d, i);
          d.padding = padding.call(this, d, i);
          return d;
        }).sort(function(a, b) { return b.size - a.size; });

    activeWords = data;

    timer = setInterval(step, 0);
    step();

    return cloud;

    function step() {
      var start = Date.now();
      while (Date.now() - start < timeInterval && ++i < n && timer) {
        var d = data[i];
        d.x = seedCoordinate(startBox[0], random);
        d.y = seedCoordinate(startBox[1], random);
        cloudSprite(contextAndRatio, d, data, i);
        if (d.hasText && place(blockState, d, bounds)) {
          tags.push(d);
          if (bounds) cloudBounds(bounds, d);
          else bounds = [{x: d.x + d.x0, y: d.y + d.y0}, {x: d.x + d.x1, y: d.y + d.y1}];
          event.call("word", cloud, outputWord(d));
        }
      }
      if (i >= n) {
        var outputTags = tags.map(function(tag) {
              return outputWord(tag);
            }),
            finalBounds = cloneBounds(bounds);
        cloud.stop();
        event.call("end", cloud, outputTags, finalBounds);
      }
    }
  }

  cloud.stop = function() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (activeWords) {
      for (const d of activeWords) {
        d.sprite = undefined;
      }
      activeWords = null;
    }
    return cloud;
  };

  function getContext(canvas) {
    const context = canvas.getContext("2d", {willReadFrequently: true});
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

  function place(state, tag, bounds) {
    var startX = tag.x,
        startY = tag.y,
        deltaLimit = resolveMaxDelta(tag, bounds, maxDelta),
        s = spiral(aspectRatio),
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

      // TODO only check for collisions within current bounds.
      if (!bounds || collideRects(tag, bounds)) {
        if (!state.collides(tag)) {
          state.insert(tag);
          return true;
        }
      }
    }
    return false;
  }

  cloud.timeInterval = function(_) {
    return arguments.length ? (timeInterval = _ == null ? Infinity : _, cloud) : timeInterval;
  };

  cloud.words = function(_) {
    return arguments.length ? (words = _, cloud) : words;
  };

  cloud.font = function(_) {
    return arguments.length ? (font = functor(_), cloud) : font;
  };

  cloud.fontStyle = function(_) {
    return arguments.length ? (fontStyle = functor(_), cloud) : fontStyle;
  };

  cloud.fontWeight = function(_) {
    return arguments.length ? (fontWeight = functor(_), cloud) : fontWeight;
  };

  cloud.aspectRatio = function(_) {
    return arguments.length ? (aspectRatio = normalizeAspectRatio(_), cloud) : aspectRatio;
  };

  cloud.startBox = function(_) {
    return arguments.length ? (startBox = normalizeStartBox(_), cloud) : startBox.slice();
  };

  cloud.rotate = function(_) {
    return arguments.length ? (rotate = functor(_), cloud) : rotate;
  };

  cloud.text = function(_) {
    return arguments.length ? (text = functor(_), cloud) : text;
  };

  cloud.spiral = function(_) {
    return arguments.length ? (spiral = SPIRALS[_] || _, cloud) : spiral;
  };

  cloud.fontSize = function(_) {
    return arguments.length ? (fontSize = functor(_), cloud) : fontSize;
  };

  cloud.padding = function(_) {
    return arguments.length ? (padding = functor(_), cloud) : padding;
  };

  cloud.random = function(_) {
    return arguments.length ? (random = _, cloud) : random;
  };

  cloud.blockSize = function(_) {
    return arguments.length ? (blockSize = normalizeBlockSize(_), cloud) : blockSize;
  };

  cloud.maxDelta = function(_) {
    return arguments.length ? (maxDelta = _ == null ? null : +_, cloud) : maxDelta;
  };

  cloud.on = function() {
    var value = event.on.apply(event, arguments);
    return value === event ? cloud : value;
  };

  return cloud;
};

function cloudText(d) {
  return d.text;
}

function cloudFont() {
  return "serif";
}

function cloudFontNormal() {
  return "normal";
}

function cloudFontSize(d) {
  return Math.sqrt(d.value);
}

function cloudPadding() {
  return 1;
}

// Fetches a monochrome sprite bitmap for the specified text.
// Load in batches for speed.
function cloudSprite(contextAndRatio, d, data, di) {
  if (d.sprite) return;
  d.hasText = false;
  var c = contextAndRatio.context,
      ratio = contextAndRatio.ratio,
      pixelWidth = contextAndRatio.pixelWidth,
      batchStart = di;

  if (contextAndRatio.clearWidth && contextAndRatio.clearHeight) {
    c.clearRect(0, 0, contextAndRatio.clearWidth / ratio, contextAndRatio.clearHeight / ratio);
  }
  var x = 0,
      y = 0,
      maxh = 0,
      n = data.length,
      usedWidth = 0,
      usedHeight = 0;
  --di;
  while (++di < n) {
    d = data[di];
    c.save();
    c.font = d.style + " " + d.weight + " " + ~~((d.size + 1) / ratio) + "px " + d.font;
    const metrics = c.measureText(d.text);
    const anchor = -Math.floor(metrics.width / 2);
    let w = (metrics.width + 1) * ratio;
    let h = d.size << 1;
    if (d.rotate) {
      var sr = Math.sin(d.rotate * RADIANS),
          cr = Math.cos(d.rotate * RADIANS),
          wcr = w * cr,
          wsr = w * sr,
          hcr = h * cr,
          hsr = h * sr;
      w = (Math.max(Math.abs(wcr + hsr), Math.abs(wcr - hsr)) + 0x1f) >>> 5 << 5;
      h = ~~Math.max(Math.abs(wsr + hcr), Math.abs(wsr - hcr));
    } else {
      w = (w + 0x1f) >>> 5 << 5;
    }
    if (h > maxh) maxh = h;
    if (x + w >= (cw << 5)) {
      x = 0;
      y += maxh;
      maxh = 0;
    }
    if (y + h >= ch) break;
    c.translate((x + (w >> 1)) / ratio, (y + (h >> 1)) / ratio);
    if (d.rotate) c.rotate(d.rotate * RADIANS);
    c.fillText(d.text, anchor, 0);
    if (d.padding) c.lineWidth = 2 * d.padding, c.strokeText(d.text, anchor, 0);
    c.restore();
    d.width = w;
    d.height = h;
    d.xoff = x;
    d.yoff = y;
    d.x1 = w >> 1;
    d.y1 = h >> 1;
    d.x0 = -d.x1;
    d.y0 = -d.y1;
    d.hasText = true;
    x += w;
    if (x > usedWidth) usedWidth = x;
    if (y + h > usedHeight) usedHeight = y + h;
  }

  contextAndRatio.clearWidth = usedWidth;
  contextAndRatio.clearHeight = usedHeight;

  if (!usedWidth || !usedHeight) return;

  var pixels = c.getImageData(0, 0, usedWidth / ratio, usedHeight / ratio).data,
      readbackWidth = usedWidth,
      sprite = contextAndRatio.sprite;
  while (--di >= batchStart) {
    d = data[di];
    if (!d.hasText) continue;
    var w = d.width,
        w32 = w >>> 5,
        h = d.y1 - d.y0;
    // Zero the buffer
    sprite.fill(0, 0, h * w32);
    x = d.xoff;
    if (x == null) return;
    y = d.yoff;
    var seen = 0,
        seenRow = -1;
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var k = w32 * j + (i >>> 5),
            m = pixels[((y + j) * readbackWidth + (x + i)) << 2] ? 1 << (31 - (i % 32)) : 0;
        sprite[k] |= m;
        seen |= m;
      }
      if (seen) seenRow = j;
      else {
        d.y0++;
        h--;
        j--;
        y++;
      }
    }
    d.y1 = d.y0 + seenRow;
    var spriteLength = (d.y1 - d.y0) * w32;
    d.sprite = new Uint32Array(spriteLength);
    d.sprite.set(sprite.subarray(0, spriteLength));
  }
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

function resolveMaxDelta(tag, bounds, maxDelta) {
  if (maxDelta != null) {
    return maxDelta;
  }
  var wordExtent = Math.max(tag.width || 0, tag.height || 0),
      boundsExtent = bounds
        ? Math.max(bounds[1].x - bounds[0].x, bounds[1].y - bounds[0].y)
        : 0;
  return Math.max(256, wordExtent * 4, boundsExtent * 2);
}

function outputWord(d) {
  return {
    ...d,
    sprite: undefined
  };
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
    // See triangular numbers: T_n = n * (n + 1) / 2.
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
  return typeof d === "function" ? d : function() { return d; };
}
