import { describe, expect, it } from "vitest";
import { defaultBodies, defaultParams, initialWorld } from "~/src/sim/defaults";

describe("defaultBodies", () => {
  it("returns three seeded bodies with stable ids, colors, and values", () => {
    expect(defaultBodies()).toStrictEqual([
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
    ]);
  });

  it("returns deep-distinct body objects between calls", () => {
    const first = defaultBodies();
    const second = defaultBodies();

    expect(second).not.toBe(first);
    expect(second[0]).not.toBe(first[0]);
    expect(second[0].position).not.toBe(first[0].position);
    expect(second[0].velocity).not.toBe(first[0].velocity);
  });
});

describe("defaultParams", () => {
  it("returns expected default params and a fresh object per call", () => {
    const first = defaultParams();
    const second = defaultParams();

    expect(first).toStrictEqual({
      G: 1,
      dt: 0.005,
      speed: 1,
      softening: 0.02,
      trailFade: 0.05,
    });
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("initialWorld", () => {
  it("returns a stopped world with cloned bodies", () => {
    const world = initialWorld();
    const world2 = initialWorld();

    world.bodies[0].position.x = 999;
    world.bodies[0].velocity.y = 999;

    expect(world2.isRunning).toBe(false);
    expect(world2.elapsedTime).toBe(0);
    expect(world2.bodies).toHaveLength(3);
    expect(world2.bodies[0].position.x).toBe(-1);
    expect(world2.bodies[0].velocity.y).toBe(0.532);
  });
});
