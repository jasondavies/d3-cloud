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
  .map((word, index) => layout.getSprite(word.text, {
    ...word,
    index,
    font: "Impact",
    padding: 1,
    rotate: 0
  }))
  .filter(Boolean);
const placed = layout.placeAll(sprites);
```

Run `npm run build` to generate the browser bundle at `build/d3-cloud.js`,
which exports the layout as an ESM module for browser use.

Placement uses sparse packed occupancy blocks for collision checks, so the
final cloud uses `size()` both as the initial seed box and as the aspect ratio
hints for the built-in spirals. By default, `overflow(true)` allows placement
to extend beyond that centered size box; switch to `overflow(false)` for a
bounded layout. Word order is controlled by the caller; in most cases you
will want to place larger words first.

## API Reference

<a name="cloudlayout" href="#cloudlayout">#</a> <b>new CloudLayout()</b>

Constructs a new cloud layout instance.

<a name="clear" href="#clear">#</a> <b>clear</b>()

Clears the current placement state and bounds so the instance can be reused for
a fresh layout.

<a name="bounds" href="#bounds">#</a> <b>bounds</b>()

Returns the current placement extent as `[{x, y}, {x, y}]`, or `null` if no
words have been placed yet.

<a name="place" href="#place">#</a> <b>place</b>(<i>sprite</i>[, <i>options</i>])

Attempts to place a single prepared `CloudSprite` immediately and returns the
placed derived word object, or `null` if it could not be placed.

If specified, the optional *options* object may include `x` and `y` to control
the initial placement attempt before the spiral search begins. Any omitted axis
still uses the normal seeded position from `size()`.

<a name="getsprite" href="#getsprite">#</a> <b>getSprite</b>(<i>source</i>[, <i>options</i>])

Builds and returns a `CloudSprite` for the specified text or image-like source,
or `null` if it could not be rasterized into the internal scratch canvas.

The optional *options* object may include `font`, `style`, `weight`, `rotate`,
`size`, `padding`, `index`, and any additional fields you want accessor
fields to carry through to the resulting sprite. The defaults are `font:
"serif"`, `style: "normal"`, `weight: "normal"`, `size: 1`, `rotate: 0`, and
`padding: 1`.

Image sprites are extracted from the source alpha channel, so transparent
pixels are ignored automatically. For image sources, `options.width` and
`options.height` may be used to resize the image before extraction; if only one
dimension is provided, the other is derived from the source aspect ratio.

<a name="placeall" href="#placeall">#</a> <b>placeAll</b>(<i>sprites</i>)

Attempts to place the specified batch of prepared sprites, in the order
provided, and places each one synchronously.

Returns an array containing only the successfully placed derived word objects.
The supplied `CloudSprite` instances are reused for placement; the returned
objects are plain placed-word snapshots with `sprite` omitted.

Words that cannot be placed are simply omitted from the returned array. To
spread work across frames, call `getSprite()`, `place()`, or `placeAll()`
yourself with smaller batches.

<a name="size" href="#size">#</a> <b>size</b>([<i>size</i>])

If specified, sets the centered layout size as `[width, height]`. This size is
used both for the initial random seed box and for the aspect ratio of the
built-in `"archimedean"` and `"rectangular"` spirals.

If not specified, returns the current layout size, which defaults to
`[256, 256]`. Use `[0, 0]` together with `overflow(true)` to start every word
exactly at the origin without any bounding box.

<a name="overflow" href="#overflow">#</a> <b>overflow</b>([<i>overflow</i>])

If specified, enables or disables overflow beyond `size()`. When `true`, the
layout may expand beyond the centered `size()` box, which is then used only for
seeding and spiral shaping. When `false`, placement is bounded to that centered
box and `place()` returns `null` if no in-bounds position is found.

If not specified, returns the current overflow mode, which defaults to `true`.

<a name="spiral" href="#spiral">#</a> <b>spiral</b>([<i>spiral</i>])

If specified, sets the current type of spiral used for positioning words.  This
can either be one of the two built-in spirals, "archimedean" and "rectangular",
or an arbitrary spiral generator can be used, of the following form:

```js
function(aspectRatio) {
  // t indicates the current step along the spiral; it may monotonically
  // increase or decrease indicating clockwise or counterclockwise motion.
  return function(t) { return [x, y]; };
}
```

If not specified, returns the current spiral generator, which defaults to the
built-in "archimedean" spiral.

<a name="random" href="#random">#</a> <b>random</b>([<i>random</i>])

If specified, sets the internal random number generator, used for selecting the
initial position of each sprite inside `size()`, and the
clockwise/counterclockwise direction of the spiral during placement. This
should return a number in the range `[0, 1)`.

If not specified, returns the current random number generator, which defaults
to `Math.random`.

<a name="blockSize" href="#blockSize">#</a> <b>blockSize</b>([<i>size</i>])

If specified, sets the sparse block size used during placement. Block sizes
are rounded up to the next multiple of 32 pixels so they align with the
packed sprite representation. If not specified, returns the current size,
which defaults to `512`.

<a name="maxDelta" href="#maxDelta">#</a> <b>maxDelta</b>([<i>distance</i>])

If specified, sets the maximum spiral delta used while searching for a
placement. If not specified, returns the current limit. By default, this grows
with the current word and the extent of the words already placed.

<a name="canvas" href="#canvas">#</a> <b>canvas</b>([<i>canvas</i>])

If specified, sets the **canvas** generator function, which is used internally
to draw text.  If not specified, returns the current generator function, which
defaults to:

```js
function() { return document.createElement("canvas"); }
```

When using Node.js, you will almost definitely override this default, e.g.
using the [canvas module](https://www.npmjs.com/package/canvas).
