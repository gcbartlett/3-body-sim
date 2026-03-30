import { describe, expect, it } from "vitest";
import { decideDiagnosticsPublish } from "~/src/ui/diagnosticsPublishPolicy";

describe("decideDiagnosticsPublish", () => {
  it("schedules while diagnostics are open and world is running before interval", () => {
    const decision = decideDiagnosticsPublish({
      diagnosticsOpen: true,
      isRunning: true,
      forceImmediate: false,
      now: 1000,
      nextPublishAt: 1100,
    });

    expect(decision).toEqual({
      type: "schedule",
      reason: "throttled_running",
      waitMs: 100,
    });
  });

  it("publishes immediately while paused for frame-accurate inspection", () => {
    const decision = decideDiagnosticsPublish({
      diagnosticsOpen: true,
      isRunning: false,
      forceImmediate: false,
      now: 1000,
      nextPublishAt: 5000,
    });

    expect(decision).toEqual({
      type: "publish_now",
      reason: "paused_or_forced",
    });
  });

  it("publishes immediately when forceImmediate is requested during running", () => {
    const decision = decideDiagnosticsPublish({
      diagnosticsOpen: true,
      isRunning: true,
      forceImmediate: true,
      now: 1000,
      nextPublishAt: 5000,
    });

    expect(decision).toEqual({
      type: "publish_now",
      reason: "paused_or_forced",
    });
  });

  it("publishes immediately when running interval is due", () => {
    const decision = decideDiagnosticsPublish({
      diagnosticsOpen: true,
      isRunning: true,
      forceImmediate: false,
      now: 1100,
      nextPublishAt: 1100,
    });

    expect(decision).toEqual({
      type: "publish_now",
      reason: "interval_due",
    });
  });

  it("skips when diagnostics are closed", () => {
    const decision = decideDiagnosticsPublish({
      diagnosticsOpen: false,
      isRunning: true,
      forceImmediate: true,
      now: 1000,
      nextPublishAt: 5000,
    });

    expect(decision).toEqual({
      type: "skip",
      reason: "closed",
    });
  });
});
