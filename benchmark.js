import { performance } from "node:perf_hooks";
import { arch, cpus, platform } from "node:os";

import { createCanvas } from "canvas";

import CloudLayout from "./src/index.js";
import cloudV1 from "d3-cloud-v1";

const DEFAULT_RUNS = 5;
const DEFAULT_BLOCK_SIZE = 512;
const scenarios = {
  "bounded-fit": {
    name: "bounded-fit",
    description: "Both versions fit the same workload in a generous fixed box.",
    count: 220,
    seed: 11,
    size: [2048, 1536],
    overflow: false
  },
  "bounded-tight": {
    name: "bounded-tight",
    description: "Both versions search a crowded fixed box; compare placement counts as well as time.",
    count: 320,
    seed: 29,
    size: [512, 384],
    overflow: false
  },
  fit: {
    name: "fit",
    description: "Moderate search radius with a wide seeded size around the origin.",
    count: 220,
    seed: 11,
    size: [512, 384],
    overflow: true
  },
  overflow: {
    name: "overflow",
    description: "Larger search radius where the layout expands well beyond the seeded size.",
    count: 320,
    seed: 29,
    size: [512, 512],
    overflow: true
  }
};
const args = parseArgs(process.argv.slice(2));
const runs = args.runs ?? DEFAULT_RUNS;
const selected = args.scenario ? [pickScenario(args.scenario)]
  : Object.values(scenarios).filter(scenario => !args.compareV1 || !scenario.overflow);

console.log(`Node ${process.version} · ${platform()} ${arch()} · ${cpus()[0]?.model ?? "unknown CPU"}`);
if (args.compareV1 && selected.some(scenario => scenario.overflow)) {
  throw new Error("v1 comparisons require a bounded scenario; v1 has no overflow mode");
}

for (const scenario of selected) {
  benchmarkScenario(scenario, runs);
}

function benchmarkScenario(scenario, runs) {
  const words = createWords(scenario.count, scenario.seed);

  console.log(`\nScenario: ${scenario.name}`);
  console.log(`${scenario.description}`);
  console.log(
    `size=${formatPair(scenario.size ?? [256, 256])} ` +
    `overflow=${scenario.overflow ?? true} ` +
    `blockSize=${args.blockSize ?? DEFAULT_BLOCK_SIZE} ` +
    `words=${scenario.count} runs=${runs}`
  );

  // Alternate order to reduce warmup and ordering bias. Include rasterization
  // and placement in both timings, with fresh inputs and RNGs for every run.
  const versions = args.compareV1 ? ["v1", "v2"] : ["v2"];
  const samples = Object.fromEntries(versions.map(version => [version, []]));
  for (const version of versions) runVersion(version, scenario, words, scenario.seed);
  for (let run = 0; run < runs; run++) {
    for (const version of run % 2 ? [...versions].reverse() : versions) {
      samples[version].push(runVersion(version, scenario, words, scenario.seed + run));
    }
  }
  for (const version of versions) printResult(version, summarize(samples[version]));
}

function summarize(samples) {
  return {
    avgDuration: average(samples.map(sample => sample.duration)),
    minDuration: Math.min(...samples.map(sample => sample.duration)),
    maxDuration: Math.max(...samples.map(sample => sample.duration)),
    avgPlaced: average(samples.map(sample => sample.placed)),
    minPlaced: Math.min(...samples.map(sample => sample.placed)),
    maxPlaced: Math.max(...samples.map(sample => sample.placed)),
    avgArea: average(samples.map(sample => sample.area))
  };
}

function runVersion(version, scenario, words, seed) {
  if (version === "v2") return runLayout(scenario, words, seed);
  const start = performance.now();
  let placed;
  let bounds;
  const layout = cloudV1()
    .canvas(() => createCanvas(1, 1))
    .size(scenario.size)
    .words(words.map(word => ({ ...word })))
    .font("sans-serif")
    .fontSize(word => word.size)
    .rotate(word => word.rotate)
    .padding(word => word.padding)
    .random(createRandom(seed))
    .timeInterval(Infinity)
    .on("end", (result, extent) => { placed = result; bounds = extent; });
  layout.start();
  const duration = performance.now() - start;
  if (!placed) throw new Error("The v1 benchmark must complete synchronously");
  return { duration, placed: placed.length, area: boundsArea(bounds) };
}

function runLayout(scenario, words, seed) {
  const start = performance.now();
  const sortedWords = [...words].sort((a, b) => b.size - a.size);
  const layout = new CloudLayout()
    .canvas(() => createCanvas(1, 1))
    .size(scenario.size ?? [256, 256])
    .overflow(scenario.overflow ?? true)
    .blockSize(args.blockSize ?? DEFAULT_BLOCK_SIZE)
    .random(createRandom(seed));

  const sprites = sortedWords
    .map(word => layout.getSprite(word.text, {
      font: "sans-serif",
      size: word.size,
      rotate: word.rotate,
      padding: word.padding
    }))
    .filter(Boolean);
  const placed = placeSprites(layout, sprites);
  const bounds = layout.bounds();
  const duration = performance.now() - start;

  return {
    duration,
    placed: placed.length,
    area: boundsArea(bounds)
  };
}

function placeSprites(layout, sprites) {
  const placedWords = [];

  for (const sprite of sprites) {
    const word = layout.place(sprite);
    if (word) {
      placedWords.push(word);
    }
  }

  return placedWords;
}

function createWords(count, seed) {
  const random = createRandom(seed);
  const terms = [
    "signal", "vector", "kernel", "render", "layout", "cloud",
    "bitmap", "sprite", "module", "canvas", "density", "spiral",
    "dispatch", "bundle", "rotate", "field", "impact", "contour"
  ];

  return Array.from({ length: count }, (_, index) => ({
    text: `${terms[index % terms.length]}-${index}`,
    size: 14 + Math.floor(random() * 64),
    rotate: random() < 0.16 ? 90 : 0,
    padding: random() < 0.35 ? 2 : 1
  }));
}

function boundsArea(bounds) {
  if (!bounds) {
    return 0;
  }
  return Math.max(0, bounds[1].x - bounds[0].x) * Math.max(0, bounds[1].y - bounds[0].y);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function printResult(version, result) {
  console.log(
    `${version} avg=${formatMs(result.avgDuration)} ` +
    `min=${formatMs(result.minDuration)} ` +
    `max=${formatMs(result.maxDuration)} ` +
    `placed=${formatNumber(result.avgPlaced)} (${result.minPlaced}–${result.maxPlaced}) ` +
    `area=${formatNumber(result.avgArea)}`
  );
}

function formatMs(value) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}ms`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    if (arg.startsWith("--runs=")) {
      options.runs = Number(arg.slice("--runs=".length));
    } else if (arg.startsWith("--scenario=")) {
      options.scenario = arg.slice("--scenario=".length);
    } else if (arg.startsWith("--block-size=")) {
      options.blockSize = Number(arg.slice("--block-size=".length));
    } else if (arg === "--compare-v1") {
      options.compareV1 = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const key of ["runs", "blockSize"]) {
    if (options[key] !== undefined && (!Number.isSafeInteger(options[key]) || options[key] < 1)) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  return options;
}

function pickScenario(name) {
  const scenario = scenarios[name];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${name}`);
  }
  return scenario;
}

function printHelp() {
  console.log(
    "Usage: node benchmark.js " +
    "[--runs=5] [--scenario=bounded-fit|bounded-tight|fit|overflow] [--block-size=512] [--compare-v1]"
  );
}

function formatPair(values) {
  return `[${values[0]},${values[1]}]`;
}

function createRandom(seed) {
  let state = seed >>> 0;

  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
