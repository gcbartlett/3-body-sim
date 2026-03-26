export type Viewport = { width: number; height: number };

export type RenderOptions = {
  showOrigin: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  centerOfMass: { x: number; y: number };
};

export type TrailPoint = {
  x: number;
  y: number;
  life: number;
};

export type TrailMap = Record<string, TrailPoint[]>;
