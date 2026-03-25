import { describe, expect, it } from "vitest";
import { createStoppedWorld } from "~/src/sim/worldState";
import type { BodyState } from "~/src/sim/types";

const makeBodies = (): BodyState[] => [
  {
    id: "body-1",
    mass: 1.1,
    position: { x: -1, y: 2 },
    velocity: { x: 0.5, y: -0.4 },
    color: "#f00",
  },
  {
    id: "body-2",
    mass: 0.9,
    position: { x: 3, y: -4 },
    velocity: { x: -0.2, y: 0.7 },
    color: "#0f0",
  },
  {
    id: "body-3",
    mass: 1.3,
    position: { x: 0, y: 1 },
    velocity: { x: 0.1, y: 0.2 },
    color: "#00f",
  },
];

describe("createStoppedWorld", () => {
  it("initializes run/ejection/dissolution fields to stopped defaults", () => {
    const world = createStoppedWorld(makeBodies());

    expect(world.elapsedTime).toBe(0);
    expect(world.isRunning).toBe(false);
    expect(world.ejectionCounterById).toEqual({});
    expect(world.ejectedBodyId).toBeNull();
    expect(world.ejectedBodyIds).toEqual([]);
    expect(world.dissolutionCounterSec).toBe(0);
    expect(world.dissolutionDetected).toBe(false);
    expect(world.dissolutionJustDetected).toBe(false);
  });

  it("deep-clones body entries and vector fields without aliasing input references", () => {
    const inputBodies = makeBodies();
    const world = createStoppedWorld(inputBodies);

    expect(world.bodies).toEqual(inputBodies);
    expect(world.bodies).not.toBe(inputBodies);
    expect(world.bodies[0]).not.toBe(inputBodies[0]);
    expect(world.bodies[0].position).not.toBe(inputBodies[0].position);
    expect(world.bodies[0].velocity).not.toBe(inputBodies[0].velocity);

    inputBodies[0].position.x = 999;
    inputBodies[0].velocity.y = -999;
    expect(world.bodies[0].position.x).toBe(-1);
    expect(world.bodies[0].velocity.y).toBe(-0.4);
  });
});
