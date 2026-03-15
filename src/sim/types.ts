export type Vec2 = {
  x: number;
  y: number;
};

export type BodyConfig = {
  id: string;
  mass: number;
  position: Vec2;
  velocity: Vec2;
  color: string;
};

export type BodyState = BodyConfig;

export type SimParams = {
  G: number;
  dt: number;
  speed: number;
  softening: number;
  trailFade: number;
  ejectionDistanceMultiplier: number;
  ejectionFramesThreshold: number;
};

export type WorldState = {
  bodies: BodyState[];
  elapsedTime: number;
  isRunning: boolean;
  ejectionCounterById: Record<string, number>;
  ejectedBodyId: string | null;
};
