import type { BodyState, SimParams, Vec2 } from "./types";
import { add, magnitude, magnitudeSquared, scale, sub } from "./vector";

export const computeAccelerations = (bodies: BodyState[], params: SimParams): Vec2[] => {
  const accelerations: Vec2[] = bodies.map(() => ({ x: 0, y: 0 }));
  const eps2 = params.softening * params.softening;

  for (let i = 0; i < bodies.length; ++i) {
    for (let j = 0; j < bodies.length; ++j) {
      if (i === j) {
        continue;
      }

      const ri = bodies[i].position;
      const rj = bodies[j].position;
      const displacement = sub(rj, ri);
      const distSq = magnitudeSquared(displacement) + eps2;
      const invDist = 1 / Math.sqrt(distSq);
      const invDistCubed = invDist / distSq;
      const factor = params.G * bodies[j].mass * invDistCubed;
      accelerations[i] = add(accelerations[i], scale(displacement, factor));
    }
  }

  return accelerations;
};

export const centerOfMass = (bodies: BodyState[]): Vec2 => {
  const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
  if (totalMass <= 0) {
    return { x: 0, y: 0 };
  }
  const weighted = bodies.reduce(
    (sum, body) => add(sum, scale(body.position, body.mass)),
    { x: 0, y: 0 },
  );
  return scale(weighted, 1 / totalMass);
};

export const totalEnergy = (bodies: BodyState[], params: SimParams): number => {
  const kinetic = bodies.reduce(
    (sum, body) => sum + 0.5 * body.mass * magnitudeSquared(body.velocity),
    0,
  );

  let potential = 0;
  for (let i = 0; i < bodies.length; ++i) {
    for (let j = i + 1; j < bodies.length; ++j) {
      const d = magnitude(sub(bodies[j].position, bodies[i].position));
      const softened = Math.sqrt(d * d + params.softening * params.softening);
      potential -= (params.G * bodies[i].mass * bodies[j].mass) / softened;
    }
  }
  return kinetic + potential;
};

export const totalMomentum = (bodies: BodyState[]): Vec2 => {
  return bodies.reduce(
    (sum, body) => add(sum, scale(body.velocity, body.mass)),
    { x: 0, y: 0 },
  );
};
