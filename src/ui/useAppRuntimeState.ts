import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SimParams, WorldState } from "../sim/types";

type UseAppRuntimeStateArgs = {
  world: WorldState;
  params: SimParams;
  manualPanZoom: boolean;
  setManualPanZoom: Dispatch<SetStateAction<boolean>>;
  onManualModeDisabled?: () => void;
};

export const shouldNotifyManualModeDisabled = (
  wasEnabled: boolean,
  nextEnabled: boolean,
): boolean => wasEnabled && !nextEnabled;

export const useAppRuntimeState = ({
  world,
  params,
  manualPanZoom,
  setManualPanZoom,
  onManualModeDisabled,
}: UseAppRuntimeStateArgs) => {
  const worldRef = useRef(world);
  const paramsRef = useRef(params);
  const manualPanZoomRef = useRef(manualPanZoom);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    manualPanZoomRef.current = manualPanZoom;
  }, [manualPanZoom]);

  const setManualMode = useCallback((enabled: boolean) => {
    const wasEnabled = manualPanZoomRef.current;
    manualPanZoomRef.current = enabled;
    setManualPanZoom(enabled);
    if (shouldNotifyManualModeDisabled(wasEnabled, enabled)) {
      onManualModeDisabled?.();
    }
  }, [onManualModeDisabled, setManualPanZoom]);

  return {
    worldRef,
    paramsRef,
    manualPanZoomRef,
    setManualMode,
  };
};
