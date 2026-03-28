import type { WorldState } from "./types";

export type SimulationSnapshot = {
  world: WorldState;
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
  accumulator: number;
  simStepCounter: number;
  forceFastZoomInFrames: number;
};

const cloneBodies = (bodies: WorldState["bodies"]): WorldState["bodies"] =>
  bodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));

export const cloneWorldState = (world: WorldState): WorldState => ({
  ...world,
  bodies: cloneBodies(world.bodies),
  ejectionCounterById: { ...world.ejectionCounterById },
  ejectedBodyIds: [...world.ejectedBodyIds],
});

export const captureSnapshot = ({
  world,
  accumulator,
  simStepCounter,
  forceFastZoomInFrames,
}: CaptureSnapshotArgs): SimulationSnapshot => ({
  world: cloneWorldState(world),
  accumulator,
  simStepCounter,
  forceFastZoomInFrames,
});

export const pushSnapshot = (historyRef: HistoryRef, snapshot: SimulationSnapshot): void => {
  const history = historyRef.current;
  history.snapshots.push(snapshot);
  if (history.snapshots.length > history.maxSteps) {
    history.snapshots.shift();
  }
};

export const popSnapshot = (historyRef: HistoryRef): SimulationSnapshot | null => {
  const snapshot = historyRef.current.snapshots.pop();
  return snapshot ?? null;
};

export const clearHistory = (historyRef: HistoryRef): void => {
  historyRef.current.snapshots = [];
};

export const restoreSnapshot = ({
  snapshot,
}: RestoreSnapshotArgs): RestoredSimulationState => ({
  world: { ...cloneWorldState(snapshot.world), isRunning: false },
  accumulator: snapshot.accumulator,
  simStepCounter: snapshot.simStepCounter,
  forceFastZoomInFrames: snapshot.forceFastZoomInFrames,
});
