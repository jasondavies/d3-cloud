import CloudLayout, { CloudSprite, type PlacedSprite } from "d3-cloud";

const layout = new CloudLayout();
const sprite = layout.getSprite("hello", {
  size: 20,
  href: "/hello",
  datum: { count: 3 }
})!;

const href: string = sprite.href;
const count: number = sprite.datum.count;
const rasterizedHref: string = sprite.rasterize({}).href;
const snapshot = layout.place(sprite)!;
const placedHref: string = snapshot.href;
const placedCount: number = snapshot.datum.count;
layout.eraseSprite(sprite);
const sprites: CloudSprite[] = [sprite];
const genericSnapshot = layout.place(sprites[0]);

// Metadata must retain its inferred type, rather than becoming any.
// @ts-expect-error href is a string
const numericHref: number = sprite.href;
// @ts-expect-error metadata does not include this field
sprite.missing;
// @ts-expect-error datum.count is a number
const stringCount: string = snapshot.datum.count;

type Metadata = { id: string; datum: { count: number } };
const constructed: CloudSprite<Metadata> = new CloudSprite({
  text: "constructed",
  id: "one",
  datum: { count: 4 }
});
const constructedId: string = constructed.id;
const constructedSnapshot: PlacedSprite<Metadata> = layout.place(constructed)!;
const inferred = new CloudSprite({ text: "inferred", href: "/inferred" });
const inferredHref: string = inferred.href;
if (inferred instanceof CloudSprite) {
  const narrowedHref: string = inferred.href;
}
class TaggedSprite extends CloudSprite<{ tag: string }> {}
const tagged = new TaggedSprite({ text: "subclass", tag: "example" });
const tag: string = tagged.tag;
const placedTag: string = layout.place(tagged)!.tag;

const image = layout.getSprite(document.createElement("canvas"), {
  width: 7,
  height: 9,
  imageHref: "/image.png"
})!;
const imageHref: string = image.imageHref;
const imageSnapshotHref: string = layout.place(image)!.imageHref;

// Runtime geometry overwrites reserved names supplied as custom metadata.
const reserved = layout.getSprite("reserved", { x: "input", width: "input", href: "/reserved" })!;
const x: number = reserved.x;
const width: number = reserved.width;
const placedX: number = layout.place(reserved)!.x;
const reservedHref: string = reserved.href;
// @ts-expect-error x is normalized to a number
const stringX: string = reserved.x;
// @ts-expect-error width is raster geometry, not the metadata string
const stringWidth: string = layout.place(reserved)!.width;

interface WordMetadata {
  id: string;
  datum: { count: number };
}
const metadata: WordMetadata = { id: "interface", datum: { count: 7 } };
const fromInterface = layout.getSprite("hello", metadata)!;
const explicitInterface: CloudSprite<WordMetadata> = layout.getSprite<WordMetadata>("hello", metadata)!;
const interfaceId: string = fromInterface.id;
const interfaceCount: number = layout.place(fromInterface)!.datum.count;
const interfaceSnapshot: PlacedSprite<WordMetadata> = layout.place(explicitInterface)!;
const interfaceImage = layout.getSprite(document.createElement("canvas"), metadata)!;
const interfaceImageId: string = interfaceImage.id;
const constructedInterface = new CloudSprite<WordMetadata>(metadata);
const interfaceSprites: CloudSprite[] = [constructedInterface];
class InterfaceSprite extends CloudSprite<WordMetadata> {}
const subclassId: string = layout.place(new InterfaceSprite(metadata))!.id;
// @ts-expect-error interface fields keep their declared types
const interfaceStringCount: string = fromInterface.datum.count;
// @ts-expect-error metadata options must be objects
layout.getSprite("hello", 123);
