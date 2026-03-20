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
};

export const LOCK_MODES = ["none", "origin", "com"] as const;
export type LockMode = (typeof LOCK_MODES)[number];

export const isLockMode = (value: unknown): value is LockMode =>
  value === "none" || value === "origin" || value === "com";

export type DiagnosticsSnapshot = {
  energy: number;
  momentum: Vec2;
};

export type PresetProfile = {
  id: string;
  name: string;
  description: string;
  bodies: BodyState[];
  params?: Partial<SimParams>;
};

export type WorldState = {
  bodies: BodyState[];
  elapsedTime: number;
  isRunning: boolean;
  ejectionCounterById: Record<string, number>;
  ejectedBodyId: string | null;
  ejectedBodyIds: string[];
  dissolutionCounterSec: number;
  dissolutionDetected: boolean;
  dissolutionJustDetected: boolean;
};
