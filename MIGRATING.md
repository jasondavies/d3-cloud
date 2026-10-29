# Migrating from d3-cloud 1.x to 2.x

Version 2 replaces the factory and event API with an ESM class and explicit
sprite placement. It requires application changes; changing the dependency
version alone is not enough. Existing applications can stay on 1.x while they
migrate.

## Staying on 1.x

Dependencies such as `^1.2.9`, `~1.2.9`, and `1.x` exclude 2.0.0. A fresh
install using those ranges will still select 1.x. Open-ended ranges such as
`*` and `>=1`, the `latest` tag, and unversioned CDN URLs do not provide that
boundary. See [npm's range rules](https://github.com/npm/node-semver#ranges).

To keep the old API:

```sh
npm install d3-cloud@^1.2.9
```

Pin legacy browser scripts to a version, including the old bundle filename:

```html
<script src="https://unpkg.com/d3-cloud@1.2.9/build/d3.layout.cloud.js"></script>
```

If a wrapper library depends on d3-cloud 1.x, let it retain that dependency
until the wrapper supports v2. Do not force v2 into it with npm `overrides` or
Yarn `resolutions`. Your own application can use v2 alongside a wrapper's v1.
Commit your application's lockfile as well as its dependency range.

## Imports and browser scripts

Replace the old factory import or `require("d3-cloud")` with:

```js
import CloudLayout from "d3-cloud";

const layout = new CloudLayout();
```

The package does not expose a CommonJS `require` entry point. A CommonJS
application can use `await import("d3-cloud")` inside an async function, but
must still migrate its layout calls. Wrappers that publish CommonJS output
must check whether their build turns imports back into `require` calls.

For a browser without a bundler, use a module script and the new bundle path:

```html
<script type="module">
  import CloudLayout from "./build/d3-cloud.js";
  const layout = new CloudLayout();
</script>
```

This relative path assumes you serve the package's `build` directory beside
the page. For a CDN, use the same `build/d3-cloud.js` path and pin the exact
published v2 version. The old `build/d3.layout.cloud.js` file and the
`d3.layout.cloud` global are not provided by v2.

## Replacing a typical layout

Given input objects with `text` and `value`, a typical v1 layout looks like:

```js
import cloud from "d3-cloud";

cloud()
  .size([640, 400])
  .words(words)
  .font("Impact")
  .fontSize(d => Math.sqrt(d.value))
  .rotate(() => 0)
  .padding(1)
  .on("end", draw)
  .start();
```

In v2, compute styling, sort by size, and place each sprite yourself:

```js
import CloudLayout from "d3-cloud";

const layout = new CloudLayout()
  .size([640, 400])
  .overflow(false);

const prepared = words.map((datum, index) => ({
  datum,
  index,
  text: datum.text,
  size: Math.max(0, Math.trunc(Math.sqrt(datum.value)))
})).sort((a, b) => b.size - a.size);

const placed = [];
for (const word of prepared) {
  const sprite = layout.getSprite(word.text, {
    datum: word,
    font: "Impact",
    size: word.size,
    rotate: 0,
    padding: 1
  });
  if (!sprite) continue;

  const result = layout.place(sprite);
  if (result) placed.push(result);
}

draw(placed, layout.bounds());
```

`draw` is your renderer. The example passes the prepared word, which holds the
original object and its index, as `datum`, so event handlers can associate
each placed word with its input via `result.datum`. Put IDs, URLs, and other
data in `datum` too; other option fields are ignored rather than copied.

Both `getSprite()` and `place()` can return `null`. The former means the source
could not produce a sprite; the latter means placement failed. Neither means
that the whole layout should be discarded.

## API mapping

| 1.x | 2.x |
| --- | --- |
| `cloud()` | `new CloudLayout()` |
| `.words(words).start()` | Loop over `getSprite()` and `place()` |
| `.text(accessor)` | Evaluate the accessor and pass its result to `getSprite()` |
| `.font()`, `.fontStyle()`, `.fontWeight()` | Per-sprite `font`, `style`, `weight` options |
| `.fontSize()`, `.rotate()`, `.padding()` | Per-sprite `size`, `rotate`, `padding` options |
| `.on("word", listener)` | Call the listener after a successful `place()` |
| `.on("end", listener)` | Call the listener after your loop, with results and `layout.bounds()` |
| `.stop()`, `.timeInterval()` | Own the scheduling and cancellation, or use a worker |
| `.spiral("rectangular")` | `.strategy("rectangular")` |
| `.random(fn)` | `.random(fn)`; placement sequences can change |
| `.canvas(factory)` | `.canvas(factory)`; a factory function is required |
| Calling `.start()` again | `layout.clear()`, or construct a new layout |

The `getSprite()` options also accept `fontSize`, `fontStyle`, and `fontWeight`
as aliases. They take evaluated values, not accessor functions. If accessors
depend on the original array index, evaluate them before sorting.

## Defaults, coordinates, and rendering

- V1 sorted words by descending font size. V2 follows your placement order.
- V1 derived the default font size from `Math.sqrt(d.value)` and chose random
  rotations in 30-degree steps. V2 defaults to `size: 1` and `rotate: 0`.
  Set these explicitly when migrating.
- V1 bounded placement to `size()`. V2 defaults to `overflow(true)`;
  use `overflow(false)` to keep the old bounded behavior.
- V2 places words and reports bounds in coordinates centered on `[0, 0]`.
  V1's final words were already centered, but its `end` bounds used the
  top-left board coordinate system. Remove any old half-size subtraction
  applied specifically to bounds. In v2, words and bounds share an origin.
- Existing SVG groups translated to `[width / 2, height / 2]` can still render
  centered word positions. Alternatively, use a centered `viewBox`.
- Render text centered horizontally at `(word.x, word.y)`, using the normal
  alphabetic baseline. Use SVG `text-anchor="middle"`, or canvas
  `textAlign = "center"` and `textBaseline = "alphabetic"`. Apply rotation
  around that position and use the returned font, style, weight, and size.
  Remove any application-specific vertical offset used to compensate for
  the old rasterizer; check the result visually.
- Explicit placement coordinates and custom strategy candidates are floored
  to whole pixels. Reusing the same random seed does not guarantee the same
  layout as v1; packing and rasterization have changed.

See the [rendering examples](./README.md#rendering-placed-words) and test with
your real fonts, rotations, long words, and fixed-size containers. Ensure fonts
are loaded before creating sprites; see the
[font-loading example](./examples/font-loading.js).

## Data ownership and repeated layouts

V1 wrote placement properties onto the input word objects. V2 rasterizes each
source into an immutable `CloudSprite`, and each successful `place()` returns a
new plain placed word. Use those results for rendering rather than expecting
`words` to be mutated. `datum` is stored by reference, so it keeps its identity.

`place()` adds to existing occupancy. Use `clear()` before a fresh layout.
For incremental removal, keep the placed word returned by `place()` and pass it
to `erase()`. Sprites have no position, so the same sprite can be placed any
number of times, in one layout or several.

Create a new sprite when its text, font, size, padding, or rotation changes;
sprites cannot be modified. After an erasure, `bounds()` may remain
conservative until the layout becomes empty. Rebuild the layout if you need
tight bounds for a fresh set of words.

## Scheduling, React, and workers

`getSprite()` and `place()` are synchronous. A large loop can block the UI.
V2 does not supply the old timer, time budget, event dispatch, or `stop()` API.

For modest inputs, run the loop and update the UI once. For progressive work,
process a batch of words and yield with `requestAnimationFrame` or a timer
before continuing. Keep a cancellation flag or request ID and check it between
batches. Yield around rasterization as well as placement. A single `place()`
call cannot be interrupted by that flag.

For larger jobs, see the [worker example](./examples/worker.html). A worker can
use `.canvas(() => new OffscreenCanvas(1, 1))`; placed text words can be
posted back if their `datum` is also structured-cloneable. Keep prepared
sprites and the layout in the worker. Terminate the worker for immediate
cancellation, or ignore results from superseded requests.

In React, create a new layout in an effect when inputs change and store the
returned placed words in state. If you schedule batches or use workers, cancel
pending work in the effect cleanup. The default canvas factory needs a DOM;
run on the client or supply a suitable canvas implementation. See the
[React example](./examples/react/README.md).

## Node.js and TypeScript

V2 requires Node.js 20 or newer, matching the minimum tested CI version.

Node.js still needs a canvas implementation:

```js
import CloudLayout from "d3-cloud";
import { createCanvas } from "canvas";

const layout = new CloudLayout().canvas(() => createCanvas(1, 1));
```

V2 includes its own TypeScript declarations. Remove a direct dependency on
`@types/d3-cloud` when migrating your code to v2; a wrapper still using v1 may
retain its own types. Replace old `Cloud` / `Word` types and local
`declare module "d3-cloud"` shims with the exported `CloudLayout`,
`CloudSprite`, `PlacedSprite`, and `Bounds` types as appropriate. Both are
generic in the type of `datum`, which is inferred from `getSprite()` options. Prefer a
current module resolution mode that understands package `exports`, such as
`node16`, `nodenext`, or `bundler`, as appropriate to your build.

## Custom spirals

A v1 custom spiral received `size` and returned offsets for a supplied `t`.
A v2 strategy receives `(initial, context)` and returns a no-argument generator
of absolute `{x, y}` candidates. Returning `null` ends the search. Adapt an
existing spiral explicitly:

```js
function adaptSpiral(spiral) {
  return (initial, context) => {
    const offset = spiral(context.size);
    const direction = context.random() < 0.5 ? 1 : -1;
    let t = -direction;
    return () => {
      const point = offset(t += direction);
      return point ? {
        x: initial.x + Math.trunc(point[0]),
        y: initial.y + Math.trunc(point[1])
      } : null;
    };
  };
}
```

Pass `adaptSpiral(yourSpiral)` to `.strategy()`. The initial seed is tried
before the strategy is called, and v2 derives its own search limit. This
adapts the interface without promising identical v1 placement.
