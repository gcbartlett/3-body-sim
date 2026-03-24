import { describe, expect, it } from "vitest";
import { updateCamera, worldToScreen, type Camera } from "~/src/sim/camera";
import type { BodyState } from "~/src/sim/types";

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 1,
    position: { x: -2, y: -1 },
    velocity: { x: 0, y: 0 },
    color: "#f00",
  },
  {
    id: "b",
    mass: 1,
    position: { x: 2, y: 3 },
    velocity: { x: 0, y: 0 },
    color: "#0f0",
  },
];

describe("updateCamera", () => {
  const previous: Camera = {
    center: { x: 10, y: -10 },
    worldUnitsPerPixel: 2,
  };

  it("returns previous camera for empty bodies or non-positive viewport dimensions", () => {
    expect(updateCamera(previous, [], { width: 100, height: 100 })).toBe(previous);
    expect(updateCamera(previous, makeBodies(), { width: 0, height: 100 })).toBe(previous);
    expect(updateCamera(previous, makeBodies(), { width: 100, height: -1 })).toBe(previous);
  });

  it("uses damped interpolation toward computed bounds center and target scale", () => {
    const result = updateCamera(
      { center: { x: 0, y: 0 }, worldUnitsPerPixel: 10 },
      makeBodies(),
      { width: 100, height: 100 },
      0.5,
    );

    expect(result.center.x).toBeCloseTo(0, 12);
    expect(result.center.y).toBeCloseTo(0.5, 12);
    expect(result.worldUnitsPerPixel).toBeCloseTo(5.0303030303, 10);
  });

  it("enforces minimum world scale of 0.001", () => {
    const tinyBodies: BodyState[] = [
      {
        id: "a",
        mass: 1,
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        color: "#f00",
      },
      {
        id: "b",
        mass: 1,
        position: { x: 0.1, y: 0.1 },
        velocity: { x: 0, y: 0 },
        color: "#0f0",
      },
    ];

    const result = updateCamera(
      { center: { x: 0, y: 0 }, worldUnitsPerPixel: 10 },
      tinyBodies,
      { width: 3000, height: 3000 },
      1,
    );

    expect(result.worldUnitsPerPixel).toBeCloseTo(0.001, 12);
  });

  it("honors damping extremes: 0 keeps previous, 1 snaps to target", () => {
    const unchanged = updateCamera(
      { center: { x: 4, y: 5 }, worldUnitsPerPixel: 2 },
      makeBodies(),
      { width: 100, height: 100 },
      0,
    );
    const snapped = updateCamera(
      { center: { x: 4, y: 5 }, worldUnitsPerPixel: 2 },
      makeBodies(),
      { width: 100, height: 100 },
      1,
    );

    expect(unchanged).toEqual({ center: { x: 4, y: 5 }, worldUnitsPerPixel: 2 });
    expect(snapped.center).toEqual({ x: 0, y: 1 });
    expect(snapped.worldUnitsPerPixel).toBeCloseTo(0.0606060606, 10);
  });
});

describe("worldToScreen", () => {
  const viewport = { width: 200, height: 100 };
  const camera: Camera = {
    center: { x: 10, y: -5 },
    worldUnitsPerPixel: 2,
  };

  it("maps camera center to viewport center", () => {
    const screen = worldToScreen({ x: 10, y: -5 }, camera, viewport);

    expect(screen).toEqual({ x: 100, y: 50 });
  });

  it("maps positive world offsets with expected sign and scale", () => {
    const screen = worldToScreen({ x: 14, y: -1 }, camera, viewport);

    expect(screen).toEqual({ x: 102, y: 52 });
  });

  it("applies linear scaling and is invertible with known fixtures", () => {
    const world = { x: 16, y: -9 };
    const screen = worldToScreen(world, camera, viewport);
    const reconstructed = {
      x: camera.center.x + (screen.x - viewport.width * 0.5) * camera.worldUnitsPerPixel,
      y: camera.center.y + (screen.y - viewport.height * 0.5) * camera.worldUnitsPerPixel,
    };

    expect(screen).toEqual({ x: 103, y: 48 });
    expect(reconstructed.x).toBeCloseTo(world.x, 12);
    expect(reconstructed.y).toBeCloseTo(world.y, 12);
  });
});
