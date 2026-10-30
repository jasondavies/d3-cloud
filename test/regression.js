import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

import CloudLayout, {
  CloudSprite,
  archimedeanStrategy,
  rectangularStrategy,
  noneStrategy
} from "../src/index.js";
import { spriteMask } from "../src/sprite.js";

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
      .strategy(noneStrategy),
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
  assert.ok(sprite.sprite instanceof Uint32Array);
  assert.ok(sprite.width > 0);
  assert.ok(sprite.height > 0);
  assert.ok(Object.isFrozen(sprite));
  assert.throws(() => { "use strict"; sprite.size = 40; }, TypeError);
});

test("sprites can only be created by getSprite()", () => {
  assert.throws(() => new CloudSprite(), /getSprite/);
  assert.throws(() => new CloudSprite(Symbol("CloudSprite"), { text: "forged" }), /getSprite/);
});

test("the same sprite can be placed repeatedly without changing", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size([200, 100]).overflow(false)
    .random(createSeededRandom(5));
  const sprite = layout.getSprite("hello", { size: 20, padding: 0, datum: { id: 1 } });
  const before = { ...sprite };
  const words = [];
  for (let word; (word = layout.place(sprite));) {
    words.push(word);
  }
  assert.ok(words.length > 3, `placed ${words.length} copies`);
  assert.deepEqual({ ...sprite }, before);
  for (let i = 0; i < words.length; i++) {
    assert.equal(words[i].datum, sprite.datum);
    for (let j = 0; j < i; j++) {
      const a = words[i];
      const b = words[j];
      assert.ok(a.x + a.x1 <= b.x + b.x0 || a.x + a.x0 >= b.x + b.x1 ||
        a.y + a.y1 <= b.y + b.y0 || a.y + a.y0 >= b.y + b.y1, `copies ${i} and ${j} overlap`);
    }
  }
  for (const word of words) {
    layout.erase(word);
  }
  assert.equal(layout.bounds(), null);
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
  assert.equal("trimX" in sprite, false);
  assert.equal("trimWidth" in sprite, false);
  assert.equal(sprite.x0, -1);
  assert.equal(sprite.y0, -1);
  assert.equal(sprite.x1, 1);
  assert.equal(sprite.y1, 1);
  assert.ok(sprite.sprite instanceof Uint32Array);
});

test("unavailable image and video sources ignore explicit display dimensions", () => {
  const canvas = createFakeCanvas();
  canvas.getContext("2d").drawImage = () => assert.fail("unavailable sources must not be drawn");
  const layout = new CloudLayout().canvas(() => canvas);
  for (const source of [
    { width: 100, height: 100, naturalWidth: 0, naturalHeight: 0, complete: false },
    { width: 100, height: 100, naturalWidth: 0, naturalHeight: 0, complete: true },
    { width: 100, height: 100, videoWidth: 0, videoHeight: 0 }
  ]) {
    assert.equal(layout.getSprite(source), null);
    assert.equal(layout.getSprite(source, { width: 80 }), null);
    if (!source.complete) {
      assert.equal(layout.getSprite(source, { width: 80, height: 80 }), null);
    }
  }
});

test("loaded images without intrinsic dimensions can be drawn at an explicit size", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const drawImage = context.drawImage.bind(context);
  // Like an SVG with only a viewBox, and a broken image, both of which report
  // zero intrinsic dimensions once complete.
  const unsized = { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: true };
  const broken = { ...unsized };
  context.drawImage = (image, ...args) => {
    if (image === unsized) return context.fillRect(...args);
    if (image === broken) throw new DOMException("broken image", "InvalidStateError");
    return drawImage(image, ...args);
  };
  const layout = new CloudLayout().canvas(() => canvas);
  assert.equal(layout.getSprite(unsized), null);
  assert.equal(layout.getSprite(unsized, { height: 30 }), null);
  const sprite = layout.getSprite(unsized, { width: 40, height: 30 });
  assert.deepEqual([sprite.width, sprite.height, sprite.imageWidth, sprite.imageHeight], [40, 30, 40, 30]);
  assert.equal(layout.getSprite(broken, { width: 40, height: 30 }), null);
  assert.ok(context.getTransform().isIdentity);
  const options = { size: 40, padding: 0 };
  const fresh = new CloudLayout().canvas(() => createCanvas(1, 1)).getSprite("hello", options);
  assert.deepEqual(layout.getSprite("hello", options).sprite, fresh.sprite);
});

test("failed image draws restore the context and clear any partial drawing", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const drawImage = context.drawImage.bind(context);
  const brokenSource = createCanvas(400, 200);
  const failure = new Error("image draw failed");
  context.drawImage = (image, ...args) => {
    if (image === brokenSource) {
      context.fillRect(-200, -100, 400, 200);
      throw failure;
    }
    drawImage(image, ...args);
  };
  const layout = new CloudLayout().canvas(() => canvas);
  assert.ok(layout.getSprite("small", { size: 20 }));
  assert.throws(() => layout.getSprite(brokenSource, { rotate: 30 }), error => error === failure);
  assert.ok(context.getTransform().isIdentity);
  assert.equal(layout.getSprite(createCanvas(600, 600)), null);
  const options = { size: 40, padding: 0 };
  const recovered = layout.getSprite("hello", options);
  const fresh = new CloudLayout().canvas(() => createCanvas(1, 1)).getSprite("hello", options);
  assert.deepEqual(recovered.sprite, fresh.sprite);
  assert.deepEqual([recovered.x0, recovered.y0, recovered.x1, recovered.y1],
    [fresh.x0, fresh.y0, fresh.x1, fresh.y1]);
});

test("image and video sprites use intrinsic dimensions when resizing", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas);
  for (const dimensions of [
    { naturalWidth: 160, naturalHeight: 90 },
    { videoWidth: 160, videoHeight: 90 }
  ]) {
    const source = {
      width: 100,
      height: 100,
      data: createFakeImage(160, 90,
        Array.from({ length: 160 * 90 }, (_, i) => [i % 160, Math.floor(i / 160)])).data,
      ...dimensions
    };
    for (const [options, expected] of [
      [{}, [160, 90]],
      [{ width: 80 }, [80, 45]],
      [{ height: 45 }, [80, 45]],
      [{ width: 80, height: 80 }, [80, 80]]
    ]) {
      const sprite = layout.getSprite(source, options);
      assert.ok(sprite);
      assert.deepEqual([sprite.imageWidth, sprite.imageHeight], expected);
    }
  }
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
  layout.erase(word);
  assert.equal(layout.bounds(), null);
});

test("occupancy insertion and erasure work across positive and negative block boundaries", () => {
  const image = createFakeImage(4, 4, Array.from({ length: 16 }, (_, i) => [i % 4, i >>> 2]));
  for (const blockSize of [32, 64, 512]) {
    const layout = new CloudLayout().canvas(createFakeCanvas).size(0).blockSize(blockSize).strategy("none");
    const sprite = layout.getSprite(image);
    for (const edge of [-blockSize, 0, blockSize]) {
      const position = { x: edge, y: edge };
      const first = layout.place(sprite, position);
      assert.ok(first);
      assert.equal(layout.place(sprite, position), null);
      layout.erase(first);
      assert.equal(layout.bounds(), null);
      layout.erase(layout.place(sprite, position));
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
  const sprite = layout.getSprite(image);
  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  const second = layout.place(sprite, { x: 10, y: 0 });
  assert.ok(second);
  assert.equal(layout.place(sprite, { x: 9, y: 0 }), null);
  layout.erase(second);
  assert.equal(layout.place(sprite, { x: 9, y: 0 }), null);
  assert.ok(layout.place(sprite, { x: 10, y: 0 }));
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
        context.textAlign = "center";
        context.translate(256, 256);
        context.rotate(rotate * Math.PI / 180);
        context.fillText(text, 0, 0);
        if (padding) {
          context.lineWidth = 2 * padding;
          context.lineJoin = "round";
          context.strokeText(text, 0, 0);
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

test("large italic and accented text masks cover their full rendered ink", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
  const fixtures = [
    { text: "f", size: 256, style: "italic", padding: 0 },
    { text: "j", size: 512, style: "italic", padding: 5 },
    { text: "A\u0301\u0302\u0303", size: 128, style: "normal", padding: 0 },
    { text: "AV", size: 128, style: "normal", padding: 24 }
  ];
  for (const options of fixtures) {
    for (const rotate of [0, 30, 90, -45]) {
      const sprite = layout.getSprite(options.text, { ...options, font: "serif", rotate });
      assert.ok(sprite);
      const context = createCanvas(1536, 1536).getContext("2d");
      context.font = `${options.style} normal ${options.size}px serif`;
      context.textAlign = "center";
      context.translate(768, 768);
      context.rotate(rotate * Math.PI / 180);
      context.fillText(options.text, 0, 0);
      if (options.padding) {
        context.lineWidth = 2 * options.padding;
        context.lineJoin = "round";
        context.strokeText(options.text, 0, 0);
      }
      const pixels = context.getImageData(0, 0, 1536, 1536).data;
      for (let y = 0; y < 1536; y++) {
        for (let x = 0; x < 1536; x++) {
          if (!pixels[(y * 1536 + x) * 4 + 3]) continue;
          const sx = x - 768 - sprite.x0;
          const sy = y - 768 - sprite.y0;
          const covered = sx >= 0 && sx < sprite.width && sy >= 0 && sy < sprite.height &&
            (sprite.sprite[sy * (sprite.spriteWidth / 32) + (sx >>> 5)] & (1 << (31 - (sx & 31))));
          assert.ok(covered, `${options.text}, ${rotate}°: missing pixel ${x - 768},${y - 768}`);
        }
      }
    }
  }
});

test("text masks cover antialiased centered rendering, as documented", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
  const fixtures = [
    ["AV", 128, 0, 0],
    ["AV", 128, 0, 30],
    ["hello", 37, 0, 0],
    ["Wave", 61, 1, 45],
    ["fij", 33, 0, 90]
  ];
  for (const [text, size, padding, rotate] of fixtures) {
    const sprite = layout.getSprite(text, { size, padding, rotate, font: "serif" });
    assert.ok(sprite);
    const context = createCanvas(512, 512).getContext("2d");
    context.font = `normal normal ${size}px serif`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.translate(256, 256);
    context.rotate(rotate * Math.PI / 180);
    context.fillText(text, 0, 0);
    const pixels = context.getImageData(0, 0, 512, 512).data;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if (!pixels[(y * 512 + x) * 4 + 3]) continue;
        const sx = x - 256 - sprite.x0;
        const sy = y - 256 - sprite.y0;
        const covered = sx >= 0 && sx < sprite.width && sy >= 0 && sy < sprite.height &&
          (sprite.sprite[sy * (sprite.spriteWidth / 32) + (sx >>> 5)] & (1 << (31 - (sx & 31))));
        assert.ok(covered, `${text} ${size}px, ${rotate}°: missing pixel ${x - 256},${y - 256}`);
      }
    }
  }
});

test("under-reported ink metrics redraw text without stale pixels or a wider envelope", () => {
  const { createCanvas } = loadNodeCanvas();
  const underReporting = () => {
    const canvas = createCanvas(1, 1);
    const context = canvas.getContext("2d");
    const measure = context.measureText.bind(context);
    context.measureText = text => {
      const metrics = measure(text);
      return {
        width: metrics.width * 0.3,
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft * 0.3,
        actualBoundingBoxRight: metrics.actualBoundingBoxRight * 0.3,
        actualBoundingBoxAscent: metrics.actualBoundingBoxAscent * 0.3,
        actualBoundingBoxDescent: metrics.actualBoundingBoxDescent * 0.3
      };
    };
    return canvas;
  };
  const layout = new CloudLayout().canvas(underReporting);
  const reference = new CloudLayout().canvas(() => createCanvas(1, 1));
  for (const options of [{ size: 60 }, { size: 60, rotate: 30 }, { size: 40, padding: 3 }]) {
    const redrawn = layout.getSprite("WWWWWWWW", options);
    const expected = reference.getSprite("WWWWWWWW", options);
    assert.deepEqual([redrawn.width, redrawn.height], [expected.width, expected.height]);
    assert.deepEqual(redrawn.sprite, expected.sprite);
    // The search envelope stays at the measured raster width.
    const envelopeWidth = sprite => spriteMask(sprite).envelope.x1 - spriteMask(sprite).envelope.x0;
    assert.ok(envelopeWidth(redrawn) <= envelopeWidth(expected));
    const next = layout.getSprite("hi", { size: 20, padding: 0 });
    assert.deepEqual(next.sprite, reference.getSprite("hi", { size: 20, padding: 0 }).sprite);
  }
});

test("failed text draws restore the context and clear any partial drawing", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const fillText = context.fillText.bind(context);
  const failure = new Error("text draw failed");
  context.fillText = (text, ...args) => {
    fillText(text, ...args);
    if (text === "broken") throw failure;
  };
  const layout = new CloudLayout().canvas(() => canvas);
  assert.ok(layout.getSprite("small", { size: 20 }));
  assert.throws(() => layout.getSprite("broken", { size: 80, rotate: 30 }), error => error === failure);
  assert.ok(context.getTransform().isIdentity);
  const options = { size: 40, padding: 0 };
  const recovered = layout.getSprite("hello", options);
  const fresh = new CloudLayout().canvas(() => createCanvas(1, 1)).getSprite("hello", options);
  assert.deepEqual(recovered.sprite, fresh.sprite);
});

test("text overhang cannot contaminate subsequent text or image sprites", () => {
  const { createCanvas } = loadNodeCanvas();
  // Exercise both complete TextMetrics and canvas adapters exposing only width.
  for (const widthOnly of [false, true]) {
    const factory = () => {
      const canvas = createCanvas(1, 1);
      if (widthOnly) {
        const context = canvas.getContext("2d");
        const measure = context.measureText.bind(context);
        context.measureText = text => ({ width: measure(text).width });
      }
      return canvas;
    };
    const layout = new CloudLayout().canvas(factory);
    const prepareOverhang = () => layout.getSprite("f", { font: "serif", style: "italic", size: 256, padding: 0 });
    assert.ok(prepareOverhang());
    assert.equal(layout.getSprite("          ", { font: "serif", size: 256, padding: 0 }), null);
    assert.ok(prepareOverhang());
    assert.equal(layout.getSprite(createCanvas(600, 600)), null);
    assert.ok(prepareOverhang());
    const options = { font: "serif", size: 256, padding: 0 };
    const reused = layout.getSprite("hello", options);
    const fresh = new CloudLayout().canvas(factory).getSprite("hello", options);
    assert.deepEqual(reused.sprite, fresh.sprite);
    assert.deepEqual([reused.x0, reused.y0, reused.x1, reused.y1], [fresh.x0, fresh.y0, fresh.x1, fresh.y1]);
  }
});

test("text readback preserves tail pixels without spilling between rows", () => {
  for (const measuredWidth of [20, 31, 50]) {
    const canvas = createFakeCanvas();
    const context = canvas.getContext("2d");
    context.measureText = () => ({ width: measuredWidth });
    let rasterWidth;
    // Ink at the end of row 1 and the start of row 2, one pixel inside the
    // raster, as ink touching the edge is treated as clipped and redrawn larger.
    context.getImageData = (_x, _y, width, height) => {
      rasterWidth = width;
      const data = new Uint8ClampedArray(width * height * 4);
      if (width > 1) {
        data[((width * 2 - 2) * 4) + 3] = 255;
        data[((width * 2 + 1) * 4) + 3] = 255;
      }
      return { data };
    };
    const sprite = new CloudLayout().canvas(() => canvas).getSprite("test", { size: 20, padding: 0 });
    const trimmedWidth = rasterWidth - 2;
    const stride = Math.ceil(trimmedWidth / 32);
    const expected = new Uint32Array(stride * 2);
    expected[(trimmedWidth - 1) >>> 5] = (1 << (31 - ((trimmedWidth - 1) & 31))) >>> 0;
    expected[stride] = 0x80000000;
    assert.equal(sprite.spriteWidth, stride * 32);
    assert.deepEqual(sprite.sprite, expected);
  }
});

test("canvases that read back more than one pixel per unit are rejected", () => {
  const canvas = createFakeCanvas();
  const context = canvas.getContext("2d");
  // A 1×1 readback returning 2×2 pixels, as from an old high-DPI backing store.
  context.getImageData = (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 16) });
  assert.throws(() => new CloudLayout().canvas(() => canvas).getSprite("test", { size: 20 }),
    /one pixel per unit/);
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
      assert.ok(attempts < 200000, "candidate budget was exceeded");
      attempts++;
      return { x: move ? attempts * 100 : 0, y: 0 };
    };
    assert.equal(layout.place(layout.getSprite("second", { size: 20 }), { strategy }), null);
    assert.ok(attempts >= 100000, `stopped after ${attempts} candidates`);
  }
});

test("custom strategies may scan every position in a large box", () => {
  const width = 600;
  const height = 400;
  const layout = new CloudLayout().canvas(createFakeCanvas).size([width, height]).overflow(false);
  const block = createFakeImage(width, height - 8,
    Array.from({ length: width * (height - 8) }, (_, i) => [i % width, Math.floor(i / width)]));
  assert.ok(layout.place(layout.getSprite(block), { x: 0, y: -4 }));
  // A raster scan from the top-left corner only finds the free strip at the
  // bottom after far more than 100,000 occupied positions.
  const scan = () => {
    let index = 0;
    return () => index < width * height
      ? { x: index % width - width / 2, y: Math.floor(index++ / width) - height / 2 }
      : null;
  };
  const probe = layout.getSprite(createFakeImage(4, 4,
    Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)])));
  const placed = layout.place(probe, { x: 0, y: 0, strategy: scan });
  assert.ok(placed, "the scan stopped before reaching free space");
  assert.ok(placed.y + placed.y0 >= height / 2 - 8);
});

test("strategy candidates and explicit coordinates must be finite", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size(0);
  const sprite = layout.getSprite("word", { size: 20 });
  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  for (const value of [NaN, Infinity, "abc"]) {
    assert.throws(() => layout.place(sprite, { x: value, y: 0 }), /finite/);
    assert.throws(() => layout.place(sprite, { strategy: () => () => ({ x: value, y: 0 }) }), /finite/);
  }
  assert.throws(() => layout.place(sprite, { x: 2 ** 25, y: 0 }), RangeError);
  assert.throws(() => layout.size(2 ** 25), RangeError);
  assert.throws(() => layout.size(-1), RangeError);
  assert.deepEqual(layout.size(), [0, 0]);
});

test("huge coordinates and sizes cannot hang placement", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size(2 ** 24);
  const sprite = layout.getSprite("word", { size: 20 });
  const edge = 2 ** 24;
  assert.ok(layout.place(sprite, { x: edge, y: -edge }));
  // Huge candidates are outside every possible placement and are skipped.
  let calls = 0;
  const far = initial => () => (++calls < 10 ? { x: 1e300, y: initial.y } : null);
  assert.equal(layout.place(sprite, { x: 0, y: 0, strategy: far }), null);
  assert.equal(calls, 10);
});

test("random() must be a function returning numbers in [0, 1)", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas);
  assert.throws(() => layout.random(0.5), /random\(\) expects a function/);
  const sprite = layout.getSprite("word", { size: 20 });
  for (const value of [undefined, NaN, 1, -0.1, "0.5x", "0.5", [0.5]]) {
    layout.random(() => value);
    assert.throws(() => layout.place(sprite), /random\(\) must return/);
    assert.equal(layout.bounds(), null);
  }
  layout.random(() => 0.5);
  assert.ok(layout.place(sprite));
});

test("blockSize() rejects sizes that cannot be allocated", () => {
  const layout = new CloudLayout();
  for (const value of [0, 0.5, -1, NaN, Infinity, 2 ** 31, 1e12, 4097]) {
    assert.throws(() => layout.blockSize(value), RangeError);
  }
  assert.equal(layout.blockSize(4096).blockSize(), 4096);
  assert.equal(layout.blockSize(1).blockSize(), 32);
});

test("built-in spirals give up promptly in full boxes with extreme aspect ratios", () => {
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const [width, height] of [[4, 1000], [1000, 4]]) {
      const layout = new CloudLayout().canvas(createFakeCanvas)
        .size([width, height]).overflow(false).random(() => 0.5);
      const full = createFakeImage(width, height,
        Array.from({ length: width * height }, (_, i) => [i % width, Math.floor(i / width)]));
      assert.ok(layout.place(layout.getSprite(full), { x: 0, y: 0 }));
      let attempts = 0;
      const counted = (initial, context) => {
        const next = strategy(initial, context);
        return () => { attempts++; return next(); };
      };
      const probe = layout.getSprite(createFakeImage(2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]]));
      assert.equal(layout.place(probe, { x: 0, y: 0, strategy: counted }), null);
      assert.ok(attempts < 1000000, `${strategy.name} ${width}×${height}: ${attempts} candidates`);
    }
  }
});

test("built-in spirals stop stretching beyond a 64:1 aspect ratio", () => {
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const [extreme, capped] of [[1e6, 64], [1e-6, 1 / 64], [Number.MIN_VALUE, 1 / 64]]) {
      const a = strategy({ x: 0, y: 0 }, { aspectRatio: extreme, random: () => 0.25 });
      const b = strategy({ x: 0, y: 0 }, { aspectRatio: capped, random: () => 0.25 });
      for (let i = 0; i < 10000; i++) {
        assert.deepEqual(a(), b(), `${strategy.name} at aspect ratio ${extreme}, candidate ${i}`);
      }
    }
  }
});

test("built-in searches in extremely tall or wide layouts leave a blocked column promptly", () => {
  const { createCanvas } = loadNodeCanvas();
  const block = createCanvas(400, 400);
  block.getContext("2d").fillRect(0, 0, 400, 400);
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const size of [[1, 16777216], [16777216, 1], [10, 100000]]) {
      const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
        .size(size).random(() => 0.25);
      assert.ok(layout.place(layout.getSprite(block), { x: 0, y: 0 }));
      let attempts = 0;
      const counted = (initial, context) => {
        const next = strategy(initial, context);
        return () => { attempts++; return next(); };
      };
      const word = layout.place(layout.getSprite("WWW", { size: 60 }), { x: 0, y: 0, strategy: counted });
      assert.ok(word, `${strategy.name} ${size}: overflow layouts can always grow`);
      assert.ok(attempts < 2000000, `${strategy.name} ${size}: ${attempts} candidates`);
    }
  }
});

test("overflow searches reach the cloud from distant seeds", () => {
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    const layout = new CloudLayout().canvas(createFakeCanvas).size([1024, 1024]).strategy(strategy);
    assert.ok(layout.place(layout.getSprite("first", { size: 20 }), { x: -256, y: -256 }));
    assert.ok(layout.place(layout.getSprite("second", { size: 20 }), { x: 255, y: 255 }),
      `${strategy.name} gave up before reaching the cloud`);
  }
  // Sparse archimedean turns can miss a small cloud from far away, but the
  // search must not stop before the rectangular spiral reaches it.
  for (const seed of [{ x: 5000, y: 0 }, { x: 0, y: -5000 }]) {
    const layout = new CloudLayout().canvas(createFakeCanvas).strategy(rectangularStrategy);
    assert.ok(layout.place(layout.getSprite("first", { size: 20 }), { x: 0, y: 0 }));
    assert.ok(layout.place(layout.getSprite("second", { size: 20 }), seed), `gave up from ${seed.x},${seed.y}`);
  }
});

test("built-in searches try the clamped anchor when it is the only position that fits", () => {
  const { createCanvas } = loadNodeCanvas();
  const image = createCanvas(400, 20);
  image.getContext("2d").fillRect(0, 0, 400, 20);
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const direction of [0.25, 0.75]) {
      const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
        .size([400, 20]).overflow(false).random(() => direction).strategy(strategy);
      const sprite = layout.getSprite(image);
      assert.equal(layout.place(sprite, { strategy: "none" }), null,
        "none still tries only the original, off-center seed");
      const word = layout.place(sprite);
      assert.ok(word, `${strategy.name} missed the sole fitting anchor`);
      assert.deepEqual([word.x, word.y], [0, 0]);
    }
  }
});

test("rectangular candidates cover the grid in aspect-scaled distance and angle order", () => {
  for (const aspectRatio of [0.1, 0.4, 1, 1.25, 2.5, 10]) {
    const scaleX = Math.max(1, aspectRatio);
    const scaleY = Math.max(1, 1 / aspectRatio);
    const expected = [];
    for (let y = -Math.floor(3 * scaleY); y <= Math.floor(3 * scaleY); y++) {
      for (let x = -Math.floor(3 * scaleX); x <= Math.floor(3 * scaleX); x++) {
        expected.push({ x, y });
      }
    }
    const distance = p => Math.max(Math.abs(p.x) / scaleX, Math.abs(p.y) / scaleY);
    expected.sort((p, q) => distance(p) - distance(q) || Math.atan2(p.y, p.x) - Math.atan2(q.y, q.x));
    const next = rectangularStrategy({ x: 0, y: 0 }, { aspectRatio, random: () => 0.25 });
    assert.deepEqual(expected.map(() => next()), expected.map(p => ({ x: 4 * p.x, y: 4 * p.y })),
      `grid order changed at aspect ratio ${aspectRatio}`);
  }
});

test("extreme rectangular aspect ratios do not allocate entire rings", () => {
  // Keep an eager-allocation regression confined to a small, timed process.
  const script = `
    import assert from "node:assert/strict";
    import CloudLayout, { rectangularStrategy } from ${JSON.stringify(new URL("../src/index.js", import.meta.url).href)};
    import { createCanvas } from "canvas";
    for (const aspectRatio of [1e12, 1e-12, Number.MIN_VALUE]) {
      const next = rectangularStrategy({ x: 0, y: 0 }, { aspectRatio, random: () => 0.25 });
      const points = Array.from({ length: 32 }, () => next());
      assert.equal(new Set(points.map(p => p.x + "," + p.y)).size, 32);
      assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    }
    const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
      .size([1000000, 1]).strategy("rectangular");
    const sprite = layout.getSprite("word", { size: 20 });
    assert.ok(layout.place(sprite, { x: 0, y: 0 }));
    assert.ok(layout.place(sprite, { x: 0, y: 0 }));
  `;
  const result = spawnSync(process.execPath, ["--max-old-space-size=64", "--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 5000
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("wrapped built-in strategies search exactly like the built-ins", () => {
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    const run = s => {
      const layout = new CloudLayout().canvas(createFakeCanvas).size([128, 96]).random(createSeededRandom(7));
      return Array.from({ length: 30 }, (_, i) =>
        layout.place(layout.getSprite(`w${i}`, { size: 10 + (i % 5) * 4 }), { strategy: s }))
        .map(word => word && [word.x, word.y]);
    };
    assert.deepEqual(run((initial, context) => strategy(initial, context)), run(strategy));
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
    .strategy(noneStrategy);
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

test("placed words are plain objects that carry the datum by reference", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5);

  const datum = { id: "greeting" };
  const sprite = layout.getSprite("hello", {
    font: "serif",
    size: 20,
    rotate: 0,
    padding: 0,
    datum,
    id: "ignored"
  });
  const placed = layout.place(sprite);

  assert.equal(sprite.datum, datum);
  assert.equal(placed.datum, datum);
  assert.equal("id" in sprite, false, "unknown options are not copied");
  assert.equal("id" in placed, false);
  assert.equal(Object.getPrototypeOf(placed), Object.prototype);
  assert.deepEqual(structuredClone(placed), placed);
  assert.equal("sprite" in placed, false);
  assert.equal("spriteWidth" in placed, false);
  assert.equal("_rasterWidth" in placed, false);
  assert.equal(typeof placed.text, "string");
  assert.equal(typeof placed.x, "number");
  assert.equal(typeof placed.height, "number");
  assert.equal("trimHeight" in placed, false);
  assert.equal(layout.place(layout.getSprite("plain")).datum, undefined);
});

test("place accepts explicit initial coordinates", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([40, 20])
    .overflow(true)
    .random(() => 0.25)
    .strategy(noneStrategy);

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
    .strategy(noneStrategy);

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
    const sprite = layout.getSprite("hello", { size: 20, padding: 0 });
    const integerCoordinates = { x: Math.floor(coordinates.x), y: Math.floor(coordinates.y) };
    const placed = layout.place(sprite, coordinates);

    assert.equal(placed.x, integerCoordinates.x);
    assert.equal(placed.y, integerCoordinates.y);
    assert.equal(layout.place(sprite, coordinates), null);
    assert.equal(layout.place(sprite, integerCoordinates), null);
    assert.equal(layout.place(sprite, {
      x: 100,
      y: 100,
      strategy: singleCandidateStrategy(coordinates.x, coordinates.y)
    }), null);

    layout.erase(placed);
    assert.equal(layout.bounds(), null);
    assert.ok(layout.place(sprite, integerCoordinates));
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

test("erase rejects sprites, copies, erased words, and other layouts' words", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size(0).strategy(noneStrategy);
  const other = new CloudLayout().canvas(createFakeCanvas).size(0).strategy(noneStrategy);
  const sprite = layout.getSprite("hello", { size: 16, padding: 0 });
  const word = layout.place(sprite, { x: 0, y: 0 });
  const otherWord = other.place(sprite, { x: 0, y: 0 });

  for (const value of [sprite, { ...word }, otherWord, null, undefined, "hello"]) {
    assert.throws(() => layout.erase(value), /returned by place\(\) on this layout/);
  }
  assert.throws(() => layout.place({ ...sprite }), TypeError);

  // Changing a placed word does not affect what erase() removes.
  word.x = 500;
  layout.erase(word);
  assert.equal(layout.bounds(), null);
  assert.throws(() => layout.erase(word), /returned by place\(\) on this layout/);
  assert.ok(other.bounds(), "erasing from one layout leaves the other intact");
});


test("place accepts a per-call strategy override", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .random(() => 0.5)
    .strategy(noneStrategy);

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

test("erase removes a placed word and frees its occupied space", () => {
  const layout = new CloudLayout()
    .canvas(() => createRightEdgeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const firstSprite = extractSprite(layout, { text: "first", size: 16, padding: 0, rotate: 0, font: "serif" });
  const secondSprite = extractSprite(layout, { text: "second", size: 16, padding: 0, rotate: 0, font: "serif" });

  const first = layout.place(firstSprite, { x: 0, y: 0 });
  assert.ok(first);
  assert.equal(layout.place(secondSprite, { x: 0, y: 0 }), null);
  layout.erase(first);
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

test("clear() and blockSize() cannot replace the occupancy during a search", () => {
  const square = createFakeImage(8, 8, Array.from({ length: 64 }, (_, i) => [i % 8, Math.floor(i / 8)]));
  for (const call of [layout => layout.clear(), layout => layout.blockSize(64)]) {
    let layout;
    let armed = false;
    let error;
    layout = new CloudLayout().canvas(createFakeCanvas).random(() => {
      if (armed) {
        armed = false;
        try {
          call(layout);
        } catch (e) {
          error = e;
        }
      }
      return 0.25;
    });
    const sprite = layout.getSprite(square);
    const first = layout.place(sprite, { x: 0, y: 0 });
    armed = true;
    const second = layout.place(sprite, { x: 0, y: 0 });
    assert.match(error?.message ?? "", /while place\(\) is searching/);
    assert.ok(second);
    assert.equal(layout.place(sprite, { x: second.x, y: second.y, strategy: "none" }), null,
      "the second word is still occupied");
    layout.erase(first);
    assert.equal(layout.clear(), layout, "clear() works again after the search");
  }
});

test("setting the same normalized block size preserves occupied pixels", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size(0)
    .strategy("none");
  const sprite = layout.getSprite("hello", { size: 20, padding: 0 });
  const first = layout.place(sprite);
  assert.ok(first);
  const bounds = layout.bounds();

  for (const size of [layout.blockSize(), layout.blockSize() - 1]) {
    assert.equal(layout.blockSize(size), layout);
    assert.deepEqual(layout.bounds(), bounds);
    assert.equal(layout.place(sprite), null);
  }

  layout.erase(first);
  assert.equal(layout.bounds(), null);
  assert.ok(layout.place(sprite));
});

test("clear invalidates earlier placed words", () => {
  const layout = new CloudLayout()
    .canvas(() => createFakeCanvas())
    .size([0, 0])
    .overflow(true)
    .strategy(noneStrategy);
  const sprite = extractSprite(layout, { text: "hello", size: 20, padding: 0, rotate: 0, font: "serif" });

  const word = layout.place(sprite, { x: 0, y: 0 });
  assert.ok(word);
  assert.equal(layout.place(sprite, { x: 0, y: 0 }), null);
  layout.clear();
  assert.throws(() => layout.erase(word), /since it was last cleared/);
  assert.ok(layout.place(sprite, { x: 0, y: 0 }));
});


test("image sprites stay attached to the cloud rather than forming islands", () => {
  const { createCanvas } = loadNodeCanvas();
  const image = createCanvas(10, 10);
  image.getContext("2d").fillRect(0, 0, 10, 10);
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    const layout = new CloudLayout().canvas(() => createCanvas(1, 1)).size(0).strategy(strategy);
    assert.ok(layout.place(layout.getSprite(image), { x: 0, y: 0 }));
    const word = layout.place(layout.getSprite(image), { x: 150, y: 150 });
    assert.ok(word);
    const gap = Math.max(word.x + word.x0 - 5, -5 - (word.x + word.x1), word.y + word.y0 - 5, -5 - (word.y + word.y1));
    assert.ok(gap >= 0 && gap <= 4, `${strategy.name} left a ${gap}px gap`);
  }
});

test("opaque images pack beside each other in wide layouts", () => {
  const { createCanvas } = loadNodeCanvas();
  const image = createCanvas(10, 10);
  image.getContext("2d").fillRect(0, 0, 10, 10);
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const size of [[1600, 900], [3200, 400]]) {
      const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
        .size(size).random(createSeededRandom(3)).strategy(strategy);
      for (let i = 0; i < 30; i++) {
        const before = layout.bounds();
        const word = layout.place(layout.getSprite(image));
        assert.ok(word, `${strategy.name} ${size}: image ${i} was not placed`);
        if (before) {
          const gapX = Math.max(word.x + word.x0 - before[1].x, before[0].x - (word.x + word.x1));
          const gapY = Math.max(word.y + word.y0 - before[1].y, before[0].y - (word.y + word.y1));
          assert.ok(gapX <= 4 && gapY <= 4, `${strategy.name} ${size}: image ${i} detached by ${gapX},${gapY}`);
        }
      }
    }
  }
});

test("width-only canvas adapters clear a bounded region between sprites", () => {
  const canvas = createFakeCanvas();
  const context = canvas.getContext("2d");
  const clearRect = context.clearRect;
  const cleared = [];
  context.clearRect = (x, y, width, height) => {
    cleared.push(width * height);
    clearRect.call(context, x, y, width, height);
  };
  const layout = new CloudLayout().canvas(() => canvas);
  for (const text of ["one", "two", "three"]) {
    assert.ok(layout.getSprite(text, { size: 20 }));
  }
  assert.ok(cleared.length > 0);
  assert.ok(Math.max(...cleared) < 256 * 256, `cleared ${Math.max(...cleared)} pixels`);
});

test("padded text rasters are not inflated by the stroke miter limit", () => {
  const { createCanvas } = loadNodeCanvas();
  let readback;
  const layout = new CloudLayout().canvas(() => {
    const canvas = createCanvas(1, 1);
    const context = canvas.getContext("2d");
    const getImageData = context.getImageData.bind(context);
    context.getImageData = (x, y, width, height) => {
      readback = [width, height];
      return getImageData(x, y, width, height);
    };
    return canvas;
  });
  // The raster read back for the sprite.
  const rasterSize = padding => {
    layout.getSprite("hello", { size: 40, font: "serif", padding });
    return readback;
  };
  const [plainWidth, plainHeight] = rasterSize(0);
  const [paddedWidth, paddedHeight] = rasterSize(4);
  // Padding 4 adds 8px of stroke and 16px of extra overscan per axis.
  assert.ok(paddedWidth - plainWidth <= 28, `width grew by ${paddedWidth - plainWidth}px`);
  assert.ok(paddedHeight - plainHeight <= 28, `height grew by ${paddedHeight - plainHeight}px`);
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
  assert.ok(Array.isArray(bounds));
  assert.equal(bounds.length, 2);
  assert.ok(bounds[0].x < bounds[1].x);
  assert.ok(bounds[0].y < bounds[1].y);
});

test("layout places many large sprites without leaking raster data into results", () => {
  const words = Array.from({ length: 40 }, (_, index) => ({
    text: `large-${String(index).padStart(2, "0")}-xxxxxxxxxxxxxxxxxxxxxxxxxx`,
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
      .strategy(noneStrategy),
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
    .strategy(noneStrategy);
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
    .strategy(noneStrategy);

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

test("fonts the canvas rejects throw instead of rasterizing a mismatched mask", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
  for (const options of [{ font: "3Dumb" }, { weight: 1001 }, { font: {} }]) {
    assert.throws(() => layout.getSprite("word", { size: 100, ...options }), /rejected by the canvas/);
  }
  // The same valid font can be used repeatedly.
  for (let i = 0; i < 2; i++) {
    assert.ok(layout.getSprite("word", { size: 100, font: "serif" }).height > 40);
  }
});

test("rejected fonts do not discard the scratch canvas", () => {
  const { createCanvas } = loadNodeCanvas();
  let calls = 0;
  const layout = new CloudLayout().canvas(() => (calls++, createCanvas(1, 1)));
  assert.ok(layout.getSprite("word", { size: 20 }));
  assert.throws(() => layout.getSprite("word", { size: 20, font: "3Dumb" }), /rejected by the canvas/);
  assert.ok(layout.getSprite("word", { size: 20 }));
  assert.equal(calls, 1);
});

test("font weights are converted before drawing, so getSprite() cannot be re-entered", () => {
  const { createCanvas } = loadNodeCanvas();
  const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
  const expected = layout.getSprite("WWW", { size: 60 });
  let calls = 0;
  const weight = {
    toString() {
      calls++;
      layout.getSprite("WWW", { size: 60, rotate: 90 });
      return "bold";
    }
  };
  const sprite = layout.getSprite("i", { size: 20, weight });
  assert.equal(sprite.weight, "bold");
  assert.equal(calls, 1);
  assert.equal(layout.getSprite("i", { size: 20, weight: 700 }).weight, 700);
  assert.deepEqual(layout.getSprite("WWW", { size: 60 }).sprite, expected.sprite);
});

test("getSprite() cannot be re-entered while a sprite is drawn to the same canvas", () => {
  const { createCanvas } = loadNodeCanvas();
  const shared = createCanvas(1, 1);
  const a = new CloudLayout().canvas(() => shared);
  const b = new CloudLayout().canvas(() => shared);
  const other = new CloudLayout().canvas(() => createCanvas(1, 1));
  const expected = other.getSprite("WWW", { size: 60 });
  for (const inner of [a, b, other]) {
    let error;
    // Image dimensions are read while the sprite is being drawn.
    const source = createCanvas(10, 10);
    source.getContext("2d").fillRect(0, 0, 10, 10);
    Object.defineProperty(source, "naturalWidth", {
      get() {
        try {
          inner.getSprite("WWW", { size: 60, rotate: 45 });
        } catch (e) {
          error = e;
        }
        return 10;
      }
    });
    assert.ok(a.getSprite(source));
    if (inner === other) {
      assert.equal(error, undefined, "other canvases are independent");
    } else {
      assert.match(error?.message ?? "", /while a sprite is being drawn/);
    }
    assert.deepEqual(a.getSprite("WWW", { size: 60 }).sprite, expected.sprite);
  }
});

test("a canvas without a 2d context does not break layouts sharing it", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  let lost = false;
  const shared = {
    get width() { return canvas.width; },
    set width(value) { canvas.width = value; },
    get height() { return canvas.height; },
    set height(value) { canvas.height = value; },
    getContext() { return lost ? null : context; }
  };
  const a = new CloudLayout().canvas(() => shared);
  const expected = a.getSprite("Hello", { size: 30 });
  lost = true;
  const b = new CloudLayout().canvas(() => shared);
  assert.ok(b.getSprite("x", { size: 30 }), "the shared canvas is already set up");
  lost = false;
  assert.deepEqual(a.getSprite("Hello", { size: 30 }).sprite, expected.sprite);

  // A canvas that has no 2d context is rejected without being resized.
  const unusable = { width: 300, height: 150, getContext: () => null };
  assert.throws(() => new CloudLayout().canvas(() => unusable).getSprite("x"), /2d context/);
  assert.deepEqual([unusable.width, unusable.height], [300, 150]);
});

test("layouts sharing a canvas share state even if getContext() returns new wrappers", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const shared = {
    get width() { return canvas.width; },
    set width(value) { canvas.width = value; },
    get height() { return canvas.height; },
    set height(value) { canvas.height = value; },
    getContext() {
      return new Proxy(context, {
        get: (target, key) => typeof target[key] === "function" ? target[key].bind(target) : target[key],
        set: (target, key, value) => { target[key] = value; return true; }
      });
    }
  };
  const a = new CloudLayout().canvas(() => shared);
  const b = new CloudLayout().canvas(() => shared);
  const expected = new CloudLayout().canvas(() => createCanvas(1, 1)).getSprite(".", { size: 60 });
  assert.ok(a.getSprite(".", { size: 2 }));
  assert.ok(b.getSprite(".", { size: 2 }));
  assert.ok(a.getSprite(".", { size: 20 }));
  assert.deepEqual(b.getSprite(".", { size: 60 }).sprite, expected.sprite);
});

test("a failed readback, such as from a tainted canvas, does not break later sprites", () => {
  const canvases = [];
  const layout = new CloudLayout().canvas(() => {
    const canvas = createFakeCanvas();
    canvases.push(canvas);
    return canvas;
  });
  assert.ok(layout.getSprite("before", { size: 20 }));
  const context = canvases[0].getContext("2d");
  const tainted = createFakeImage(4, 4, [[0, 0]]);
  const drawImage = context.drawImage;
  context.drawImage = function(image, ...args) {
    if (image === tainted) {
      this.getImageData = () => { throw new DOMException("tainted", "SecurityError"); };
    }
    return drawImage.call(this, image, ...args);
  };
  assert.throws(() => layout.getSprite(tainted), /tainted/);
  assert.ok(layout.getSprite("after", { size: 20 }));
  assert.equal(canvases.length, 2);
});

test("failed shared canvases reset before either layout uses them again", () => {
  const { createCanvas } = loadNodeCanvas();
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const read = context.getImageData.bind(context);
  let tainted = false;
  let resets = 0;
  context.getImageData = (...args) => {
    if (tainted) throw new DOMException("tainted", "SecurityError");
    return read(...args);
  };
  // Resizing a canvas clears its origin taint in Chrome and Safari, though not
  // in Firefox. Model that behavior around a real rasterizer, since
  // node-canvas does not enforce CORS.
  const shared = {
    get width() { return canvas.width; },
    set width(value) { canvas.width = value; tainted = false; resets++; },
    get height() { return canvas.height; },
    set height(value) { canvas.height = value; tainted = false; resets++; },
    getContext() { return context; }
  };
  const a = new CloudLayout().canvas(() => shared);
  const b = new CloudLayout().canvas(() => shared);
  const options = { size: 20 };
  const expected = a.getSprite("word", options);
  assert.ok(b.getSprite("word", options));
  const initialResets = resets;
  tainted = true;
  assert.throws(() => a.getSprite("bad", options), /tainted/);
  assert.deepEqual(b.getSprite("word", options).sprite, expected.sprite,
    "the other layout must detect that its cached context was invalidated");
  assert.ok(resets > initialResets);
  const recoveredResets = resets;
  assert.deepEqual(a.getSprite("word", options).sprite, expected.sprite);
  assert.equal(resets, recoveredResets, "healthy shared state should be reused");
});

test("layouts sharing one canvas do not contaminate each other's masks", () => {
  const { createCanvas } = loadNodeCanvas();
  const shared = createCanvas(1, 1);
  const a = new CloudLayout().canvas(() => shared);
  const b = new CloudLayout().canvas(() => shared);
  const expected = new CloudLayout().canvas(() => createCanvas(1, 1)).getSprite("o", { size: 20 });
  assert.ok(b.getSprite("o", { size: 20 }));
  assert.ok(a.getSprite("WWWWWWWWWW", { size: 120, rotate: 30 }));
  const sprite = b.getSprite("o", { size: 20 });
  assert.deepEqual([sprite.width, sprite.height], [expected.width, expected.height]);
  assert.deepEqual(sprite.sprite, expected.sprite);
});

test("placement ignores forged sprites and changes to a sprite's public mask", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size(0).strategy("none");
  assert.throws(() => layout.place(Object.create(CloudSprite.prototype)), /CloudSprite from getSprite/);
  const square = createFakeImage(8, 8, Array.from({ length: 64 }, (_, i) => [i % 8, Math.floor(i / 8)]));
  const sprite = layout.getSprite(square);
  assert.notEqual(layout.getSprite(square).sprite, sprite.sprite, "each sprite has its own mask copy");
  const first = layout.place(sprite, { x: 0, y: 0 });
  assert.ok(first);
  sprite.sprite.fill(0);
  assert.equal(layout.place(sprite, { x: 0, y: 0 }), null);
  assert.ok(layout.place(sprite, { x: 9, y: 0 }));
  layout.erase(first);
  assert.ok(layout.place(sprite, { x: 0, y: 0 }), "erase freed the original pixels");
  assert.equal(layout.place(sprite, { x: 9, y: 0 }), null, "erase kept the neighbor's pixels");
});

test("sprite options are validated", () => {
  // Invalid sources are rejected before the default canvas factory runs.
  assert.throws(() => new CloudLayout().getSprite(null), /text or an image-like source/);
  const layout = new CloudLayout().canvas(createFakeCanvas);
  for (const options of [{ size: NaN }, { fontSize: Infinity }, { rotate: "x" }, { padding: NaN }]) {
    assert.throws(() => layout.getSprite("word", options), /finite/);
  }
  assert.throws(() => layout.getSprite("word", { padding: -1 }), RangeError);
  for (const size of [0, 0.5, -10]) {
    assert.equal(layout.getSprite("word", { size }), null);
  }
  const image = createFakeImage(4, 4, [[1, 1]]);
  assert.ok(layout.getSprite(image, { size: 0 }), "images do not use size");
  assert.equal(layout.getSprite(image, { width: 0.5 }), null);
  assert.throws(() => layout.getSprite(image, { width: NaN }), /finite/);
  const sprite = layout.getSprite("word", null);
  assert.ok(sprite);
  assert.ok(layout.place(sprite, null));
});

test("place() reads each option once", () => {
  const layout = new CloudLayout().canvas(createFakeCanvas).size(0);
  const reads = { x: 0, y: 0, strategy: 0 };
  const options = {};
  for (const [key, value] of [["x", 0], ["y", 0], ["strategy", "none"]]) {
    Object.defineProperty(options, key, { get() { reads[key]++; return value; } });
  }
  assert.ok(layout.place(layout.getSprite("word", { size: 20 }), options));
  assert.deepEqual(reads, { x: 1, y: 1, strategy: 1 });
});

test("small words reach a small cloud from anywhere in the seed box", () => {
  const { createCanvas } = loadNodeCanvas();
  for (const strategy of [archimedeanStrategy, rectangularStrategy]) {
    for (const rx of [0.01, 0.6, 0.8, 0.99]) {
      for (const ry of [0.01, 0.5, 0.99]) {
        const layout = new CloudLayout().canvas(() => createCanvas(1, 1)).size([960, 500])
          .strategy(strategy).random(createSequenceRandom([0.5, 0.5, rx, ry]));
        const sprite = layout.getSprite("i", { size: 10 });
        assert.ok(layout.place(sprite));
        assert.ok(layout.place(sprite), `${strategy.name} missed the cloud from ${rx},${ry}`);
      }
    }
  }
});

test("the rectangular spiral fills tall and wide boxes equally densely", () => {
  const square = createFakeImage(4, 4, Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)]));
  const counts = [[400, 40], [40, 400]].map(size => {
    const layout = new CloudLayout().canvas(createFakeCanvas).size(size).overflow(false)
      .strategy("rectangular").random(createSeededRandom(3));
    const sprite = layout.getSprite(square);
    let count = 0;
    while (layout.place(sprite)) count++;
    return count;
  });
  // The box holds at most 1,000 squares.
  assert.ok(counts[0] > 500 && counts[1] > 500, `placed ${counts}`);
});

function createFakeCanvas({
  measureText = text => ({ width: text.length * 10 }),
  textBox = createBox
} = {}) {
  const boxes = [];
  const images = [];
  const stack = [];
  const context = {
    _tx: 0,
    _ty: 0,
    fillStyle: "",
    strokeStyle: "",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    lineWidth: 1,
    clearRect() {
      boxes.length = 0;
      images.length = 0;
    },
    save() {
      stack.push({
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        lineWidth: this.lineWidth,
        tx: this._tx,
        ty: this._ty
      });
    },
    restore() {
      const state = stack.pop();
      this.font = state.font;
      this.textAlign = state.textAlign;
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
    measureText,
    fillText(text, x, y) {
      boxes.push(textBox(this, text, x, y, 0));
    },
    strokeText(text, x, y) {
      boxes.push(textBox(this, text, x, y, this.lineWidth));
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
  return createFakeCanvas({
    measureText() {
      return { width: 31 };
    },
    textBox(context, _text, _x, y, inflate) {
      return createRightEdgeBox(context, y, inflate);
    }
  });
}

function createBox(context, text, x, y, inflate) {
  const fontMatch = /(\d+)px/.exec(context.font);
  const fontSize = fontMatch ? Number(fontMatch[1]) : 10;
  const width = context.measureText(text).width;
  if (context.textAlign === "center") {
    x -= width / 2;
  }

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
    textAlign: "start",
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
  const sourceWidth = draw.image.naturalWidth ?? draw.image.videoWidth ?? draw.image.width;
  const sourceHeight = draw.image.naturalHeight ?? draw.image.videoHeight ?? draw.image.height;
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
    renderNodeCanvasFilledWord(context, word, word.x + offsetX - left, word.y + offsetY - top);

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

function renderNodeCanvasFilledWord(context, word, x, y) {
  context.save();
  context.font = getNodeCanvasWordFont(word);
  context.textAlign = "center";
  context.translate(x, y);

  if (word.rotate) {
    context.rotate(word.rotate * Math.PI / 180);
  }

  context.fillText(word.text, 0, 0);
  context.restore();
}

function getNodeCanvasWordFont(word) {
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
