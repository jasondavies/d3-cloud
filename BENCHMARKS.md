# Benchmarks

Run these commands from a repository checkout after `npm ci`:

```sh
node benchmark.js --compare-v1 --runs=5
node benchmark.js --scenario=overflow --runs=5
```

The first compares the current v2 source with the published `d3-cloud@1.2.9`,
installed under the development-only alias `d3-cloud-v1`. The second measures
v2's unbounded mode, which has no direct v1 counterpart. Use `--help` for
scenario and block-size options. No v1 code is bundled into v2 or required by
its consumers.

## Method

- Both versions receive the same words, font (`sans-serif`), numeric font
  sizes, rotations, padding, box dimensions, and random seeds.
- Each run starts with a new layout, new input objects where v1 mutates them,
  and a fresh random source. V2 places words largest-first, matching v1's sort.
- Timings include layout setup, sorting, rasterization, and placement. They
  exclude module loading, input generation, and drawing the resulting cloud.
- Each scenario warms up each version once, then alternates the measurement
  order across runs. The measured seeds start at the scenario seed and increase
  by one. The default is five runs.
- Report placement counts and occupied bounding-box area with timing. A faster
  run that places fewer words is not necessarily an improvement.

The algorithms, search limits, and raster geometry differ, so identical seeds
do not imply identical positions or placement counts. V1 and v2 may also
consume random values differently. Fonts and canvas implementations vary by
platform; these are reproducible workloads, not a promise of identical numbers.

## Local comparison, 2026-10-30

Measured on an Apple M5 Pro, macOS 27.2 arm64, Node 24.22.1, node-canvas
3.2.3, Cairo 1.18.4, and Pango 1.57.1, at commit `5befb39`, with five
measured runs per version (`node benchmark.js --compare-v1 --runs=5`).

| Scenario | Version | Mean time | Min–max time | Mean placed | Placement range | Mean bounds area (px²) |
| --- | --- | ---: | --- | ---: | --- | ---: |
| 220 words, 2048 × 1536 | v1.2.9 | 129.64 ms | 127.67–131.47 ms | 220 | 220–220 | 2,915,899 |
| 220 words, 2048 × 1536 | v2 | 130.83 ms | 127.94–135.17 ms | 220 | 220–220 | 2,803,181 |
| 320 words, 512 × 384 | v1.2.9 | 202.72 ms | 198.16–204.32 ms | 30.8 | 29–33 | 195,994 |
| 320 words, 512 × 384 | v2 | 181.48 ms | 179.68–183.52 ms | 29.6 | 28–32 | 195,943 |

In the generous box, both versions placed every word in similar time, and v2's
cloud was about 4% smaller. In the crowded box, v2 was about 10% faster and
placed about one word fewer on average, within the overlapping placement
ranges. These results do not support a general claim that v2 is faster than
v1. Sparse storage and incremental erasure provide capabilities separate from
throughput on these bounded workloads.

## Unbounded layouts

The same machine measured v2 with `overflow(true)`, which has no v1
counterpart (`node benchmark.js --scenario=fit --runs=5` and
`--scenario=overflow`):

| Scenario | Mean time | Min–max time | Mean placed | Mean bounds area (px²) |
| --- | ---: | --- | ---: | ---: |
| fit: 220 words, seeded in 512 × 384 | 161.99 ms | 159.44–164.28 ms | 220 | 2,745,119 |
| overflow: 320 words, seeded in 512 × 512 | 300.41 ms | 293.28–316.96 ms | 320 | 4,505,835 |

Every word is placed, because the cloud grows beyond `size()` as needed.
