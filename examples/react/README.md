# React Example

This sample shows the smallest typical React integration:

- run the layout once on the client inside `useEffect()`
- use about 200 short labels so the cloud looks reasonably full
- store the placed words in component state
- render them as SVG text
- make each word clickable by passing `href` through `getSprite(..., options)`

The example uses `overflow(false)` so the cloud stays inside a fixed SVG
viewport and avoids extra bounds bookkeeping.

## Run

```sh
cd examples/react
npm install
npm run dev
```

This example depends on the local checkout via `"d3-cloud": "file:../.."`, so
it exercises the code in this repository rather than a published package.
