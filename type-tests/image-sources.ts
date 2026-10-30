import { createCanvas, Image } from "canvas";
import CloudLayout from "d3-cloud";

const layout = new CloudLayout();

// node-canvas images and canvases are image sources.
const nodeImage = layout.getSprite(new Image(), { width: 20, height: 20 });
const nodeCanvas = layout.getSprite(createCanvas(10, 10));

// Placed image words keep the source type, so they can be drawn directly.
const element = document.createElement("img");
const word = layout.place(layout.getSprite(element)!)!;
if (word.image) {
  document.createElement("canvas").getContext("2d")!.drawImage(word.image, word.x, word.y);
}
const bitmapSprite = (bitmap: ImageBitmap) => layout.getSprite(bitmap);
const videoSprite = layout.getSprite(document.createElement("video"));

// A source that may be text or an image.
declare const source: string | HTMLImageElement;
const mixed = layout.getSprite(source, { datum: { id: 1 } });
const mixedId: number | undefined = mixed?.datum.id;

// Text sprites have no image.
const textImage: null = layout.getSprite("text")!.image;

// Sizes may be readonly tuples.
const size = [960, 500] as const;
layout.size(size);

// Options may be null, as at runtime.
layout.place(layout.getSprite("text", null)!, null);

// @ts-expect-error plain objects with only dimensions are not drawable
layout.getSprite({ width: 10, height: 10 });
