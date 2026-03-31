import { describe, expect, it, vi } from "vitest";
import { drawTrailLayer } from "~/src/render/layers/trailLayer";
import { perfMonitor } from "~/src/perf/perfMonitor";
import type { Camera } from "~/src/sim/camera";
import type { BodyState } from "~/src/sim/types";
import type { TrailMap } from "~/src/render/layers/types";

const makeCamera = (): Camera => ({
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 1,
});

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    color: "#ff0000",
  },
];

const makeContext = (): CanvasRenderingContext2D => {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
};

describe("drawTrailLayer", () => {
  const viewport = { width: 200, height: 100 };

  it("deduplicates coincident trail samples before drawing segments", () => {
    const ctx = makeContext();
    const gaugeSpy = vi.spyOn(perfMonitor, "recordGauge");
    const trails: TrailMap = {
      a: [
        { x: 0, y: 0, life: 1 },
        { x: 0, y: 0, life: 0.8 },
        { x: 2, y: 0, life: 1 },
      ],
    };

    drawTrailLayer(ctx, trails, makeBodies(), makeCamera(), viewport);

    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(gaugeSpy).toHaveBeenCalledWith("render.trail.points.dedupePct", (1 / 3) * 100);
    gaugeSpy.mockRestore();
  });

  it("keeps the first point position when collapsing near-duplicate samples", () => {
    const ctx = makeContext();
    const trails: TrailMap = {
      a: [
        { x: 0, y: 0, life: 1 },
        { x: 0.001, y: 0, life: 1 },
        { x: 2, y: 0, life: 1 },
      ],
    };

    drawTrailLayer(ctx, trails, makeBodies(), makeCamera(), viewport);

    const firstMoveToCall = vi.mocked(ctx.moveTo).mock.calls[0];
    expect(firstMoveToCall).toEqual([100, 50]);
  });

  it("draws connecting line segments for separated trail points", () => {
    const ctx = makeContext();
    const trails: TrailMap = {
      a: [
        { x: 0, y: 0, life: 1 },
        { x: 2, y: 0, life: 1 },
      ],
    };

    drawTrailLayer(ctx, trails, makeBodies(), makeCamera(), viewport);

    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.lineWidth).toBe(4);
  });

  it("connects samples across large gaps", () => {
    const ctx = makeContext();
    const trails: TrailMap = {
      a: [
        { x: 0, y: 0, life: 1 },
        { x: 100, y: 0, life: 1 },
      ],
    };

    drawTrailLayer(ctx, trails, makeBodies(), makeCamera(), viewport);

    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });

  it("draws a single dot when only one renderable sample remains", () => {
    const ctx = makeContext();
    const trails: TrailMap = {
      a: [{ x: 1, y: 1, life: 1 }],
    };

    drawTrailLayer(ctx, trails, makeBodies(), makeCamera(), viewport);

    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });
});
