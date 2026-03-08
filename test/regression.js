import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import CloudLayout, {
  CloudSprite,
  archimedeanStrategy,
  rectangularStrategy,
  noneStrategy
} from "../src/index.js";

const require = createRequire(import.meta.url);

test("package exports resolve to the layout class in ESM", async () => {
  const {
    default: ImportedCloudLayout,
    CloudSprite: ImportedCloudSprite,
    archimedeanStrategy: ImportedArchimedeanStrategy,
    rectangularStrategy: ImportedRectangularStrategy,
    noneStrategy: ImportedNoneStrategy
  } = await import("d3-cloud");

  assert.equal(typeof ImportedCloudLayout, "function");
  assert.equal(typeof new ImportedCloudLayout().place, "function");
  assert.equal(typeof ImportedCloudSprite, "function");
  assert.equal(typeof ImportedArchimedeanStrategy, "function");
  assert.equal(typeof ImportedRectangularStrategy, "function");
  assert.equal(typeof ImportedNoneStrategy, "function");
});

test("package exports reject CommonJS require", () => {
  assert.throws(() => require("d3-cloud"));
});

test("browser bundle exports the layout class as ESM", async () => {
  const {
    default: BundledCloudLayout,
    CloudSprite: BundledCloudSprite,
    archimedeanStrategy: BundledArchimedeanStrategy,
    rectangularStrategy: BundledRectangularStrategy,
    noneStrategy: BundledNoneStrategy
  } = await import(new URL("../build/d3-cloud.js", import.meta.url));

  assert.equal(typeof BundledCloudLayout, "function");
  assert.equal(typeof new BundledCloudLayout().place, "function");
  assert.equal(typeof BundledCloudSprite, "function");
  assert.equal(typeof BundledArchimedeanStrategy, "function");
  assert.equal(typeof BundledRectangularStrategy, "function");
  assert.equal(typeof BundledNoneStrategy, "function");
});

test("layout exposes a size accessor", () => {
  const layout = new CloudLayout();

  assert.deepEqual(layout.size(), [256, 256]);
  assert.equal(layout.size([40, 20]), layout);
  assert.deepEqual(layout.size(), [40, 20]);
});

test("layout uses size for seeded placement", () => {
  const { placedWords } = runLayout(
    new CloudLayout()
      .canvas(() => createFakeCanvas())
      .size([80, 40])
      .overflow(true)
      .random(createSequenceRandom([0.75, 0.25, 0.6]))
      .strategy(noStrategy),
    [{ text: "seeded", size: 12, padding: 0, rotate: 0, font: "serif" }]
  );

  assert.deepEqual(new CloudLayout().size(), [256, 256]);
  assert.equal(placedWords.length, 1);
  assert.equal(placedWords[0].x, 20);
  assert.equal(placedWords[0].y, -10);
});

test("layout exposes an overflow accessor", () => {
  const layout = new CloudLayout();

  assert.equal(layout.overflow(), true);
  assert.equal(layout.overflow(false), layout);
  assert.equal(layout.overflow(), false);
});

test("layout exposes a strategy accessor", () => {
  const layout = new CloudLayout();

  assert.equal(layout.strategy(), archimedeanStrategy);
  assert.equal(layout.strategy("rectangular"), layout);
  assert.equal(layout.strategy(), rectangularStrategy);
  assert.equal(layout.strategy("none"), layout);
  assert.equal(layout.strategy(), noneStrategy);
  assert.equal(layout.strategy(archimedeanStrategy), layout);
  assert.equal(layout.strategy(), archimedeanStrategy);
});

test("layout exposes a blockSize accessor", () => {
  const layout = new CloudLayout();

  assert.equal(layout.blockSize(), 512);
  assert.equal(layout.blockSize(100), layout);
  assert.equal(layout.blockSize(), 128);
  assert.equal(layout.blockSize(160), layout);
  assert.equal(layout.blockSize(), 160);
});

test("layout canvas accessor requires a factory function", () => {
  const layout = new CloudLayout();

  assert.equal(typeof layout.canvas(), "function");
  assert.throws(() => layout.canvas(createFakeCanvas()), /canvas\(\) expects a canvas factory function/);
});

test("layout can build a reusable CloudSprite", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas());

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(sprite.text, "hello");
  assert.equal(sprite.hasPixels, true);
  assert.ok(sprite.sprite instanceof Uint32Array);
  assert.ok(sprite.width > 0);
  assert.ok(sprite.height > 0);
});

test("layout rasterizes text with a middle baseline", () => {
  let seenBaseline = null;
  const layout = new CloudLayout()
    .canvas(() => createBaselineCanvas(value => {
      seenBaseline = value;
    }));

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(seenBaseline, "middle");
});

test("layout can build a CloudSprite from image alpha", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas());
  const image = createFakeImage(4, 4, [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2]
  ]);

  const sprite = layout.getSprite(image, { text: "icon" });

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(sprite.image, image);
  assert.equal(sprite.text, "icon");
  assert.equal(sprite.imageWidth, 4);
  assert.equal(sprite.imageHeight, 4);
  assert.equal(sprite.width, 2);
  assert.equal(sprite.height, 2);
  assert.equal(sprite.trimX, 1);
  assert.equal(sprite.trimY, 1);
  assert.equal(sprite.trimWidth, 2);
  assert.equal(sprite.trimHeight, 2);
  assert.equal(sprite.x0, -1);
  assert.equal(sprite.y0, -1);
  assert.equal(sprite.x1, 1);
  assert.equal(sprite.y1, 1);
  assert.ok(sprite.sprite instanceof Uint32Array);
});

test("layout can resize image sprites with explicit width and height", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas());
  const image = createFakeImage(
    4,
    4,
    Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)])
  );

  const sprite = layout.getSprite(image, {
    text: "icon",
    width: 8,
    height: 6
  });

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(sprite.imageWidth, 8);
  assert.equal(sprite.imageHeight, 6);
  assert.equal(sprite.width, 8);
  assert.equal(sprite.height, 6);
  assert.equal(sprite.x0, -4);
  assert.equal(sprite.y0, -3);
  assert.equal(sprite.x1, 4);
  assert.equal(sprite.y1, 3);
});

test("layout preserves image aspect ratio when only one resize dimension is provided", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas());
  const image = createFakeImage(
    4,
    8,
    Array.from({ length: 32 }, (_, index) => [index % 4, Math.floor(index / 4)])
  );

  const sprite = layout.getSprite(image, {
    text: "icon",
    width: 10
  });

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(sprite.imageWidth, 10);
  assert.equal(sprite.imageHeight, 20);
  assert.equal(sprite.width, 10);
  assert.equal(sprite.height, 20);
});

test("overflow false constrains image sprites to the layout size", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([4, 4])
    .overflow(false)
    .random(() => 0.5)
    .strategy(noStrategy);
  const image = createFakeImage(
    4,
    4,
    Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)])
  );

  const sprite = layout.getSprite(image, { width: 4, height: 4 });

  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  layout.clear();
  assert.equal(layout.place(sprite, { x: 1, y: 0 }), null);
});

test("custom strategies receive the initial seed and layout context", () => {
  let receivedInitial;
  let receivedContext;
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([60, 20])
    .overflow(true)
    .random(() => 0.5);

  layout.place(layout.getSprite("first", {
    font: "serif",
    size: 16,
    rotate: 0,
    padding: 0
  }));

  layout.strategy((initial, context) => {
    receivedInitial = initial;
    receivedContext = context;
    return singleCandidateStrategy(31, 0)();
  });

  const placed = layout.place(layout.getSprite("hello", {
    font: "serif",
    size: 16,
    rotate: 0,
    padding: 0
  }));

  assert.deepEqual(receivedInitial, { x: 0, y: 0 });
  assert.equal(receivedContext.aspectRatio, 3);
  assert.deepEqual(receivedContext.size, [60, 20]);
  assert.equal(receivedContext.overflow, true);
  assert.equal(typeof receivedContext.random, "function");
  assert.ok(receivedContext.bounds);
  assert.ok(placed);
  assert.equal(placed.x, 31);
  assert.equal(placed.y, 0);
});

test("place accepts a prepared CloudSprite", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5);

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });
  const placed = layout.place(sprite);

  assert.ok(sprite instanceof CloudSprite);
  assert.equal(placed.text, "hello");
  assert.equal(placed.x, 0);
  assert.equal(placed.y, 0);
});

test("placed words omit internal raster state and preserve custom fields", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5);

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0,
    id: "greeting"
  });
  const placed = layout.place(sprite);

  assert.equal(placed.id, "greeting");
  assert.equal("sprite" in placed, false);
  assert.equal("spriteWidth" in placed, false);
  assert.equal("hasPixels" in placed, false);
  assert.equal(typeof placed.text, "string");
  assert.equal(typeof placed.x, "number");
  assert.equal(typeof placed.trimHeight, "number");
});

test("place accepts explicit initial coordinates", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([40, 20])
    .overflow(true)
    .random(() => 0.25)
    .strategy(noStrategy);

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });
  const placed = layout.place(sprite, { x: 12, y: -8 });

  assert.equal(placed.x, 12);
  assert.equal(placed.y, -8);
});

test("place mixes explicit coordinates with seeded defaults", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([40, 20])
    .overflow(true)
    .random(createSequenceRandom([0.25, 0.6]))
    .strategy(noStrategy);

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });
  const placed = layout.place(sprite, { x: 12 });

  assert.equal(placed.x, 12);
  assert.equal(placed.y, -5);
});

test("place rejects raw word objects", () => {
  const layout = new CloudLayout();

  assert.throws(() => layout.place({ text: "hello" }), /CloudSprite/);
});

test("place accepts a per-call strategy override", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5)
    .strategy(noStrategy);

  const first = layout.place(extractSprite(layout, { text: "first", size: 16, padding: 0, rotate: 0, font: "serif" }));
  const second = layout.place(
    extractSprite(layout, { text: "second", size: 16, padding: 0, rotate: 0, font: "serif" }),
    { strategy: singleCandidateStrategy(31, 0) }
  );

  assert.ok(first);
  assert.ok(second);
  assert.equal(second.x, 31);
  assert.equal(second.y, 0);
});

test("eraseSprite removes a placed sprite and frees its occupied space", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const firstSprite = extractSprite(layout, { text: "first", size: 16, padding: 0, rotate: 0, font: "serif" });
  const secondSprite = extractSprite(layout, { text: "second", size: 16, padding: 0, rotate: 0, font: "serif" });

  assert.ok(layout.place(firstSprite, { x: 0, y: 0 }));
  assert.equal(layout.place(secondSprite, { x: 0, y: 0 }), null);
  layout.eraseSprite(firstSprite);
  assert.equal(layout.bounds(), null);

  const secondPlacement = layout.place(secondSprite, { x: 0, y: 0 });

  assert.ok(secondPlacement);
  assert.equal(secondPlacement.x, 0);
  assert.equal(secondPlacement.y, 0);
});

test("clear resets bounds and unlocks blockSize changes", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5);

  layout.place(extractSprite(layout, { text: "hello", size: 20, padding: 0, rotate: 0, font: "serif" }));

  assert.ok(layout.bounds());
  assert.throws(() => layout.blockSize(256));
  assert.equal(layout.clear(), layout);
  assert.equal(layout.bounds(), null);
  assert.equal(layout.blockSize(256), layout);
  assert.equal(layout.blockSize(), 256);
});

test("place handles one word at a time", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5);

  const placed = layout.place(extractSprite(layout, { text: "hello", size: 20, padding: 0, rotate: 0, font: "serif" }));

  assert.equal(placed.text, "hello");
  assert.equal(placed.x, 0);
  assert.equal(placed.y, 0);
  assert.ok(layout.bounds());
});

test("default placement produces a collision-free layout", () => {
  const words = [
    { text: "alpha", size: 28, padding: 2 },
    { text: "beta", size: 24, padding: 2 },
    { text: "gamma", size: 20, padding: 2 },
    { text: "delta", size: 18, padding: 2 }
  ];
  const { placedWords } = runLayout(
    new CloudLayout()
      .canvas(() => createFakeCanvas())
      .random(createSeededRandom(7)),
    words
  );

  assert.equal(placedWords.length, words.length);
  assertCollisionFree(placedWords);
});

test("block size changes do not affect deterministic placement", () => {
  const words = [
    { text: "alpha", size: 28 },
    { text: "beta", size: 24 },
    { text: "gamma", size: 20 },
    { text: "delta", size: 18 },
    { text: "epsilon", size: 16 }
  ];
  const baseConfig = layout => layout
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(createSeededRandom(9));

  const { placedWords: smallBlockWords } = runLayout(baseConfig(new CloudLayout().blockSize(64)), words);
  const { placedWords: largeBlockWords } = runLayout(baseConfig(new CloudLayout().blockSize(512)), words);

  assert.deepEqual(summarizeWords(largeBlockWords), summarizeWords(smallBlockWords));
});

test("layout places a simple word and reports bounds", () => {
  const words = [{ text: "hello", size: 20, padding: 0, rotate: 0, font: "serif" }];
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
      .random(() => 0.5);

  const { placedWords, bounds } = runLayout(layout, words);

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

test("layout handles multiple sprite batches and cleans up sprite data", () => {
  const words = Array.from({ length: 40 }, (_, index) => ({
    text: `batch-${String(index).padStart(2, "0")}-xxxxxxxxxxxxxxxxxxxxxxxxxx`,
    size: 160,
    padding: 0,
    rotate: 0
  }));
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
      .random(createSeededRandom(1));

  const { placedWords } = runLayout(layout, words);

  assert.ok(placedWords.length > 0);
  for (const word of words) {
    assert.equal(word.sprite, undefined);
  }
});

test("layout collision detection survives partial sprite readback", () => {
  const words = [
    { text: "tall-a", size: 16, padding: 0, rotate: 0 },
    { text: "tall-b", size: 16, padding: 0, rotate: 0 }
  ];
  const { placedWords } = runLayout(
    new CloudLayout()
      .canvas(() => createFakeCanvas())
      .size([0, 0])
      .overflow(true)
      .random(createSequenceRandom([0.5, 0.5, 0.6, 0.5, 0.578125, 0.6]))
      .strategy(noStrategy),
    words
  );

  assert.equal(placedWords.length, 1);
});

test("layout can rerun the same input words after sprite options change", () => {
  const words = [{ text: "huge-word", size: 1, padding: 0, rotate: 0 }];
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
      .random(() => 0.5);

  const { placedWords: firstPlacedWords } = runLayout(layout, words);

  assert.equal(firstPlacedWords.length, 1);

  words[0].size = 5000;
  layout.clear();

  const { placedWords: secondPlacedWords } = runLayout(layout, words);

  assert.equal(secondPlacedWords.length, 0);
  assert.deepEqual(Object.keys(words[0]).sort(), ["padding", "rotate", "size", "text"]);
});

test("layout detects collisions near the right edge for non-word-aligned widths", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5)
    .strategy(noStrategy);
  const first = layout.place(extractSprite(layout, {
    text: "right-edge-a",
    size: 16,
    padding: 0,
    rotate: 0
  }), { x: 234, y: 0 });
  const second = layout.place(extractSprite(layout, {
    text: "right-edge-b",
    size: 16,
    padding: 0,
    rotate: 0
  }), { x: 234, y: 0 });

  assert.ok(first);
  assert.equal(first.x, 234);
  assert.equal(first.y, 0);
  assert.equal(second, null);
});

test("layout can place words beyond the initial seeded position", () => {
  const words = [
    { text: "first", size: 16, padding: 0, rotate: 0 },
    { text: "second", size: 16, padding: 0, rotate: 0 }
  ];
  const { placedWords } = runLayout(
    new CloudLayout()
      .canvas(() => createRightEdgeCanvas())
      .size([0, 0])
      .overflow(true)
      .random(() => 0.4)
      .strategy(sequenceStrategy([{ x: 31, y: 0 }])),
    words
  );

  assert.equal(placedWords.length, 2);
  assert.ok(placedWords[1].x + placedWords[1].x1 > 32);
});

test("overflow false constrains placement to the layout size", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([32, 32])
    .overflow(false)
    .random(() => 0.5)
    .strategy(noStrategy);

  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0
  });

  assert.equal(layout.place(sprite), null);
});

function createFakeCanvas() {
  const boxes = [];
  const images = [];
  const stack = [];
  const context = {
    _tx: 0,
    _ty: 0,
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    textBaseline: "alphabetic",
    lineWidth: 1,
    clearRect() {
      boxes.length = 0;
      images.length = 0;
    },
    save() {
      stack.push({
        font: this.font,
        textBaseline: this.textBaseline,
        lineWidth: this.lineWidth,
        tx: this._tx,
        ty: this._ty
      });
    },
    restore() {
      const state = stack.pop();
      this.font = state.font;
      this.textBaseline = state.textBaseline;
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
    drawImage(image, x, y, width = image.width, height = image.height) {
      images.push(createImageDraw(this, image, x, y, width, height));
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
            data[(row * width + column) * 4 + 3] = 255;
          }
        }
      }

       for (const image of images) {
        paintImageDraw(data, width, height, image);
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
  const images = [];
  const stack = [];
  const context = {
    _tx: 0,
    _ty: 0,
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    textBaseline: "alphabetic",
    lineWidth: 1,
    clearRect() {
      boxes.length = 0;
      images.length = 0;
    },
    save() {
      stack.push({
        font: this.font,
        textBaseline: this.textBaseline,
        lineWidth: this.lineWidth,
        tx: this._tx,
        ty: this._ty
      });
    },
    restore() {
      const state = stack.pop();
      this.font = state.font;
      this.textBaseline = state.textBaseline;
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
    drawImage(image, x, y, width = image.width, height = image.height) {
      images.push(createImageDraw(this, image, x, y, width, height));
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
            data[(row * width + column) * 4 + 3] = 255;
          }
        }
      }

      for (const image of images) {
        paintImageDraw(data, width, height, image);
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

function createBaselineCanvas(onFillText) {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    textBaseline: "alphabetic",
    lineWidth: 1,
    clearRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    measureText(text) {
      return { width: text.length * 10 };
    },
    fillText(_text, _x, _y) {
      onFillText(this.textBaseline);
    },
    strokeText() {},
    getImageData(_x, _y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let row = 4; row < Math.min(height, 12); row += 1) {
        for (let column = 4; column < Math.min(width, 20); column += 1) {
          data[(row * width + column) * 4 + 3] = 255;
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

function createImageDraw(context, image, x, y, width, height) {
  return {
    image,
    x0: context._tx + x,
    y0: context._ty + y,
    width,
    height
  };
}

function paintImageDraw(data, width, height, draw) {
  const sourceWidth = draw.image.naturalWidth ?? draw.image.width;
  const sourceHeight = draw.image.naturalHeight ?? draw.image.height;
  const sourceData = draw.image.data;
  const x0 = Math.max(0, Math.floor(draw.x0));
  const y0 = Math.max(0, Math.floor(draw.y0));
  const x1 = Math.min(width, Math.ceil(draw.x0 + draw.width));
  const y1 = Math.min(height, Math.ceil(draw.y0 + draw.height));

  for (let row = y0; row < y1; row += 1) {
    const sourceRow = Math.min(
      sourceHeight - 1,
      Math.max(0, Math.floor(((row - draw.y0) / draw.height) * sourceHeight))
    );
    for (let column = x0; column < x1; column += 1) {
      const sourceColumn = Math.min(
        sourceWidth - 1,
        Math.max(0, Math.floor(((column - draw.x0) / draw.width) * sourceWidth))
      );
      const alpha = sourceData[((sourceRow * sourceWidth + sourceColumn) << 2) + 3];
      if (alpha) {
        data[((row * width + column) << 2) + 3] = alpha;
      }
    }
  }
}

function createFakeImage(width, height, opaquePixels) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (const [x, y, alpha = 255] of opaquePixels) {
    data[((y * width + x) << 2) + 3] = alpha;
  }

  return {
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    data
  };
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createSequenceRandom(values) {
  let index = 0;

  return function() {
    const value = values[index];
    index += 1;
    return value === undefined ? 0.5 : value;
  };
}

function assertCollisionFree(words) {
  for (let i = 0; i < words.length; i += 1) {
    const a = words[i];
    for (let j = i + 1; j < words.length; j += 1) {
      const b = words[j];
      assert.equal(
        fakeCanvasBoxesOverlap(a, b),
        false,
        `${a.text} overlaps ${b.text}`
      );
    }
  }
}

function fakeCanvasBoxesOverlap(a, b) {
  const aBox = getClippedFakeCanvasBox(a);
  const bBox = getClippedFakeCanvasBox(b);

  return (
    aBox.x1 > bBox.x0 &&
    aBox.x0 < bBox.x1 &&
    aBox.y1 > bBox.y0 &&
    aBox.y0 < bBox.y1
  );
}

function getClippedFakeCanvasBox(word) {
  const inflate = word.padding ? word.padding * 2 : 0;
  const fontPx = word.size + 1;
  const width = word.text.length * 10;
  const anchor = -Math.floor(width / 2);
  const spriteLeft = word.x + word.x0;
  const spriteTop = word.y + word.y0;
  const spriteRight = word.x + word.x1;
  const spriteBottom = word.y + word.y1;

  return {
    x0: Math.max(spriteLeft, word.x + anchor - inflate),
    y0: Math.max(spriteTop, word.y - fontPx - inflate),
    x1: Math.min(spriteRight, word.x + anchor + width + inflate),
    y1: Math.min(spriteBottom, word.y + fontPx + inflate)
  };
}

function summarizeWords(words) {
  return words.map(word => ({
    text: word.text,
    x: word.x,
    y: word.y,
    x0: word.x0,
    x1: word.x1,
    y0: word.y0,
    y1: word.y1,
    rotate: word.rotate
  }));
}

function runLayout(layout, words = []) {
  const placedWords = [];

  for (const sprite of extractSprites(layout, words)) {
    const word = layout.place(sprite);
    if (word) {
      placedWords.push(word);
    }
  }

  return {
    placedWords,
    bounds: layout.bounds()
  };
}

function extractSprites(layout, words) {
  return Array.from(words, word => extractSprite(layout, word)).filter(Boolean);
}

function extractSprite(layout, word) {
  return layout.getSprite(word.text, {
    ...word,
    font: word.font ?? "serif",
    style: word.style ?? "normal",
    weight: word.weight ?? "normal",
    size: word.size ?? 1,
    rotate: word.rotate ?? 0,
    padding: word.padding ?? 1
  });
}

function noStrategy() {
  return function() {
    return null;
  };
}

function singleCandidateStrategy(x, y) {
  return sequenceStrategy([{ x, y }]);
}

function sequenceStrategy(candidates) {
  return function() {
    let index = 0;
    return function() {
      const candidate = candidates[index];
      index += 1;
      return candidate ?? null;
    };
  };
}
