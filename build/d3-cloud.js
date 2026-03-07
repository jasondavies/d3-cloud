var __defProp = Object.defineProperty;
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

// node_modules/d3-dispatch/src/dispatch.js
var noop = { value: function() {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}
function set(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({ name, value: callback });
  return type;
}
var dispatch_default = dispatch;

// src/index.js
var RADIANS = Math.PI / 180;
var SPIRALS = {
  archimedean: archimedeanSpiral,
  rectangular: rectangularSpiral
};
var cw = 1 << 11 >>> 5;
var ch = 1 << 11;
function index_default() {
  var size = [256, 256], text = cloudText, font = cloudFont, fontSize = cloudFontSize, fontStyle = cloudFontNormal, fontWeight = cloudFontNormal, padding = cloudPadding, spiral = archimedeanSpiral, words = [], timeInterval = Infinity, event = dispatch_default("word", "end"), timer = null, random = Math.random, rotate = () => (~~(random() * 6) - 3) * 30, activeWords = null, cloud = {}, canvas = cloudCanvas;
  cloud.canvas = function(_) {
    return arguments.length ? (canvas = functor(_), cloud) : canvas;
  };
  cloud.start = function() {
    cloud.stop();
    var contextAndRatio = getContext(canvas()), boardWidth = boardWidthWords(size[0]), board = zeroArray(boardWidth * size[1]), bounds = null, n = words.length, i = -1, tags = [], data = words.map(function(word, i2) {
      var d = __spreadValues({}, word);
      d.text = text.call(this, d, i2);
      d.font = font.call(this, d, i2);
      d.style = fontStyle.call(this, d, i2);
      d.weight = fontWeight.call(this, d, i2);
      d.rotate = rotate.call(this, d, i2);
      d.size = ~~fontSize.call(this, d, i2);
      d.padding = padding.call(this, d, i2);
      return d;
    }).sort(function(a, b) {
      return b.size - a.size;
    });
    activeWords = data;
    timer = setInterval(step, 0);
    step();
    return cloud;
    function step() {
      var start = Date.now();
      while (Date.now() - start < timeInterval && ++i < n && timer) {
        var d = data[i];
        d.x = size[0] * (random() + 0.5) >> 1;
        d.y = size[1] * (random() + 0.5) >> 1;
        cloudSprite(contextAndRatio, d, data, i);
        if (d.hasText && place(board, boardWidth, d, bounds)) {
          tags.push(d);
          event.call("word", cloud, d);
          if (bounds) cloudBounds(bounds, d);
          else bounds = [{ x: d.x + d.x0, y: d.y + d.y0 }, { x: d.x + d.x1, y: d.y + d.y1 }];
          d.x -= size[0] >> 1;
          d.y -= size[1] >> 1;
        }
      }
      if (i >= n) {
        cloud.stop();
        event.call("end", cloud, tags, bounds);
      }
    }
  };
  cloud.stop = function() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (activeWords) {
      for (const d of activeWords) {
        d.sprite = void 0;
      }
      activeWords = null;
    }
    return cloud;
  };
  function getContext(canvas2) {
    const context = canvas2.getContext("2d", { willReadFrequently: true });
    const pixelWidth = cw << 5;
    canvas2.width = canvas2.height = 1;
    const ratio = Math.sqrt(context.getImageData(0, 0, 1, 1).data.length >> 2);
    canvas2.width = pixelWidth / ratio;
    canvas2.height = ch / ratio;
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
  function place(board, boardWidth, tag, bounds) {
    var perimeter = [{ x: 0, y: 0 }, { x: size[0], y: size[1] }], startX = tag.x, startY = tag.y, maxDelta = Math.sqrt(size[0] * size[0] + size[1] * size[1]), s = spiral(size), dt = random() < 0.5 ? 1 : -1, t = -dt, dxdy, dx, dy;
    while (dxdy = s(t += dt)) {
      dx = ~~dxdy[0];
      dy = ~~dxdy[1];
      if (Math.min(Math.abs(dx), Math.abs(dy)) >= maxDelta) break;
      tag.x = startX + dx;
      tag.y = startY + dy;
      if (tag.x + tag.x0 < 0 || tag.y + tag.y0 < 0 || tag.x + tag.x1 > size[0] || tag.y + tag.y1 > size[1]) continue;
      if (!bounds || collideRects(tag, bounds)) {
        if (!cloudCollide(tag, board, boardWidth)) {
          var sprite = tag.sprite, w = tag.width >>> 5, sw = boardWidth, lx = tag.x - (w << 4), sx = lx & 127, msx = 32 - sx, h = tag.y1 - tag.y0, x = (tag.y + tag.y0) * sw + (lx >>> 5), last;
          for (var j = 0; j < h; j++) {
            last = 0;
            for (var i = 0; i <= w; i++) {
              board[x + i] |= last << msx | (i < w ? (last = sprite[j * w + i]) >>> sx : 0);
            }
            x += sw;
          }
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
  cloud.size = function(_) {
    return arguments.length ? (size = [+_[0], +_[1]], cloud) : size;
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
  cloud.on = function() {
    var value = event.on.apply(event, arguments);
    return value === event ? cloud : value;
  };
  return cloud;
}
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
function cloudSprite(contextAndRatio, d, data, di) {
  if (d.sprite) return;
  d.hasText = false;
  var c = contextAndRatio.context, ratio = contextAndRatio.ratio, pixelWidth = contextAndRatio.pixelWidth, batchStart = di;
  if (contextAndRatio.clearWidth && contextAndRatio.clearHeight) {
    c.clearRect(0, 0, contextAndRatio.clearWidth / ratio, contextAndRatio.clearHeight / ratio);
  }
  var x = 0, y = 0, maxh = 0, n = data.length, usedWidth = 0, usedHeight = 0;
  --di;
  while (++di < n) {
    d = data[di];
    c.save();
    c.font = d.style + " " + d.weight + " " + ~~((d.size + 1) / ratio) + "px " + d.font;
    const metrics = c.measureText(d.text);
    const anchor = -Math.floor(metrics.width / 2);
    let w2 = (metrics.width + 1) * ratio;
    let h2 = d.size << 1;
    if (d.rotate) {
      var sr = Math.sin(d.rotate * RADIANS), cr = Math.cos(d.rotate * RADIANS), wcr = w2 * cr, wsr = w2 * sr, hcr = h2 * cr, hsr = h2 * sr;
      w2 = Math.max(Math.abs(wcr + hsr), Math.abs(wcr - hsr)) + 31 >>> 5 << 5;
      h2 = ~~Math.max(Math.abs(wsr + hcr), Math.abs(wsr - hcr));
    } else {
      w2 = w2 + 31 >>> 5 << 5;
    }
    if (h2 > maxh) maxh = h2;
    if (x + w2 >= cw << 5) {
      x = 0;
      y += maxh;
      maxh = 0;
    }
    if (y + h2 >= ch) break;
    c.translate((x + (w2 >> 1)) / ratio, (y + (h2 >> 1)) / ratio);
    if (d.rotate) c.rotate(d.rotate * RADIANS);
    c.fillText(d.text, anchor, 0);
    if (d.padding) c.lineWidth = 2 * d.padding, c.strokeText(d.text, anchor, 0);
    c.restore();
    d.width = w2;
    d.height = h2;
    d.xoff = x;
    d.yoff = y;
    d.x1 = w2 >> 1;
    d.y1 = h2 >> 1;
    d.x0 = -d.x1;
    d.y0 = -d.y1;
    d.hasText = true;
    x += w2;
    if (x > usedWidth) usedWidth = x;
    if (y + h2 > usedHeight) usedHeight = y + h2;
  }
  contextAndRatio.clearWidth = usedWidth;
  contextAndRatio.clearHeight = usedHeight;
  if (!usedWidth || !usedHeight) return;
  var pixels = c.getImageData(0, 0, usedWidth / ratio, usedHeight / ratio).data, readbackWidth = usedWidth, sprite = contextAndRatio.sprite;
  while (--di >= batchStart) {
    d = data[di];
    if (!d.hasText) continue;
    var w = d.width, w32 = w >>> 5, h = d.y1 - d.y0;
    sprite.fill(0, 0, h * w32);
    x = d.xoff;
    if (x == null) return;
    y = d.yoff;
    var seen = 0, seenRow = -1;
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var k = w32 * j + (i >>> 5), m = pixels[(y + j) * readbackWidth + (x + i) << 2] ? 1 << 31 - i % 32 : 0;
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
function cloudCollide(tag, board, sw) {
  var sprite = tag.sprite, w = tag.width >>> 5, lx = tag.x - (w << 4), sx = lx & 127, msx = 32 - sx, h = tag.y1 - tag.y0, x = (tag.y + tag.y0) * sw + (lx >>> 5), last;
  for (var j = 0; j < h; j++) {
    last = 0;
    for (var i = 0; i <= w; i++) {
      if ((last << msx | (i < w ? (last = sprite[j * w + i]) >>> sx : 0)) & board[x + i]) return true;
    }
    x += sw;
  }
  return false;
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
function archimedeanSpiral(size) {
  var e = size[0] / size[1];
  return function(t) {
    return [e * (t *= 0.1) * Math.cos(t), t * Math.sin(t)];
  };
}
function rectangularSpiral(size) {
  var dy = 4, dx = dy * size[0] / size[1], x = 0, y = 0;
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
function zeroArray(n) {
  return new Uint32Array(n);
}
function boardWidthWords(width) {
  return width + 31 >>> 5;
}
function cloudCanvas() {
  return document.createElement("canvas");
}
function functor(d) {
  return typeof d === "function" ? d : function() {
    return d;
  };
}
export {
  index_default as default
};
