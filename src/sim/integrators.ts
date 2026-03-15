import type { BodyState, SimParams } from "./types";
import { computeAccelerations } from "./physics";
import { add, scale } from "./vector";

export const velocityVerletStep = (
  bodies: BodyState[],
  params: SimParams,
): BodyState[] => {
  const dt = params.dt;
  const acc0 = computeAccelerations(bodies, params);

  const predicted = bodies.map((body, i) => {
    const nextPosition = add(
      add(body.position, scale(body.velocity, dt)),
      scale(acc0[i], 0.5 * dt * dt),
    );
    return {
      ...body,
      position: nextPosition,
    };
  });

  const acc1 = computeAccelerations(predicted, params);
  return predicted.map((body, i) => {
    const averageAcceleration = scale(add(acc0[i], acc1[i]), 0.5);
    return {
      ...body,
      velocity: add(bodies[i].velocity, scale(averageAcceleration, dt)),
    };
  });
};
