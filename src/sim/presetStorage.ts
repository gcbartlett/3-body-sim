import {
  decodePersistedParams,
  decodePersistedUiPrefs,
  decodePersistedUserPresets,
  PRESET_DESCRIPTION_MAX_LENGTH,
  PRESET_ID_MAX_LENGTH,
  PRESET_NAME_MAX_LENGTH,
  sanitizePresetDescription,
  sanitizePresetId,
  sanitizePresetName,
  type PersistedUiPrefs,
} from "./presetStorageCodecs";
import type { PresetProfile, SimParams } from "./types";

const PARAMS_STORAGE_KEY = "three-body-sim.params.v1";
const USER_PRESETS_STORAGE_KEY = "three-body-sim.user-presets.v1";
const PANEL_EXPANDED_STORAGE_KEY = "three-body-sim.ui.panel-expanded.v1";
const LOCK_MODE_STORAGE_KEY = "three-body-sim.ui.lock-mode.v1";
const SHOW_ORIGIN_MARKER_STORAGE_KEY = "three-body-sim.ui.show-origin-marker.v1";
const SHOW_GRID_STORAGE_KEY = "three-body-sim.ui.show-grid.v1";
const SHOW_CENTER_OF_MASS_STORAGE_KEY = "three-body-sim.ui.show-center-of-mass.v1";

export {
  PRESET_DESCRIPTION_MAX_LENGTH,
  PRESET_ID_MAX_LENGTH,
  PRESET_NAME_MAX_LENGTH,
  sanitizePresetDescription,
  sanitizePresetId,
  sanitizePresetName,
};

const readStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const loadPersistedParams = (): SimParams => {
  return decodePersistedParams(readStorageItem(PARAMS_STORAGE_KEY));
};

export const savePersistedParams = (params: SimParams): void => {
  try {
    localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};

export const loadPersistedUiPrefs = (): PersistedUiPrefs => {
  return decodePersistedUiPrefs({
    panelExpanded: readStorageItem(PANEL_EXPANDED_STORAGE_KEY),
    lockMode: readStorageItem(LOCK_MODE_STORAGE_KEY),
    showOriginMarker: readStorageItem(SHOW_ORIGIN_MARKER_STORAGE_KEY),
    showGrid: readStorageItem(SHOW_GRID_STORAGE_KEY),
    showCenterOfMass: readStorageItem(SHOW_CENTER_OF_MASS_STORAGE_KEY),
  });
};

export const savePersistedUiPrefs = (prefs: PersistedUiPrefs): void => {
  try {
    localStorage.setItem(PANEL_EXPANDED_STORAGE_KEY, prefs.panelExpanded ? "1" : "0");
    localStorage.setItem(LOCK_MODE_STORAGE_KEY, prefs.lockMode);
    localStorage.setItem(SHOW_ORIGIN_MARKER_STORAGE_KEY, prefs.showOriginMarker ? "1" : "0");
    localStorage.setItem(SHOW_GRID_STORAGE_KEY, prefs.showGrid ? "1" : "0");
    localStorage.setItem(SHOW_CENTER_OF_MASS_STORAGE_KEY, prefs.showCenterOfMass ? "1" : "0");
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};

export const loadPersistedUserPresets = (): PresetProfile[] => {
  return decodePersistedUserPresets(readStorageItem(USER_PRESETS_STORAGE_KEY));
};

export const savePersistedUserPresets = (userPresets: PresetProfile[]): void => {
  try {
    localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(userPresets));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};
