import type { SimParams, WorldState } from "./types";
import { centerOfMass, specificOrbitalEnergy, systemScale } from "./physics";
import { magnitude, sub } from "./vector";

export const evaluateEjection = (
  world: WorldState,
  params: SimParams,
): Pick<WorldState, "ejectionCounterById" | "ejectedBodyId" | "isRunning"> => {
  const com = centerOfMass(world.bodies);
  const scaleNow = systemScale(world.bodies, com);

  const updatedCounters: Record<string, number> = { ...world.ejectionCounterById };
  let ejectedBodyId: string | null = null;

  for (let i = 0; i < world.bodies.length; i += 1) {
    const body = world.bodies[i];
    const distFromCom = magnitude(sub(body.position, com));
    const farThreshold = scaleNow * params.ejectionDistanceMultiplier;
    const energy = specificOrbitalEnergy(i, world.bodies, params);
    const isPotentiallyEscaping = distFromCom > farThreshold && energy > 0;

    const previous = updatedCounters[body.id] ?? 0;
    const next = isPotentiallyEscaping ? previous + 1 : 0;
    updatedCounters[body.id] = next;

    if (next >= params.ejectionFramesThreshold && ejectedBodyId === null) {
      ejectedBodyId = body.id;
    }
  }

  return {
    ejectionCounterById: updatedCounters,
    ejectedBodyId,
    isRunning: ejectedBodyId ? false : world.isRunning,
  };
};
