import { describe, expect, it } from "vitest";
import { shouldNotifyManualModeDisabled } from "~/src/ui/useAppRuntimeState";

describe("shouldNotifyManualModeDisabled", () => {
  it("returns true only for true-to-false transitions", () => {
    expect(shouldNotifyManualModeDisabled(true, false)).toBe(true);
    expect(shouldNotifyManualModeDisabled(true, true)).toBe(false);
    expect(shouldNotifyManualModeDisabled(false, false)).toBe(false);
    expect(shouldNotifyManualModeDisabled(false, true)).toBe(false);
  });
});
