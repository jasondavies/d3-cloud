# Word Cloud Layout

This is a [Wordle](http://www.wordle.net/)-inspired word cloud layout written
in JavaScript. It uses HTML5 canvas and sprite masks to achieve
near-interactive speeds.

See [here](http://www.jasondavies.com/wordcloud/) for an interactive
demonstration along with implementation details.

![Example cloud of Twitter search results for “amazing”](http://www.jasondavies.com/wordcloud/amazing.png)

## Usage

See the samples in `examples/`.

For a browser-loadable SVG example, run `npm run build`, serve the repository
root with any static file server, and open `examples/`.

This package is ESM-only.

For Node and bundler consumers:

```js
import CloudLayout from "d3-cloud";

const layout = new CloudLayout();
const sprites = [...words]
  .sort((a, b) => b.size - a.size)
  .map(word => layout.getSprite(word.text, {
    ...word,
    font: "Impact",
    padding: 1,
    rotate: 0
  }))
  .filter(Boolean);
const placed = [];

for (const sprite of sprites) {
  const word = layout.place(sprite);
  if (word) {
    placed.push(word);
  }
}
```

Run `npm run build` to generate the browser bundle at `build/d3-cloud.js`,
which exports the layout as an ESM module for browser use.

Placement uses sparse packed occupancy blocks for collision checks, so the
final cloud uses `size()` both as the initial seed box and as the aspect ratio
hints for the built-in strategies. By default, `overflow(true)` allows placement
to extend beyond that centered size box; switch to `overflow(false)` for a
bounded layout. Word order is controlled by the caller; in most cases you
will want to place larger words first.

## Migrating From 1.x

- The package is now ESM-only. `require("d3-cloud")` is no longer supported.
- The old factory and event API is gone. Use `new CloudLayout()` together with
  `getSprite()` and `place()` instead of `start()`, `stop()`, `on()`,
  `words()`, and `timeInterval()`.
- Text and image styling now lives on `getSprite(source, options)` rather than
  layout-wide accessors such as `text()`, `font()`, `fontSize()`, `rotate()`,
  and `padding()`.
- `size([width, height])` now describes a centered layout box around `[0, 0]`.
  Use `overflow(false)` to keep placement inside that box or `overflow(true)`
  to allow the layout to grow beyond it.
- `strategy()` replaces the old `spiral()` API. Built-in strategies are
  `"archimedean"` and `"rectangular"`, and custom strategies now receive an
  initial `{x, y}` seed plus layout context.

## API Reference

<a name="cloudlayout" href="#cloudlayout">#</a> <b>new CloudLayout()</b>

Constructs a new cloud layout instance.

<a name="clear" href="#clear">#</a> <b>clear</b>()

Clears the current placement state and bounds so the instance can be reused for
a fresh layout.

<a name="bounds" href="#bounds">#</a> <b>bounds</b>()

Returns the current placement extent as `[{x, y}, {x, y}]`, or `null` if no
sprites have been placed yet. After `eraseSprite()`, these bounds are only
reset when the layout becomes completely empty; otherwise they may remain
conservative.

<a name="erasesprite" href="#erasesprite">#</a> <b>eraseSprite</b>(<i>sprite</i>)

Erases a previously placed `CloudSprite` from the layout.

Pass the original `CloudSprite` instance that was given to `place()`, not the
plain placed-word snapshot returned by `place()`. This call is unchecked: pass
only the same sprite instance that was actually placed and has not already been
removed. This low-level operation does not shrink `bounds()` unless the layout
becomes completely empty.

<a name="place" href="#place">#</a> <b>place</b>(<i>sprite</i>[, <i>options</i>])

Attempts to place a single prepared `CloudSprite` immediately and returns the
placed sprite snapshot, or `null` if it could not be placed.

The returned object is a plain placed-word snapshot. Internal raster fields
such as `sprite`, `spriteWidth`, and `hasPixels` are omitted, while custom
metadata from `getSprite(..., options)` is preserved.

If specified, the optional *options* object may include `x` and `y` to control
the initial placement attempt before the strategy search begins. Any omitted axis
still uses the normal seeded position from `size()`.

If specified, `options.strategy` overrides the layout-level default strategy
for this placement only.

For both text and image sprites, the returned `x` and `y` coordinates mark the
sprite center. When rendering text in SVG, use `text-anchor="middle"` together
with `dominant-baseline="middle"` to match the layout coordinates.

<a name="getsprite" href="#getsprite">#</a> <b>getSprite</b>(<i>source</i>[, <i>options</i>])

Builds and returns a `CloudSprite` for the specified text or image-like source,
or `null` if it could not be rasterized into the internal scratch canvas.

The returned value is a prepared reusable `CloudSprite`, not the plain placed
word snapshot returned by `place()`.

The optional *options* object may include `font`, `style`, `weight`, `rotate`,
`size`, `padding`, and any additional fields you want to carry through to the
resulting sprite. The defaults are `font:
"serif"`, `style: "normal"`, `weight: "normal"`, `size: 1`, `rotate: 0`, and
`padding: 1`.

Image sprites are extracted from the source alpha channel, so transparent
pixels are ignored automatically. For image sources, `options.width` and
`options.height` may be used to resize the image before extraction; if only one
dimension is provided, the other is derived from the source aspect ratio.

Words that cannot be placed simply return `null`. To place multiple sprites,
call `place()` in your own loop.

<a name="size" href="#size">#</a> <b>size</b>([<i>size</i>])

If specified, sets the centered layout size as `[width, height]`. This size is
used both for the initial random seed box and for the aspect ratio of the
built-in `"archimedean"` and `"rectangular"` strategies.

If not specified, returns the current layout size, which defaults to
`[256, 256]`. Use `[0, 0]` together with `overflow(true)` to start every word
exactly at the origin without any bounding box.

<a name="overflow" href="#overflow">#</a> <b>overflow</b>([<i>overflow</i>])

If specified, enables or disables overflow beyond `size()`. When `true`, the
layout may expand beyond the centered `size()` box, which is then used only for
seeding and built-in strategy shaping. When `false`, placement is bounded to
that centered box and `place()` returns `null` if no in-bounds position is
found.

If not specified, returns the current overflow mode, which defaults to `true`.

<a name="strategy" href="#strategy">#</a> <b>strategy</b>([<i>strategy</i>])

If specified, sets the current placement strategy used after the initial seed
position fails. This can either be one of the built-in strategies,
`"archimedean"`, `"rectangular"`, and `"none"`, or an arbitrary strategy
factory of the following form:

```js
function(initial, context) {
  return function() {
    return { x, y };
  };
}
```

The `initial` argument is the initial `{x, y}` seed for this placement.
`context` includes `size`, `aspectRatio`, `bounds`, `overflow`, and `random`.

Each generated candidate must be returned as `{x, y}`. Returning `null` stops
the search.

The built-in strategies are also exported as `archimedeanStrategy`,
`rectangularStrategy`, and `noneStrategy`, so callers do not need to use string
names. Use `noneStrategy` or `"none"` for a single-attempt placement that tries
only the initial `{x, y}`.

If not specified, returns the current strategy factory, which defaults to the
built-in `archimedeanStrategy`.

<a name="random" href="#random">#</a> <b>random</b>([<i>random</i>])

If specified, sets the internal random number generator, used for selecting the
initial position of each sprite inside `size()`, and the
clockwise/counterclockwise direction of the built-in strategies during
placement. This
should return a number in the range `[0, 1)`.

If not specified, returns the current random number generator, which defaults
to `Math.random`.

<a name="blockSize" href="#blockSize">#</a> <b>blockSize</b>([<i>size</i>])

If specified, sets the sparse block size used during placement. Block sizes
are rounded up to the next multiple of 32 pixels so they align with the
packed sprite representation. If not specified, returns the current size,
which defaults to `512`.

<a name="canvas" href="#canvas">#</a> <b>canvas</b>([<i>canvas</i>])

If specified, sets the **canvas** generator function, which is used internally
to draw text. This must be a function that returns a canvas-like object. If not
specified, returns the current generator function, which defaults to:

```js
function() { return document.createElement("canvas"); }
```

When using Node.js, you will almost definitely override this default, e.g.
using the [canvas module](https://www.npmjs.com/package/canvas).
