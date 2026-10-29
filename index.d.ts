export type TextSource = string | number | boolean | String;

export interface ImageLike {
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
  alt?: string;
  src?: string;
  currentSrc?: string;
}

export interface BoundsPoint {
  x: number;
  y: number;
}

export type Bounds = [BoundsPoint, BoundsPoint];

export type RandomSource = () => number;

export interface CanvasLike {
  width: number;
  height: number;
  // Canvas implementations may accept different optional context settings.
  getContext(contextId: "2d"): unknown;
}

export type CanvasFactory = () => CanvasLike;

export interface PlaceOptions {
  x?: number;
  y?: number;
  strategy?: StrategyName | StrategyFactory;
}

export interface StrategySeed {
  x: number;
  y: number;
}

export interface StrategyContext {
  size: [number, number];
  aspectRatio: number;
  bounds: Bounds | null;
  overflow: boolean;
  random: RandomSource;
}

export type StrategyCandidate = { x: number; y: number } | null | undefined;
export type StrategyGenerator = () => StrategyCandidate;
export type StrategyFactory = (initial: StrategySeed, context: StrategyContext) => StrategyGenerator;
export type StrategyName = "archimedean" | "rectangular" | "none";

export interface BaseSpriteOptions {
  font?: string;
  fontStyle?: string;
  style?: string;
  fontWeight?: string | number;
  weight?: string | number;
  fontSize?: number;
  size?: number;
  rotate?: number;
  /** Text only; image masks use the source alpha without padding. */
  padding?: number;
}

export type SpriteMetadata = Record<string, unknown>;

export type TextSpriteOptions<T extends object = SpriteMetadata> = T & BaseSpriteOptions;

export type ImageSpriteOptions<T extends object = SpriteMetadata> = T & BaseSpriteOptions & {
  text?: string;
  width?: number;
  height?: number;
};

export type CloudSpriteOptions<T extends object = SpriteMetadata> = T & {
  text?: string;
  image?: ImageLike | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  font?: string;
  style?: string;
  weight?: string | number;
  rotate?: number;
  size?: number;
  padding?: number;
};

export type PlacedSprite<T extends object = SpriteMetadata> = Omit<T, keyof CloudSpriteBase<T>> & {
  text: string;
  image: ImageLike | null;
  imageWidth: number | null;
  imageHeight: number | null;
  font: string;
  style: string;
  weight: string | number;
  rotate: number;
  size: number;
  padding: number;
  x: number;
  y: number;
  width: number;
  height: number;
  trimX: number;
  trimY: number;
  trimWidth: number;
  trimHeight: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

declare class CloudSpriteBase<T extends object = SpriteMetadata> {
  constructor(options?: CloudSpriteOptions<T>);
  // Type-only marker retains metadata inference through subclasses.
  private readonly _metadata: T;

  text: string;
  image: ImageLike | null;
  imageWidth: number | null;
  imageHeight: number | null;
  font: string;
  style: string;
  weight: string | number;
  rotate: number;
  size: number;
  padding: number;
  x: number;
  y: number;
  hasPixels: boolean;
  width: number;
  height: number;
  spriteWidth: number;
  trimX: number;
  trimY: number;
  trimWidth: number;
  trimHeight: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sprite?: Uint32Array;

  rasterize(contextAndRatio: unknown): this;
}

// Built-in fields override metadata at runtime, including raster geometry.
// A bare CloudSprite accepts sprites with any metadata, including interface
// types that lack an index signature, so it defaults to {} rather than
// SpriteMetadata; annotate CloudSprite<T> to keep metadata fields.
type CloudSprite<T extends object = {}> =
  CloudSpriteBase<T> & Omit<T, keyof CloudSpriteBase<T>>;

declare const CloudSprite: {
  new<T extends object = SpriteMetadata>(options?: CloudSpriteOptions<T>): CloudSprite<T>;
  readonly prototype: CloudSpriteBase<object>;
};

declare class CloudLayout {
  constructor();

  canvas(): CanvasFactory;
  canvas(value: CanvasFactory): this;

  clear(): this;
  bounds(): Bounds | null;
  eraseSprite<T extends object = SpriteMetadata>(sprite: CloudSprite<T>): void;

  size(): [number, number];
  size(value: [number, number] | number): this;

  overflow(): boolean;
  overflow(value: boolean): this;

  strategy(): StrategyFactory;
  strategy(value: StrategyName | StrategyFactory): this;

  random(): RandomSource;
  random(value: RandomSource): this;

  blockSize(): number;
  blockSize(value: number): this;

  getSprite<T extends object = SpriteMetadata>(source: TextSource, options?: TextSpriteOptions<T>): CloudSprite<T> | null;
  getSprite<T extends object = SpriteMetadata>(source: ImageLike, options?: ImageSpriteOptions<T>): CloudSprite<T> | null;

  place<T extends object = SpriteMetadata>(sprite: CloudSprite<T>, options?: PlaceOptions): PlacedSprite<T> | null;
}

export default CloudLayout;
export function archimedeanStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function rectangularStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function noneStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export { CloudLayout, CloudSprite };
