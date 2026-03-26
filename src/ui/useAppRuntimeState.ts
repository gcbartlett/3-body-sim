import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SimParams, WorldState } from "../sim/types";

type UseAppRuntimeStateArgs = {
  world: WorldState;
  params: SimParams;
  manualPanZoom: boolean;
  setManualPanZoom: Dispatch<SetStateAction<boolean>>;
};

export const useAppRuntimeState = ({
  world,
  params,
  manualPanZoom,
  setManualPanZoom,
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

  const setManualMode = (enabled: boolean) => {
    manualPanZoomRef.current = enabled;
    setManualPanZoom(enabled);
  };

  return {
    worldRef,
    paramsRef,
    manualPanZoomRef,
    setManualMode,
  };
};

