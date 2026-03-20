import { defaultBodies, defaultParams } from "./defaults";
import { isLockMode, type BodyState, type LockMode, type PresetProfile, type SimParams } from "./types";

const PARAMS_STORAGE_KEY = "three-body-sim.params.v1";
const USER_PRESETS_STORAGE_KEY = "three-body-sim.user-presets.v1";
const PANEL_EXPANDED_STORAGE_KEY = "three-body-sim.ui.panel-expanded.v1";
const LOCK_MODE_STORAGE_KEY = "three-body-sim.ui.lock-mode.v1";
const SHOW_ORIGIN_MARKER_STORAGE_KEY = "three-body-sim.ui.show-origin-marker.v1";
const SHOW_GRID_STORAGE_KEY = "three-body-sim.ui.show-grid.v1";
const SHOW_CENTER_OF_MASS_STORAGE_KEY = "three-body-sim.ui.show-center-of-mass.v1";

export const PRESET_ID_MAX_LENGTH = 64;
export const PRESET_NAME_MAX_LENGTH = 80;
export const PRESET_DESCRIPTION_MAX_LENGTH = 280;

type PersistedUiPrefs = {
  panelExpanded: boolean;
  lockMode: LockMode;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
};

const sanitizeParams = (candidate: Partial<SimParams> | null | undefined): SimParams => {
  const base = defaultParams();
  if (!candidate) {
    return base;
  }
  const safe = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return {
    G: Math.max(0, safe(candidate.G, base.G)),
    dt: Math.max(0.0001, safe(candidate.dt, base.dt)),
    speed: Math.max(0.01, safe(candidate.speed, base.speed)),
    softening: Math.max(0, safe(candidate.softening, base.softening)),
    trailFade: Math.max(0.0001, safe(candidate.trailFade, base.trailFade)),
  };
};

const stripControlChars = (value: string, allowNewlines = false): string => {
  // Intentional: sanitize ASCII control chars (U+0000-U+001F and U+007F).
  /* eslint-disable no-control-regex */
  const pattern = allowNewlines
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  /* eslint-enable no-control-regex */
  return value.replace(pattern, "");
};

export const sanitizePresetId = (value: string): string => {
  const normalized = stripControlChars(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return normalized.slice(0, PRESET_ID_MAX_LENGTH);
};

export const sanitizePresetName = (value: string): string =>
  stripControlChars(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, PRESET_NAME_MAX_LENGTH);

export const sanitizePresetDescription = (value: string): string =>
  stripControlChars(value, true)
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, PRESET_DESCRIPTION_MAX_LENGTH);

const sanitizeBodyArray = (candidate: unknown): BodyState[] | null => {
  if (!Array.isArray(candidate) || candidate.length !== 3) {
    return null;
  }
  const defaultSet = defaultBodies();
  const safeNumber = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return candidate.map((body, index) => {
    const fallback = defaultSet[index];
    const source = body as Partial<BodyState> | null;
    const sourcePosition = source?.position as Partial<{ x: number; y: number }> | undefined;
    const sourceVelocity = source?.velocity as Partial<{ x: number; y: number }> | undefined;

    return {
      id: fallback.id,
      color: fallback.color,
      mass: Math.max(0.001, safeNumber(source?.mass, fallback.mass)),
      position: {
        x: safeNumber(sourcePosition?.x, fallback.position.x),
        y: safeNumber(sourcePosition?.y, fallback.position.y),
      },
      velocity: {
        x: safeNumber(sourceVelocity?.x, fallback.velocity.x),
        y: safeNumber(sourceVelocity?.y, fallback.velocity.y),
      },
    };
  });
};

export const loadPersistedParams = (): SimParams => {
  try {
    const raw = localStorage.getItem(PARAMS_STORAGE_KEY);
    if (!raw) {
      return defaultParams();
    }
    return sanitizeParams(JSON.parse(raw) as Partial<SimParams>);
  } catch {
    return defaultParams();
  }
};

export const savePersistedParams = (params: SimParams): void => {
  try {
    localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};

export const loadPersistedUiPrefs = (): PersistedUiPrefs => {
  const loadBoolean = (storageKey: string, fallback: boolean): boolean => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) {
        return fallback;
      }
      return raw === "1";
    } catch {
      return fallback;
    }
  };

  let lockMode: LockMode = "com";
  try {
    const raw = localStorage.getItem(LOCK_MODE_STORAGE_KEY);
    if (isLockMode(raw)) {
      lockMode = raw;
    }
  } catch {
    lockMode = "com";
  }

  return {
    panelExpanded: loadBoolean(PANEL_EXPANDED_STORAGE_KEY, true),
    lockMode,
    showOriginMarker: loadBoolean(SHOW_ORIGIN_MARKER_STORAGE_KEY, true),
    showGrid: loadBoolean(SHOW_GRID_STORAGE_KEY, true),
    showCenterOfMass: loadBoolean(SHOW_CENTER_OF_MASS_STORAGE_KEY, true),
  };
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
  try {
    const raw = localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seenIds = new Set<string>();
    const safePresets: PresetProfile[] = [];
    for (const item of parsed) {
      const source = item as Partial<PresetProfile> | null;
      const id = typeof source?.id === "string" ? sanitizePresetId(source.id) : "";
      const name = typeof source?.name === "string" ? sanitizePresetName(source.name) : "";
      const description =
        typeof source?.description === "string"
          ? sanitizePresetDescription(source.description)
          : "";
      const bodies = sanitizeBodyArray(source?.bodies);
      if (!id || !name || !description || !bodies || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      safePresets.push({
        id,
        name,
        description,
        bodies,
        params: sanitizeParams(source?.params),
      });
    }
    return safePresets;
  } catch {
    return [];
  }
};

export const savePersistedUserPresets = (userPresets: PresetProfile[]): void => {
  try {
    localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(userPresets));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};
