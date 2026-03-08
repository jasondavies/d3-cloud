import { performance } from "node:perf_hooks";

import { createCanvas } from "canvas";

import cloud from "./src/index.js";

const DEFAULT_RUNS = 5;
const DEFAULT_BLOCK_SIZE = 512;
const scenarios = {
  fit: {
    name: "fit",
    description: "Moderate search radius with a wide start box around the origin.",
    count: 220,
    seed: 11,
    aspectRatio: 1024 / 768,
    startBox: [512, 384],
    maxDelta: 1280
  },
  overflow: {
    name: "overflow",
    description: "Larger search radius where the layout expands well beyond the seeded area.",
    count: 320,
    seed: 29,
    aspectRatio: 1,
    startBox: [512, 512],
    maxDelta: 4096
  }
};
const args = parseArgs(process.argv.slice(2));
const runs = args.runs ?? DEFAULT_RUNS;
const selected = args.scenario ? [pickScenario(args.scenario)] : Object.values(scenarios);

for (const scenario of selected) {
  await benchmarkScenario(scenario, runs);
}

async function benchmarkScenario(scenario, runs) {
  const words = createWords(scenario.count, scenario.seed);

  console.log(`\nScenario: ${scenario.name}`);
  console.log(`${scenario.description}`);
  console.log(
    `aspectRatio=${scenario.aspectRatio ?? 1} ` +
    `startBox=${formatPair(scenario.startBox ?? [256, 256])} ` +
    `maxDelta=${scenario.maxDelta ?? "default"} ` +
    `blockSize=${args.blockSize ?? DEFAULT_BLOCK_SIZE} ` +
    `words=${scenario.count} runs=${runs}`
  );

  const result = await measureScenario(scenario, words, runs);
  printResult(result);
}

async function measureScenario(scenario, words, runs) {
  const samples = [];

  await runLayout(scenario, words, scenario.seed);

  for (let run = 0; run < runs; run += 1) {
    const sample = await runLayout(scenario, words, scenario.seed + run);
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

async function runLayout(scenario, words, seed) {
  const layout = cloud()
    .canvas(() => createCanvas(1, 1))
    .aspectRatio(scenario.aspectRatio ?? 1)
    .startBox(scenario.startBox ?? [256, 256])
    .blockSize(args.blockSize ?? DEFAULT_BLOCK_SIZE)
    .random(createRandom(seed))
    .rotate(d => d.rotate)
    .padding(d => d.padding)
    .font("sans-serif")
    .fontSize(d => d.size)
    .words(words);

  if (scenario.maxDelta != null) {
    layout.maxDelta(scenario.maxDelta);
  }

  const start = performance.now();
  const { placed, bounds } = await new Promise(resolve => {
    layout.on("end", (placedWords, nextBounds) => {
      resolve({ placed: placedWords, bounds: nextBounds });
    }).start();
  });
  const duration = performance.now() - start;

  return {
    duration,
    placed: placed.length,
    area: boundsArea(bounds)
  };
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
