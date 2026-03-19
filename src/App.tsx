import { useEffect, useRef, useState } from "react";
import "./styles.css";
import type { TrailMap } from "./render/canvasRenderer";
import { worldToScreen, type Camera } from "./sim/camera";
import { defaultBodies, defaultParams, initialWorld } from "./sim/defaults";
import {
  coreEscapeMetricsForBody,
  EJECTION_TIME_THRESHOLD_SECONDS,
  evaluateEjection,
} from "./sim/ejection";
import { velocityVerletStep } from "./sim/integrators";
import {
  loadPersistedParams,
  loadPersistedUiPrefs,
  loadPersistedUserPresets,
  PRESET_DESCRIPTION_MAX_LENGTH,
  PRESET_ID_MAX_LENGTH,
  PRESET_NAME_MAX_LENGTH,
  sanitizePresetDescription,
  sanitizePresetId,
  sanitizePresetName,
  savePersistedParams,
  savePersistedUiPrefs,
  savePersistedUserPresets,
  type PersistedLockMode,
} from "./sim/presetStorage";
import {
  computeAccelerations,
  totalEnergy,
  totalMomentum,
} from "./sim/physics";
import { PRESETS, cloneBodies } from "./sim/presets";
import { generateRandomChaoticBodies, generateRandomStableBodies } from "./sim/randomProfiles";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./sim/types";
import { createStoppedWorld } from "./sim/worldState";
import { CanvasDiagnostics } from "./ui/CanvasDiagnostics";
import { ControlPanel } from "./ui/ControlPanel";
import { useCanvasCameraControls } from "./ui/useCanvasCameraControls";
import { magnitude } from "./sim/vector";
import { useSimulationLoop } from "./sim/useSimulationLoop";
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
const MIN_VIEWPORT_WIDTH_PX = 320;
const MIN_VIEWPORT_HEIGHT_PX = 120;

const formatDiag = (value: number): string => {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  const abs = Math.abs(normalized);
  const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(dp)}`;
};

const nextUserPresetNumber = (presetIds: string[]): number => {
  const used = new Set<number>();
  for (const id of presetIds) {
    const match = /^user-(\d+)$/.exec(id);
    if (match) {
      used.add(Number(match[1]));
    }
  }
  let next = 1;
  while (used.has(next)) {
    next += 1;
  }
  return next;
};

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
  const [hoverBody, setHoverBody] = useState<{
    x: number;
    y: number;
    color: string;
    lines: string[];
  } | null>(null);
  const [saveProfileDraft, setSaveProfileDraft] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);
  const [baselineDiagnostics, setBaselineDiagnostics] = useState<DiagnosticsSnapshot>(() =>
    diagnosticsSnapshot(initialWorld().bodies, defaultParams()),
  );
  const [viewport, setViewport] = useState({ width: 900, height: 700 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const worldRef = useRef(world);
  const paramsRef = useRef(params);
  const cameraRef = useRef(initialCamera);
  const trailsRef = useRef<TrailMap>({});
  const hoverBodyIdRef = useRef<string | null>(null);
  const hoverLastUpdateTimeRef = useRef(0);
  const forceFastZoomInFramesRef = useRef(FAST_REFRAME_FRAMES);
  const simStepCounterRef = useRef(0);
  const manualPanZoomRef = useRef(manualPanZoom);

  const scheduleFastReframe = () => {
    cameraRef.current = { ...initialCamera };
    forceFastZoomInFramesRef.current = FAST_REFRAME_FRAMES;
  };

  const updateBodyHoverTooltip = (screenX: number, screenY: number) => {
    const bodies = worldRef.current.bodies;
    if (bodies.length === 0) {
      setHoverBody(null);
      return;
    }

    const cam = cameraRef.current;
    const thresholdPx = 16;
    let nearestIndex = -1;
    let nearestDistSq = Number.POSITIVE_INFINITY;
    let nearestScreen = { x: 0, y: 0 };

    for (let i = 0; i < bodies.length; i += 1) {
      const p = worldToScreen(bodies[i].position, cam, viewport);
      const dx = p.x - screenX;
      const dy = p.y - screenY;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestDistSq) {
        nearestDistSq = d2;
        nearestIndex = i;
        nearestScreen = p;
      }
    }

    if (nearestIndex < 0 || nearestDistSq > thresholdPx * thresholdPx) {
      hoverBodyIdRef.current = null;
      hoverLastUpdateTimeRef.current = 0;
      setHoverBody(null);
      return;
    }

    const accelerations = computeAccelerations(bodies, paramsRef.current);
    const body = bodies[nearestIndex];
    const a = accelerations[nearestIndex];
    const speed = magnitude(body.velocity);
    const aParallel =
      speed > 1e-9
        ? (a.x * body.velocity.x + a.y * body.velocity.y) / speed
        : 0;
    const ejectMetrics = coreEscapeMetricsForBody(nearestIndex, worldRef.current, paramsRef.current);
    const ejectionTimeSec = worldRef.current.ejectionCounterById[body.id] ?? 0;
    const ejectionCntText =
      worldRef.current.ejectedBodyIds.includes(body.id) ||
      ejectionTimeSec >= EJECTION_TIME_THRESHOLD_SECONDS
        ? "ejected"
        : `${ejectionTimeSec.toFixed(1)}s/${EJECTION_TIME_THRESHOLD_SECONDS.toFixed(0)}s`;

    hoverBodyIdRef.current = body.id;
    hoverLastUpdateTimeRef.current = performance.now();
    setHoverBody({
      x: nearestScreen.x,
      y: nearestScreen.y,
      color: body.color,
      lines: [
        `Body ${nearestIndex + 1}`,
        `r: (${formatDiag(body.position.x)}, ${formatDiag(body.position.y)})`,
        `v: (${formatDiag(body.velocity.x)}, ${formatDiag(body.velocity.y)}) |v|: ${formatDiag(speed)}`,
        `a: (${formatDiag(a.x)}, ${formatDiag(a.y)}) a||: ${formatDiag(aParallel)}`,
        `Erel: ${formatDiag(ejectMetrics?.energy ?? 0)}`,
        `v/vesc: ${formatDiag(ejectMetrics?.speedRatioToEscape ?? 0)}`,
        `out: ${(ejectMetrics?.outward ?? false) ? "Y" : "N"} ` +
          `cnt: ${ejectionCntText}`,
      ],
    });
  };

  const refreshHoverTooltipForBodyId = (bodyId: string) => {
    const bodies = worldRef.current.bodies;
    const index = bodies.findIndex((b) => b.id === bodyId);
    if (index < 0) {
      hoverBodyIdRef.current = null;
      setHoverBody(null);
      return;
    }
    const body = bodies[index];
    const a = computeAccelerations(bodies, paramsRef.current)[index];
    const speed = magnitude(body.velocity);
    const aParallel =
      speed > 1e-9
        ? (a.x * body.velocity.x + a.y * body.velocity.y) / speed
        : 0;
    const ejectMetrics = coreEscapeMetricsForBody(index, worldRef.current, paramsRef.current);
    const ejectionTimeSec = worldRef.current.ejectionCounterById[body.id] ?? 0;
    const ejectionCntText =
      worldRef.current.ejectedBodyIds.includes(body.id) ||
      ejectionTimeSec >= EJECTION_TIME_THRESHOLD_SECONDS
        ? "ejected"
        : `${ejectionTimeSec.toFixed(1)}s/${EJECTION_TIME_THRESHOLD_SECONDS.toFixed(0)}s`;
    const screen = worldToScreen(body.position, cameraRef.current, viewport);
    setHoverBody({
      x: screen.x,
      y: screen.y,
      color: body.color,
      lines: [
        `Body ${index + 1}`,
        `r: (${formatDiag(body.position.x)}, ${formatDiag(body.position.y)})`,
        `v: (${formatDiag(body.velocity.x)}, ${formatDiag(body.velocity.y)}) |v|: ${formatDiag(speed)}`,
        `a: (${formatDiag(a.x)}, ${formatDiag(a.y)}) a||: ${formatDiag(aParallel)}`,
        `Erel: ${formatDiag(ejectMetrics?.energy ?? 0)}`,
        `v/vesc: ${formatDiag(ejectMetrics?.speedRatioToEscape ?? 0)}`,
        `out: ${(ejectMetrics?.outward ?? false) ? "Y" : "N"} ` +
          `cnt: ${ejectionCntText}`,
      ],
    });
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

  const clearHoverBody = () => {
    hoverBodyIdRef.current = null;
    hoverLastUpdateTimeRef.current = 0;
    setHoverBody(null);
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

  const onLockModeChange = (mode: LockMode) => {
    setManualMode(false);
    setLockMode(mode);
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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const updateViewportFromRect = (rect: DOMRectReadOnly) => {
      const usableHeight = Math.max(
        MIN_VIEWPORT_HEIGHT_PX,
        Math.floor(rect.height - diagnosticsInsetPx),
      );
      setViewport({
        width: Math.max(MIN_VIEWPORT_WIDTH_PX, Math.floor(rect.width)),
        height: usableHeight,
      });
    };
    updateViewportFromRect(element.getBoundingClientRect());
    const observer = new ResizeObserver((entries) => {
      updateViewportFromRect(entries[0].contentRect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [diagnosticsInsetPx]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      if (isEditable) {
        return;
      }
      if (e.key === "Escape") {
        setManualMode(false);
        return;
      }
      if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
        e.preventDefault();
        adjustRateByFactor(1.1);
        return;
      }
      if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
        e.preventDefault();
        adjustRateByFactor(1 / 1.1);
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        onLockModeChange(lockMode === "none" ? "com" : lockMode === "com" ? "origin" : "none");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;

  }, [viewport]);

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

  const onStartPause = () => {
    setWorld((prev) => {
      let next = { ...prev, isRunning: !prev.isRunning };
      if (!prev.isRunning && prev.elapsedTime === 0) {
        setBaselineDiagnostics(diagnosticsSnapshot(prev.bodies, paramsRef.current));
      }
      if (!prev.isRunning && prev.ejectedBodyId) {
        next = { ...next, ejectedBodyId: null };
      }
      if (!prev.isRunning && prev.dissolutionJustDetected) {
        next = { ...next, dissolutionJustDetected: false };
      }
      worldRef.current = next;
      return next;
    });
  };

  const onReset = () => {
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    setManualMode(false);
    scheduleFastReframe();
    const next = createStoppedWorld(draftBodies);
    worldRef.current = next;
    setWorld(next);
    setBaselineDiagnostics(diagnosticsSnapshot(next.bodies, paramsRef.current));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
  };

  const onStep = () => {
    const steppedBodies = velocityVerletStep(worldRef.current.bodies, paramsRef.current);
    let nextWorld: WorldState = {
      ...worldRef.current,
      bodies: steppedBodies,
      elapsedTime: worldRef.current.elapsedTime + paramsRef.current.dt,
      isRunning: false,
    };
    const ejection = evaluateEjection(nextWorld, paramsRef.current);
    nextWorld = {
      ...nextWorld,
      ejectionCounterById: ejection.ejectionCounterById,
      ejectedBodyId: ejection.ejectedBodyId,
      ejectedBodyIds: ejection.ejectedBodyIds,
      isRunning: false,
    };
    nextWorld = applyDissolutionProgress(nextWorld, paramsRef.current, paramsRef.current.dt);
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    trailsRef.current = appendTrailPoints(trailsRef.current, nextWorld.bodies);
  };

  const onApplyPreset = () => {
    const preset = allPresets.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) {
      return;
    }

    const nextBodies = cloneBodies(preset.bodies);
    const nextParams = { ...paramsRef.current, ...preset.params };
    setDraftBodies(nextBodies);
    setParams(nextParams);
    paramsRef.current = nextParams;

    const nextWorld = createStoppedWorld(nextBodies);
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setBaselineDiagnostics(diagnosticsSnapshot(nextWorld.bodies, nextParams));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
    scheduleFastReframe();
  };

  const onSaveProfile = () => {
    const existingIds = allPresets.map((preset) => preset.id);
    const suggestedNumber = nextUserPresetNumber(existingIds);
    const defaultId = `user-${suggestedNumber}`;
    const defaultName = `User Profile #${suggestedNumber}`;
    const defaultDescription = "Saved from current initial conditions and simulation parameters.";
    setSaveProfileDraft({
      id: defaultId,
      name: defaultName,
      description: defaultDescription,
    });
  };

  const onSaveProfileFieldChange = (field: "id" | "name" | "description", value: string) => {
    setSaveProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const onCancelSaveProfile = () => {
    setSaveProfileDraft(null);
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
    setSaveProfileDraft(null);
  };

  const applyBodiesAsNewInitialState = (nextBodies: BodyState[]) => {
    setDraftBodies(nextBodies);
    const nextWorld = createStoppedWorld(nextBodies);
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setBaselineDiagnostics(diagnosticsSnapshot(nextWorld.bodies, paramsRef.current));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
    scheduleFastReframe();
  };

  const onGenerateRandomStable = () => {
    const nextBodies = generateRandomStableBodies(BODY_COLORS);
    const nextParams = { ...paramsRef.current, G: 1, dt: 0.0045, speed: 1 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

  const onGenerateRandomChaotic = () => {
    const nextBodies = generateRandomChaoticBodies(BODY_COLORS);
    const nextParams = { ...paramsRef.current, G: 1.1, dt: 0.005, speed: 1.3 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

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
        <div className="canvas-status" title="Simulation status and active camera mode.">
          <span>{statusLabel}</span>
          {ejectedStatusRows.length > 0 ? (
            <span>
              {" • Ejected: "}
              {ejectedStatusRows.map((body, index) => (
                <span key={body.id}>
                  <span className="status-eject-body" style={{ color: body.color }}>
                    {body.label}
                  </span>
                  {index < ejectedStatusRows.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <div className="top-right-tools">
          <div className="hud" title="Elapsed simulation time and current simulation rate. Hotkeys: '+' faster, '-' slower.">
            <div>t = {world.elapsedTime.toFixed(3)}</div>
            <div>rate = {params.speed.toFixed(2)}x</div>
          </div>
          <button
            className="panel-toggle-icon"
            title={panelExpanded ? "Hide panel (maximize canvas)" : "Show panel (restore layout)"}
            onClick={onTogglePanelExpanded}
            aria-label={panelExpanded ? "Maximize canvas" : "Restore panel"}
          >
            {panelExpanded ? (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
        <div className="stage-controls">
          <div className="button-row">
            <button
              onClick={onStartPause}
              title={runButtonTooltip}
            >
              {runButtonLabel}
            </button>
            <button onClick={onReset} title="Reset to current initial conditions and clear trails.">
              Reset
            </button>
            <button onClick={onStep} title="Advance simulation by one integration step.">
              Step
            </button>
          </div>
          {world.ejectedBodyId && (
            <p className="warning">
              Paused: {latestEjectedLabel ?? world.ejectedBodyId} newly ejected from system.
            </p>
          )}
          {world.dissolutionJustDetected && (
            <p className="warning">
              Paused: system dissolved.
            </p>
          )}
        </div>
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
      {saveProfileDraft && (
        <div className="modal-backdrop" onClick={onCancelSaveProfile}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Save Profile"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Save Profile</h3>
            <label title="Unique profile identifier used internally and in preset selection.">
              Id
              <input
                type="text"
                value={saveProfileDraft.id}
                maxLength={PRESET_ID_MAX_LENGTH}
                onChange={(e) => onSaveProfileFieldChange("id", e.target.value)}
              />
            </label>
            <label title="Display name shown in the profile dropdown.">
              Name
              <input
                type="text"
                value={saveProfileDraft.name}
                maxLength={PRESET_NAME_MAX_LENGTH}
                onChange={(e) => onSaveProfileFieldChange("name", e.target.value)}
              />
            </label>
            <label title="Short description shown under the profile selector.">
              Description
              <textarea
                value={saveProfileDraft.description}
                maxLength={PRESET_DESCRIPTION_MAX_LENGTH}
                onChange={(e) => onSaveProfileFieldChange("description", e.target.value)}
              />
            </label>
            <div className="button-row">
              <button onClick={onConfirmSaveProfile}>Save</button>
              <button onClick={onCancelSaveProfile}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
