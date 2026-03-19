import { useEffect, useRef, useState } from "react";
import "./styles.css";
import type { TrailMap } from "./render/canvasRenderer";
import type { Camera } from "./sim/camera";
import { defaultBodies, defaultParams, initialWorld } from "./sim/defaults";
import {
  EJECTION_TIME_THRESHOLD_SECONDS,
} from "./sim/ejection";
import {
  loadPersistedParams,
  loadPersistedUiPrefs,
  loadPersistedUserPresets,
  type PersistedLockMode,
} from "./sim/presetStorage";
import { PRESETS } from "./sim/presets";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./sim/types";
import { CanvasDiagnostics } from "./ui/CanvasDiagnostics";
import { ControlPanel } from "./ui/ControlPanel";
import { SaveProfileDialog } from "./ui/SaveProfileDialog";
import { StageControls } from "./ui/stage/StageControls";
import { StageHud } from "./ui/stage/StageHud";
import { HoverTooltip } from "./ui/stage/HoverTooltip";
import { useCanvasCameraControls } from "./ui/useCanvasCameraControls";
import { useSaveProfileDraft } from "./ui/useSaveProfileDraft";
import { useStageViewport } from "./ui/useStageViewport";
import { useSimulationHotkeys } from "./ui/useSimulationHotkeys";
import { useSimulationLoop } from "./sim/useSimulationLoop";
import { useHoverTooltipState } from "./ui/useHoverTooltipState";
import { useSimulationSession } from "./sim/useSimulationSession";
import { buildSavedPresetFromDraft } from "./sim/profileValidation";
import { useAppPersistence } from "./ui/useAppPersistence";
import {
  adjustedSimulationSpeed,
  diagnosticsSnapshot,
  DISSOLUTION_TIME_THRESHOLD_SECONDS,
} from "./sim/simulationPolicies";
import {
  bodyEjectionStatusesForDisplay,
  bodyVectorsForDisplay,
  boundPairStateLabel,
  DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  displayPairStateFromEnergies,
  pairEnergiesForBodies,
  stageViewModelForWorld,
} from "./sim/simulationSelectors";

type LockMode = PersistedLockMode;

const initialCamera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const FAST_REFRAME_FRAMES = 60;

function App() {
  const [initialUiPrefs] = useState(loadPersistedUiPrefs);
  const [params, setParams] = useState<SimParams>(loadPersistedParams);
  const [userPresets, setUserPresets] = useState<PresetProfile[]>(loadPersistedUserPresets);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [lockMode, setLockMode] = useState<LockMode>(initialUiPrefs.lockMode);
  const [manualPanZoom, setManualPanZoom] = useState<boolean>(false);
  const [showOriginMarker, setShowOriginMarker] = useState<boolean>(initialUiPrefs.showOriginMarker);
  const [showGrid, setShowGrid] = useState<boolean>(initialUiPrefs.showGrid);
  const [showCenterOfMass, setShowCenterOfMass] = useState<boolean>(initialUiPrefs.showCenterOfMass);
  const [panelExpanded, setPanelExpanded] = useState<boolean>(initialUiPrefs.panelExpanded);
  const [diagnosticsInsetPx, setDiagnosticsInsetPx] = useState<number>(0);
  const [baselineDiagnostics, setBaselineDiagnostics] = useState<DiagnosticsSnapshot>(() =>
    diagnosticsSnapshot(initialWorld().bodies, defaultParams()),
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const worldRef = useRef(world);
  const paramsRef = useRef(params);
  const cameraRef = useRef(initialCamera);
  const trailsRef = useRef<TrailMap>({});
  const forceFastZoomInFramesRef = useRef(FAST_REFRAME_FRAMES);
  const simStepCounterRef = useRef(0);
  const manualPanZoomRef = useRef(manualPanZoom);
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

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useAppPersistence({
    params,
    panelExpanded,
    lockMode,
    showOriginMarker,
    showGrid,
    showCenterOfMass,
    userPresets,
  });

  useEffect(() => {
    manualPanZoomRef.current = manualPanZoom;
  }, [manualPanZoom]);

  const setManualMode = (enabled: boolean) => {
    manualPanZoomRef.current = enabled;
    setManualPanZoom(enabled);
  };

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
    beginSaveProfileDraft,
    onSaveProfileFieldChange,
    cancelSaveProfileDraft,
  } = useSaveProfileDraft(allPresets);

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
    lockMode,
    onEscape: () => setManualMode(false),
    onIncreaseRate: () => adjustRateByFactor(1.1),
    onDecreaseRate: () => adjustRateByFactor(1 / 1.1),
    onCycleLockMode,
  });

  useSimulationLoop({
    canvasRef,
    viewport,
    lockMode,
    manualPanZoom,
    showOriginMarker,
    showGrid,
    showCenterOfMass,
    worldRef,
    paramsRef,
    cameraRef,
    trailsRef,
    rafRef,
    lastTimeRef,
    accumulatorRef,
    forceFastZoomInFramesRef,
    simStepCounterRef,
    hoverBodyIdRef,
    hoverLastUpdateTimeRef,
    setWorld,
    refreshHoverTooltipForBodyId,
  });

  const onSaveProfile = () => {
    beginSaveProfileDraft();
  };

  const onConfirmSaveProfile = () => {
    if (!saveProfileDraft) {
      return;
    }
    const result = buildSavedPresetFromDraft({
      draft: saveProfileDraft,
      existingIds: allPresets.map((preset) => preset.id),
      bodies: draftBodies,
      params: paramsRef.current,
    });
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    const savedPreset: PresetProfile = result.preset;
    setUserPresets((prev) => [...prev, savedPreset]);
    setSelectedPresetId(savedPreset.id);
    cancelSaveProfileDraft();
  };

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
    draftBodies,
    allPresets,
    selectedPresetId,
    bodyColors: BODY_COLORS,
    worldRef,
    paramsRef,
    trailsRef,
    accumulatorRef,
    lastTimeRef,
    simStepCounterRef,
    setWorld,
    setParams,
    setDraftBodies,
    setBaselineDiagnostics,
    setManualMode,
    scheduleFastReframe,
  });

  const onTogglePanelExpanded = () => {
    scheduleFastReframe();
    setPanelExpanded((prev) => !prev);
  };

  const diagnostics = diagnosticsSnapshot(world.bodies, params);
  const { eps12, eps13, eps23 } = pairEnergiesForBodies(world.bodies, params);
  const displayPairState = displayPairStateFromEnergies(
    eps12,
    eps13,
    eps23,
    world.ejectedBodyIds.length > 0,
    DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  );
  const boundPairState = boundPairStateLabel(displayPairState, world.dissolutionDetected);
  const bodyVectors = bodyVectorsForDisplay(world.bodies, params);
  const bodyEjectionStatuses = bodyEjectionStatusesForDisplay(
    world,
    params,
    EJECTION_TIME_THRESHOLD_SECONDS,
  );
  const stageViewModel = stageViewModelForWorld({
    world,
    lockMode,
    manualPanZoom,
    bodyColors: BODY_COLORS,
    pairStateLabel: boundPairState,
  });
  return (
    <div className={`layout${panelExpanded ? "" : " panel-collapsed"}`}>
      <ControlPanel
        bodies={draftBodies}
        params={params}
        isRunning={world.isRunning}
        presets={allPresets}
        selectedPresetId={selectedPresetId}
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
        onApplyPreset={onApplyPreset}
        onSaveProfile={onSaveProfile}
        onGenerateRandomStable={onGenerateRandomStable}
        onGenerateRandomChaotic={onGenerateRandomChaotic}
      />
      <main className="stage-wrap" ref={containerRef}>
        <StageHud
          statusLabel={stageViewModel.statusLabel}
          ejectedStatusRows={stageViewModel.ejectedStatusRows}
          elapsedTime={world.elapsedTime}
          speed={params.speed}
          panelExpanded={panelExpanded}
          onTogglePanelExpanded={onTogglePanelExpanded}
        />
        <StageControls
          runButtonLabel={stageViewModel.runButtonLabel}
          runButtonTooltip={stageViewModel.runButtonTooltip}
          onStartPause={onStartPause}
          onReset={onReset}
          onStep={onStep}
          ejectedBodyId={world.ejectedBodyId}
          latestEjectedLabel={stageViewModel.latestEjectedLabel}
          dissolutionJustDetected={world.dissolutionJustDetected}
        />
        <CanvasDiagnostics
          pairEnergies={{ e12: eps12, e13: eps13, e23: eps23 }}
          displayPairState={{
            nbound: displayPairState.nbound,
            state: displayPairState.state,
            eps: DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
          }}
          dissolutionCounterSec={world.dissolutionCounterSec}
          dissolutionThresholdSec={DISSOLUTION_TIME_THRESHOLD_SECONDS}
          dissolutionDetected={world.dissolutionDetected}
          diagnostics={diagnostics}
          baselineDiagnostics={baselineDiagnostics}
          bodyVectors={bodyVectors}
          bodyEjectionStatuses={bodyEjectionStatuses}
          onVisibleHeightChange={setDiagnosticsInsetPx}
        />
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
        onCancel={cancelSaveProfileDraft}
      />
    </div>
  );
}

export default App;
