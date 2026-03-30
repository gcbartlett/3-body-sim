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
  maxSteps: number;
  estimatedBytes?: number;
  ringBuffer?: Array<SimulationSnapshot | undefined>;
  ringHead?: number;
  ringCount?: number;
  // Legacy initialization path for call sites/tests that still seed history with arrays.
  snapshots?: SimulationSnapshot[];
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

export const createSimulationHistory = (
  maxSteps: number,
  snapshots: SimulationSnapshot[] = [],
): SimulationHistory => ({
  maxSteps: clampHistoryMaxSteps(maxSteps),
  snapshots,
});

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

const estimateSnapshotBytes = (snapshot: SimulationSnapshot): number => {
  const bodyCount = snapshot.world.bodies.length;
  const trailPoints = Object.values(snapshot.trails).reduce((acc, points) => acc + points.length, 0);
  return bodyCount * 160 + trailPoints * 32 + 64;
};

const totalEstimatedBytes = (snapshots: readonly SimulationSnapshot[]): number =>
  snapshots.reduce((acc, snapshot) => acc + estimateSnapshotBytes(snapshot), 0);

const ensureRingState = (history: SimulationHistory): void => {
  const maxSteps = clampHistoryMaxSteps(history.maxSteps);
  if (
    history.ringBuffer &&
    history.ringHead !== undefined &&
    history.ringCount !== undefined &&
    history.ringBuffer.length === maxSteps
  ) {
    history.maxSteps = maxSteps;
    return;
  }

  const seededSnapshots = history.snapshots ?? [];
  const trimmed = seededSnapshots.slice(Math.max(0, seededSnapshots.length - maxSteps));
  const ringBuffer = new Array<SimulationSnapshot | undefined>(maxSteps);
  for (let i = 0; i < trimmed.length; ++i) {
    ringBuffer[i] = trimmed[i];
  }

  history.maxSteps = maxSteps;
  history.ringBuffer = ringBuffer;
  history.ringHead = 0;
  history.ringCount = trimmed.length;
  history.estimatedBytes = totalEstimatedBytes(trimmed);
  history.snapshots = undefined;
};

const getRingSnapshot = (history: SimulationHistory, logicalIndex: number): SimulationSnapshot | null => {
  ensureRingState(history);
  const ringBuffer = history.ringBuffer!;
  const ringHead = history.ringHead!;
  const ringCount = history.ringCount!;
  if (logicalIndex < 0 || logicalIndex >= ringCount) {
    return null;
  }
  const physicalIndex = (ringHead + logicalIndex) % ringBuffer.length;
  return ringBuffer[physicalIndex] ?? null;
};

const getOrInitEstimatedBytes = (history: SimulationHistory): number => {
  ensureRingState(history);
  if (history.estimatedBytes === undefined) {
    history.estimatedBytes = totalEstimatedBytes(getHistorySnapshots(history));
  }
  return history.estimatedBytes;
};

export const getHistorySnapshotCount = (history: SimulationHistory): number => {
  ensureRingState(history);
  return history.ringCount!;
};

export const getHistorySnapshots = (history: SimulationHistory): SimulationSnapshot[] => {
  ensureRingState(history);
  const ringCount = history.ringCount!;
  const snapshots: SimulationSnapshot[] = new Array(ringCount);
  for (let i = 0; i < ringCount; ++i) {
    const snapshot = getRingSnapshot(history, i);
    if (!snapshot) {
      continue;
    }
    snapshots[i] = snapshot;
  }
  return snapshots.filter((snapshot): snapshot is SimulationSnapshot => snapshot !== undefined);
};

export const pushSnapshot = (historyRef: HistoryRef, snapshot: SimulationSnapshot): void => {
  const history = historyRef.current;
  ensureRingState(history);
  const ringBuffer = history.ringBuffer!;
  const previousEstimatedBytes = getOrInitEstimatedBytes(history);
  const snapshotBytes = estimateSnapshotBytes(snapshot);

  if (history.ringCount! < ringBuffer.length) {
    const index = (history.ringHead! + history.ringCount!) % ringBuffer.length;
    ringBuffer[index] = snapshot;
    history.ringCount = history.ringCount! + 1;
    history.estimatedBytes = previousEstimatedBytes + snapshotBytes;
  } else {
    const overwritten = ringBuffer[history.ringHead!] ?? null;
    ringBuffer[history.ringHead!] = snapshot;
    history.ringHead = (history.ringHead! + 1) % ringBuffer.length;
    history.estimatedBytes =
      previousEstimatedBytes + snapshotBytes - (overwritten ? estimateSnapshotBytes(overwritten) : 0);
    perfMonitor.incrementCounter("history.pushSnapshot.shifted");
  }

  perfMonitor.incrementCounter("history.pushSnapshot.calls");
  perfMonitor.recordGauge("history.snapshot.count", history.ringCount!);
};

export const popSnapshot = (historyRef: HistoryRef): SimulationSnapshot | null => {
  const history = historyRef.current;
  ensureRingState(history);
  if (history.ringCount === 0) {
    perfMonitor.recordGauge("history.snapshot.count", 0);
    return null;
  }

  const ringBuffer = history.ringBuffer!;
  const lastIndex = (history.ringHead! + history.ringCount! - 1) % ringBuffer.length;
  const snapshot = ringBuffer[lastIndex] ?? null;
  ringBuffer[lastIndex] = undefined;
  history.ringCount = history.ringCount! - 1;
  if (history.ringCount === 0) {
    history.ringHead = 0;
  }
  if (snapshot) {
    history.estimatedBytes = getOrInitEstimatedBytes(history) - estimateSnapshotBytes(snapshot);
  }

  perfMonitor.recordGauge("history.snapshot.count", history.ringCount);
  return snapshot;
};

export const clearHistory = (historyRef: HistoryRef): void => {
  const history = historyRef.current;
  ensureRingState(history);
  history.ringBuffer = new Array<SimulationSnapshot | undefined>(history.maxSteps);
  history.ringHead = 0;
  history.ringCount = 0;
  history.estimatedBytes = 0;
  perfMonitor.recordGauge("history.snapshot.count", 0);
};

export const setHistoryMaxSteps = (historyRef: HistoryRef, nextMaxSteps: number): void => {
  const history = historyRef.current;
  ensureRingState(history);
  const clampedMaxSteps = clampHistoryMaxSteps(nextMaxSteps);
  if (history.maxSteps === clampedMaxSteps) {
    return;
  }

  const snapshots = getHistorySnapshots(history);
  const retained = snapshots.slice(Math.max(0, snapshots.length - clampedMaxSteps));
  const nextBuffer = new Array<SimulationSnapshot | undefined>(clampedMaxSteps);
  for (let i = 0; i < retained.length; ++i) {
    nextBuffer[i] = retained[i];
  }
  history.maxSteps = clampedMaxSteps;
  history.ringBuffer = nextBuffer;
  history.ringHead = 0;
  history.ringCount = retained.length;
  history.estimatedBytes = totalEstimatedBytes(retained);
  perfMonitor.recordGauge("history.snapshot.count", history.ringCount);
};

export const getSimulationHistoryMetrics = (history: SimulationHistory): SimulationHistoryMetrics => ({
  ...perfMonitor.measure("history.metrics.compute", () => ({
    count: getHistorySnapshotCount(history),
    maxSteps: history.maxSteps,
    estimatedBytes: getOrInitEstimatedBytes(history),
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
