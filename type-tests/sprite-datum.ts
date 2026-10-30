import CloudLayout, { CloudSprite, type PlacedSprite, type SpriteOptions, type ImageSpriteOptions } from "d3-cloud";

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

// Optional options cannot promise a datum that was never supplied.
const optionalOptions: SpriteOptions<WordDatum> = { size: 20 };
const optionalSprite = layout.getSprite("hello", optionalOptions)!;
const optionalDatum: WordDatum | undefined = optionalSprite.datum;
// @ts-expect-error datum may be missing even though its generic type is specified
optionalSprite.datum.id;
// @ts-expect-error placement must preserve the optional datum
layout.place(optionalSprite)!.datum.id;
// @ts-expect-error an explicit generic without options does not supply a datum
layout.getSprite<WordDatum>("hello")!.datum.id;
// @ts-expect-error null options do not supply a datum either
layout.getSprite<WordDatum>("hello", null)!.datum.id;
const explicitId: string = layout.getSprite<WordDatum>("hello", { datum })!.datum.id;
const requiredOptions: SpriteOptions<WordDatum> & { datum: WordDatum } = { datum };
const requiredId: string = layout.getSprite("hello", requiredOptions)!.datum.id;

const optionalImageOptions: ImageSpriteOptions<WordDatum> = { width: 20 };
const optionalImage = layout.getSprite(document.createElement("canvas"), optionalImageOptions)!;
// @ts-expect-error image options may also omit datum
optionalImage.datum.id;
declare const source: string | HTMLImageElement;
const optionalMixed = layout.getSprite(source, optionalImageOptions)!;
// @ts-expect-error text-or-image sources must preserve the optional datum
optionalMixed.datum.id;
const requiredMixedId: string = layout.getSprite(source, { datum })!.datum.id;
