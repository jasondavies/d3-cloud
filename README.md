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
Node.js usage requires Node 20 or newer, matching the minimum CI version.

See [RELEASING.md](./RELEASING.md) for the manual release checklist.

## Install

```sh
npm install d3-cloud
```

If you want to rasterize text in Node.js, you will typically also install and
configure a canvas implementation such as:

```sh
npm install canvas
```

For Node and bundler consumers:

```js
import CloudLayout from "d3-cloud";

const layout = new CloudLayout();
const sprites = [...words]
  .sort((a, b) => b.size - a.size)
  .map(word => layout.getSprite(word.text, {
    size: word.size,
    datum: word,
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

Placement uses sparse packed occupancy blocks for collision checks.
`size()` sets the aspect ratio for the built-in strategies and defines a
centered half-size box for initial placement seeds.
By default, `overflow(true)` allows placement to extend beyond the centered
`size()` box; switch to `overflow(false)` for a bounded layout. Word order is
controlled by the caller; in most cases you will want to place larger words
first.

Image sprites use `x` and `y` as the sprite center. For text, render from
`word.x` and `word.y` directly and center the text horizontally.

## Rendering Placed Words

Render text from the placed position with a centered horizontal anchor:

```js
context.save();
context.font = `${word.style} ${word.weight} ${Math.ceil(word.size)}px ${word.font}`;
context.textAlign = "center";
context.textBaseline = "alphabetic";
context.translate(word.x, word.y);
context.rotate(word.rotate * Math.PI / 180);
context.fillText(word.text, 0, 0);
context.restore();
```

For SVG:

```html
<text
  text-anchor="middle"
  transform="translate(...) rotate(...)"
>word</text>
```

## Using With React

See `examples/react/README.md` for a minimal Vite + React sample that runs the
layout on the client and renders each placed word as a clickable SVG link.

In frameworks that render on the server, create the layout only on the client,
for example inside `useEffect()` or inside a client-only component. The
default canvas factory uses `document.createElement("canvas")`.

## Migrating From 1.x

See the [migration guide](./MIGRATING.md) for a before-and-after example,
changed defaults, scheduling, TypeScript, and browser script migration.
Existing `^1.x` dependencies stay on v1; pin legacy CDN scripts to a 1.x
version before changing any unversioned URLs.

- The package is now ESM-only. `require("d3-cloud")` is no longer supported.
- The old factory and event API is gone. Use `new CloudLayout()` together with
  `getSprite()` and `place()` instead of `start()`, `stop()`, `on()`,
  `words()`, and `timeInterval()`.
- Input words are no longer annotated with layout fields. Pass your word as
  `datum` and read it back from each placed word.
- Text and image styling now lives on `getSprite(source, options)` rather than
  layout-wide accessors such as `text()`, `font()`, `fontSize()`, `rotate()`,
  and `padding()`.
- `size([width, height])` now describes a centered layout box around `[0, 0]`.
  Use `overflow(false)` to keep placement inside that box or `overflow(true)`
  to allow the layout to grow beyond it.
- `strategy()` replaces the old `spiral()` API. Built-in strategies are
  `"archimedean"`, `"rectangular"`, and `"none"`, and custom strategies now receive an
  initial `{x, y}` seed plus layout context.

## API Reference

<a name="cloudlayout" href="#cloudlayout">#</a> <b>new CloudLayout()</b>

Constructs a new cloud layout instance.

<a name="clear" href="#clear">#</a> <b>clear</b>()

Clears the current placement state and bounds so the instance can be reused for
a fresh layout. Words placed before clearing can no longer be erased.

<a name="bounds" href="#bounds">#</a> <b>bounds</b>()

Returns the current placement extent as `[{x, y}, {x, y}]`, or `null` if no
words have been placed yet. After `erase()`, these bounds are only reset when
the layout becomes completely empty; otherwise they may remain conservative.

<a name="getsprite" href="#getsprite">#</a> <b>getSprite</b>(<i>source</i>[, <i>options</i>])

Rasterizes the specified text or image-like source and returns an immutable
`CloudSprite`, or `null` if it could not be rasterized into the internal scratch
canvas.

A sprite is a mask: it holds the source, its styling, its trimmed geometry
(`width`, `height`, `x0`, `y0`, `x1`, `y1`) and its pixels, but no position.
Rasterization is the expensive step, so prepare a sprite once and place it as
many times as you like, in this or any other layout. Sprites are frozen and
can only be created by `getSprite()`.

The optional *options* object may include `font`, `style`, `weight`, `rotate`,
`size`, `padding`, and `datum`. The defaults are `font: "serif"`,
`style: "normal"`, `weight: "normal"`, `size: 1`, `rotate: 0`, and
`padding: 1`. `fontStyle`, `fontWeight`, and `fontSize` are accepted as aliases.
Other option fields are ignored.

Use `datum` to carry your own data, such as the input word, a link, or an ID.
It is stored by reference on the sprite and on every word placed from it, and
is never read by the layout.

Image sprites are extracted from the source alpha channel, so transparent
pixels are ignored automatically. For image sources, `options.width` and
`options.height` may be used to resize the image before extraction; if only one
dimension is provided, the other is derived from the source aspect ratio.
`options.text` sets the sprite's text, which defaults to the image's `alt`.
Images and videos use their intrinsic dimensions rather than their display size.

`padding` applies only to text. Image masks use the source alpha unchanged;
adding transparent margins does not create occupied padding pixels.

Text and image bounds are trimmed to nontransparent pixels, including text
padding. Packed rows are aligned internally without adding empty space to
reported bounds or bounded placement checks.
`null` can indicate empty text, an unloaded or empty image, or a raster exceeding
the 2048-pixel scratch dimensions. Load images and fonts before preparing sprites.

<a name="place" href="#place">#</a> <b>place</b>(<i>sprite</i>[, <i>options</i>])

Attempts to place *sprite* and returns a new placed word, or `null` if it could
not be placed. The sprite itself is not changed, so it can be placed again;
for example, this fills the remaining space with one word at decreasing sizes:

```js
for (let size = 80; size >= 8; size -= 4) {
  const sprite = layout.getSprite("fill", { size, font: "Impact" });
  while (sprite && layout.place(sprite)) {}
}
```

The placed word is a plain object with the sprite's `text`, `image`,
`imageWidth`, `imageHeight`, `font`, `style`, `weight`, `rotate`, `size`,
`padding`, `datum`, and trimmed geometry, plus the placed position `x` and `y`.
It is shallow and not a serialization format: an image word retains its
`image` source, which may be a DOM element, and `datum` is whatever you passed.
Before posting or serializing a word, omit anything that cannot be cloned.

If specified, the optional *options* object may include `x` and `y` to control
the initial placement attempt before the strategy search begins. Any omitted axis
still uses the normal seeded position from the centered half-size seed box
derived from `size()`. Explicit coordinates are rounded down to integer pixels.

If specified, `options.strategy` overrides the layout-level default strategy
for this placement only.

Image sprites use the returned `x` and `y` coordinates as the sprite center.
For text, render from `x` and `y` directly with a centered horizontal anchor,
as shown in the canvas and SVG snippets above.

To place multiple sprites, call `place()` in your own loop.

<a name="erase" href="#erase">#</a> <b>erase</b>(<i>word</i>)

Erases a placed word, freeing its pixels for later placements. *word* must be
an object returned by `place()` on this layout since it was last cleared; it is
matched by identity, so changing its fields does not affect what is erased, and
copies are rejected. Each word can be erased once.

This does not shrink `bounds()` unless the layout becomes completely empty.

<a name="size" href="#size">#</a> <b>size</b>([<i>size</i>])

If specified, sets the centered layout size as `[width, height]`. This size is
used both for the aspect ratio of the built-in `"archimedean"` and
`"rectangular"` strategies and for a centered initial seed box at half that
width and height.

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

Each generated candidate must be returned as `{x, y}`. Candidate coordinates
are rounded down to integer pixels. Returning `null` stops the search.
Built-in and custom strategies follow the same search limits. A search stops
once a candidate is beyond the layout's search distance on both axes, or after
100,000 consecutive candidates that make no progress on the axis furthest from
that distance; stopping returns `null`. This limits
repeated or one-axis searches, but cannot interrupt a generator that never
returns from an individual call.

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

<a name="blocksize" href="#blocksize">#</a> <b>blockSize</b>([<i>size</i>])

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

## Benchmarks

See [BENCHMARKS.md](./BENCHMARKS.md) for reproducible v1/v2 comparisons,
placement counts, and limitations. Run `node benchmark.js --compare-v1`
after installing development dependencies. The v1 alias is a development
dependency and is not shipped as a runtime dependency.
