import { useState, type Dispatch, type SetStateAction } from "react";
import { loadPersistedUiPrefs } from "../sim/presetStorage";
import type { LockMode } from "../sim/types";

type UseAppUiPreferencesResult = {
  lockMode: LockMode;
  setLockMode: Dispatch<SetStateAction<LockMode>>;
  showOriginMarker: boolean;
  setShowOriginMarker: Dispatch<SetStateAction<boolean>>;
  showGrid: boolean;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  showCenterOfMass: boolean;
  setShowCenterOfMass: Dispatch<SetStateAction<boolean>>;
  panelExpanded: boolean;
  setPanelExpanded: Dispatch<SetStateAction<boolean>>;
};

export const useAppUiPreferences = (): UseAppUiPreferencesResult => {
  const [initialUiPrefs] = useState(loadPersistedUiPrefs);
  const [lockMode, setLockMode] = useState<LockMode>(initialUiPrefs.lockMode);
  const [showOriginMarker, setShowOriginMarker] = useState<boolean>(initialUiPrefs.showOriginMarker);
  const [showGrid, setShowGrid] = useState<boolean>(initialUiPrefs.showGrid);
  const [showCenterOfMass, setShowCenterOfMass] = useState<boolean>(initialUiPrefs.showCenterOfMass);
  const [panelExpanded, setPanelExpanded] = useState<boolean>(initialUiPrefs.panelExpanded);

  return {
    lockMode,
    setLockMode,
    showOriginMarker,
    setShowOriginMarker,
    showGrid,
    setShowGrid,
    showCenterOfMass,
    setShowCenterOfMass,
    panelExpanded,
    setPanelExpanded,
  };
};
