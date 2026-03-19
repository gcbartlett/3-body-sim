import type { BodyState, WorldState } from "./types";

const cloneBodies = (bodies: BodyState[]): BodyState[] =>
  bodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));

export const createStoppedWorld = (bodies: BodyState[]): WorldState => ({
  bodies: cloneBodies(bodies),
  elapsedTime: 0,
  isRunning: false,
  ejectionCounterById: {},
  ejectedBodyId: null,
  ejectedBodyIds: [],
  dissolutionCounterSec: 0,
  dissolutionDetected: false,
  dissolutionJustDetected: false,
});
