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
  assert.ok(Array.isArray(bounds));
  assert.equal(bounds.length, 2);
  assert.ok(bounds[0].x < bounds[1].x);
  assert.ok(bounds[0].y < bounds[1].y);
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
