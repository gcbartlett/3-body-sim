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
  sanitizePresetDescription,
  sanitizePresetId,
  sanitizePresetName,
  savePersistedParams,
  savePersistedUiPrefs,
  savePersistedUserPresets,
  type PersistedLockMode,
} from "./sim/presetStorage";
import { totalEnergy, totalMomentum } from "./sim/physics";
import { PRESETS, cloneBodies } from "./sim/presets";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./sim/types";
import { createStoppedWorld } from "./sim/worldState";
import { CanvasDiagnostics } from "./ui/CanvasDiagnostics";
import { ControlPanel } from "./ui/ControlPanel";
import { SaveProfileDialog } from "./ui/SaveProfileDialog";
import { StageControls } from "./ui/stage/StageControls";
import { StageHud } from "./ui/stage/StageHud";
import { useCanvasCameraControls } from "./ui/useCanvasCameraControls";
import { useSaveProfileDraft } from "./ui/useSaveProfileDraft";
import { useStageViewport } from "./ui/useStageViewport";
import { useSimulationHotkeys } from "./ui/useSimulationHotkeys";
import { useSimulationLoop } from "./sim/useSimulationLoop";
import { useHoverTooltipState } from "./ui/useHoverTooltipState";
import { useSimulationSession } from "./sim/useSimulationSession";
import {
  bodyEjectionStatusesForDisplay,
  bodyVectorsForDisplay,
  boundPairStateLabel,
  DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  displayPairStateFromEnergies,
  ejectedBodiesForStatus,
  latestEjectedLabelForStatus,
  pairBindingStateForBodies,
  pairEnergiesForBodies,
  statusLabelForWorld,
} from "./sim/simulationSelectors";

type LockMode = PersistedLockMode;

const initialCamera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

const applyBodyField = (
  body: BodyState,
  field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y",
  value: number,
): BodyState => {
  if (field === "mass") {
    return { ...body, mass: Math.max(0.001, value) };
  }
  if (field === "position.x") {
    return { ...body, position: { ...body.position, x: value } };
  }
  if (field === "position.y") {
    return { ...body, position: { ...body.position, y: value } };
  }
  if (field === "velocity.x") {
    return { ...body, velocity: { ...body.velocity, x: value } };
  }
  return { ...body, velocity: { ...body.velocity, y: value } };
};

const diagnosticsSnapshot = (bodies: BodyState[], params: SimParams): DiagnosticsSnapshot => ({
  energy: totalEnergy(bodies, params),
  momentum: totalMomentum(bodies),
});

const MAX_TRAIL_POINTS_PER_BODY = 2400;
const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const FAST_REFRAME_FRAMES = 60;
const DISSOLUTION_TIME_THRESHOLD_SECONDS = 10;

const appendTrailPoints = (trails: TrailMap, bodies: BodyState[]): TrailMap => {
  const updated: TrailMap = { ...trails };
  for (const body of bodies) {
    const existing = updated[body.id] ?? [];
    const next = [...existing, { x: body.position.x, y: body.position.y, life: 1 }];
    updated[body.id] =
      next.length > MAX_TRAIL_POINTS_PER_BODY
        ? next.slice(next.length - MAX_TRAIL_POINTS_PER_BODY)
        : next;
  }
  return updated;
};

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

  const applyDissolutionProgress = (
    baseWorld: WorldState,
    stepParams: SimParams,
    stepDt: number,
  ): WorldState => {
    const pairState = pairBindingStateForBodies(baseWorld.bodies, stepParams);
    const nextCounterSec =
      pairState === "dissolving" ? baseWorld.dissolutionCounterSec + Math.max(0, stepDt) : 0;
    const crossedThreshold =
      !baseWorld.dissolutionDetected &&
      nextCounterSec >= DISSOLUTION_TIME_THRESHOLD_SECONDS;
    return {
      ...baseWorld,
      dissolutionCounterSec: nextCounterSec,
      dissolutionDetected: baseWorld.dissolutionDetected || crossedThreshold,
      dissolutionJustDetected: crossedThreshold ? true : baseWorld.dissolutionJustDetected,
      isRunning: crossedThreshold ? false : baseWorld.isRunning,
    };
  };

  const adjustRateByFactor = (factor: number) => {
    const current = paramsRef.current.speed;
    const nextSpeed = Math.max(0.01, Math.min(30, Number((current * factor).toFixed(3))));
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
    appendTrailPoints,
    applyDissolutionProgress,
    refreshHoverTooltipForBodyId,
  });

  const onBodyChange = (
    index: number,
    field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y",
    value: number,
  ) => {
    setDraftBodies((prev) => {
      const next = prev.map((body, i) => (i === index ? applyBodyField(body, field, value) : body));
      if (!worldRef.current.isRunning && worldRef.current.elapsedTime === 0) {
        const synced = createStoppedWorld(next);
        worldRef.current = synced;
        setWorld(synced);
        setBaselineDiagnostics(diagnosticsSnapshot(synced.bodies, paramsRef.current));
      }
      return next;
    });
  };

  const onParamChange = (field: keyof SimParams, value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const next = { ...paramsRef.current, [field]: value };
    paramsRef.current = next;
    setParams(next);
    if (!worldRef.current.isRunning && worldRef.current.elapsedTime === 0) {
      setBaselineDiagnostics(diagnosticsSnapshot(worldRef.current.bodies, next));
    }
  };

  const onResetParams = () => {
    const next = defaultParams();
    paramsRef.current = next;
    setParams(next);
    if (!worldRef.current.isRunning && worldRef.current.elapsedTime === 0) {
      setBaselineDiagnostics(diagnosticsSnapshot(worldRef.current.bodies, next));
    }
  };

  const onSaveProfile = () => {
    beginSaveProfileDraft();
  };

  const onConfirmSaveProfile = () => {
    if (!saveProfileDraft) {
      return;
    }
    const id = sanitizePresetId(saveProfileDraft.id);
    const name = sanitizePresetName(saveProfileDraft.name);
    const description = sanitizePresetDescription(saveProfileDraft.description);
    const existingIds = allPresets.map((preset) => preset.id);
    if (!id) {
      window.alert("Profile id must include letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    if (existingIds.includes(id)) {
      window.alert(`Profile id '${id}' already exists. Please use a unique id.`);
      return;
    }
    if (!name) {
      window.alert("Profile name cannot be empty.");
      return;
    }
    if (!description) {
      window.alert("Profile description cannot be empty.");
      return;
    }

    const savedPreset: PresetProfile = {
      id,
      name,
      description,
      bodies: cloneBodies(draftBodies),
      params: { ...paramsRef.current },
    };
    setUserPresets((prev) => [...prev, savedPreset]);
    setSelectedPresetId(id);
    cancelSaveProfileDraft();
  };

  const {
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
    appendTrailPoints,
    applyDissolutionProgress,
    diagnosticsSnapshot,
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
  const runButtonLabel = world.isRunning ? "Pause" : world.elapsedTime > 0 ? "Resume" : "Start";
  const runButtonTooltip = world.isRunning
    ? "Pause simulation time progression."
    : world.elapsedTime > 0
    ? "Resume running the simulation."
    : "Start running the simulation.";
  const lockModeLabel = lockMode === "none" ? "No Lock" : lockMode === "origin" ? "Origin Lock" : "COM Lock";
  const ejectedStatusRows = ejectedBodiesForStatus(world, BODY_COLORS);
  const latestEjectedLabel = latestEjectedLabelForStatus(world);
  const statusModeSegment = manualPanZoom ? "Manual" : lockModeLabel;
  const statusLabel = statusLabelForWorld(world, statusModeSegment, boundPairState);
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
          statusLabel={statusLabel}
          ejectedStatusRows={ejectedStatusRows}
          elapsedTime={world.elapsedTime}
          speed={params.speed}
          panelExpanded={panelExpanded}
          onTogglePanelExpanded={onTogglePanelExpanded}
        />
        <StageControls
          runButtonLabel={runButtonLabel}
          runButtonTooltip={runButtonTooltip}
          onStartPause={onStartPause}
          onReset={onReset}
          onStep={onStep}
          ejectedBodyId={world.ejectedBodyId}
          latestEjectedLabel={latestEjectedLabel}
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
        {hoverBody && (
          <div
            className="body-hover-tooltip"
            style={{
              left: Math.min(viewport.width - 420, hoverBody.x + 12),
              top: Math.min(viewport.height - 90, hoverBody.y + 12),
              borderColor: hoverBody.color,
              color: hoverBody.color,
            }}
          >
            {hoverBody.lines.map((line, index) => (
              <div key={index} className={index === 0 ? "body-hover-title" : "body-hover-line"}>
                {line}
              </div>
            ))}
          </div>
        )}
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
