import { describe, expect, it } from "vitest";
import { computeAutoCamera } from "~/src/sim/cameraPolicy";
import { centerOfMass } from "~/src/sim/physics";
import type { BodyState, LockMode } from "~/src/sim/types";

const makeBodies = (
  specs: Array<{ id: string; mass: number; x: number; y: number; vx?: number; vy?: number }>,
): BodyState[] =>
  specs.map((body) => ({
    id: body.id,
    mass: body.mass,
    position: { x: body.x, y: body.y },
    velocity: { x: body.vx ?? 0, y: body.vy ?? 0 },
    color: "#fff",
  }));

describe("computeAutoCamera", () => {
  it('uses tracked center for "none" and damped center transitions for "com"/"origin"', () => {
    const camera = { center: { x: 5, y: -4 }, worldUnitsPerPixel: 2 };
    const viewport = { width: 100, height: 100 };
    const bodies = makeBodies([
      { id: "a", mass: 1, x: -10, y: 0 },
      { id: "b", mass: 3, x: 14, y: 6 },
      { id: "c", mass: 2, x: 2, y: -8 },
    ]);
    const com = centerOfMass(bodies);

    const noneResult = computeAutoCamera({
      camera,
      bodies,
      viewport,
      topInsetPx: 0,
      lockMode: "none",
      forceFastZoomInFrames: 0,
    });
    const originResult = computeAutoCamera({
      camera,
      bodies,
      viewport,
      topInsetPx: 0,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });
    const comResult = computeAutoCamera({
      camera,
      bodies,
      viewport,
      topInsetPx: 0,
      lockMode: "com",
      forceFastZoomInFrames: 0,
    });

    expect(noneResult.camera.center.x).toBeCloseTo(4.7, 12);
    expect(noneResult.camera.center.y).toBeCloseTo(-3.7, 12);
    expect(originResult.camera.center.x).toBeCloseTo(4.5, 12);
    expect(originResult.camera.center.y).toBeCloseTo(-3.6, 12);
    expect(comResult.camera.center.x).toBeCloseTo(5.1, 12);
    expect(comResult.camera.center.y).toBeCloseTo(-3.566666666667, 12);
    expect(comResult.camera.center).not.toEqual(com);
  });

  it("uses fast zoom-out damping and increases scale when required scale is larger", () => {
    const result = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 },
      bodies: makeBodies([
        { id: "a", mass: 1, x: -100, y: 0 },
        { id: "b", mass: 1, x: 100, y: 0 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 0,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });

    expect(result.camera.worldUnitsPerPixel).toBeCloseTo(1.406060606, 9);
    expect(result.camera.worldUnitsPerPixel).toBeGreaterThan(1);
  });

  it("prevents zoom-in jitter when required scale is inside hysteresis band", () => {
    const currentScale = 2;
    const result = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: currentScale },
      bodies: makeBodies([
        { id: "a", mass: 1, x: -62.7, y: 0 },
        { id: "b", mass: 1, x: 62.7, y: 0 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 0,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });

    expect(result.camera.worldUnitsPerPixel).toBe(currentScale);
  });

  it("decrements forceFastZoomInFrames and uses fast damping while active", () => {
    const result = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: 2 },
      bodies: makeBodies([
        { id: "a", mass: 1, x: -33, y: 0 },
        { id: "b", mass: 1, x: 33, y: 0 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 0,
      lockMode: "origin",
      forceFastZoomInFrames: 2,
    });

    expect(result.camera.worldUnitsPerPixel).toBeCloseTo(1.8, 12);
    expect(result.nextForceFastZoomInFrames).toBe(1);
  });

  it("handles empty bodies using minimum required scale fallback", () => {
    const result = computeAutoCamera({
      camera: { center: { x: 10, y: -10 }, worldUnitsPerPixel: 1 },
      bodies: [],
      viewport: { width: 100, height: 100 },
      topInsetPx: 0,
      lockMode: "origin" satisfies LockMode,
      forceFastZoomInFrames: 0,
    });

    expect(result.camera.center.x).toBeCloseTo(9, 12);
    expect(result.camera.center.y).toBeCloseTo(-9, 12);
    expect(result.camera.worldUnitsPerPixel).toBeCloseTo(0.9975025, 12);
    expect(Number.isFinite(result.camera.worldUnitsPerPixel)).toBe(true);
  });

  it("biases camera center toward visible region below top inset", () => {
    const result = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 },
      bodies: makeBodies([
        { id: "a", mass: 1, x: -10, y: -10 },
        { id: "b", mass: 1, x: 10, y: 10 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 20,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });

    expect(result.camera.center.y).toBeLessThan(0);
  });

  it("requires more zoom-out when top inset reduces visible height", () => {
    const noInset = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 },
      bodies: makeBodies([
        { id: "a", mass: 1, x: 0, y: -40 },
        { id: "b", mass: 1, x: 0, y: 40 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 0,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });
    const withInset = computeAutoCamera({
      camera: { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 },
      bodies: makeBodies([
        { id: "a", mass: 1, x: 0, y: -40 },
        { id: "b", mass: 1, x: 0, y: 40 },
        { id: "c", mass: 1, x: 0, y: 0 },
      ]),
      viewport: { width: 100, height: 100 },
      topInsetPx: 30,
      lockMode: "origin",
      forceFastZoomInFrames: 0,
    });

    expect(withInset.camera.worldUnitsPerPixel).toBeGreaterThan(noInset.camera.worldUnitsPerPixel);
  });
});
