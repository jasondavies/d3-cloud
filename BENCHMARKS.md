# Benchmarks

Run these commands from a repository checkout after `npm ci`:

```sh
node benchmark.js --compare-v1 --runs=5
node benchmark.js --scenario=fit --runs=5
node benchmark.js --scenario=overflow --runs=5
```

The first compares the current v2 source with the published `d3-cloud@1.2.9`,
installed under the development-only alias `d3-cloud-v1`. The other two measure
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

## Local comparison, 2026-11-27

Measured on an Apple M5 Pro, macOS 27.2.1 arm64, Node 26.13.0, node-canvas
3.2.3, Cairo 1.18.4, and Pango 1.57.1, at commit `fd6d90f`, with five
measured runs per version (`node benchmark.js --compare-v1 --runs=5`).

| Scenario | Version | Mean time | Min–max time | Mean placed | Placement range | Mean bounds area (px²) |
| --- | --- | ---: | --- | ---: | --- | ---: |
| 220 words, 2048 × 1536 | v1.2.9 | 130.45 ms | 126.91–138.64 ms | 220 | 220–220 | 2,915,899 |
| 220 words, 2048 × 1536 | v2 | 132.00 ms | 129.60–135.94 ms | 220 | 220–220 | 2,794,071 |
| 320 words, 512 × 384 | v1.2.9 | 201.93 ms | 199.50–204.21 ms | 30.8 | 29–33 | 195,994 |
| 320 words, 512 × 384 | v2 | 182.96 ms | 180.98–184.39 ms | 29.0 | 27–31 | 195,254 |

In the generous box, both versions placed every word in similar time, and v2's
bounding box was about 4% smaller in area. In the crowded box, v2 took about
9% less time and placed 1.8 fewer words on average over the five seeds.

## Unbounded layouts

The same machine measured v2 with `overflow(true)`, which has no v1
counterpart (`node benchmark.js --scenario=fit --runs=5` and
`--scenario=overflow`):

| Scenario | Mean time | Min–max time | Mean placed | Mean bounds area (px²) |
| --- | ---: | --- | ---: | ---: |
| fit: 220 words, seeded in 512 × 384 | 162.21 ms | 159.50–165.36 ms | 220 | 2,779,755 |
| overflow: 320 words, seeded in 512 × 512 | 295.63 ms | 290.72–302.21 ms | 320 | 4,521,890 |

Both unbounded workloads placed every word in all five runs.
