export type DiagnosticsPublishDecision =
  | { type: "skip"; reason: "closed" }
  | { type: "publish_now"; reason: "paused_or_forced" | "interval_due" }
  | { type: "schedule"; reason: "throttled_running"; waitMs: number };

type DiagnosticsPublishDecisionArgs = {
  diagnosticsOpen: boolean;
  isRunning: boolean;
  forceImmediate: boolean;
  now: number;
  nextPublishAt: number;
};

export const decideDiagnosticsPublish = ({
  diagnosticsOpen,
  isRunning,
  forceImmediate,
  now,
  nextPublishAt,
}: DiagnosticsPublishDecisionArgs): DiagnosticsPublishDecision => {
  if (!diagnosticsOpen) {
    return { type: "skip", reason: "closed" };
  }
  if (forceImmediate || !isRunning) {
    return { type: "publish_now", reason: "paused_or_forced" };
  }
  if (now >= nextPublishAt) {
    return { type: "publish_now", reason: "interval_due" };
  }
  return {
    type: "schedule",
    reason: "throttled_running",
    waitMs: Math.max(0, nextPublishAt - now),
  };
};
