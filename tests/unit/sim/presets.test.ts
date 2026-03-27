import { describe, expect, it } from "vitest";
import { cloneBodies } from "~/src/sim/presets";
import type { BodyState } from "~/src/sim/types";

const sampleBodies = (): BodyState[] => [
  {
    id: "body-1",
    mass: 1.2,
    color: "#f7b731",
    position: { x: -1, y: 2 },
    velocity: { x: 0.3, y: -0.4 },
  },
  {
    id: "body-2",
    mass: 0.8,
    color: "#60a5fa",
    position: { x: 3, y: -1 },
    velocity: { x: -0.1, y: 0.25 },
  },
];

describe("cloneBodies", () => {
  it("returns a new array preserving order and field values", () => {
    const input = sampleBodies();
    const cloned = cloneBodies(input);

    expect(cloned).toStrictEqual(input);
    expect(cloned).not.toBe(input);
    expect(cloned.map((body) => body.id)).toStrictEqual(["body-1", "body-2"]);
  });

  it("deep-clones position and velocity vectors for each body", () => {
    const input = sampleBodies();
    const cloned = cloneBodies(input);

    expect(cloned[0]).not.toBe(input[0]);
    expect(cloned[1]).not.toBe(input[1]);
    expect(cloned[0].position).not.toBe(input[0].position);
    expect(cloned[0].velocity).not.toBe(input[0].velocity);
    expect(cloned[1].position).not.toBe(input[1].position);
    expect(cloned[1].velocity).not.toBe(input[1].velocity);
  });

  it("does not mutate source bodies when cloned bodies are changed", () => {
    const input = sampleBodies();
    const cloned = cloneBodies(input);

    cloned[0].mass = 9;
    cloned[0].position.x = 123;
    cloned[1].velocity.y = 456;

    expect(input[0].mass).toBe(1.2);
    expect(input[0].position.x).toBe(-1);
    expect(input[1].velocity.y).toBe(0.25);
  });

  it("returns a new empty array for empty input", () => {
    const empty: BodyState[] = [];
    const cloned = cloneBodies(empty);

    expect(cloned).toStrictEqual([]);
    expect(cloned).not.toBe(empty);
  });
});
