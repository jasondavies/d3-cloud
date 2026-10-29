import CloudLayout, { CloudSprite, type PlacedSprite } from "d3-cloud";

const layout = new CloudLayout();
const sprite = layout.getSprite("hello", {
  size: 20,
  datum: { href: "/hello", count: 3 }
})!;

const href: string = sprite.datum.href;
const count: number = sprite.datum.count;
const word = layout.place(sprite)!;
const placedHref: string = word.datum.href;
const placedCount: number = word.datum.count;
const x: number = word.x;
layout.erase(word);

// The same immutable sprite can be placed again.
const again: PlacedSprite<{ href: string; count: number }> = layout.place(sprite)!;

// A bare CloudSprite or PlacedSprite accepts any datum.
const sprites: CloudSprite[] = [sprite];
const anyWord: PlacedSprite | null = layout.place(sprites[0]);
const unknownDatum: unknown = sprites[0].datum;

// Sprites without a datum carry undefined.
const plain = layout.getSprite("plain")!;
const plainDatum: undefined = plain.datum;
const plainWord: PlacedSprite<undefined> = layout.place(plain)!;

// Interfaces and primitives work as data without an index signature.
interface WordDatum {
  id: string;
  value: number;
}
const datum: WordDatum = { id: "interface", value: 7 };
const fromInterface = layout.getSprite("hello", { datum })!;
const interfaceId: string = fromInterface.datum.id;
const interfaceValue: number = layout.place(fromInterface)!.datum.value;
const primitive: number = layout.getSprite("n", { datum: 42 })!.datum;

const image = layout.getSprite(document.createElement("canvas"), {
  width: 7,
  height: 9,
  text: "icon",
  datum: { src: "/image.png" }
})!;
const imageSrc: string = image.datum.src;
const imageWidth: number | null = layout.place(image)!.imageWidth;

if (sprites[0] instanceof CloudSprite) {
  const narrowed: number = sprites[0].width;
}

// Placed words are plain objects; erasure does not depend on their fields.
plainWord.x = 10;
layout.erase(plainWord);

// @ts-expect-error datum fields keep their types
const numericHref: number = sprite.datum.href;
// @ts-expect-error datum does not include this field
sprite.datum.missing;
// @ts-expect-error interface fields keep their declared types
const stringValue: string = fromInterface.datum.value;
// @ts-expect-error sprites are immutable
sprite.size = 10;
// @ts-expect-error sprites are only created by getSprite()
new CloudSprite();
// @ts-expect-error erase() takes the placed word, not the sprite
layout.erase(sprite);
// @ts-expect-error sprite options must be objects
layout.getSprite("hello", 123);
