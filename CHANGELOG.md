# Changelog

All notable changes to this project will be documented in this file.

This changelog currently documents the 2.x line. The previous stable 1.x
release was `v1.2.9`.

## [2.0.0] - Unreleased

### Breaking

- Switched the package to ESM-only publishing and removed the old Browserify /
  CommonJS distribution shape.
- Replaced the old event-driven factory API (`start()`, `stop()`, `on()`,
  `words()`, `timeInterval()`, accessor-based text/font configuration) with the
  class-based `CloudLayout` / `CloudSprite` API.
- Replaced the old `spiral()` API with `strategy()`.
- Moved source files under `src/` and renamed the browser bundle to
  `build/d3-cloud.js`.
- Changed placement configuration so `size([width, height])` defines the
  centered layout box, while `overflow(true | false)` controls whether
  placement may extend beyond that box.

### Added

- Added `CloudLayout.getSprite(...)` for explicit sprite preparation and
  `place()` for caller-controlled placement.
- Added built-in placement strategies including `noneStrategy` for single-attempt
  placement.
- Added `eraseSprite()` for erasing previously placed `CloudSprite` instances.
- Added image sprite extraction from alpha masks, including optional image
  resizing with `options.width` and `options.height`.
- Added sparse packed block placement for effectively unbounded layouts.
- Added browser examples for ESM loading, image sprites, and masked layout.
- Added a `node:test` regression suite and a standalone benchmark script.

### Changed

- Optimized sprite extraction to use partial canvas readback and `Uint32Array`
  mask storage.
- Fixed layout state reuse between runs and corrected right-edge occupancy for
  non-word-aligned widths.
- Removed `maxDelta()` and now always derives the placement search limit from
  the current sprite, bounds, and layout size.
- Simplified the public examples and aligned the browser demo with the modern
  ESM build.
