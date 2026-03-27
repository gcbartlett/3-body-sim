import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAppLikedState,
  loadCanvasDiagnosticsOpenState,
  loadSectionOpenState,
  saveAppLikedState,
  saveCanvasDiagnosticsOpenState,
  saveSectionOpenState,
} from "~/src/ui/uiPrefsStorage";

const makeStorage = (seed: Record<string, string> = {}) => {
  const store = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn(() => null),
    get length() {
      return store.size;
    },
  };
};

describe("uiPrefsStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and saves control panel section open state", () => {
    const storage = makeStorage({
      "three-body-sim.ui.sections.v1": JSON.stringify({
        presetsOpen: false,
        simParamsOpen: true,
        bodyConfigOpen: true,
      }),
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadSectionOpenState()).toEqual({
      presetsOpen: false,
      simParamsOpen: true,
      bodyConfigOpen: true,
    });

    saveSectionOpenState({
      presetsOpen: true,
      simParamsOpen: false,
      bodyConfigOpen: false,
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "three-body-sim.ui.sections.v1",
      JSON.stringify({
        presetsOpen: true,
        simParamsOpen: false,
        bodyConfigOpen: false,
      }),
    );
  });

  it("loads and saves canvas diagnostics state", () => {
    const storage = makeStorage({
      "three-body-sim.ui.canvas-diagnostics.v1": "1",
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadCanvasDiagnosticsOpenState()).toBe(true);

    saveCanvasDiagnosticsOpenState(false);
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.canvas-diagnostics.v1", "0");
  });

  it("loads and saves app liked state", () => {
    const storage = makeStorage({
      "three-body-sim.ui.app-liked.v1": "1",
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadAppLikedState()).toBe(true);

    saveAppLikedState(false);
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.app-liked.v1", "0");
  });
});
