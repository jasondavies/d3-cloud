# Changelog

All notable changes to this project will be documented in this file.

This changelog currently documents the 2.x line. The previous stable 1.x
release was `v1.2.9`.

## [2.0.0] - Unreleased

Prerelease `2.0.0-rc.0` was published on 2026-10-30 under the `next` npm tag.
Since then, the undocumented `trimX`, `trimY`, `trimWidth`, and `trimHeight`
fields have been removed from sprites and placed words; use `width`, `height`,
`x0`, and `y0` instead. Canvases that read back more than one pixel per unit
are now rejected.

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
- Input word objects are no longer mutated. Placement returns separate plain
  words, and callers control the word ordering.
- Custom data is carried in a single `datum` option, stored by reference on
  sprites and placed words. Other option fields are ignored rather than copied
  onto sprites and results, so built-in field names are no longer reserved.
- Replaced the old event-driven factory API (`start()`, `stop()`, `on()`,
  `words()`, `timeInterval()`, accessor-based text/font configuration) with the
  class-based `CloudLayout` / `CloudSprite` API.
- Replaced the old `spiral()` API with `strategy()`.
- Moved source files under `src/` and renamed the browser bundle to
  `build/d3-cloud.js`.
- Changed placement configuration so `size([width, height])` defines the
  centered layout box, while `overflow(true | false)` controls whether
  placement may extend beyond that box.
- Text padding now uses round stroke joins instead of the canvas default miter
  joins, so padding extends exactly `padding` pixels from the glyph outline
  rather than up to ten times that at sharp corners. Padded masks, and layouts
  that depend on them, differ from 1.x.
- The rectangular strategy now visits every point of a 4-pixel grid in rings
  shaped to the aspect ratio, instead of stepping four pixels times the aspect
  ratio along the longer axis. Rectangular layouts differ from 1.x, and pack
  densely at any aspect ratio.
- Both built-in spirals stretch to the aspect ratio only up to 64:1. Beyond
  that they barely moved along the shorter axis, so a search starting in a
  blocked column or row could take minutes and then fail. Layouts with more
  extreme aspect ratios differ from 1.x.
- Invalid arguments throw instead of being silently replaced: non-finite
  coordinates, sizes, rotations, padding, image dimensions and strategy
  candidates; negative padding; `size()` dimensions outside 0–16,777,216;
  `blockSize()` outside 1–4096; a `random()` that is not a function or returns
  anything but a number in `[0, 1)`; fonts the canvas rejects; canvases
  without a 2d context; and canvases whose `getImageData()` returns more than
  one pixel per canvas unit, as some old high-density WebKit canvases did.

### Added

- Added `CloudLayout.getSprite(...)` for explicit sprite preparation and
  `place()` for caller-controlled placement. Sprites are immutable masks with
  no position, so one sprite can be placed any number of times; they can only
  be created by `getSprite()`.
- Added built-in placement strategies including `noneStrategy` for single-attempt
  placement.
- Added `erase()` for erasing a word returned by `place()`.
- Added image sprite extraction from alpha masks, including optional image
  resizing with `options.width` and `options.height`. Loaded images without
  intrinsic dimensions, such as SVGs with only a `viewBox`, are drawn at an
  explicit width and height.
- Added sparse packed block placement for effectively unbounded layouts.
- Added browser examples for ESM loading, image sprites, and masked layout.
- Added a `node:test` regression suite and a standalone benchmark script.

### Changed

- Tried the clamped search origin before advancing the archimedean spiral, so
  an off-center seed can still place a sprite that exactly fills a fixed box.
- Generated rectangular candidates edge by edge in distance and angle order,
  in constant time and memory per candidate at any aspect ratio.
- Preserved `undefined` in TypeScript results when `datum` is optional or
  omitted, while retaining precise inference for a required `datum`.
- Restored the scratch context after failed image draws and rejected unavailable
  image/video sources even when they have explicit display dimensions.
- Used intrinsic video dimensions to preserve aspect ratio when resizing sprites.
- Accepted node-canvas factories in TypeScript alongside browser and offscreen
  canvases.
- Sized text rasters to measured ink bounds, including overhang and accents,
  and redrew text into a larger raster, after clearing the scratch canvas,
  when its ink reached the raster edge, as some canvas implementations
  under-report ink bounds. Restored the scratch context after failed text
  draws. Cleared an extra margin of the scratch canvas for width-only adapters
  to prevent pixels from leaking into subsequent sprites.
- Rasterized text with `textAlign = "center"`, matching the documented
  rendering contract, since some canvases position centered glyphs differently
  from a manually offset left-aligned run.
- Preserved image edge pixels for odd dimensions, rotation, and resizing, and
  allowed opaque image sprites to pack beside each other while still touching
  the existing cloud.
- Typed `datum` generically on sprites and placed words, inferred from
  `getSprite()` options.
- Typed image sources as images, videos, canvases, and `ImageBitmap`s,
  including node-canvas images, and kept the source type on sprites and
  placed words so `word.image` can be drawn directly. Accepted text-or-image
  unions and readonly `size()` tuples.
- Searches start from the nearest position where the sprite could overlap the
  cloud's bounds (and, without overflow, fit in the box), and skip candidates
  outside those positions, so distant seeds cost no extra time and small
  clouds are not stepped over.
- Applied the same search limits to built-in and custom strategies, so wrapped
  built-ins behave identically. Limits scale with the number of positions
  where the sprite could be placed, so scans and random samplers can cover
  them, while generators that repeat points still stop. A generator that
  leaves along one axis and never returns stops after a run proportional to
  the area it could have searched.
- Placement uses a private copy of each sprite's mask, and only accepts
  sprites created by `getSprite()`, so changing or forging a sprite cannot
  corrupt a layout.
- Layouts sharing one canvas share its clearing state, so they clear each
  other's drawings, even if `getContext()` returns a new wrapper each time.
  After a failed draw or readback, for example from a tainted canvas, every
  layout using that canvas requests a canvas from its factory again, and a
  reused canvas is reset; a rejected font does not count as a failure.
- `getSprite()` throws if called while a sprite is being drawn to the same
  canvas, for example from an image getter, and `clear()` and `blockSize()`
  throw while `place()` is searching, for example from `random()`, rather
  than corrupting masks or occupancy. Non-numeric font weights are converted
  to strings before drawing.
- Typed the `build/d3-cloud.js` export with the package declarations.
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

### Known limitations

- The archimedean strategy samples points about a tenth of the radius apart
  and stretches its spiral to the aspect ratio, so in fixed boxes at extreme
  aspect ratios (around 20:1 and beyond) it places fewer words than at
  moderate ratios. Use the rectangular strategy for such boxes.
- The rectangular strategy samples a finer grid than in 1.x, so it can be
  slower in wide layouts, in exchange for denser packing.
