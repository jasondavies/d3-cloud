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
const NODE_CANVAS_OVERLAP_FILL_STYLE = "rgba(255, 255, 255, 0.125)";
const NODE_CANVAS_OVERLAP_SEEDS = Array.from({ length: 16 }, (_value, index) => index + 1);
const NODE_CANVAS_TOUCH_ALPHA_THRESHOLD = 128;
const NODE_CANVAS_ROTATIONS = [-90, 0, 90];

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

test("layout uses half-size seeded placement", () => {
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
  assert.equal(placedWords[0].x, 10);
  assert.equal(placedWords[0].y, -5);
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

test("layout rasterizes text with alphabetic baseline", () => {
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
  assert.equal(seenBaseline, "alphabetic");
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
  assert.equal(sprite.trimX, 2);
  assert.equal(sprite.trimY, 2);
  assert.equal(sprite.trimWidth, 2);
  assert.equal(sprite.trimHeight, 2);
  assert.equal(sprite.x0, -1);
  assert.equal(sprite.y0, -1);
  assert.equal(sprite.x1, 1);
  assert.equal(sprite.y1, 1);
  assert.ok(sprite.sprite instanceof Uint32Array);
});

test("text geometry is trimmed to ink while the packed stride stays word-aligned", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size([50, 40]).overflow(false).strategy("none");
  const sprite = layout.getSprite("hello", { size: 20, padding: 0 });
  assert.equal(sprite.width, 50);
  assert.equal(sprite.height, 40);
  assert.equal(sprite.spriteWidth, 64);
  const word = layout.place(sprite, { x: -25 - sprite.x0, y: -20 - sprite.y0 });
  assert.ok(word, "a word fits when its pixels, but not its scratch raster, fit the box");
  assert.deepEqual(layout.bounds(), [{ x: -25, y: -20 }, { x: 25, y: 20 }]);
  assert.equal("_rasterWidth" in word, false);
  layout.eraseSprite(sprite);
  assert.equal(layout.bounds(), null);
});

test("occupancy insertion and erasure work across positive and negative block boundaries", () => {
  const image = createFakeImage(4, 4, Array.from({ length: 16 }, (_, i) => [i % 4, i >>> 2]));
  for (const blockSize of [32, 64, 512]) {
    const layout = new CloudLayout().canvas(createFakeCanvas).size(0).blockSize(blockSize).strategy("none");
    for (const edge of [-blockSize, 0, blockSize]) {
      const first = layout.getSprite(image);
      const second = layout.getSprite(image);
      const position = { x: edge, y: edge };
      assert.ok(layout.place(first, position));
      assert.equal(layout.place(second, position), null);
      layout.eraseSprite(first);
      assert.equal(layout.bounds(), null);
      assert.ok(layout.place(second, position));
      layout.eraseSprite(second);
    }
  }
});

test("image masks ignore the text-only padding option", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas);
  const image = createFakeImage(4, 4, [[1, 1], [2, 2]]);
  const plain = layout.getSprite(image);
  const padded = layout.getSprite(image, { padding: 10 });
  assert.deepEqual(padded.sprite, plain.sprite);
  assert.equal(padded.width, plain.width);
  assert.equal(padded.height, plain.height);
});

test("image masks cover rendered pixels for odd sizes, resizing, and rotation", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
  for (const [width, height] of [[1, 1], [3, 3], [5, 4], [4, 4], [31, 19]]) {
    const image = createCanvas(width, height);
    image.getContext("2d").fillRect(0, 0, width, height);
    for (const rotate of [0, 15, 30, 45, 90, -30]) {
      for (const dimensions of [{}, { width: 7, height: 9 }]) {
        const sprite = layout.getSprite(image, { rotate, ...dimensions });
        assert.ok(sprite);
        const canvas = createCanvas(128, 128);
        const context = canvas.getContext("2d");
        context.translate(64, 64);
        context.rotate(rotate * Math.PI / 180);
        context.drawImage(image, -sprite.imageWidth / 2, -sprite.imageHeight / 2,
          sprite.imageWidth, sprite.imageHeight);
        const pixels = context.getImageData(0, 0, 128, 128).data;
        for (let y = 0; y < 128; y++) {
          for (let x = 0; x < 128; x++) {
            if (!pixels[(y * 128 + x) * 4 + 3]) continue;
            const sx = x - 64 - sprite.x0;
            const sy = y - 64 - sprite.y0;
            const covered = sx >= 0 && sx < sprite.width && sy >= 0 && sy < sprite.height &&
              (sprite.sprite[sy * (sprite.spriteWidth / 32) + (sx >>> 5)] & (1 << (31 - (sx & 31))));
            assert.ok(covered, `${width}×${height}, ${rotate}°, ${JSON.stringify(dimensions)}: missing pixel ${x - 64},${y - 64}`);
          }
        }
      }
    }
  }
});

test("odd image dimensions cannot escape a bounded layout through clipped mask edges", () => {
  const { createCanvas } = loadNodeCanvas();
  const image = createCanvas(3, 3);
  image.getContext("2d").fillRect(0, 0, 3, 3);
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
    .size([4, 4]).overflow(false).strategy("none");
  const sprite = layout.getSprite(image);
  assert.equal(layout.place(sprite, { x: -1, y: -1 }), null);
  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  assert.deepEqual(layout.bounds(), [{ x: -2, y: -2 }, { x: 2, y: 2 }]);
});

test("opaque image sprites support explicit adjacent placement and erasure", () => {
  const { createCanvas } = loadNodeCanvas();
  const image = createCanvas(10, 10);
  image.getContext("2d").fillRect(0, 0, 10, 10);
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1)).size(0).strategy("none");
  const first = layout.getSprite(image);
  const second = layout.getSprite(image);
  const probe = layout.getSprite(image);
  assert.ok(layout.place(first, { x: 0, y: 0 }));
  assert.ok(layout.place(second, { x: 10, y: 0 }));
  assert.equal(layout.place(probe, { x: 9, y: 0 }), null);
  layout.eraseSprite(second);
  assert.equal(layout.place(probe, { x: 9, y: 0 }), null);
  assert.ok(layout.place(probe, { x: 10, y: 0 }));
});

for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
  test(`${strategy.name} packs multiple opaque images without overlapping`, () => {
    const { createCanvas } = loadNodeCanvas();
    const image = createCanvas(10, 10);
    image.getContext("2d").fillRect(0, 0, 10, 10);
    for (const overflow of [false, true]) {
      const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
        .size([64, 64]).overflow(overflow).random(() => 0.5).strategy(strategy);
      const placed = [];
      for (let i = 0; i < 6; i++) {
        const word = layout.place(layout.getSprite(image));
        assert.ok(word, `image ${i} failed with overflow ${overflow}`);
        for (const other of placed) {
          assert.ok(word.x + word.x1 <= other.x + other.x0 || word.x + word.x0 >= other.x + other.x1 ||
            word.y + word.y1 <= other.y + other.y0 || word.y + word.y0 >= other.y + other.y1);
        }
        if (!overflow) {
          assert.ok(word.x + word.x0 >= -32 && word.x + word.x1 <= 32);
          assert.ok(word.y + word.y0 >= -32 && word.y + word.y1 <= 32);
        }
        placed.push(word);
      }
    }
  });
}

test("text masks retain all padded pixels at the alphabetic rendering origin", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createNodeCanvasLayoutCanvas(createCanvas));
  for (const text of ["MMMM", "gy", "fij"]) {
    for (const rotate of [0, 45, 90]) {
      for (const padding of [0, 5, 12]) {
        const sprite = layout.getSprite(text, { size: 32, font: "serif", style: "italic", rotate, padding });
        assert.ok(sprite);
        const canvas = createCanvas(512, 512);
        const context = canvas.getContext("2d");
        configureNodeCanvasTextContext(context);
        context.font = "italic normal 32px serif";
        context.textBaseline = "alphabetic";
        const anchor = -context.measureText(text).width / 2;
        context.translate(256, 256);
        context.rotate(rotate * Math.PI / 180);
        context.fillText(text, anchor, 0);
        if (padding) {
          context.lineWidth = 2 * padding;
          context.strokeText(text, anchor, 0);
        }
        const pixels = context.getImageData(0, 0, 512, 512).data;
        for (let y = 0; y < 512; y++) {
          for (let x = 0; x < 512; x++) {
            if (!pixels[(y * 512 + x) * 4 + 3]) continue;
            const sx = x - 256 - sprite.x0;
            const sy = y - 256 - sprite.y0;
            const covered = sx >= 0 && sx < sprite.width && sy >= 0 && sy < sprite.height &&
              (sprite.sprite[sy * (sprite.spriteWidth / 32) + (sx >>> 5)] & (1 << (31 - (sx & 31))));
            assert.ok(covered, `${text}, rotation ${rotate}, padding ${padding}: missing pixel ${x - 256},${y - 256}`);
          }
        }
      }
    }
  }
});

test("ratio-three text readback preserves tail pixels without spilling between rows", () => {
  for (const measuredWidth of [20, 31]) {
    const context = createFakeCanvas().getContext("2d");
    context.measureText = () => ({ width: measuredWidth });
    let physicalWidth;
    context.getImageData = (_x, _y, width, height) => {
      physicalWidth = width * 3;
      const data = new Uint8ClampedArray(physicalWidth * height * 3 * 4);
      data[((physicalWidth - 1) * 4) + 3] = 255;
      data[(physicalWidth * 4) + 3] = 255;
      return { data };
    };
    const sprite = new CloudSprite({ text: "test", size: 20, padding: 0 });
    sprite.rasterize({ context, ratio: 3, pixelWidth: 2048, clearWidth: 0, clearHeight: 0 });
    const stride = Math.ceil(physicalWidth / 32);
    const expected = new Uint32Array(stride * 2);
    expected[(physicalWidth - 1) >>> 5] = (1 << (31 - ((physicalWidth - 1) & 31))) >>> 0;
    expected[stride] = 0x80000000;
    assert.equal(sprite.spriteWidth, stride * 32);
    assert.deepEqual(sprite.sprite, expected);
  }
});

test("strategy names do not resolve inherited object properties", () => {
  const layout = new CloudLayout();
  for (const name of ["toString", "constructor", "__proto__"]) {
    assert.throws(() => layout.strategy(name), /strategy/);
  }
});

test("custom strategies terminate when repeating or moving along only one axis", () => {
  for (const move of [false, true]) {
    const layout = new CloudLayout().canvas(createFakeCanvas).size(0);
    assert.ok(layout.place(layout.getSprite("first", { size: 20 })));
    let attempts = 0;
    const strategy = () => () => {
      assert.ok(attempts < 100000, "candidate budget was exceeded");
      attempts++;
      return { x: move ? attempts * 100 : 0, y: 0 };
    };
    assert.equal(layout.place(layout.getSprite("second", { size: 20 }), { strategy }), null);
    assert.equal(attempts, 100000);
  }
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
  assert.deepEqual(structuredClone(placed), placed);
  assert.equal("_placedLayout" in placed, false);
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
  assert.equal(placed.y, -3);
});

test("fractional coordinates are floored and preserve collision detection", () => {
  for (const coordinates of [{ x: 0.1, y: 0.1 }, { x: 12.75, y: -8.25 }, { x: -12.25, y: 8.75 }]) {
    const layout = new CloudLayout()
      .canvas(() => createFakeCanvas())
      .size(0)
      .strategy("none");
    const first = layout.getSprite("hello", { size: 20, padding: 0 });
    const second = layout.getSprite("hello", { size: 20, padding: 0 });
    const integerCoordinates = { x: Math.floor(coordinates.x), y: Math.floor(coordinates.y) };
    const placed = layout.place(first, coordinates);

    assert.equal(placed.x, integerCoordinates.x);
    assert.equal(placed.y, integerCoordinates.y);
    assert.equal(layout.place(second, coordinates), null);
    assert.equal(layout.place(second, integerCoordinates), null);
    assert.equal(layout.place(second, {
      x: 100,
      y: 100,
      strategy: singleCandidateStrategy(coordinates.x, coordinates.y)
    }), null);

    layout.eraseSprite(first);
    assert.equal(layout.bounds(), null);
    assert.ok(layout.place(second, integerCoordinates));
  }
});

test("custom strategy placements use integer pixel coordinates", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size(0);
  const first = layout.getSprite("first", { size: 16, padding: 0 });
  const second = layout.getSprite("second", { size: 16, padding: 0 });

  assert.ok(layout.place(first));
  const placed = layout.place(second, { strategy: singleCandidateStrategy(31.9, -0.1) });
  assert.ok(placed);
  assert.equal(placed.x, 31);
  assert.equal(placed.y, -1);
});

test("place rejects raw word objects", () => {
  const layout = new CloudLayout();

  assert.throws(() => layout.place({ text: "hello" }), /CloudSprite/);
});

test("place rejects an already placed CloudSprite without moving it", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const sprite = extractSprite(layout, { text: "hello", size: 16, padding: 0, rotate: 0, font: "serif" });
  const original = layout.place(sprite, { x: 0, y: 0 });

  assert.ok(original);
  assert.throws(
    () => layout.place(sprite, { x: 31, y: 0, strategy: "none" }),
    /already placed/
  );
  assert.equal(sprite.x, 0);
  assert.equal(sprite.y, 0);

  layout.eraseSprite(sprite);
  assert.ok(layout.place(sprite, { x: 0, y: 0, strategy: "none" }));
});

test("eraseSprite rejects unplaced and foreign sprites", () => {
  const firstLayout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const secondLayout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const sprite = extractSprite(firstLayout, { text: "hello", size: 16, padding: 0, rotate: 0, font: "serif" });

  assert.throws(() => firstLayout.eraseSprite(sprite), /placed in this layout/);
  assert.ok(firstLayout.place(sprite, { x: 0, y: 0 }));
  assert.throws(() => secondLayout.eraseSprite(sprite), /placed in this layout/);
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

test("setting the same normalized block size preserves occupied pixels", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size(0)
    .strategy("none");
  const first = layout.getSprite("hello", { size: 20, padding: 0 });
  const second = layout.getSprite("hello", { size: 20, padding: 0 });
  assert.ok(layout.place(first));
  const bounds = layout.bounds();

  for (const size of [layout.blockSize(), layout.blockSize() - 1]) {
    assert.equal(layout.blockSize(size), layout);
    assert.deepEqual(layout.bounds(), bounds);
    assert.equal(layout.place(second), null);
  }

  layout.eraseSprite(first);
  assert.equal(layout.bounds(), null);
  assert.ok(layout.place(second));
});

test("clear releases placed sprites for reuse", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const sprite = extractSprite(layout, { text: "hello", size: 20, padding: 0, rotate: 0, font: "serif" });

  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  layout.clear();
  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
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

test("node-canvas rendering stays overlap-free across seeded layouts", () => {
  const nodeCanvas = loadNodeCanvas();
  assert.ok(nodeCanvasSupportsBinaryText(nodeCanvas.createCanvas), "canvas must support antialias control");

  const words = createNodeCanvasStressWords(256);
  const maxSingleWordAlpha = measureNodeCanvasSingleWordAlpha(nodeCanvas.createCanvas, words);

  assert.ok(maxSingleWordAlpha > 0);

  for (const seed of NODE_CANVAS_OVERLAP_SEEDS) {
    const { placedWords, bounds } = runLayout(
      new CloudLayout()
        .canvas(() => createNodeCanvasLayoutCanvas(nodeCanvas.createCanvas))
        .size([1024, 768])
        .overflow(true)
        .random(createSeededRandom(seed)),
      words
    );

    assert.equal(
      placedWords.length,
      words.length,
      `seed ${seed} placed ${placedWords.length} of ${words.length} words`
    );

    const overlap = detectNodeCanvasOverlap(
      nodeCanvas.createCanvas,
      placedWords,
      bounds,
      maxSingleWordAlpha
    );

    assert.equal(
      overlap.count,
      0,
      `seed ${seed} rendered ${overlap.count} overlapping pixels (alpha ${overlap.maxAlpha} > ${maxSingleWordAlpha}) at ${overlap.x},${overlap.y}`
    );
  }
});

test("node-canvas rendered text keeps padded words from touching in seeded seed-523 layout", () => {
  const nodeCanvas = loadNodeCanvas();
  assert.ok(nodeCanvasSupportsBinaryText(nodeCanvas.createCanvas), "canvas must support antialias control");

  const words = createNodeCanvasTouchWords();
  const { placedWords, bounds } = runLayout(
    new CloudLayout()
      .canvas(() => createNodeCanvasLayoutCanvas(nodeCanvas.createCanvas))
      .size([960, 600])
      .overflow(true)
      .random(createBrowserSeededRandom(523)),
    words
  );

  assert.equal(
    placedWords.length,
    words.length,
    `seed 523 placed ${placedWords.length} of ${words.length} words`
  );

  const collision = detectNodeCanvasTouch(nodeCanvas.createCanvas, placedWords, bounds);

  assert.equal(
    collision,
    null,
    collision && `seed 523 rendered a ${collision.kind} between ${collision.a} and ${collision.b} at ${collision.x},${collision.y}`
  );
});

test("node-canvas rendered text keeps padded words from touching in seeded seed-20 five-orientation layout", () => {
  const nodeCanvas = loadNodeCanvas();
  assert.ok(nodeCanvasSupportsBinaryText(nodeCanvas.createCanvas), "canvas must support antialias control");

  const words = createNodeCanvasSeed20TouchWords();
  const { placedWords, bounds } = runLayout(
    new CloudLayout()
      .canvas(() => createNodeCanvasLayoutCanvas(nodeCanvas.createCanvas))
      .size([960, 600])
      .overflow(true)
      .random(createBrowserSeededRandom(20)),
    words
  );

  assert.equal(
    placedWords.length,
    words.length,
    `seed 20 placed ${placedWords.length} of ${words.length} words`
  );

  const collision = detectNodeCanvasTouch(nodeCanvas.createCanvas, placedWords, bounds);

  assert.equal(
    collision,
    null,
    collision && `seed 20 rendered a ${collision.kind} between ${collision.a} and ${collision.b} at ${collision.x},${collision.y}`
  );
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

test("layout places many large sprites without leaking raster data into results", () => {
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

  assert.equal(placedWords.length, words.length);
  assertCollisionFree(placedWords);
  for (const word of placedWords) {
    assert.equal("sprite" in word, false);
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

for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
  test(`${strategy.name} stops searching a full fixed box promptly`, () => {
    const width = 64;
    const height = 48;
    const image = createFakeImage(width, height,
      Array.from({ length: width * height }, (_, i) => [i % width, Math.floor(i / width)]));

    for (const overflow of [false, true]) {
      const layout = new CloudLayout().canvas(createFakeCanvas)
        .size([width, height]).overflow(overflow).random(() => 0.5);
      assert.ok(layout.place(layout.getSprite(image), { x: 0, y: 0 }));
      let attempts = 0;
      const countedStrategy = (initial, context) => {
        const next = strategy(initial, context);
        return () => { attempts++; return next(); };
      };
      const probe = layout.getSprite(createFakeImage(2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]]));
      const placed = layout.place(probe, { x: 0, y: 0, strategy: countedStrategy });
      if (overflow) {
        assert.ok(placed, "unbounded image placement can expand beyond the full box");
        assert.ok(placed.x + placed.x1 <= -width / 2 || placed.x + placed.x0 >= width / 2 ||
          placed.y + placed.y1 <= -height / 2 || placed.y + placed.y0 >= height / 2);
      } else {
        assert.equal(placed, null);
        assert.ok(attempts < 2000, `wasted ${attempts} candidates on a full fixed box`);
      }
    }
  });

  test(`${strategy.name} reaches open space near fixed-box edges`, () => {
    for (const [width, height] of [[64, 48], [48, 64]]) {
      for (const direction of [0.25, 0.75]) {
        for (const [holeX, holeY] of [[0, 0], [width - 16, 0], [0, height - 16], [width - 16, height - 16]]) {
          const pixels = Array.from({ length: width * height }, (_, i) => [i % width, Math.floor(i / width)])
            .filter(([x, y]) => x < holeX || x >= holeX + 16 || y < holeY || y >= holeY + 16);
          const layout = new CloudLayout().canvas(createFakeCanvas)
            .size([width, height]).overflow(false).random(() => direction).strategy(strategy);
          assert.ok(layout.place(layout.getSprite(createFakeImage(width, height, pixels)), { x: 0, y: 0 }));
          const probe = layout.getSprite(createFakeImage(2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]]));
          const placed = layout.place(probe);
          assert.ok(placed, `missed hole at ${holeX},${holeY} in ${width}×${height}, direction ${direction}`);
          assert.ok(placed.x + placed.x0 >= holeX - width / 2);
          assert.ok(placed.x + placed.x1 <= holeX + 16 - width / 2);
          assert.ok(placed.y + placed.y0 >= holeY - height / 2);
          assert.ok(placed.y + placed.y1 <= holeY + 16 - height / 2);
        }
      }
    }
  });

  test(`${strategy.name} can enter a fixed box from explicit outside coordinates`, () => {
    for (const x of [-128, 128]) {
      for (const y of [-128, 128]) {
        const layout = new CloudLayout().canvas(createFakeCanvas)
          .size([64, 48]).overflow(false).random(() => 0.5).strategy(strategy);
        const sprite = layout.getSprite(createFakeImage(2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]]));
        const placed = layout.place(sprite, { x, y });
        assert.ok(placed, `could not reach box from ${x},${y}`);
        assert.ok(placed.x + placed.x0 >= -32 && placed.x + placed.x1 <= 32);
        assert.ok(placed.y + placed.y0 >= -24 && placed.y + placed.y1 <= 24);
      }
    }
  });
}

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

function loadNodeCanvas() {
  return require("canvas");
}

function createNodeCanvasStressWords(count) {
  const syllables = [
    "al", "be", "cor", "di", "el", "fi", "gan", "hel",
    "io", "jun", "kel", "lin", "mor", "nor", "or", "pra"
  ];
  const random = createSeededRandom(0x5eedc0de);

  return Array.from({ length: count }, (_value, index) => {
    const parts = 2 + Math.floor(random() * 4);
    let text = "w";

    for (let part = 0; part < parts; part += 1) {
      text += syllables[Math.floor(random() * syllables.length)];
    }

    text += `-${index.toString(36).padStart(3, "0")}`;

    return {
      text,
      font: "serif",
      style: "normal",
      weight: "normal",
      size: 10 + Math.floor(random() * 46),
      rotate: NODE_CANVAS_ROTATIONS[Math.floor(random() * NODE_CANVAS_ROTATIONS.length)],
      padding: 0
    };
  }).sort((a, b) => b.size - a.size || a.text.localeCompare(b.text));
}

function createNodeCanvasTouchWords() {
  return createNodeCanvasTouchFixture([
    ["layout", 64.18539921951661, 0],
    ["algorithm", 64.18539921951661, 0],
    ["area", 64.18539921951661, 0],
    ["without", 52.940912924769606, 0],
    ["step", 52.940912924769606, 0],
    ["bounding", 52.940912924769606, 0],
    ["retrieve", 52.940912924769606, 0],
    ["operation", 52.940912924769606, 0],
    ["collision", 52.940912924769606, 0],
    ["candidate", 52.940912924769606, 0],
    ["separately", 37.092699609758306, 0],
    ["expensive", 37.092699609758306, 0]
  ]);
}

function createNodeCanvasSeed20TouchWords() {
  return createNodeCanvasTouchFixture([
    ["word", 100, 0],
    ["words", 91.27809882927491, 0],
    ["sprite", 86.0588236012831, 90],
    ["placed", 72.90730039024169, 45],
    ["layout", 64.18539921951661, -45],
    ["algorithm", 64.18539921951661, 45],
    ["area", 64.18539921951661, 0],
    ["without", 52.940912924769606, 45],
    ["step", 52.940912924769606, -45],
    ["bounding", 52.940912924769606, 90],
    ["retrieve", 52.940912924769606, -90],
    ["operation", 52.940912924769606, 90],
    ["time", 37.092699609758306, -90],
    ["possible", 37.092699609758306, -45],
    ["even", 37.092699609758306, -90],
    ["simple", 37.092699609758306, 0],
    ["starting", 37.092699609758306, 45],
    ["previously", 37.092699609758306, 0],
    ["move", 37.092699609758306, -45],
    ["perform", 37.092699609758306, 90],
    ["hierarchical", 37.092699609758306, 45],
    ["draw", 37.092699609758306, -45],
    ["pixel", 37.092699609758306, -90],
    ["data", 37.092699609758306, 45],
    ["separately", 37.092699609758306, 0],
    ["expensive", 37.092699609758306, 45],
    ["pixels", 37.092699609758306, 90],
    ["masks", 37.092699609758306, 45],
    ["implementation", 37.092699609758306, 90],
    ["detection", 37.092699609758306, 0],
    ["source", 10, -90],
    ["license", 10, 45],
    ["d3cloud", 10, -45],
    ["Note", 10, -90],
    ["code", 10, 90],
    ["converting", 10, 0],
    ["text", 10, -90],
    ["rendering", 10, -90],
    ["final", 10, 45],
    ["output", 10, 0],
    ["configurable", 10, -45],
    ["size", 10, 45],
    ["makes", 10, 90],
    ["animate", 10, -90],
    ["stuttering", 10, -45],
    ["recommended", 10, 90],
    ["always", 10, 45],
    ["use", 10, -90],
    ["animations", 10, 45],
    ["prevents", 10, 90],
    ["hard", 10, -90],
    ["part", 10, -45],
    ["making", 10, 0],
    ["efficiently", 10, -90],
    ["According", 10, 90],
    ["Jonathan", 10, 0]
  ]);
}

function createNodeCanvasTouchFixture(specs) {
  return specs.map(([text, size, rotate]) => ({
    text,
    font: "sans-serif",
    style: "normal",
    weight: "normal",
    size,
    rotate,
    padding: 1
  }));
}

function createNodeCanvasLayoutCanvas(createCanvas) {
  const canvas = createCanvas(1, 1);
  let context = null;

  return {
    get width() {
      return canvas.width;
    },
    set width(value) {
      canvas.width = value;
      if (context) {
        configureNodeCanvasTextContext(context);
      }
    },
    get height() {
      return canvas.height;
    },
    set height(value) {
      canvas.height = value;
      if (context) {
        configureNodeCanvasTextContext(context);
      }
    },
    getContext(type, options) {
      context = canvas.getContext(type, options);
      configureNodeCanvasTextContext(context);
      return context;
    }
  };
}

function configureNodeCanvasTextContext(context) {
  if ("antialias" in context) {
    context.antialias = "none";
  }
  if ("textDrawingMode" in context) {
    context.textDrawingMode = "path";
  }
}

function nodeCanvasSupportsBinaryText(createCanvas) {
  const context = createCanvas(1, 1).getContext("2d");
  return "antialias" in context;
}

function measureNodeCanvasSingleWordAlpha(createCanvas, words) {
  let maxAlpha = 0;

  for (const word of words) {
    const canvas = createCanvas(1, 1);
    let context = canvas.getContext("2d");
    configureNodeCanvasTextContext(context);
    context.font = getNodeCanvasWordFont(word);

    const width = Math.max(1, Math.ceil(context.measureText(word.text).width + Math.ceil(word.size) * 2 + 8));
    const height = Math.max(1, Math.ceil(Math.ceil(word.size) * 2 + 8));

    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext("2d");
    configureNodeCanvasTextContext(context);
    context.fillStyle = NODE_CANVAS_OVERLAP_FILL_STYLE;
    context.strokeStyle = NODE_CANVAS_OVERLAP_FILL_STYLE;
    context.globalCompositeOperation = "source-over";
    renderNodeCanvasFilledWord(context, word, width / 2, height / 2);

    maxAlpha = Math.max(maxAlpha, getMaxAlpha(context.getImageData(0, 0, width, height).data));
  }

  return maxAlpha;
}

function detectNodeCanvasOverlap(createCanvas, words, bounds, singleWordAlphaLimit) {
  const margin = 8;
  const width = Math.max(1, Math.ceil(bounds[1].x - bounds[0].x + margin * 2));
  const height = Math.max(1, Math.ceil(bounds[1].y - bounds[0].y + margin * 2));
  const offsetX = margin - bounds[0].x;
  const offsetY = margin - bounds[0].y;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  configureNodeCanvasTextContext(context);
  context.fillStyle = NODE_CANVAS_OVERLAP_FILL_STYLE;
  context.strokeStyle = NODE_CANVAS_OVERLAP_FILL_STYLE;
  context.globalCompositeOperation = "lighter";

  for (const word of words) {
    renderNodeCanvasFilledWord(context, word, word.x + offsetX, word.y + offsetY);
  }

  return summarizeNodeCanvasOverlap(
    context.getImageData(0, 0, width, height).data,
    width,
    singleWordAlphaLimit
  );
}

function detectNodeCanvasTouch(createCanvas, words, bounds) {
  const margin = 8;
  const width = Math.max(1, Math.ceil(bounds[1].x - bounds[0].x + margin * 2));
  const height = Math.max(1, Math.ceil(bounds[1].y - bounds[0].y + margin * 2));
  const offsetX = margin - bounds[0].x;
  const offsetY = margin - bounds[0].y;
  const occupancy = new Int32Array(width * height).fill(-1);
  const canvas = createCanvas(1, 1);
  let context = canvas.getContext("2d");

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
    const left = Math.max(0, Math.floor(word.x + word.x0 + offsetX) - 2);
    const top = Math.max(0, Math.floor(word.y + word.y0 + offsetY) - 2);
    const right = Math.min(width, Math.ceil(word.x + word.x1 + offsetX) + 3);
    const bottom = Math.min(height, Math.ceil(word.y + word.y1 + offsetY) + 3);
    const wordWidth = Math.max(1, right - left);
    const wordHeight = Math.max(1, bottom - top);

    canvas.width = wordWidth;
    canvas.height = wordHeight;
    context = canvas.getContext("2d");

    configureNodeCanvasTextContext(context);
    context.clearRect(0, 0, wordWidth, wordHeight);
    context.fillStyle = "rgba(255, 255, 255, 1)";
    context.globalCompositeOperation = "source-over";
    renderNodeCanvasRenderedFilledWord(context, word, word.x + offsetX - left, word.y + offsetY - top);

    const data = context.getImageData(0, 0, wordWidth, wordHeight).data;

    for (let y = 0; y < wordHeight; y += 1) {
      for (let x = 0; x < wordWidth; x += 1) {
        const alpha = data[((y * wordWidth + x) << 2) + 3];
        if (alpha < NODE_CANVAS_TOUCH_ALPHA_THRESHOLD) {
          continue;
        }

        const globalX = left + x;
        const globalY = top + y;
        const ownerIndex = globalY * width + globalX;
        const owner = occupancy[ownerIndex];

        if (owner >= 0 && owner !== wordIndex) {
          return {
            kind: "overlap",
            a: words[owner].text,
            b: word.text,
            x: globalX,
            y: globalY
          };
        }

        const touchOwner = findNodeCanvasTouchOwner(occupancy, width, height, globalX, globalY, wordIndex);
        if (touchOwner >= 0) {
          return {
            kind: "touch",
            a: words[touchOwner].text,
            b: word.text,
            x: globalX,
            y: globalY
          };
        }

        occupancy[ownerIndex] = wordIndex;
      }
    }
  }

  return null;
}

function renderNodeCanvasRenderedFilledWord(context, word, x, y) {
  context.save();
  context.font = getNodeCanvasRenderedWordFont(word);
  context.textAlign = "center";
  context.translate(x, y);

  if (word.rotate) {
    context.rotate(word.rotate * Math.PI / 180);
  }

  context.fillText(word.text, 0, 0);
  context.restore();
}

function renderNodeCanvasFilledWord(context, word, x, y) {
  context.save();
  context.font = getNodeCanvasWordFont(word);
  context.translate(x, y);

  if (word.rotate) {
    context.rotate(word.rotate * Math.PI / 180);
  }

  const anchor = -context.measureText(word.text).width / 2;

  context.fillText(word.text, anchor, 0);
  context.restore();
}

function getNodeCanvasWordFont(word) {
  return `${word.style ?? "normal"} ${word.weight ?? "normal"} ${Math.max(1, Math.ceil(word.size))}px ${word.font ?? "serif"}`;
}

function getNodeCanvasRenderedWordFont(word) {
  return `${word.style ?? "normal"} ${word.weight ?? "normal"} ${Math.max(1, Math.ceil(word.size))}px ${word.font ?? "serif"}`;
}

function summarizeNodeCanvasOverlap(data, width, alphaLimit) {
  let count = 0;
  let maxAlpha = 0;
  let x = -1;
  let y = -1;

  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];

    if (alpha > alphaLimit) {
      if (x < 0) {
        const pixelIndex = (index - 3) >> 2;
        x = pixelIndex % width;
        y = Math.floor(pixelIndex / width);
      }
      count += 1;
      maxAlpha = Math.max(maxAlpha, alpha);
    }
  }

  return { count, maxAlpha, x, y };
}

function findNodeCanvasTouchOwner(owners, width, height, x, y, wordIndex) {
  const neighborOffsets = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1]
  ];

  for (const [dx, dy] of neighborOffsets) {
    const neighborX = x + dx;
    const neighborY = y + dy;

    if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
      continue;
    }

    const owner = owners[neighborY * width + neighborX];
    if (owner >= 0 && owner !== wordIndex) {
      return owner;
    }
  }

  return -1;
}

function getMaxAlpha(data) {
  let maxAlpha = 0;

  for (let index = 3; index < data.length; index += 4) {
    maxAlpha = Math.max(maxAlpha, data[index]);
  }

  return maxAlpha;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createBrowserSeededRandom(seed) {
  let state = seed >>> 0;

  return function() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
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
  const fontPx = Math.ceil(word.size);
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
