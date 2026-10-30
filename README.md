# Word Cloud Layout

This is a [Wordle](https://s3.amazonaws.com/static.mrfeinberg.com/bv_ch03.pdf)-inspired word cloud layout written
in JavaScript. It uses HTML5 canvas and sprite masks to achieve
near-interactive speeds. The library prepares sprite masks and computes word
positions; your application renders the results with canvas, SVG, or another
renderer.

See [here](https://www.jasondavies.com/wordcloud/) for an interactive
demonstration along with implementation details.

![Example word cloud](https://www.jasondavies.com/wordcloud/readme.svg)

## Install

```sh
npm install d3-cloud
```

The package is ESM-only. Node.js requires version 20 or newer and a canvas
implementation for rasterizing text and images:

```sh
npm install canvas
```

## Quick Start

In Node.js, save this example as `cloud.mjs` and run `node cloud.mjs`:

```js
import { createCanvas } from "canvas";
import CloudLayout from "d3-cloud";

const words = [
  { text: "Hello", size: 64 },
  { text: "world", size: 48 },
  { text: "cloud", size: 32 }
];
const layout = new CloudLayout()
  .canvas(() => createCanvas(1, 1))
  .size([640, 400])
  .overflow(false);
const sprites = [...words]
  .sort((a, b) => b.size - a.size)
  .map(word => layout.getSprite(word.text, {
    size: word.size,
    datum: word,
    font: "sans-serif",
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
console.log(placed);
```

In a browser application with a bundler, use the same example but omit the
`canvas` import and the `.canvas(...)` call. The default factory creates an
HTML canvas. Load any custom fonts before calling `getSprite()`.

Prepare sprites once, then call `place()` for each one, usually largest first.
Both methods can return `null`, so the example filters unsuccessful sprites
and placements. `datum` carries the original input object onto each result.

The example uses `overflow(false)` to keep words inside a 640 × 400 layout
rectangle centered at `[0, 0]`. The default, `overflow(true)`, allows the cloud
to grow beyond that rectangle. `size()` also shapes the built-in search
strategies and sets their initial seed region; see [size](#size).

## Rendering Placed Words

### Canvas Rendering

Layout coordinates are centered around zero, whereas a canvas starts at its
top-left corner. For the bounded quick-start example, translate the drawing
origin to the canvas center before rendering the words:

```js
function drawText(context, word) {
  context.save();
  context.font = `${word.style} ${word.weight} ${word.size}px ${word.font}`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.translate(word.x, word.y);
  context.rotate(word.rotate * Math.PI / 180);
  context.fillText(word.text, 0, 0);
  context.restore();
}

const canvas = createCanvas(640, 400);
const context = canvas.getContext("2d");
context.save();
context.translate(canvas.width / 2, canvas.height / 2);
for (const word of placed) drawText(context, word);
context.restore();
```

This continues the Node.js example. In a browser, use an HTML canvas with
`width="640"` and `height="400"` instead of `createCanvas(640, 400)`.
Use the same font family, style, weight, and size used to prepare the sprites.
Text positions are the horizontal center of the text on its alphabetic baseline.

For an overflowing layout, fit the drawing surface to `bounds()` instead of
assuming it fits inside `size()`. After placing the words, use this in place of
the centered rendering block above:

```js
const bounds = layout.bounds();
if (bounds) {
  const [min, max] = bounds;
  const margin = 16;
  canvas.width = Math.ceil(max.x - min.x) + 2 * margin;
  canvas.height = Math.ceil(max.y - min.y) + 2 * margin;
  context.save();
  context.translate(margin - min.x, margin - min.y);
  for (const word of placed) drawText(context, word);
  context.restore();
}
```

Image positions are the center of the resized source image, which may differ
from the center of its visible pixels when the source has transparent margins.
Within the same outer translation, render an image word with:

```js
context.save();
context.translate(word.x, word.y);
context.rotate(word.rotate * Math.PI / 180);
context.drawImage(word.image,
  -word.imageWidth / 2, -word.imageHeight / 2,
  word.imageWidth, word.imageHeight);
context.restore();
```

### SVG

For an existing SVG element, render the placed text words with a `viewBox`
derived from the layout bounds, and copy
the font attributes as well as the position and rotation:

```js
const svg = document.querySelector("svg");
const bounds = layout.bounds();
svg.replaceChildren();
if (bounds) {
  const [min, max] = bounds;
  const margin = 16;
  svg.setAttribute("viewBox",
    `${min.x - margin} ${min.y - margin} ${max.x - min.x + 2 * margin} ${max.y - min.y + 2 * margin}`);
  for (const word of placed) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-family", word.font);
    text.setAttribute("font-size", word.size);
    text.setAttribute("font-style", word.style);
    text.setAttribute("font-weight", word.weight);
    text.setAttribute("transform", `translate(${word.x},${word.y}) rotate(${word.rotate})`);
    text.textContent = word.text;
    svg.append(text);
  }
}
```

## Examples

See [examples/](./examples/) for SVG rendering, image sprites, live updates,
font loading, and Web Workers. To run these from a repository checkout, follow
[Development](#development). The npm package already includes the browser ESM
bundle at `build/d3-cloud.js`; consumers do not need to build it.

## Using With React

See [examples/react/README.md](./examples/react/README.md) for a minimal
Vite + React sample that runs the layout on the client and renders each placed
word as a clickable SVG link.

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
a fresh layout. Words placed before clearing can no longer be erased. Calling
`clear()` while `place()` is searching, for example from `random()` or a
strategy, throws an error.

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
The geometry describes the axis-aligned mask after rotation, relative to the
placement anchor. `x0` and `y0` are the inclusive left and top edges; `x1` and
`y1` are the exclusive right and bottom edges. Thus `width = x1 - x0` and
`height = y1 - y0`. A placed word's mask has a bounding rectangle from
`[word.x + word.x0, word.y + word.y0]` to
`[word.x + word.x1, word.y + word.y1]`.
For text the anchor is its horizontal center on the alphabetic baseline;
for images it is the center of the resized source image, before transparent
margins are trimmed. See [Rendering Placed Words](#rendering-placed-words).

Rasterization is the expensive step, so prepare a sprite once and place it as
many times as you like, in this or any other layout. Sprites are frozen and
can only be created by `getSprite()`. The `sprite` field is a copy of the
packed mask, a `Uint32Array` of `height` rows of `spriteWidth` bits each, with
the leftmost pixel in the most significant bit. Placement uses a private copy,
so changing it has no effect.
Sprites work with any layout from the same copy of d3-cloud, but the package
entry point and `build/d3-cloud.js` are separate copies whose sprites and
layouts cannot be mixed.

The optional *options* object may include `font`, `style`, `weight`, `rotate`,
`size`, `padding`, and `datum`. The defaults are `font: "serif"`,
`style: "normal"`, `weight: "normal"`, `size: 1`, `rotate: 0`, and
`padding: 1` (0 for images). `fontStyle`, `fontWeight`, and `fontSize` are
accepted as aliases. `font` and `style` are converted to strings, as is
`weight` unless it is a number.
Other option fields are ignored, and `null` is the same as no options.
Numeric options must be finite, and `padding` must not be negative. Text sizes
are truncated to whole pixels, and text smaller than 1 pixel returns `null`.
If the canvas rejects the resulting CSS font, for example an unquoted family
name starting with a digit or a weight above 1000, `getSprite()` throws rather
than rasterizing a mask in the canvas's previous font.

Use `datum` to carry your own data, such as the input word, a link, or an ID.
It is stored by reference on the sprite and on every word placed from it, and
is never read by the layout. If omitted, it is `undefined`. TypeScript preserves
that possibility when the options declare `datum` as optional; passing a
required `datum` infers its type directly.

Image sprites are extracted from the source alpha channel, so transparent
pixels are ignored automatically. For image sources, `options.width` and
`options.height` may be used to resize the image before extraction; if only one
dimension is provided, the other is derived from the source aspect ratio.
`options.text` sets the sprite's text, which defaults to the image's `alt`.
Images and videos use their intrinsic dimensions rather than their display size.
A loaded image without intrinsic dimensions, such as an SVG with only a
`viewBox`, is drawn at the given `width` and `height` if both are specified;
if the browser cannot draw it, for example because it is broken, `getSprite()`
returns `null`.

`padding` applies only to text. Image masks use the source alpha unchanged;
adding transparent margins does not create occupied padding pixels.

Text and image bounds are trimmed to nontransparent pixels, including text
padding. Packed rows are aligned internally without adding empty space to
reported bounds or bounded placement checks.
`null` can indicate empty text, an unloaded or empty image, or a raster exceeding
the 2048-pixel scratch dimensions. Load images and fonts before preparing sprites.
If drawing or reading the scratch canvas throws, for example because a
cross-origin image tainted it, the error is rethrown and the layout requests a
new canvas from its factory for later sprites; see [canvas](#canvas).
`getSprite()` throws if it is called while a sprite is being drawn to the same
canvas, for example from an image's property getter.

<a name="place" href="#place">#</a> <b>place</b>(<i>sprite</i>[, <i>options</i>])

Attempts to place *sprite* and returns a new placed word, or `null` if it could
not be placed. The sprite itself is not changed, so it can be placed again;
for example, this fills a fixed box with one word at decreasing sizes:

```js
layout.overflow(false);
for (let size = 80; size >= 8; size -= 4) {
  const sprite = layout.getSprite("fill", { size, font: "Impact" });
  while (sprite && layout.place(sprite)) {}
}
```

With the default `overflow(true)` the cloud can always grow, so a loop like
this would never end.

The placed word is a plain object with the sprite's `text`, `image`,
`imageWidth`, `imageHeight`, `font`, `style`, `weight`, `rotate`, `size`,
`padding`, `datum`, and trimmed geometry, plus the placed position `x` and `y`.
It is shallow and not a serialization format: an image word retains its
`image` source, which may be a DOM element, and `datum` is whatever you passed.
Before posting or serializing a word, omit anything that cannot be cloned.

If specified, the optional *options* object may include `x` and `y` to control
the initial placement attempt before the strategy search begins. Any omitted axis
still uses the normal seeded position from the centered half-size seed box
derived from `size()`. Explicit coordinates must be finite and within
±16,777,216, and are rounded down to integer pixels.

Once the layout has placed words, a new sprite's search envelope must overlap
the existing cloud's bounds. This envelope extends the mask's rectangle with
some horizontal slack for text and a few pixels on each side for images, so
words can sit beside the cloud while their occupied pixels remain separate.
With `overflow(false)`, the mask must also fit inside the fixed layout rectangle
defined by `size()`; this is distinct from the existing cloud's bounds.
If the initial position fails, the search starts from the nearest position
that satisfies these rectangle constraints. Pixel collisions are checked at
each candidate position.

If specified, `options.strategy` overrides the layout-level default strategy
for this placement only.

The returned `x` and `y` are the rendering anchor: the center of the resized
source image, or the horizontal center of text on its alphabetic baseline.
See [Rendering Placed Words](#rendering-placed-words) for canvas and SVG examples.

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

Each dimension must be from 0 to 16,777,216. If not specified, returns the
current layout size, which defaults to `[256, 256]`. Use `[0, 0]` together
with `overflow(true)` to start every word exactly at the origin without any
bounding box.

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

The `initial` argument is the `{x, y}` position the search starts from: the
seed for this placement, moved if necessary to the nearest position where the
sprite could be placed, as described under [place](#place).
`context` includes `size`, `aspectRatio`, `bounds`, `overflow`, and `random`.

Each generated candidate must be returned as `{x, y}` with finite coordinates,
which are rounded down to integer pixels. Returning `null` stops the search.
Built-in and custom strategies use the same bounded search. Candidates outside
the allowed anchor range are skipped without a collision check. Searches stop
when they travel too far from that range or exhaust a candidate budget, so
`null` does not prove that every free position has been tried. Custom generators
should return `null` when finished, and each call must return promptly: the
layout cannot interrupt a generator that never returns.

<details>
<summary>Search limits</summary>

The allowed anchor range is the inclusive integer rectangle computed from the
fixed layout rectangle (if overflow is disabled) and the existing cloud's
bounds, using the sprite's search envelope as described under [place](#place).
Let `minX`, `minY`, `maxX`, and `maxY` be the edges of that anchor range,
and `startX` and `startY` the clamped search origin. Using the search
envelope's width and height, define:

```text
reachX = max(startX - minX, maxX - startX)
reachY = max(startY - minY, maxY - startY)
limitX = reachX + envelopeWidth + 1
limitY = reachY + envelopeHeight + 1
```

The search ends when any of these occurs:

- An outside candidate is at least `limitX` from `startX` and at least `limitY`
  from `startY`.
- It has checked `max(100000, (maxX - minX + 1) * (maxY - minY + 1))`
  candidates inside the range without finding a placement.
- It encounters `max(100000, 4 * limitX * limitY)` consecutive candidates
  outside the range. An inside candidate resets this counter.

Repeated candidates count toward these budgets. A generator that moves away
along only one axis may therefore take many calls to terminate.

</details>

`aspectRatio` is the width of `size()` divided by its height, or 1 if either
is 0. The archimedean spiral is stretched to the aspect ratio, and the
rectangular spiral visits every point of a 4-pixel grid in rings shaped to it,
both up to 64:1; beyond that they would barely move along the shorter axis.

The built-in strategies are also exported as `archimedeanStrategy`,
`rectangularStrategy`, and `noneStrategy`, so callers do not need to use string
names. Use `noneStrategy` or `"none"` for a single-attempt placement that tries
only the seed position, not the nearest position where the sprite could be
placed.

If not specified, returns the current strategy factory, which defaults to the
built-in `archimedeanStrategy`.

<a name="random" href="#random">#</a> <b>random</b>([<i>random</i>])

If specified, sets the internal random number generator, used for selecting the
initial position of each sprite inside `size()`, and the
clockwise/counterclockwise direction of the built-in strategies during
placement. This must be a function returning a number in the range `[0, 1)`;
`place()` throws a `RangeError` without changing the layout if a seed is
outside it.

If not specified, returns the current random number generator, which defaults
to `Math.random`.

<a name="blocksize" href="#blocksize">#</a> <b>blockSize</b>([<i>size</i>])

If specified, sets the sparse block size used during placement, from 1 to
4096 pixels. Block sizes are rounded up to the next multiple of 32 pixels so
they align with the packed sprite representation. Changing the size throws an
error once words have been placed, until `clear()` is called. If not
specified, returns the current size, which defaults to `512`.

<a name="canvas" href="#canvas">#</a> <b>canvas</b>([<i>canvas</i>])

If specified, sets the **canvas** generator function, which is used internally
to rasterize text and images. This must be a function that returns a
canvas-like object. If not specified, returns the current generator function,
which defaults to:

```js
function() { return document.createElement("canvas"); }
```

In Node.js, supply a factory using a canvas implementation, as shown in
[Quick Start](#quick-start).

The canvas must provide a 2d context; otherwise `getSprite()` throws a
`TypeError`. The factory is called once, and again after a sprite fails to draw
or read back. If it returns the same canvas, that canvas is reset before reuse
by resizing it, which clears its pixels. Chrome and Safari also clear a
cross-origin taint when a canvas is resized, but Firefox does not, so return a
new canvas to recover from tainting in every browser, as the default factory
does. Layouts may share one canvas; a failure invalidates their
shared state until the canvas is reset or replaced. Nothing else should draw
to the scratch canvas.

## Benchmarks

See [BENCHMARKS.md](./BENCHMARKS.md) for reproducible v1/v2 comparisons,
placement counts, and limitations. Run `node benchmark.js --compare-v1`
after installing development dependencies. The v1 alias is a development
dependency and is not shipped as a runtime dependency.

## Development

From a repository checkout, install development dependencies and build the
browser bundle:

```sh
npm install
npm run build
```

Serve the repository root with a static file server and open `examples/`.
The build writes `build/d3-cloud.js`, an ESM module. Run `npm test` for the
regression and TypeScript checks, or `npm run check:package` for the full
packaging checks. See [RELEASING.md](./RELEASING.md) for the release checklist.
