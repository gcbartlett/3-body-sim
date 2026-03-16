import type { BodyState, PresetProfile } from "./types";

const withColors = (positionsAndVelocities: Array<Pick<BodyState, "mass" | "position" | "velocity">>): BodyState[] => {
  const colors = ["#f7b731", "#60a5fa", "#8bd450"];
  return positionsAndVelocities.map((body, index) => ({
    id: `body-${index + 1}`,
    color: colors[index],
    ...body,
  }));
};

export const PRESETS: PresetProfile[] = [
  {
    id: "figure-eight",
    name: "Figure Eight",
    description: "Classic equal-mass choreography with periodic figure-eight paths.",
    bodies: withColors([
      {
        mass: 1,
        position: { x: -0.97000436, y: 0.24308753 },
        velocity: { x: 0.466203685, y: 0.43236573 },
      },
      {
        mass: 1,
        position: { x: 0.97000436, y: -0.24308753 },
        velocity: { x: 0.466203685, y: 0.43236573 },
      },
      {
        mass: 1,
        position: { x: 0, y: 0 },
        velocity: { x: -0.93240737, y: -0.86473146 },
      },
    ]),
    params: {
      G: 1,
      dt: 0.004,
      speed: 1,
    },
  },
  {
    id: "lagrange-ish",
    name: "Lagrange Triangle",
    description: "Near-equilateral rotating setup that can stay semi-coherent.",
    bodies: withColors([
      {
        mass: 1,
        position: { x: 0, y: 1.2 },
        velocity: { x: -0.62, y: 0 },
      },
      {
        mass: 1,
        position: { x: 1.0392305, y: -0.6 },
        velocity: { x: 0.31, y: -0.537 },
      },
      {
        mass: 1,
        position: { x: -1.0392305, y: -0.6 },
        velocity: { x: 0.31, y: 0.537 },
      },
    ]),
    params: {
      G: 1,
      dt: 0.005,
      speed: 1.2,
    },
  },
  {
    id: "chaotic-slingshot",
    name: "Chaotic Slingshot",
    description: "Intentionally unstable arrangement that often ejects one body.",
    bodies: withColors([
      {
        mass: 1.4,
        position: { x: -0.7, y: 0.2 },
        velocity: { x: 0.18, y: 0.86 },
      },
      {
        mass: 0.8,
        position: { x: 0.95, y: -0.35 },
        velocity: { x: -0.15, y: -0.54 },
      },
      {
        mass: 0.6,
        position: { x: -0.1, y: -0.55 },
        velocity: { x: -1.05, y: 0.1 },
      },
    ]),
    params: {
      G: 1.1,
      dt: 0.0045,
      speed: 1.4,
    },
  },
  {
    id: "trojan-l4",
    name: "Trojan (L4)",
    description: "Restricted-style setup: two heavy primaries with a light third body near the L4 region.",
    bodies: withColors([
      {
        mass: 1.2,
        position: { x: -0.8, y: 0.0 },
        velocity: { x: 0.0, y: 0.55 },
      },
      {
        mass: 0.9,
        position: { x: 0.8, y: 0.0 },
        velocity: { x: 0.0, y: -0.73 },
      },
      {
        mass: 0.08,
        position: { x: 0.0, y: 1.35 },
        velocity: { x: -0.67, y: -0.08 },
      },
    ]),
    params: {
      G: 1,
      dt: 0.004,
      speed: 1,
    },
  },
  {
    id: "euler-collinear",
    name: "Euler Collinear",
    description: "Classic collinear rotating-style configuration; visually structured but perturbation-sensitive.",
    bodies: withColors([
      {
        mass: 1.1,
        position: { x: -1.1, y: 0.0 },
        velocity: { x: 0.0, y: -0.62 },
      },
      {
        mass: 0.8,
        position: { x: 0.0, y: 0.0 },
        velocity: { x: 0.0, y: 0.12 },
      },
      {
        mass: 1.1,
        position: { x: 1.1, y: 0.0 },
        velocity: { x: 0.0, y: 0.62 },
      },
    ]),
    params: {
      G: 1,
      dt: 0.0035,
      speed: 1,
    },
  },
];

export const cloneBodies = (bodies: BodyState[]): BodyState[] =>
  bodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));
