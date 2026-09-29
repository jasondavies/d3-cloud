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

## Local comparison, 2026-09-29

Measured on an Apple M5 Pro, macOS arm64, Node 24.21.0, node-canvas 3.2.3,
Cairo 1.18.4, and Pango 1.57.1. V2 includes the pixel-tight text geometry and
numeric occupancy-map changes following commit `fef6d45`, plus the bounded
search correction described below. This comparison uses ten measured runs
per version (`node benchmark.js --compare-v1 --runs=10`).

| Scenario | Version | Mean time | Min–max time | Mean placed | Placement range | Mean bounds area (px²) |
| --- | --- | ---: | --- | ---: | --- | ---: |
| 220 words, 2048 × 1536 | v1.2.9 | 130.05 ms | 125.44–140.57 ms | 220 | 220–220 | 2,906,854 |
| 220 words, 2048 × 1536 | v2 | 128.56 ms | 125.35–132.58 ms | 220 | 220–220 | 2,808,196 |
| 320 words, 512 × 384 | v1.2.9 | 203.56 ms | 199.93–207.71 ms | 31.0 | 27–35 | 195,520 |
| 320 words, 512 × 384 | v2 | 203.08 ms | 197.87–210.88 ms | 29.4 | 26–33 | 195,623 |

V2's timings were similar to v1 in both scenarios on this machine, with
overlapping timing ranges. Placement counts still differ in the crowded box.
These results do not support a general claim that v2 is faster than v1. Sparse
storage and incremental erasure provide capabilities separate from throughput
on these bounded workloads.

## Bounded search correction

The initial v2 search limit grew with sprite size and cloud bounds even when
`overflow(false)` prevented placement outside a fixed box. Failed placements
therefore spent substantial time generating and rejecting distant positions.
Bounded searches now use the box diagonal, extended when necessary to reach
fitting positions from explicit initial coordinates outside the box.
Unbounded searches retain their previous limit.

Instrumenting `bounded-tight` with seed 29 showed the effect:

| Version | Spiral candidates | Candidates rejected outside the box | Collision checks |
| --- | ---: | ---: | ---: |
| v1.2.9 | 2,395,132 | 2,015,794 | 379,047 |
| v2 before correction | 4,086,340 | 3,660,937 | 425,393 |
| v2 after correction | 2,418,616 | 1,993,213 | 425,393 |

The correction removes out-of-bounds work without removing collision checks
in this sample. A separate five-run, alternating-order comparison measured
the crowded default-spiral workload at 252.86 ms before and 218.19 ms after.
The same comparison with the rectangular spiral measured 760.75 ms before
and 401.61 ms after. These times came from different runs than the v1
comparison above; compare within each experiment only.

Placement snapshots were identical before and after across five seeds in all
four default-spiral scenarios, and in both bounded scenarios with the
rectangular spiral. Regression tests cover crowded-box termination, corner
gaps in portrait and landscape boxes, both spiral directions, and starting
coordinates outside the box.

## Occupancy lookup experiment

Before changing text geometry, replacing string keys and temporary range
objects with nested numeric maps produced these v2 timings. Each row used
five measured runs; placement counts and mean bounds areas were unchanged.
These were separate local runs, not an allocation profiler or a statistical
significance test. This earlier harness timed rasterization and placement,
excluding layout setup and sorting; compare within this table only.

| Scenario | String keys | Numeric maps |
| --- | ---: | ---: |
| bounded-fit | 162.77 ms | 144.31 ms |
| bounded-tight | 277.67 ms | 253.84 ms |
| fit (unbounded) | 212.13 ms | 191.75 ms |
| overflow (unbounded) | 413.79 ms | 353.79 ms |

The numeric map removes per-candidate block-key strings and range objects.
It preserves separate signed x/y coordinates without packing them into a
numeric key that could alias at large coordinates.
