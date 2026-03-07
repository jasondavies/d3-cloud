import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import cloud from "../src/index.js";

const require = createRequire(import.meta.url);

test("package exports resolve to the layout factory in ESM", async () => {
  const { default: importedCloud } = await import("d3-cloud");

  assert.equal(typeof importedCloud, "function");
});

test("package exports reject CommonJS require", () => {
  assert.throws(() => require("d3-cloud"));
});

test("browser bundle exports the layout factory as ESM", async () => {
  const { default: bundledCloud } = await import(new URL("../build/d3-cloud.js", import.meta.url));

  assert.equal(typeof bundledCloud, "function");
});

test("layout places a simple word and cleans up sprite data", async () => {
  const words = [{ text: "hello", value: 1 }];
  const seenWords = [];
  const layout = cloud()
    .canvas(() => createFakeCanvas())
    .random(() => 0.5)
    .rotate(() => 0)
    .padding(0)
    .font("serif")
    .fontSize(() => 20)
    .words(words);

  const { placedWords, bounds } = await new Promise(resolve => {
    layout
      .on("word", word => {
        seenWords.push(word);
      })
      .on("end", (placed, nextBounds) => {
        resolve({ placedWords: placed, bounds: nextBounds });
      })
      .start();
  });

  assert.equal(seenWords.length, 1);
  assert.equal(placedWords.length, 1);
  assert.equal(placedWords[0].text, "hello");
  assert.equal(placedWords[0].x, 0);
  assert.equal(placedWords[0].y, 0);
  assert.equal(words[0].sprite, undefined);
  assert.equal(words[0].x, undefined);
  assert.equal(words[0].y, undefined);
  assert.ok(Array.isArray(bounds));
  assert.equal(bounds.length, 2);
  assert.ok(bounds[0].x < bounds[1].x);
  assert.ok(bounds[0].y < bounds[1].y);
});

test("layout handles multiple sprite batches and cleans up sprite data", async () => {
  const words = Array.from({ length: 40 }, (_, index) => ({
    text: `batch-${String(index).padStart(2, "0")}-xxxxxxxxxxxxxxxxxxxxxxxxxx`,
    value: 1
  }));
  const layout = cloud()
    .size([4096, 4096])
    .canvas(() => createFakeCanvas())
    .random(createSeededRandom(1))
    .rotate(() => 0)
    .padding(0)
    .font("serif")
    .fontSize(() => 160)
    .words(words);

  const placedWords = await new Promise(resolve => {
    layout.on("end", placed => {
      resolve(placed);
    }).start();
  });

  assert.ok(placedWords.length > 0);
  for (const word of words) {
    assert.equal(word.sprite, undefined);
  }
});

test("layout can rerun the same input words after accessors change", async () => {
  const words = [{ text: "huge-word", value: 1 }];
  const layout = cloud()
    .size([4096, 4096])
    .canvas(() => createFakeCanvas())
    .random(() => 0.5)
    .rotate(() => 0)
    .padding(0)
    .font("serif")
    .fontSize(d => d.value)
    .words(words);

  const firstPlacedWords = await runLayout(layout);

  assert.equal(firstPlacedWords.length, 1);

  words[0].value = 5000;

  const secondPlacedWords = await runLayout(layout);

  assert.equal(secondPlacedWords.length, 0);
  assert.deepEqual(Object.keys(words[0]).sort(), ["text", "value"]);
});

test("layout detects collisions near the right edge for non-word-aligned widths", async () => {
  const words = [
    { text: "right-edge-a", value: 1 },
    { text: "right-edge-b", value: 1 }
  ];
  const placedWords = await runLayout(
    cloud()
      .size([500, 64])
      .canvas(() => createRightEdgeCanvas())
      .random(() => 0.5)
      .rotate(() => 0)
      .padding(0)
      .font("serif")
      .fontSize(() => 16)
      .spiral(() => t => t === 0 ? [234, 0] : [234 + t * 1000, t * 1000])
      .words(words)
  );

  assert.equal(placedWords.length, 1);
  assert.equal(placedWords[0].x, 234);
  assert.equal(placedWords[0].y, 0);
});

function createFakeCanvas() {
  const boxes = [];
  const stack = [];
  const context = {
    _tx: 0,
    _ty: 0,
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    lineWidth: 1,
    clearRect() {
      boxes.length = 0;
    },
    save() {
      stack.push({
        font: this.font,
        lineWidth: this.lineWidth,
        tx: this._tx,
        ty: this._ty
      });
    },
    restore() {
      const state = stack.pop();
      this.font = state.font;
      this.lineWidth = state.lineWidth;
      this._tx = state.tx;
      this._ty = state.ty;
    },
    translate(x, y) {
      this._tx += x;
      this._ty += y;
    },
    rotate() {},
    measureText(text) {
      return { width: text.length * 10 };
    },
    fillText(text, x, y) {
      boxes.push(createBox(this, text, x, y, 0));
    },
    strokeText(text, x, y) {
      boxes.push(createBox(this, text, x, y, this.lineWidth));
    },
    getImageData(_x, _y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);

      for (const box of boxes) {
        const x0 = Math.max(0, box.x0);
        const y0 = Math.max(0, box.y0);
        const x1 = Math.min(width, box.x1);
        const y1 = Math.min(height, box.y1);

        for (let row = y0; row < y1; row += 1) {
          for (let column = x0; column < x1; column += 1) {
            data[(row * width + column) * 4] = 255;
          }
        }
      }

      return { data };
    }
  };

  return {
    width: 1,
    height: 1,
    getContext(type) {
      assert.equal(type, "2d");
      return context;
    }
  };
}

function createRightEdgeCanvas() {
  const boxes = [];
  const stack = [];
  const context = {
    _tx: 0,
    _ty: 0,
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    lineWidth: 1,
    clearRect() {
      boxes.length = 0;
    },
    save() {
      stack.push({
        font: this.font,
        lineWidth: this.lineWidth,
        tx: this._tx,
        ty: this._ty
      });
    },
    restore() {
      const state = stack.pop();
      this.font = state.font;
      this.lineWidth = state.lineWidth;
      this._tx = state.tx;
      this._ty = state.ty;
    },
    translate(x, y) {
      this._tx += x;
      this._ty += y;
    },
    rotate() {},
    measureText() {
      return { width: 31 };
    },
    fillText(_text, _x, y) {
      boxes.push(createRightEdgeBox(this, y, 0));
    },
    strokeText(_text, _x, y) {
      boxes.push(createRightEdgeBox(this, y, this.lineWidth));
    },
    getImageData(_x, _y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);

      for (const box of boxes) {
        const x0 = Math.max(0, box.x0);
        const y0 = Math.max(0, box.y0);
        const x1 = Math.min(width, box.x1);
        const y1 = Math.min(height, box.y1);

        for (let row = y0; row < y1; row += 1) {
          for (let column = x0; column < x1; column += 1) {
            data[(row * width + column) * 4] = 255;
          }
        }
      }

      return { data };
    }
  };

  return {
    width: 1,
    height: 1,
    getContext(type) {
      assert.equal(type, "2d");
      return context;
    }
  };
}

function createBox(context, text, x, y, inflate) {
  const fontMatch = /(\d+)px/.exec(context.font);
  const fontSize = fontMatch ? Number(fontMatch[1]) : 10;
  const width = context.measureText(text).width;

  return {
    x0: Math.floor(context._tx + x - inflate),
    y0: Math.floor(context._ty + y - fontSize - inflate),
    x1: Math.ceil(context._tx + x + width + inflate),
    y1: Math.ceil(context._ty + y + fontSize + inflate)
  };
}

function createRightEdgeBox(context, y, inflate) {
  const fontMatch = /(\d+)px/.exec(context.font);
  const fontSize = fontMatch ? Number(fontMatch[1]) : 10;

  return {
    x0: Math.floor(context._tx + 12 - inflate),
    y0: Math.floor(context._ty + y - fontSize - inflate),
    x1: Math.ceil(context._tx + 16 + inflate),
    y1: Math.ceil(context._ty + y + fontSize + inflate)
  };
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function runLayout(layout) {
  return new Promise((resolve, reject) => {
    try {
      layout.on("end", placed => {
        resolve(placed);
      }).start();
    } catch (error) {
      reject(error);
    }
  });
}
