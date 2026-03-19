import type { BodyState } from "./types";

const STABLE_MASS_MIN = 0.8;
const STABLE_MASS_MAX = 1.3;
const STABLE_RADIUS_MIN = 0.9;
const STABLE_RADIUS_MAX = 1.4;
const STABLE_ORBITAL_RADIUS_FLOOR = 0.2;
const STABLE_VELOCITY_MAGNITUDE_FLOOR = 0.05;
const STABLE_VELOCITY_JITTER_MIN = -0.08;
const STABLE_VELOCITY_JITTER_MAX = 0.08;

const CHAOTIC_MASS_MIN = 0.5;
const CHAOTIC_MASS_MAX = 1.8;
const CHAOTIC_POSITION_MIN = -1.2;
const CHAOTIC_POSITION_MAX = 1.2;
const CHAOTIC_VELOCITY_MIN = -1.5;
const CHAOTIC_VELOCITY_MAX = 1.5;

const randomIn = (min: number, max: number): number => min + Math.random() * (max - min);

export const generateRandomStableBodies = (bodyColors: readonly string[]): BodyState[] => {
  const masses = [
    randomIn(STABLE_MASS_MIN, STABLE_MASS_MAX),
    randomIn(STABLE_MASS_MIN, STABLE_MASS_MAX),
    randomIn(STABLE_MASS_MIN, STABLE_MASS_MAX),
  ];
  const r = randomIn(STABLE_RADIUS_MIN, STABLE_RADIUS_MAX);
  const angle = randomIn(0, Math.PI * 2);
  const points = [0, 2 * Math.PI / 3, 4 * Math.PI / 3].map((offset) => ({
    x: r * Math.cos(angle + offset),
    y: r * Math.sin(angle + offset),
  }));
  const meanMass = (masses[0] + masses[1] + masses[2]) / 3;
  const vMag = Math.sqrt(Math.max(STABLE_VELOCITY_MAGNITUDE_FLOOR, meanMass / r));
  const velocities = points.map((p) => ({
    x:
      (-p.y / Math.max(STABLE_ORBITAL_RADIUS_FLOOR, r)) * vMag +
      randomIn(STABLE_VELOCITY_JITTER_MIN, STABLE_VELOCITY_JITTER_MAX),
    y:
      (p.x / Math.max(STABLE_ORBITAL_RADIUS_FLOOR, r)) * vMag +
      randomIn(STABLE_VELOCITY_JITTER_MIN, STABLE_VELOCITY_JITTER_MAX),
  }));

  const momentum = velocities.reduce(
    (sum, v, i) => ({ x: sum.x + masses[i] * v.x, y: sum.y + masses[i] * v.y }),
    { x: 0, y: 0 },
  );
  const totalMass = masses[0] + masses[1] + masses[2];
  const correction = { x: momentum.x / totalMass, y: momentum.y / totalMass };

  return points.map((position, i) => ({
    id: `body-${i + 1}`,
    color: bodyColors[i],
    mass: masses[i],
    position,
    velocity: {
      x: velocities[i].x - correction.x,
      y: velocities[i].y - correction.y,
    },
  }));
};

export const generateRandomChaoticBodies = (bodyColors: readonly string[]): BodyState[] => {
  const masses = [
    randomIn(CHAOTIC_MASS_MIN, CHAOTIC_MASS_MAX),
    randomIn(CHAOTIC_MASS_MIN, CHAOTIC_MASS_MAX),
    randomIn(CHAOTIC_MASS_MIN, CHAOTIC_MASS_MAX),
  ];
  const positions = [0, 1, 2].map(() => ({
    x: randomIn(CHAOTIC_POSITION_MIN, CHAOTIC_POSITION_MAX),
    y: randomIn(CHAOTIC_POSITION_MIN, CHAOTIC_POSITION_MAX),
  }));
  const velocities = [0, 1, 2].map(() => ({
    x: randomIn(CHAOTIC_VELOCITY_MIN, CHAOTIC_VELOCITY_MAX),
    y: randomIn(CHAOTIC_VELOCITY_MIN, CHAOTIC_VELOCITY_MAX),
  }));
  return positions.map((position, i) => ({
    id: `body-${i + 1}`,
    color: bodyColors[i],
    mass: masses[i],
    position,
    velocity: velocities[i],
  }));
};
