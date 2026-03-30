// noinspection ES6PreferShortImport
import type { TrailMap } from "../render/canvasRenderer";
import type { WorldState } from "./types";
import { perfMonitor } from "../perf/perfMonitor";

export const MIN_HISTORY_STEPS = 50;
export const MAX_HISTORY_STEPS = 2000;

export type SimulationSnapshot = {
  world: WorldState;
  trails: TrailMap;
  accumulator: number;
  simStepCounter: number;
  forceFastZoomInFrames: number;
};

export type SimulationHistory = {
  snapshots: SimulationSnapshot[];
  maxSteps: number;
};

type CaptureSnapshotArgs = {
  world: WorldState;
  trails: TrailMap;
  accumulator: number;
  simStepCounter: number;
  forceFastZoomInFrames: number;
};

type HistoryRef = {
  current: SimulationHistory;
};

type RestoreSnapshotArgs = {
  snapshot: SimulationSnapshot;
};

export type RestoredSimulationState = {
  world: WorldState;
  trails: TrailMap;
  accumulator: number;
  simStepCounter: number;
  forceFastZoomInFrames: number;
};

export type SimulationHistoryMetrics = {
  count: number;
  maxSteps: number;
  estimatedBytes: number;
};

const cloneBodies = (bodies: WorldState["bodies"]): WorldState["bodies"] =>
  bodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));

const cloneTrailMap = (trails: TrailMap): TrailMap => {
  return perfMonitor.measure("history.cloneTrailMap", () => {
    const cloned: TrailMap = {};
    let trailPointCount = 0;
    for (const [id, points] of Object.entries(trails)) {
      trailPointCount += points.length;
      cloned[id] = points.map((point) => ({ ...point }));
    }
    perfMonitor.recordGauge("history.cloneTrailMap.points", trailPointCount);
    return cloned;
  });
};

export const clampHistoryMaxSteps = (value: number): number => {
  const rounded = Math.round(value);
  return Math.min(MAX_HISTORY_STEPS, Math.max(MIN_HISTORY_STEPS, rounded));
};

export const cloneWorldState = (world: WorldState): WorldState => ({
  ...world,
  bodies: cloneBodies(world.bodies),
  ejectionCounterById: { ...world.ejectionCounterById },
  ejectedBodyIds: [...world.ejectedBodyIds],
});

export const captureSnapshot = ({
  world,
  trails,
  accumulator,
  simStepCounter,
  forceFastZoomInFrames,
}: CaptureSnapshotArgs): SimulationSnapshot => ({
  ...perfMonitor.measure("history.captureSnapshot", () => ({
    world: cloneWorldState(world),
    trails: cloneTrailMap(trails),
    accumulator,
    simStepCounter,
    forceFastZoomInFrames,
  })),
});

export const pushSnapshot = (historyRef: HistoryRef, snapshot: SimulationSnapshot): void => {
  const history = historyRef.current;
  history.snapshots.push(snapshot);
  perfMonitor.incrementCounter("history.pushSnapshot.calls");
  if (history.snapshots.length > history.maxSteps) {
    history.snapshots.shift();
    perfMonitor.incrementCounter("history.pushSnapshot.shifted");
  }
  perfMonitor.recordGauge("history.snapshot.count", history.snapshots.length);
};

export const popSnapshot = (historyRef: HistoryRef): SimulationSnapshot | null => {
  const snapshot = historyRef.current.snapshots.pop();
  perfMonitor.recordGauge("history.snapshot.count", historyRef.current.snapshots.length);
  return snapshot ?? null;
};

export const clearHistory = (historyRef: HistoryRef): void => {
  historyRef.current.snapshots = [];
  perfMonitor.recordGauge("history.snapshot.count", historyRef.current.snapshots.length);
};

export const setHistoryMaxSteps = (historyRef: HistoryRef, nextMaxSteps: number): void => {
  historyRef.current.maxSteps = clampHistoryMaxSteps(nextMaxSteps);
  if (historyRef.current.snapshots.length > historyRef.current.maxSteps) {
    historyRef.current.snapshots.splice(
      0,
      historyRef.current.snapshots.length - historyRef.current.maxSteps,
    );
    perfMonitor.recordGauge("history.snapshot.count", historyRef.current.snapshots.length);
  }
};

const estimateSnapshotBytes = (snapshot: SimulationSnapshot): number => {
  const bodyCount = snapshot.world.bodies.length;
  const trailPoints = Object.values(snapshot.trails).reduce((acc, points) => acc + points.length, 0);
  return bodyCount * 160 + trailPoints * 32 + 64;
};

export const getSimulationHistoryMetrics = (history: SimulationHistory): SimulationHistoryMetrics => ({
  ...perfMonitor.measure("history.metrics.compute", () => ({
    count: history.snapshots.length,
    maxSteps: history.maxSteps,
    estimatedBytes: history.snapshots.reduce((acc, snapshot) => acc + estimateSnapshotBytes(snapshot), 0),
  })),
});

export const restoreSnapshot = ({
  snapshot,
}: RestoreSnapshotArgs): RestoredSimulationState => ({
  world: { ...cloneWorldState(snapshot.world), isRunning: false },
  trails: cloneTrailMap(snapshot.trails),
  accumulator: snapshot.accumulator,
  simStepCounter: snapshot.simStepCounter,
  forceFastZoomInFrames: snapshot.forceFastZoomInFrames,
});
