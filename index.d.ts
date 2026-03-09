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
  getContext(contextId: "2d", options?: { willReadFrequently?: boolean }): unknown;
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
  padding?: number;
}

export type SpriteMetadata = Record<string, unknown>;

export type TextSpriteOptions<T extends SpriteMetadata = SpriteMetadata> = T & BaseSpriteOptions;

export type ImageSpriteOptions<T extends SpriteMetadata = SpriteMetadata> = T & BaseSpriteOptions & {
  text?: string;
  width?: number;
  height?: number;
};

export type CloudSpriteOptions<T extends SpriteMetadata = SpriteMetadata> = T & {
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

export type PlacedSprite<T extends SpriteMetadata = SpriteMetadata> = T & {
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

declare class CloudSprite<T extends SpriteMetadata = SpriteMetadata> {
  constructor(options?: CloudSpriteOptions<T>);

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

declare class CloudLayout {
  constructor();

  canvas(): CanvasFactory;
  canvas(value: CanvasFactory): this;

  clear(): this;
  bounds(): Bounds | null;
  eraseSprite<T extends SpriteMetadata = SpriteMetadata>(sprite: CloudSprite<T>): void;

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

  getSprite<T extends SpriteMetadata = SpriteMetadata>(source: TextSource, options?: TextSpriteOptions<T>): CloudSprite<T> | null;
  getSprite<T extends SpriteMetadata = SpriteMetadata>(source: ImageLike, options?: ImageSpriteOptions<T>): CloudSprite<T> | null;

  place<T extends SpriteMetadata = SpriteMetadata>(sprite: CloudSprite<T>, options?: PlaceOptions): PlacedSprite<T> | null;
}

export default CloudLayout;
export function archimedeanStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function rectangularStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export function noneStrategy(initial: StrategySeed, context: StrategyContext): StrategyGenerator;
export { CloudLayout, CloudSprite };
