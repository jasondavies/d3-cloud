# Changelog

All notable changes to this project will be documented in this file.

This changelog currently documents the 2.x line. The previous stable 1.x
release was `v1.2.9`.

## [2.0.0] - Unreleased

See the [1.x to 2.x migration guide](./MIGRATING.md) before upgrading.
Dependencies constrained to 1.x continue to use the old API.

### Breaking

- Set the minimum Node.js version to 20, matching the CI test matrix.
- Switched the package to ESM-only publishing and removed the old Browserify /
  CommonJS distribution shape.
- Removed the UMD/script-tag build, the `d3.layout.cloud` global, and the
  `d3-dispatch` dependency. Browser scripts must use ESM imports.
- Changed the default rotation from random multiples of 30 degrees to zero,
  and the default font size from `sqrt(value)` to 1. Set styling explicitly.
- Input word objects are no longer mutated. Placement returns separate snapshots,
  and callers control the word ordering.
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

- Restored the scratch context after failed image draws and rejected unavailable
  image/video sources even when they have explicit display dimensions.
- Used intrinsic video dimensions to preserve aspect ratio when resizing sprites.
- Accepted node-canvas factories in TypeScript alongside browser and offscreen
  canvases.
- Sized text rasters to measured ink bounds, including overhang and accents,
  and redrew text into a larger raster when its ink reached the raster edge, as
  some canvas implementations under-report ink bounds. Cleared an extra margin
  of the scratch canvas for width-only adapters to prevent pixels from leaking
  into subsequent sprites.
- Text padding strokes now use round joins, so padding extends exactly
  `padding` pixels from the glyph outline rather than up to ten times that at
  sharp miter corners.
- Allowed ordinary TypeScript interfaces as sprite metadata without requiring
  an index signature.
- Preserved image edge pixels for odd dimensions, rotation, and resizing, and
  allowed opaque image sprites to pack beside each other while still touching
  the existing cloud.
- Preserved custom metadata types on prepared sprites as well as placed
  snapshots, with built-in field types taking precedence over metadata.
- Limited bounded placement searches per axis to the fixed box and initial
  coordinates, avoiding expansion-distance searches after the box fills up.
- Applied the same search limits to built-in and custom strategies, so wrapped
  built-ins behave identically and extreme aspect ratios cannot search for
  minutes.
- Copying a placed sprite's fields into a new sprite no longer marks the copy
  as placed, and layouts no longer retain references to placed sprites.
- Trimmed text and image geometry to occupied pixels, independently of packed
  row alignment, so bounded layouts do not reject words due to raster slack.
- Replaced string block keys and temporary range objects with numeric map
  lookups in collision checks.
- Optimized sprite extraction to use partial canvas readback and `Uint32Array`
  mask storage.
- Documented the rendering anchor contract: image sprite coordinates mark the
  sprite center, while text should be rendered from `x` and `y` directly with a
  centered horizontal anchor.
- Fixed layout state reuse between runs and corrected right-edge occupancy for
  non-word-aligned widths.
- Removed `maxDelta()` and now always derives the placement search limit from
  the current sprite, bounds, and layout size.
- Simplified the public examples and aligned the browser demo with the modern
  ESM build.
