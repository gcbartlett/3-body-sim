import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresetProfile, SimParams } from "~/src/sim/types";

vi.mock("~/src/sim/presetStorageCodecs", () => ({
  PRESET_ID_MAX_LENGTH: 64,
  PRESET_NAME_MAX_LENGTH: 80,
  PRESET_DESCRIPTION_MAX_LENGTH: 560,
  sanitizePresetId: vi.fn((value: string) => value.trim()),
  sanitizePresetName: vi.fn((value: string) => value.trim()),
  sanitizePresetDescription: vi.fn((value: string) => value.trim()),
  decodePersistedParams: vi.fn(),
  decodePersistedUiPrefs: vi.fn(),
  decodePersistedUserPresets: vi.fn(),
}));

import {
  decodePersistedParams,
  decodePersistedUiPrefs,
  decodePersistedUserPresets,
} from "~/src/sim/presetStorageCodecs";
import {
  loadPersistedParams,
  loadPersistedUiPrefs,
  loadPersistedUserPresets,
  savePersistedParams,
  savePersistedUiPrefs,
  savePersistedUserPresets,
} from "~/src/sim/presetStorage";

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

describe("presetStorage wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadPersistedParams forwards raw storage value and falls back when getItem throws", () => {
    const params: SimParams = { G: 2, dt: 0.02, speed: 3, softening: 0.03, trailFade: 0.04 };
    vi.mocked(decodePersistedParams).mockReturnValue(params);

    const storage = makeStorage({
      "three-body-sim.params.v1": '{"G":2}',
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadPersistedParams()).toBe(params);
    expect(decodePersistedParams).toHaveBeenCalledWith('{"G":2}');

    storage.getItem.mockImplementation(() => {
      throw new Error("storage blocked");
    });

    loadPersistedParams();
    expect(decodePersistedParams).toHaveBeenLastCalledWith(null);
  });

  it("savePersistedParams writes encoded payload and ignores storage errors", () => {
    const storage = makeStorage();
    vi.stubGlobal("localStorage", storage);
    const params: SimParams = { G: 1, dt: 0.005, speed: 1, softening: 0.02, trailFade: 0.05 };

    expect(() => savePersistedParams(params)).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.params.v1", JSON.stringify(params));

    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => savePersistedParams(params)).not.toThrow();
  });

  it("loadPersistedUiPrefs reads all keys and forwards raw values to decodePersistedUiPrefs", () => {
    const decoded = {
      panelExpanded: false,
      lockMode: "origin",
      showOriginMarker: true,
      showGrid: false,
      showCenterOfMass: true,
    } as const;
    vi.mocked(decodePersistedUiPrefs).mockReturnValue(decoded);

    const storage = makeStorage({
      "three-body-sim.ui.panel-expanded.v1": "1",
      "three-body-sim.ui.lock-mode.v1": "origin",
      "three-body-sim.ui.show-origin-marker.v1": "0",
      "three-body-sim.ui.show-grid.v1": "1",
      "three-body-sim.ui.show-center-of-mass.v1": "0",
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadPersistedUiPrefs()).toBe(decoded);
    expect(decodePersistedUiPrefs).toHaveBeenCalledWith({
      panelExpanded: "1",
      lockMode: "origin",
      showOriginMarker: "0",
      showGrid: "1",
      showCenterOfMass: "0",
    });
  });

  it("savePersistedUiPrefs writes each key with expected boolean encoding", () => {
    const storage = makeStorage();
    vi.stubGlobal("localStorage", storage);

    savePersistedUiPrefs({
      panelExpanded: true,
      lockMode: "com",
      showOriginMarker: false,
      showGrid: true,
      showCenterOfMass: false,
    });

    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.panel-expanded.v1", "1");
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.lock-mode.v1", "com");
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.show-origin-marker.v1", "0");
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.show-grid.v1", "1");
    expect(storage.setItem).toHaveBeenCalledWith("three-body-sim.ui.show-center-of-mass.v1", "0");
  });

  it("load/save user presets round-trip through storage and ignore write failures", () => {
    const presets: PresetProfile[] = [
      {
        id: "p1",
        name: "Preset 1",
        description: "",
        bodies: [],
      },
    ];
    vi.mocked(decodePersistedUserPresets).mockReturnValue(presets);

    const storage = makeStorage({
      "three-body-sim.user-presets.v1": '[{"id":"p1"}]',
    });
    vi.stubGlobal("localStorage", storage);

    expect(loadPersistedUserPresets()).toBe(presets);
    expect(decodePersistedUserPresets).toHaveBeenCalledWith('[{"id":"p1"}]');

    savePersistedUserPresets(presets);
    expect(storage.setItem).toHaveBeenCalledWith(
      "three-body-sim.user-presets.v1",
      JSON.stringify(presets),
    );

    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => savePersistedUserPresets(presets)).not.toThrow();
  });
});
