import { useRef, useState } from "react";
import "./styles.css";
import type { TrailMap } from "./render/canvasRenderer";
import type { Camera } from "./sim/camera";
import { defaultBodies, defaultParams, initialWorld } from "./sim/defaults";
import {
  loadPersistedParams,
  loadPersistedUserPresets,
} from "./sim/presetStorage";
import { PRESETS } from "./sim/presets";
import type {
  BodyState,
  DiagnosticsSnapshot,
  LockMode,
  PresetProfile,
  SimParams,
  WorldState,
} from "./sim/types";
import { CanvasDiagnostics } from "./ui/CanvasDiagnostics";
import { ControlPanel } from "./ui/ControlPanel";
import { EditProfileDialog } from "./ui/EditProfileDialog";
import { SaveProfileDialog } from "./ui/SaveProfileDialog";
import { StageControls } from "./ui/stage/StageControls";
import { StageHud } from "./ui/stage/StageHud";
import { HoverTooltip } from "./ui/stage/HoverTooltip";
import { useCanvasCameraControls } from "./ui/useCanvasCameraControls";
import { useStageViewport } from "./ui/useStageViewport";
import { useSimulationHotkeys } from "./ui/useSimulationHotkeys";
import { useSimulationLoop } from "./sim/useSimulationLoop";
import { useHoverTooltipState } from "./ui/useHoverTooltipState";
import { useSimulationSession } from "./sim/useSimulationSession";
import { useUserPresetCommands } from "./sim/useUserPresetCommands";
import { selectedUserPresetIbcDirty } from "./sim/profileValidation";
import { useAppPersistence } from "./ui/useAppPersistence";
import { useAppRuntimeState } from "./ui/useAppRuntimeState";
import { useAppUiPreferences } from "./ui/useAppUiPreferences";
import { useAppViewModels } from "./ui/useAppViewModels";
import {
  adjustedSimulationSpeed,
  diagnosticsSnapshot,
} from "./sim/simulationPolicies";

const initialCamera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const FAST_REFRAME_FRAMES = 60;
const APP_VERSION = __APP_VERSION__;

function App() {
  const [params, setParams] = useState<SimParams>(loadPersistedParams);
  const [userPresets, setUserPresets] = useState<PresetProfile[]>(loadPersistedUserPresets);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [manualPanZoom, setManualPanZoom] = useState<boolean>(false);
  const {
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
  } = useAppUiPreferences();
  const [diagnosticsInsetPx, setDiagnosticsInsetPx] = useState<number>(0);
  const [baselineDiagnostics, setBaselineDiagnostics] = useState<DiagnosticsSnapshot>(() =>
    diagnosticsSnapshot(initialWorld().bodies, defaultParams()),
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const cameraRef = useRef(initialCamera);
  const trailsRef = useRef<TrailMap>({});
  const forceFastZoomInFramesRef = useRef(FAST_REFRAME_FRAMES);
  const simStepCounterRef = useRef(0);
  const { worldRef, paramsRef, manualPanZoomRef, setManualMode } = useAppRuntimeState({
    world,
    params,
    manualPanZoom,
    setManualPanZoom,
  });
  const viewport = useStageViewport({ containerRef, canvasRef, diagnosticsInsetPx });
  const {
    hoverBody,
    hoverBodyIdRef,
    hoverLastUpdateTimeRef,
    clearHoverBody,
    updateBodyHoverTooltip,
    refreshHoverTooltipForBodyId,
  } = useHoverTooltipState({
    worldRef,
    paramsRef,
    cameraRef,
    viewport,
  });

  const scheduleFastReframe = () => {
    cameraRef.current = { ...initialCamera };
    forceFastZoomInFramesRef.current = FAST_REFRAME_FRAMES;
  };

  useAppPersistence({
    params,
    panelExpanded,
    lockMode,
    showOriginMarker,
    showGrid,
    showCenterOfMass,
    userPresets,
  });

  const {
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUpOrCancel,
    onCanvasPointerLeave,
    onCanvasWheel,
    onCanvasDoubleClick,
  } = useCanvasCameraControls({
    cameraRef,
    viewport,
    manualPanZoomRef,
    setManualMode,
    onPointerHover: updateBodyHoverTooltip,
    onPointerHoverClear: clearHoverBody,
  });

  const allPresets = [...PRESETS, ...userPresets];
  const {
    saveProfileDraft,
    editProfileDraft,
    onOpenSaveProfile,
    onSaveProfileFieldChange,
    onCancelSaveProfile,
    onConfirmSaveProfile,
    onDeleteUserPreset,
    onEditUserPreset,
    onEditProfileFieldChange,
    onCancelEditProfile,
    onConfirmEditProfile,
  } = useUserPresetCommands({
    userPresets,
    setUserPresets,
    allPresets,
    selectedPresetId,
    setSelectedPresetId,
    defaultPresetId: PRESETS[0].id,
    draftBodies,
    getCurrentParams: () => paramsRef.current,
  });

  const onLockModeChange = (mode: LockMode) => {
    setManualMode(false);
    setLockMode(mode);
  };

  const onCycleLockMode = () => {
    onLockModeChange(lockMode === "none" ? "com" : lockMode === "com" ? "origin" : "none");
  };

  const adjustRateByFactor = (factor: number) => {
    const current = paramsRef.current.speed;
    const nextSpeed = adjustedSimulationSpeed(current, factor);
    if (nextSpeed === current) {
      return;
    }
    const next = { ...paramsRef.current, speed: nextSpeed };
    paramsRef.current = next;
    setParams(next);
  };

  useSimulationHotkeys({
    onEscape: () => setManualMode(false),
    onIncreaseRate: () => adjustRateByFactor(1.1),
    onDecreaseRate: () => adjustRateByFactor(1 / 1.1),
    onCycleLockMode,
    onTogglePause: onStartPause,
    onStepForward: () => (worldRef.current.isRunning ? onStartPause() : onStep()),
  });

  useSimulationLoop({
    canvasRef,
    viewport,
    runtime: {
      lockMode,
      manualPanZoom,
      showOriginMarker,
      showGrid,
      showCenterOfMass,
    },
    refs: {
      worldRef,
      paramsRef,
      cameraRef,
      trailsRef,
      rafRef,
      lastTimeRef,
      accumulatorRef,
      forceFastZoomInFramesRef,
      simStepCounterRef,
    },
    hover: {
      hoverBodyIdRef,
      hoverLastUpdateTimeRef,
      refreshHoverTooltipForBodyId,
    },
    setWorld,
  });

  const {
    onBodyChange,
    onParamChange,
    onResetParams,
    onStartPause,
    onReset,
    onStep,
    onApplyPreset,
    onGenerateRandomStable,
    onGenerateRandomChaotic,
  } = useSimulationSession({
    session: {
      draftBodies,
      allPresets,
      selectedPresetId,
      bodyColors: BODY_COLORS,
    },
    runtimeRefs: {
      worldRef,
      paramsRef,
      trailsRef,
      accumulatorRef,
      lastTimeRef,
      simStepCounterRef,
    },
    stateSetters: {
      setWorld,
      setParams,
      setDraftBodies,
      setBaselineDiagnostics,
    },
    controls: {
      setManualMode,
      scheduleFastReframe,
    },
  });

  const onTogglePanelExpanded = () => {
    scheduleFastReframe();
    setPanelExpanded((prev) => !prev);
  };

  const diagnostics = diagnosticsSnapshot(world.bodies, params);
  const {
    stageHudProps,
    stageControlsProps,
    diagnosticsProps,
  } = useAppViewModels({
    world,
    params,
    panelExpanded,
    lockMode,
    manualPanZoom,
    bodyColors: BODY_COLORS,
    baselineDiagnostics,
    diagnostics,
    onStartPause,
    onReset,
    onStep,
    onTogglePanelExpanded,
    onVisibleHeightChange: setDiagnosticsInsetPx,
  });
  const selectedPresetIbcDirty = selectedUserPresetIbcDirty({
    selectedPresetId,
    userPresets,
    draftBodies,
  });
  return (
    <div className={`layout${panelExpanded ? "" : " panel-collapsed"}`}>
      <ControlPanel
        bodies={draftBodies}
        params={params}
        appVersion={APP_VERSION}
        presets={allPresets}
        selectedPresetId={selectedPresetId}
        defaultPresetIds={PRESETS.map((preset) => preset.id)}
        selectedUserPresetIbcDirty={selectedPresetIbcDirty}
        lockMode={lockMode}
        manualPanZoom={manualPanZoom}
        showOriginMarker={showOriginMarker}
        showGrid={showGrid}
        showCenterOfMass={showCenterOfMass}
        onBodyChange={onBodyChange}
        onParamChange={onParamChange}
        onLockModeChange={onLockModeChange}
        onToggleManualPanZoom={setManualMode}
        onToggleShowOriginMarker={setShowOriginMarker}
        onToggleShowGrid={setShowGrid}
        onToggleShowCenterOfMass={setShowCenterOfMass}
        onResetParams={onResetParams}
        onPresetSelect={setSelectedPresetId}
        onEditUserPreset={onEditUserPreset}
        onDeleteUserPreset={onDeleteUserPreset}
        onApplyPreset={onApplyPreset}
        onSaveProfile={onOpenSaveProfile}
        onGenerateRandomStable={onGenerateRandomStable}
        onGenerateRandomChaotic={onGenerateRandomChaotic}
      />
      <main className="stage-wrap" ref={containerRef}>
        <StageHud {...stageHudProps} />
        <StageControls {...stageControlsProps} />
        <CanvasDiagnostics {...diagnosticsProps} />
        <canvas
          ref={canvasRef}
          className={`stage${manualPanZoom ? " stage-manual" : ""}`}
          style={{ height: `calc(100% - ${Math.max(0, diagnosticsInsetPx)}px)` }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUpOrCancel}
          onPointerCancel={onCanvasPointerUpOrCancel}
          onPointerLeave={onCanvasPointerLeave}
          onWheel={onCanvasWheel}
          onDoubleClick={onCanvasDoubleClick}
        />
        <HoverTooltip
          hoverBody={hoverBody}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
        />
      </main>
      <SaveProfileDialog
        draft={saveProfileDraft}
        onFieldChange={onSaveProfileFieldChange}
        onSave={onConfirmSaveProfile}
        onCancel={onCancelSaveProfile}
      />
      <EditProfileDialog
        draft={editProfileDraft}
        onFieldChange={onEditProfileFieldChange}
        onSave={onConfirmEditProfile}
        onCancel={onCancelEditProfile}
      />
    </div>
  );
}

export default App;
