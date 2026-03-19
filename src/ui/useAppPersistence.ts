import { useEffect } from "react";
import {
  savePersistedParams,
  savePersistedUiPrefs,
  savePersistedUserPresets,
  type PersistedLockMode,
} from "../sim/presetStorage";
import type { PresetProfile, SimParams } from "../sim/types";

type UseAppPersistenceParams = {
  params: SimParams;
  panelExpanded: boolean;
  lockMode: PersistedLockMode;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  userPresets: PresetProfile[];
};

export const useAppPersistence = ({
  params,
  panelExpanded,
  lockMode,
  showOriginMarker,
  showGrid,
  showCenterOfMass,
  userPresets,
}: UseAppPersistenceParams): void => {
  useEffect(() => {
    savePersistedParams(params);
  }, [params]);

  useEffect(() => {
    savePersistedUiPrefs({
      panelExpanded,
      lockMode,
      showOriginMarker,
      showGrid,
      showCenterOfMass,
    });
  }, [lockMode, panelExpanded, showCenterOfMass, showGrid, showOriginMarker]);

  useEffect(() => {
    savePersistedUserPresets(userPresets);
  }, [userPresets]);
};
