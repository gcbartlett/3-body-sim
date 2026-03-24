import { useEffect, useRef, useState, type ComponentProps } from "react";
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
import { EditProfileDialog, type EditProfileDraft } from "./ui/EditProfileDialog";
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
  stageDiagnosticsViewModelForWorld,
} from "./sim/diagnosticsSelectors";
import { boundPairStateLabel, stageViewModelForWorld } from "./sim/stageSelectors";

const initialCamera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const FAST_REFRAME_FRAMES = 60;
const APP_VERSION = __APP_VERSION__;
const EPS = 1e-12;

const sameNumber = (a: number, b: number) => Math.abs(a - b) <= EPS;

const sameIbcBodies = (a: BodyState[], b: BodyState[]) =>
  a.length === b.length &&
  a.every((body, index) => {
    const candidate = b[index];
    if (!candidate) {
      return false;
    }
    return (
      sameNumber(body.mass, candidate.mass) &&
      sameNumber(body.position.x, candidate.position.x) &&
      sameNumber(body.position.y, candidate.position.y) &&
      sameNumber(body.velocity.x, candidate.velocity.x) &&
      sameNumber(body.velocity.y, candidate.velocity.y)
    );
  });

function App() {
  const [initialUiPrefs] = useState(loadPersistedUiPrefs);
  const [params, setParams] = useState<SimParams>(loadPersistedParams);
  const [userPresets, setUserPresets] = useState<PresetProfile[]>(loadPersistedUserPresets);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [editProfileDraft, setEditProfileDraft] = useState<EditProfileDraft | null>(null);
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
    onEscape: () => setManualMode(false),
    onIncreaseRate: () => adjustRateByFactor(1.1),
    onDecreaseRate: () => adjustRateByFactor(1 / 1.1),
    onCycleLockMode,
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

  const onSaveProfile = () => {
    beginSaveProfileDraft();
  };

  const onDeleteUserPreset = (id: string) => {
    const target = userPresets.find((preset) => preset.id === id);
    if (!target) {
      return;
    }
    setUserPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (selectedPresetId === id) {
      setSelectedPresetId(PRESETS[0].id);
    }
  };

  const onEditUserPreset = (id: string) => {
    const target = userPresets.find((preset) => preset.id === id);
    if (!target) {
      return;
    }
    setEditProfileDraft({
      originalId: target.id,
      id: target.id,
      name: target.name,
      description: target.description,
    });
  };

  const onEditProfileFieldChange = (field: "id" | "name" | "description", value: string) => {
    setEditProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const onCancelEditProfile = () => {
    setEditProfileDraft(null);
  };

  const onConfirmEditProfile = () => {
    if (!editProfileDraft) {
      return;
    }
    const id = sanitizePresetId(editProfileDraft.id);
    const name = sanitizePresetName(editProfileDraft.name);
    const description = sanitizePresetDescription(editProfileDraft.description);
    const existingIds = allPresets
      .map((preset) => preset.id)
      .filter((existingId) => existingId !== editProfileDraft.originalId);

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

    setUserPresets((prev) =>
      prev.map((preset) =>
        preset.id === editProfileDraft.originalId
          ? {
              ...preset,
              id,
              name,
              description,
            }
          : preset,
      ),
    );
    if (selectedPresetId === editProfileDraft.originalId) {
      setSelectedPresetId(id);
    }
    setEditProfileDraft(null);
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
  const diagnosticsViewModel = stageDiagnosticsViewModelForWorld({
    world,
    params,
    ejectionThresholdSec: EJECTION_TIME_THRESHOLD_SECONDS,
  });
  const selectedUserPreset = userPresets.find((preset) => preset.id === selectedPresetId) ?? null;
  const selectedUserPresetIbcDirty =
    selectedUserPreset === null ? false : !sameIbcBodies(selectedUserPreset.bodies, draftBodies);
  const displayPairState = diagnosticsViewModel.displayPairState;
  const boundPairState = boundPairStateLabel(displayPairState, world.dissolutionDetected);
  const stageViewModel = stageViewModelForWorld({
    world,
    lockMode,
    manualPanZoom,
    bodyColors: BODY_COLORS,
    pairStateLabel: boundPairState,
  });
  const stageHudProps: ComponentProps<typeof StageHud> = {
    statusLabel: stageViewModel.statusLabel,
    ejectedStatusRows: stageViewModel.ejectedStatusRows,
    elapsedTime: world.elapsedTime,
    speed: params.speed,
    panelExpanded,
    onTogglePanelExpanded,
  };
  const stageControlsProps: ComponentProps<typeof StageControls> = {
    runButtonLabel: stageViewModel.runButtonLabel,
    runButtonTooltip: stageViewModel.runButtonTooltip,
    onStartPause,
    onReset,
    onStep,
    ejectedBodyId: world.ejectedBodyId,
    latestEjectedLabel: stageViewModel.latestEjectedLabel,
    dissolutionJustDetected: world.dissolutionJustDetected,
  };
  const diagnosticsProps: ComponentProps<typeof CanvasDiagnostics> = {
    pairEnergies: diagnosticsViewModel.pairEnergies,
    displayPairState: diagnosticsViewModel.displayPairState,
    dissolutionCounterSec: world.dissolutionCounterSec,
    dissolutionThresholdSec: DISSOLUTION_TIME_THRESHOLD_SECONDS,
    dissolutionDetected: world.dissolutionDetected,
    diagnostics,
    baselineDiagnostics,
    bodyVectors: diagnosticsViewModel.bodyVectors,
    bodyEjectionStatuses: diagnosticsViewModel.bodyEjectionStatuses,
    onVisibleHeightChange: setDiagnosticsInsetPx,
  };
  return (
    <div className={`layout${panelExpanded ? "" : " panel-collapsed"}`}>
      <ControlPanel
        bodies={draftBodies}
        params={params}
        appVersion={APP_VERSION}
        presets={allPresets}
        selectedPresetId={selectedPresetId}
        defaultPresetIds={PRESETS.map((preset) => preset.id)}
        selectedUserPresetIbcDirty={selectedUserPresetIbcDirty}
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
        onSaveProfile={onSaveProfile}
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
        onCancel={cancelSaveProfileDraft}
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
