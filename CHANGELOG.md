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

- Placement first tries the seed, then searches from the nearest position
  where the sprite could touch the cloud (and, with `overflow(false)`, fit in
  the box), skipping positions where it could not without a collision check.
  Distant seeds cost no extra time, and small clouds are not stepped over.
- Search limits scale with the number of positions where the sprite could be
  placed, rather than the board diagonal, and apply equally to built-in and
  custom strategies. Strategies that repeat points still stop; one that moves
  away along one axis and never returns stops after a run proportional to the
  area it could have searched.
- Placement uses a private copy of each sprite's mask and accepts only sprites
  created by `getSprite()`, so changing or forging a sprite cannot corrupt a
  layout.
- Text rasters are sized from measured ink bounds, including italic overhang
  and accents, and redrawn larger if the ink reaches the raster edge, as some
  canvases under-report ink bounds. Text is rasterized with
  `textAlign = "center"`, matching how placed words should be rendered.
- Sprite geometry is trimmed to occupied pixels, independently of the packed
  row alignment, so bounded layouts do not reject words because of raster
  slack. Sprite extraction reads back only the raster and stores masks as
  `Uint32Array`s.
- Layouts may share one scratch canvas. A failed draw or readback, for example
  from a tainted canvas, makes every layout using it ask its factory for a
  canvas again; a rejected font does not.
- `getSprite()` throws if called while a sprite is being drawn to the same
  canvas, and `clear()` and `blockSize()` throw while `place()` is
  searching, rather than corrupting masks or occupancy.
- The package includes TypeScript declarations, for both the package entry
  and `build/d3-cloud.js`. `datum` is typed generically and inferred from
  `getSprite()` options. Image sources may be images, videos, canvases, or
  `ImageBitmap`s, including node-canvas, and placed words keep the source
  type, so `word.image` can be drawn directly.
- Documented the rendering contract: image coordinates mark the sprite center,
  and text is rendered from `x` and `y` with a centered horizontal anchor.
- Rewrote the examples for the ESM build.

### Known limitations

- The archimedean strategy samples points about a tenth of the radius apart
  and stretches its spiral to the aspect ratio, so in fixed boxes at extreme
  aspect ratios (around 20:1 and beyond) it places fewer words than at
  moderate ratios. Use the rectangular strategy for such boxes.
- The rectangular strategy samples a finer grid than in 1.x, so it can be
  slower in wide layouts, in exchange for denser packing.
