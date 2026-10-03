import { createCanvas } from "canvas";
import CloudLayout, { type CanvasFactory } from "d3-cloud";

const nodeFactory: CanvasFactory = () => createCanvas(1, 1);
new CloudLayout().canvas(nodeFactory);
new CloudLayout().canvas(() => document.createElement("canvas"));
new CloudLayout().canvas(() => new OffscreenCanvas(1, 1));

// @ts-expect-error canvas dimensions must be numeric
new CloudLayout().canvas(() => ({ width: "1", height: 1, getContext: () => null }));
// @ts-expect-error a canvas must expose a 2D context
new CloudLayout().canvas(() => ({ width: 1, height: 1 }));
