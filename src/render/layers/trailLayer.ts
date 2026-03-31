import { worldToScreen } from "../../sim/camera";
import type { Camera } from "../../sim/camera";
import type { BodyState } from "../../sim/types";
import { perfMonitor } from "../../perf/perfMonitor";
import type { TrailMap, TrailPoint, Viewport } from "./types";

const MIN_TRAIL_ALPHA = 0.015;
const TRAIL_DUPLICATE_DISTANCE_PX = 0.25;
const TRAIL_DOT_RADIUS_PX = 1.5;
const TRAIL_LINE_WIDTH_PX = 4;
const rgbColorCache = new Map<string, string>();

type RenderTrailSample = {
  x: number;
  y: number;
  alpha: number;
};

type TrailSamplingStats = {
  renderablePointCount: number;
  dedupedPointCount: number;
  nonConsecutiveNearOverlapEstimate: number;
};

const toOpaqueRgb = (hexColor: string): string => {
  const cached = rgbColorCache.get(hexColor);
  if (cached) {
    return cached;
  }
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return "rgb(255, 255, 255)";
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return "rgb(255, 255, 255)";
  }

  const rgb = `rgb(${r}, ${g}, ${b})`;
  rgbColorCache.set(hexColor, rgb);
  return rgb;
};

const collectRenderableTrailSamples = (
  bodyTrails: TrailPoint[],
  camera: Camera,
  viewport: Viewport,
): { samples: RenderTrailSample[]; stats: TrailSamplingStats } => {
  const samples: RenderTrailSample[] = [];
  const stats: TrailSamplingStats = {
    renderablePointCount: 0,
    dedupedPointCount: 0,
    nonConsecutiveNearOverlapEstimate: 0,
  };
  const duplicateDistanceSq = TRAIL_DUPLICATE_DISTANCE_PX * TRAIL_DUPLICATE_DISTANCE_PX;
  const overlapCellSizePx = 2;
  const lastSeenIndexByCell = new Map<string, number>();
  let renderableIndex = 0;

  for (const point of bodyTrails) {
    const alpha = Math.max(0, Math.min(1, point.life));
    if (alpha <= MIN_TRAIL_ALPHA) {
      continue;
    }
    ++stats.renderablePointCount;
    const p = worldToScreen({ x: point.x, y: point.y }, camera, viewport);
    const cellX = Math.floor(p.x / overlapCellSizePx);
    const cellY = Math.floor(p.y / overlapCellSizePx);
    const cellKey = `${cellX},${cellY}`;
    const lastSeen = lastSeenIndexByCell.get(cellKey);
    if (lastSeen !== undefined && renderableIndex - lastSeen > 1) {
      ++stats.nonConsecutiveNearOverlapEstimate;
    }
    lastSeenIndexByCell.set(cellKey, renderableIndex);
    ++renderableIndex;

    const previous = samples[samples.length - 1];
    if (previous) {
      const dx = p.x - previous.x;
      const dy = p.y - previous.y;
      if (dx * dx + dy * dy <= duplicateDistanceSq) {
        // Preserve the first sample position to avoid stretching long replacement segments.
        previous.alpha = Math.max(previous.alpha, alpha);
        ++stats.dedupedPointCount;
        continue;
      }
    }
    samples.push({ x: p.x, y: p.y, alpha });
  }

  return { samples, stats };
};

const drawTrailSamples = (
  ctx: CanvasRenderingContext2D,
  samples: RenderTrailSample[],
): void => {
  ctx.save();
  if (samples.length === 0) {
    ctx.restore();
    return;
  }
  if (samples.length === 1) {
    const only = samples[0];
    ctx.globalAlpha = only.alpha;
    ctx.beginPath();
    ctx.arc(only.x, only.y, TRAIL_DOT_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  ctx.lineWidth = TRAIL_LINE_WIDTH_PX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < samples.length; ++i) {
    const previous = samples[i - 1];
    const current = samples[i];
    ctx.globalAlpha = Math.max(previous.alpha, current.alpha);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  }

  // Keep a visible trail tip even when segment alpha is low.
  const last = samples[samples.length - 1];
  ctx.globalAlpha = last.alpha;
  ctx.beginPath();
  ctx.arc(last.x, last.y, TRAIL_DOT_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
};

export const drawTrailLayer = (
  ctx: CanvasRenderingContext2D,
  trails: TrailMap,
  bodies: BodyState[],
  camera: Camera,
  viewport: Viewport,
): void => {
  let renderablePointCount = 0;
  let dedupedPointCount = 0;
  let nonConsecutiveNearOverlapEstimate = 0;

  for (const body of bodies) {
    const bodyTrails = trails[body.id] ?? [];
    if (bodyTrails.length === 0) {
      continue;
    }
    const collected = collectRenderableTrailSamples(bodyTrails, camera, viewport);
    renderablePointCount += collected.stats.renderablePointCount;
    dedupedPointCount += collected.stats.dedupedPointCount;
    nonConsecutiveNearOverlapEstimate += collected.stats.nonConsecutiveNearOverlapEstimate;
    const samples = collected.samples;
    if (samples.length === 0) {
      continue;
    }
    const trailColor = toOpaqueRgb(body.color);
    ctx.strokeStyle = trailColor;
    ctx.fillStyle = trailColor;
    drawTrailSamples(ctx, samples);
  }

  const dedupePct =
    renderablePointCount > 0
      ? (dedupedPointCount / renderablePointCount) * 100
      : 0;
  perfMonitor.recordGauge("render.trail.points.renderable", renderablePointCount);
  perfMonitor.recordGauge("render.trail.points.deduped", dedupedPointCount);
  perfMonitor.recordGauge("render.trail.points.dedupePct", dedupePct);
  perfMonitor.recordGauge(
    "render.trail.points.nonConsecutiveNearOverlapEstimate",
    nonConsecutiveNearOverlapEstimate,
  );
};
