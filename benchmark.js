import { performance } from "node:perf_hooks";

import { createCanvas } from "canvas";

import CloudLayout from "./src/index.js";

const DEFAULT_RUNS = 5;
const DEFAULT_BLOCK_SIZE = 512;
const scenarios = {
  fit: {
    name: "fit",
    description: "Moderate search radius with a wide seeded size around the origin.",
    count: 220,
    seed: 11,
    size: [512, 384],
    overflow: true,
    maxDelta: 1280
  },
  overflow: {
    name: "overflow",
    description: "Larger search radius where the layout expands well beyond the seeded size.",
    count: 320,
    seed: 29,
    size: [512, 512],
    overflow: true,
    maxDelta: 4096
  }
};
const args = parseArgs(process.argv.slice(2));
const runs = args.runs ?? DEFAULT_RUNS;
const selected = args.scenario ? [pickScenario(args.scenario)] : Object.values(scenarios);

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
    `maxDelta=${scenario.maxDelta ?? "default"} ` +
    `blockSize=${args.blockSize ?? DEFAULT_BLOCK_SIZE} ` +
    `words=${scenario.count} runs=${runs}`
  );

  const result = measureScenario(scenario, words, runs);
  printResult(result);
}

function measureScenario(scenario, words, runs) {
  const samples = [];

  runLayout(scenario, words, scenario.seed);

  for (let run = 0; run < runs; run += 1) {
    const sample = runLayout(scenario, words, scenario.seed + run);
    samples.push(sample);
  }

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

function runLayout(scenario, words, seed) {
  const sortedWords = [...words].sort((a, b) => b.size - a.size);
  const layout = new CloudLayout()
    .canvas(() => createCanvas(1, 1))
    .size(scenario.size ?? [256, 256])
    .overflow(scenario.overflow ?? true)
    .blockSize(args.blockSize ?? DEFAULT_BLOCK_SIZE)
    .random(createRandom(seed));

  if (scenario.maxDelta != null) {
    layout.maxDelta(scenario.maxDelta);
  }

  const start = performance.now();
  const sprites = sortedWords
    .map((word, index) => layout.getSprite(word.text, {
      ...word,
      index,
      font: "sans-serif"
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

function printResult(result) {
  console.log(
    `blocks avg=${formatMs(result.avgDuration)} ` +
    `min=${formatMs(result.minDuration)} ` +
    `max=${formatMs(result.maxDuration)} ` +
    `placed=${formatNumber(result.avgPlaced)} ` +
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
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
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
    "[--runs=5] [--scenario=fit|overflow] [--block-size=512]"
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
