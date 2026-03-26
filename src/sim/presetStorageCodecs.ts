import { defaultBodies, defaultParams } from "./defaults";
import { isLockMode, type BodyState, type LockMode, type PresetProfile, type SimParams } from "./types";

export const PRESET_ID_MAX_LENGTH = 64;
export const PRESET_NAME_MAX_LENGTH = 80;
export const PRESET_DESCRIPTION_MAX_LENGTH = 560;

export type PersistedUiPrefs = {
  panelExpanded: boolean;
  lockMode: LockMode;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
};

type PersistedUiPrefsRaw = {
  panelExpanded: string | null;
  lockMode: string | null;
  showOriginMarker: string | null;
  showGrid: string | null;
  showCenterOfMass: string | null;
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

const parsePersistedBoolean = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) {
    return fallback;
  }
  return raw === "1";
};

const parsePersistedLockMode = (raw: string | null): LockMode => (isLockMode(raw) ? raw : "com");

export const decodePersistedParams = (raw: string | null): SimParams => {
  if (!raw) {
    return defaultParams();
  }
  try {
    return sanitizeParams(JSON.parse(raw) as Partial<SimParams>);
  } catch {
    return defaultParams();
  }
};

export const decodePersistedUiPrefs = (raw: PersistedUiPrefsRaw): PersistedUiPrefs => ({
  panelExpanded: parsePersistedBoolean(raw.panelExpanded, true),
  lockMode: parsePersistedLockMode(raw.lockMode),
  showOriginMarker: parsePersistedBoolean(raw.showOriginMarker, true),
  showGrid: parsePersistedBoolean(raw.showGrid, true),
  showCenterOfMass: parsePersistedBoolean(raw.showCenterOfMass, true),
});

export const decodePersistedUserPresets = (raw: string | null): PresetProfile[] => {
  if (!raw) {
    return [];
  }
  try {
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
      if (!id || !name || !bodies || seenIds.has(id)) {
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
