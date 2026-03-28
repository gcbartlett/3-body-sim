import { describe, expect, it } from "vitest";
import { fadeAndPruneTrails } from "~/src/render/canvasRenderer";
import type { TrailMap } from "~/src/render/layers/types";

describe("fadeAndPruneTrails", () => {
  it("applies decay factor max(0, 1 - trailFade) to each point life", () => {
    const trails: TrailMap = {
      a: [{ x: 1, y: 2, life: 1 }],
      b: [{ x: 3, y: 4, life: 0.5 }],
    };

    const result = fadeAndPruneTrails(trails, 0.25);

    expect(result.a).toEqual([{ x: 1, y: 2, life: 0.75 }]);
    expect(result.b).toEqual([{ x: 3, y: 4, life: 0.375 }]);
  });

  it("prunes points at or below threshold after decay and keeps strictly greater", () => {
    const trails: TrailMap = {
      a: [
        { x: 0, y: 0, life: 0.03 },
        { x: 1, y: 1, life: 0.02 },
      ],
    };

    const result = fadeAndPruneTrails(trails, 0.25);

    expect(result.a).toEqual([{ x: 0, y: 0, life: 0.0225 }]);
  });

  it("returns empty arrays for all ids when trailFade is >= 1", () => {
    const trails: TrailMap = {
      a: [{ x: 1, y: 2, life: 1 }],
      b: [{ x: 3, y: 4, life: 0.6 }],
    };

    const result = fadeAndPruneTrails(trails, 1.5);

    expect(result).toEqual({ a: [], b: [] });
  });

  it("returns new map and point objects without mutating input", () => {
    const trails: TrailMap = {
      a: [{ x: 1, y: 2, life: 0.9 }],
    };
    const originalPoint = trails.a[0];

    const result = fadeAndPruneTrails(trails, 0.1);

    expect(result).not.toBe(trails);
    expect(result.a).not.toBe(trails.a);
    expect(result.a[0]).not.toBe(originalPoint);
    expect(trails.a[0]).toEqual({ x: 1, y: 2, life: 0.9 });
    expect(result.a[0]).toEqual({ x: 1, y: 2, life: 0.81 });
  });
});
