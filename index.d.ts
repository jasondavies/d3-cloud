export type TextSource = string | number | boolean | String;

/**
 * A drawable image source with numeric dimensions: an image element (or
 * node-canvas `Image`), a video element, a canvas, or an `ImageBitmap`.
 */
export type ImageLike =
  | { naturalWidth: number; naturalHeight: number }
  | { videoWidth: number; videoHeight: number }
  | { width: number; height: number; getContext(contextId: "2d", ...args: any[]): unknown }
  | { width: number; height: number; close(): void };

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

export interface SpriteOptions<D = undefined> {
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
  /** Carried by reference to the sprite and every word placed from it. */
  datum?: D;
}

export interface ImageSpriteOptions<D = undefined> extends SpriteOptions<D> {
  text?: string;
  width?: number;
  height?: number;
}

interface SpriteFields<D, I extends ImageLike> {
  text: string;
  /** The image source passed to `getSprite()`, or null for text. */
  image: I | null;
  imageWidth: number | null;
  imageHeight: number | null;
  font: string;
  style: string;
  weight: string | number;
  rotate: number;
  size: number;
  padding: number;
  datum: D;
  width: number;
  height: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  trimX: number;
  trimY: number;
  trimWidth: number;
  trimHeight: number;
}

/** A plain object describing one successful placement. */
export interface PlacedSprite<D = unknown, I extends ImageLike = ImageLike> extends SpriteFields<D, I> {
  x: number;
  y: number;
}

/**
 * An immutable, rasterized mask created by `CloudLayout.getSprite()`. The
 * same sprite can be placed any number of times.
 */
declare class CloudSprite<D = unknown, I extends ImageLike = ImageLike> implements Readonly<SpriteFields<D, I>> {
  private constructor();

  readonly text: string;
  readonly image: I | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly font: string;
  readonly style: string;
  readonly weight: string | number;
  readonly rotate: number;
  readonly size: number;
  readonly padding: number;
  readonly datum: D;
  readonly width: number;
  readonly height: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly trimWidth: number;
  readonly trimHeight: number;
  readonly spriteWidth: number;
  /** A copy of the mask; changing it does not affect placement. */
  readonly sprite: Uint32Array;
}

declare class CloudLayout {
  constructor();

  canvas(): CanvasFactory;
  canvas(value: CanvasFactory): this;

  clear(): this;
  bounds(): Bounds | null;
  erase(word: PlacedSprite<unknown, ImageLike>): void;

  size(): [number, number];
  size(value: readonly [number, number] | number): this;

  overflow(): boolean;
  overflow(value: boolean): this;

  strategy(): StrategyFactory;
  strategy(value: StrategyName | StrategyFactory): this;

  random(): RandomSource;
  random(value: RandomSource): this;

  blockSize(): number;
  blockSize(value: number): this;

  getSprite<D = undefined>(source: TextSource, options?: SpriteOptions<D> | null): CloudSprite<D, never> | null;
  getSprite<D = undefined, I extends ImageLike = ImageLike>(source: I, options?: ImageSpriteOptions<D> | null): CloudSprite<D, I> | null;
  getSprite<D = undefined, I extends ImageLike = ImageLike>(source: TextSource | I, options?: ImageSpriteOptions<D> | null): CloudSprite<D, I> | null;

  place<D, I extends ImageLike>(sprite: CloudSprite<D, I>, options?: PlaceOptions | null): PlacedSprite<D, I> | null;
}

export default CloudLayout;
export function archimedeanStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function rectangularStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function noneStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export { CloudLayout, CloudSprite };
