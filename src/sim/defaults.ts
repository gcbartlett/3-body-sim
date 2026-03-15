import type { BodyConfig, SimParams, WorldState } from "./types";

export const defaultBodies = (): BodyConfig[] => [
  {
    id: "body-1",
    mass: 1,
    position: { x: -1.0, y: 0.0 },
    velocity: { x: 0.347, y: 0.532 },
    color: "#f7b731",
  },
  {
    id: "body-2",
    mass: 1,
    position: { x: 1.0, y: 0.0 },
    velocity: { x: 0.347, y: 0.532 },
    color: "#60a5fa",
  },
  {
    id: "body-3",
    mass: 1,
    position: { x: 0.0, y: 0.0 },
    velocity: { x: -0.694, y: -1.064 },
    color: "#8bd450",
  },
];

export const defaultParams = (): SimParams => ({
  G: 1,
  dt: 0.005,
  speed: 1,
  softening: 0.02,
  trailFade: 0.05,
  ejectionDistanceMultiplier: 8,
  ejectionFramesThreshold: 120,
});

export const initialWorld = (): WorldState => ({
  bodies: defaultBodies(),
  elapsedTime: 0,
  isRunning: false,
  ejectionCounterById: {},
  ejectedBodyId: null,
});
