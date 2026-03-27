export type SectionOpenState = {
  presetsOpen: boolean;
  simParamsOpen: boolean;
  bodyConfigOpen: boolean;
};

const UI_SECTIONS_STORAGE_KEY = "three-body-sim.ui.sections.v1";
const CANVAS_DIAGNOSTICS_STORAGE_KEY = "three-body-sim.ui.canvas-diagnostics.v1";
const APP_LIKED_STORAGE_KEY = "three-body-sim.ui.app-liked.v1";

export const loadSectionOpenState = (): SectionOpenState => {
  const fallback: SectionOpenState = {
    presetsOpen: true,
    simParamsOpen: false,
    bodyConfigOpen: false,
  };
  try {
    const raw = localStorage.getItem(UI_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<SectionOpenState>;
    return {
      presetsOpen: parsed.presetsOpen === undefined ? true : Boolean(parsed.presetsOpen),
      simParamsOpen: Boolean(parsed.simParamsOpen),
      bodyConfigOpen: Boolean(parsed.bodyConfigOpen),
    };
  } catch {
    return fallback;
  }
};

export const saveSectionOpenState = (state: SectionOpenState): void => {
  try {
    localStorage.setItem(UI_SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};

export const loadCanvasDiagnosticsOpenState = (): boolean => {
  try {
    const raw = localStorage.getItem(CANVAS_DIAGNOSTICS_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    return raw === "1";
  } catch {
    return false;
  }
};

export const saveCanvasDiagnosticsOpenState = (isOpen: boolean): void => {
  try {
    localStorage.setItem(CANVAS_DIAGNOSTICS_STORAGE_KEY, isOpen ? "1" : "0");
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};

export const loadAppLikedState = (): boolean => {
  try {
    return localStorage.getItem(APP_LIKED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const saveAppLikedState = (liked: boolean): void => {
  try {
    localStorage.setItem(APP_LIKED_STORAGE_KEY, liked ? "1" : "0");
  } catch {
    // Ignore storage failures (quota/private mode).
  }
};
