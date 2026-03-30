import { Profiler, useEffect, useMemo, useRef, useState, type ProfilerOnRenderCallback } from "react";
import "./styles.css";
// noinspection ES6PreferShortImport
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
import { useStableCallback } from "./ui/useStableCallback";
import { IDLE_STEP_ACCELERATION, type StepAccelerationState } from "./ui/stepAcceleration";
import {
  adjustedSimulationSpeed,
  diagnosticsSnapshot,
} from "./sim/simulationPolicies";
import {
  clampHistoryMaxSteps,
  getSimulationHistoryMetrics,
  setHistoryMaxSteps,
  type SimulationHistory,
  type SimulationHistoryMetrics,
} from "./sim/simulationHistory";
import { perfMonitor } from "./perf/perfMonitor";

const initialCamera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const FAST_REFRAME_FRAMES = 60;
const MAX_HISTORY_STEPS = 300;
const HISTORY_DEPTH_INPUT_MIN = 50;
const HISTORY_DEPTH_INPUT_MAX = 2000;
const APP_VERSION = __APP_VERSION__;

function App() {
  const [params, setParams] = useState<SimParams>(loadPersistedParams);
  const [userPresets, setUserPresets] = useState<PresetProfile[]>(loadPersistedUserPresets);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [manualPanZoom, setManualPanZoom] = useState<boolean>(false);
  const [historyMetrics, setHistoryMetrics] = useState<SimulationHistoryMetrics>({
    count: 0,
    maxSteps: MAX_HISTORY_STEPS,
    estimatedBytes: 0,
  });
  const [stepAcceleration, setStepAcceleration] = useState<StepAccelerationState>(
    IDLE_STEP_ACCELERATION,
  );
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
  const historyRef = useRef<SimulationHistory>({
    snapshots: [],
    maxSteps: MAX_HISTORY_STEPS,
  });
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
  const syncHistoryMetrics = (nextCount?: number) => {
    const metrics = getSimulationHistoryMetrics(historyRef.current);
    setHistoryMetrics({
      count: nextCount ?? metrics.count,
      maxSteps: metrics.maxSteps,
      estimatedBytes: metrics.estimatedBytes,
    });
  };
  const onHistoryMaxStepsChange = (nextMaxSteps: number) => {
    setHistoryMaxSteps(historyRef, clampHistoryMaxSteps(nextMaxSteps));
    syncHistoryMetrics();
  };
  const onDiagnosticsInsetChange = (nextHeight: number) => {
    const clampedHeight = Math.max(0, nextHeight);
    setDiagnosticsInsetPx((prev) => {
      const changed = prev !== clampedHeight;
      perfMonitor.incrementCounter(
        changed ? "layout.diagnosticsInset.changed" : "layout.diagnosticsInset.unchanged",
      );
      perfMonitor.recordGauge("layout.diagnosticsInset.value", clampedHeight);
      return changed ? clampedHeight : prev;
    });
  };
  const onProfileRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
    perfMonitor.recordReactRender(id, actualDuration, baseDuration);
    perfMonitor.incrementCounter(`react.render.${id}.${phase}`);
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

  const allPresets = useMemo(() => [...PRESETS, ...userPresets], [userPresets]);
  const defaultPresetIds = useMemo(() => PRESETS.map((preset) => preset.id), []);
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

  const { requestRender } = useSimulationLoop({
    canvasRef,
    viewport,
    runtime: {
      isRunning: world.isRunning,
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
      historyRef,
      onHistoryChanged: syncHistoryMetrics,
    },
    hover: {
      hoverBodyIdRef,
      hoverLastUpdateTimeRef,
      refreshHoverTooltipForBodyId,
    },
    setWorld,
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
    onVisualChange: requestRender,
  });
  useEffect(() => {
    if (!world.isRunning) {
      requestRender();
    }
  }, [world, requestRender]);

  const {
    onBodyChange,
    onParamChange,
    onResetParams,
    onStartPause,
    onReset,
    onStep,
    onStepBack,
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
      forceFastZoomInFramesRef,
      hoverLastUpdateTimeRef,
      historyRef,
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
      onHistoryChanged: syncHistoryMetrics,
    },
  });
  const canStepBack = historyMetrics.count > 0;

  useSimulationHotkeys({
    onEscape: () => setManualMode(false),
    onIncreaseRate: () => adjustRateByFactor(1.1),
    onDecreaseRate: () => adjustRateByFactor(1 / 1.1),
    onCycleLockMode,
    onTogglePause: onStartPause,
    onToggleGrid: () => setShowGrid((prev) => !prev),
    onToggleCenterOfMass: () => setShowCenterOfMass((prev) => !prev),
    onToggleOriginMarker: () => setShowOriginMarker((prev) => !prev),
    onStepForward: onStep,
    onStepBack,
    canStepBack,
    onStepAccelerationChange: setStepAcceleration,
  });

  const onTogglePanelExpanded = () => {
    scheduleFastReframe();
    setPanelExpanded((prev) => !prev);
  };

  const diagnostics = diagnosticsSnapshot(world.bodies, params);
  const accelerationActive = stepAcceleration.active;
  const accelerationBurst = stepAcceleration.active ? stepAcceleration.burst : 1;
  const accelerationDirection = stepAcceleration.active ? stepAcceleration.direction : null;
  const hudAccelerationBurst = canStepBack ? accelerationBurst : 1;
  const hudAccelerationDirection = canStepBack ? accelerationDirection : null;
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
    onStepBack,
    canStepBack,
    accelerationActive,
    accelerationBurst: hudAccelerationBurst,
    accelerationDirection: hudAccelerationDirection,
    historySnapshotCount: historyMetrics.count,
    historyMaxSteps: historyMetrics.maxSteps,
    historyEstimatedBytes: historyMetrics.estimatedBytes,
    onHistoryMaxStepsChange,
    historyDepthInputMin: HISTORY_DEPTH_INPUT_MIN,
    historyDepthInputMax: HISTORY_DEPTH_INPUT_MAX,
    onStepAccelerationChange: setStepAcceleration,
    onTogglePanelExpanded,
    onVisibleHeightChange: onDiagnosticsInsetChange,
  });
  const selectedPresetIbcDirty = selectedUserPresetIbcDirty({
    selectedPresetId,
    userPresets,
    draftBodies,
  });
  const onBodyChangeControlPanel = useStableCallback(onBodyChange);
  const onParamChangeControlPanel = useStableCallback(onParamChange);
  const onLockModeChangeControlPanel = useStableCallback(onLockModeChange);
  const onResetParamsControlPanel = useStableCallback(onResetParams);
  const onPresetSelectControlPanel = useStableCallback(setSelectedPresetId);
  const onEditUserPresetControlPanel = useStableCallback(onEditUserPreset);
  const onDeleteUserPresetControlPanel = useStableCallback(onDeleteUserPreset);
  const onApplyPresetControlPanel = useStableCallback(onApplyPreset);
  const onSaveProfileControlPanel = useStableCallback(onOpenSaveProfile);
  const onGenerateRandomStableControlPanel = useStableCallback(onGenerateRandomStable);
  const onGenerateRandomChaoticControlPanel = useStableCallback(onGenerateRandomChaotic);
  return (
    <div className={`layout${panelExpanded ? "" : " panel-collapsed"}`}>
      <Profiler id="ControlPanel" onRender={onProfileRender}>
        <ControlPanel
          bodies={draftBodies}
          params={params}
          appVersion={APP_VERSION}
          presets={allPresets}
          selectedPresetId={selectedPresetId}
          defaultPresetIds={defaultPresetIds}
          selectedUserPresetIbcDirty={selectedPresetIbcDirty}
          lockMode={lockMode}
          manualPanZoom={manualPanZoom}
          showOriginMarker={showOriginMarker}
          showGrid={showGrid}
          showCenterOfMass={showCenterOfMass}
          onBodyChange={onBodyChangeControlPanel}
          onParamChange={onParamChangeControlPanel}
          onLockModeChange={onLockModeChangeControlPanel}
          onToggleManualPanZoom={setManualMode}
          onToggleShowOriginMarker={setShowOriginMarker}
          onToggleShowGrid={setShowGrid}
          onToggleShowCenterOfMass={setShowCenterOfMass}
          onResetParams={onResetParamsControlPanel}
          onPresetSelect={onPresetSelectControlPanel}
          onEditUserPreset={onEditUserPresetControlPanel}
          onDeleteUserPreset={onDeleteUserPresetControlPanel}
          onApplyPreset={onApplyPresetControlPanel}
          onSaveProfile={onSaveProfileControlPanel}
          onGenerateRandomStable={onGenerateRandomStableControlPanel}
          onGenerateRandomChaotic={onGenerateRandomChaoticControlPanel}
        />
      </Profiler>
      <main className="stage-wrap" ref={containerRef}>
        <Profiler id="StageHud" onRender={onProfileRender}>
          <StageHud {...stageHudProps} />
        </Profiler>
        <Profiler id="StageControls" onRender={onProfileRender}>
          <StageControls {...stageControlsProps} />
        </Profiler>
        <Profiler id="CanvasDiagnostics" onRender={onProfileRender}>
          <CanvasDiagnostics {...diagnosticsProps} />
        </Profiler>
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
