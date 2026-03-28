export type StepAccelerationDirection = "forward" | "backward";

export type StepAccelerationState = {
  source: "idle" | "keyboard" | "pointer";
  direction: StepAccelerationDirection | null;
  burst: number;
  active: boolean;
};

export const IDLE_STEP_ACCELERATION: StepAccelerationState = {
  source: "idle",
  direction: null,
  burst: 1,
  active: false,
};

export const HOLD_ACCELERATION_TICK_MS = 120;

export const burstCountForHoldDuration = (holdDurationMs: number): number => {
  if (holdDurationMs < 600) {
    return 1;
  }
  if (holdDurationMs < 1400) {
    return 2;
  }
  if (holdDurationMs < 2400) {
    return 4;
  }
  if (holdDurationMs < 3400) {
    return 8;
  }
  if (holdDurationMs < 4600) {
    return 16;
  }
  return 32;
};
