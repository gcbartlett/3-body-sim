import { useEffect, useRef, useState } from "react";
import "./styles.css";
import { drawFrame, fadeAndPruneTrails, type TrailMap } from "./render/canvasRenderer";
import { updateCamera, type Camera } from "./sim/camera";
import { defaultBodies, defaultParams, initialWorld } from "./sim/defaults";
import { evaluateEjection } from "./sim/ejection";
import { velocityVerletStep } from "./sim/integrators";
import { centerOfMass, computeAccelerations, totalEnergy, totalMomentum } from "./sim/physics";
import { PRESETS, cloneBodies } from "./sim/presets";
import type { BodyState, DiagnosticsSnapshot, SimParams, WorldState } from "./sim/types";
import { ControlPanel } from "./ui/ControlPanel";

type LockMode = "none" | "origin" | "com";

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
const VIEWPORT_TARGET_FRACTION = 0.66;
const ZOOM_DAMPING = 0.18;
const MIN_WORLD_UNITS_PER_PIXEL = 0.0005;
const MAX_WORLD_UNITS_PER_PIXEL = 5;
const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"];
const BASE_MAX_STEPS = 12;

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

const randomIn = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const generateRandomStableBodies = (): BodyState[] => {
  const masses = [randomIn(0.8, 1.3), randomIn(0.8, 1.3), randomIn(0.8, 1.3)];
  const r = randomIn(0.9, 1.4);
  const angle = randomIn(0, Math.PI * 2);
  const points = [0, 2 * Math.PI / 3, 4 * Math.PI / 3].map((offset) => ({
    x: r * Math.cos(angle + offset),
    y: r * Math.sin(angle + offset),
  }));
  const meanMass = (masses[0] + masses[1] + masses[2]) / 3;
  const vMag = Math.sqrt(Math.max(0.05, meanMass / r));
  const velocities = points.map((p) => ({
    x: (-p.y / Math.max(0.2, r)) * vMag + randomIn(-0.08, 0.08),
    y: (p.x / Math.max(0.2, r)) * vMag + randomIn(-0.08, 0.08),
  }));

  const momentum = velocities.reduce(
    (sum, v, i) => ({ x: sum.x + masses[i] * v.x, y: sum.y + masses[i] * v.y }),
    { x: 0, y: 0 },
  );
  const totalMass = masses[0] + masses[1] + masses[2];
  const correction = { x: momentum.x / totalMass, y: momentum.y / totalMass };

  return points.map((position, i) => ({
    id: `body-${i + 1}`,
    color: BODY_COLORS[i],
    mass: masses[i],
    position,
    velocity: {
      x: velocities[i].x - correction.x,
      y: velocities[i].y - correction.y,
    },
  }));
};

const generateRandomChaoticBodies = (): BodyState[] => {
  const masses = [randomIn(0.5, 1.8), randomIn(0.5, 1.8), randomIn(0.5, 1.8)];
  const positions = [0, 1, 2].map(() => ({
    x: randomIn(-1.2, 1.2),
    y: randomIn(-1.2, 1.2),
  }));
  const velocities = [0, 1, 2].map(() => ({
    x: randomIn(-1.5, 1.5),
    y: randomIn(-1.5, 1.5),
  }));
  return positions.map((position, i) => ({
    id: `body-${i + 1}`,
    color: BODY_COLORS[i],
    mass: masses[i],
    position,
    velocity: velocities[i],
  }));
};

function App() {
  const [params, setParams] = useState<SimParams>(defaultParams);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [lockMode, setLockMode] = useState<LockMode>("com");
  const [manualPanZoom, setManualPanZoom] = useState<boolean>(false);
  const [showOriginMarker, setShowOriginMarker] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCenterOfMass, setShowCenterOfMass] = useState<boolean>(true);
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
  const simStepCounterRef = useRef(0);
  const manualPanZoomRef = useRef(manualPanZoom);
  const dragRef = useRef<{ active: boolean; pointerId: number | null; x: number; y: number }>({
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
  });
  const touchRef = useRef<{
    points: Map<number, { x: number; y: number }>;
    lastDistance: number | null;
    lastMidpoint: { x: number; y: number } | null;
  }>({
    points: new Map(),
    lastDistance: null,
    lastMidpoint: null,
  });

  const panCameraByScreenDelta = (dx: number, dy: number) => {
    const cam = cameraRef.current;
    cameraRef.current = {
      ...cam,
      center: {
        x: cam.center.x - dx * cam.worldUnitsPerPixel,
        y: cam.center.y - dy * cam.worldUnitsPerPixel,
      },
    };
  };

  const zoomCameraAtScreenPoint = (
    screen: { x: number; y: number },
    zoomFactor: number,
  ) => {
    const cam = cameraRef.current;
    const clampedFactor = Math.max(0.2, Math.min(5, zoomFactor));
    const nextScale = Math.max(
      MIN_WORLD_UNITS_PER_PIXEL,
      Math.min(MAX_WORLD_UNITS_PER_PIXEL, cam.worldUnitsPerPixel * clampedFactor),
    );
    const worldBefore = {
      x: cam.center.x + (screen.x - viewport.width * 0.5) * cam.worldUnitsPerPixel,
      y: cam.center.y + (screen.y - viewport.height * 0.5) * cam.worldUnitsPerPixel,
    };
    cameraRef.current = {
      center: {
        x: worldBefore.x - (screen.x - viewport.width * 0.5) * nextScale,
        y: worldBefore.y - (screen.y - viewport.height * 0.5) * nextScale,
      },
      worldUnitsPerPixel: nextScale,
    };
  };

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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0].contentRect;
      setViewport({
        width: Math.max(320, Math.floor(next.width)),
        height: Math.max(320, Math.floor(next.height)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setManualMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;

  }, [viewport]);

  useEffect(() => {
    const tick = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const currentWorld = worldRef.current;
      const currentParams = paramsRef.current;
      const previous = lastTimeRef.current ?? time;
      const dtReal = (time - previous) / 1000;
      lastTimeRef.current = time;

      let nextWorld = currentWorld;
      if (currentWorld.isRunning) {
        const rate = currentParams.speed;
        const dtScale =
          rate <= 1
            ? 1
            : Math.min(6, 1 + Math.log10(Math.max(1, rate)) * 2.3);
        const effectiveDt = currentParams.dt * dtScale;
        const maxStepsThisFrame = Math.max(
          BASE_MAX_STEPS,
          Math.min(240, Math.floor(BASE_MAX_STEPS + 20 * Math.sqrt(rate))),
        );
        const trailSampleEvery = Math.max(1, Math.min(45, Math.floor(rate)));
        const stepParams = { ...currentParams, dt: effectiveDt };

        accumulatorRef.current += dtReal * rate;
        let stepCount = 0;
        while (accumulatorRef.current >= effectiveDt && stepCount < maxStepsThisFrame) {
          const steppedBodies = velocityVerletStep(nextWorld.bodies, stepParams);
          simStepCounterRef.current += 1;
          if (simStepCounterRef.current % trailSampleEvery === 0) {
            trailsRef.current = appendTrailPoints(trailsRef.current, steppedBodies);
          }

          nextWorld = {
            ...nextWorld,
            bodies: steppedBodies,
            elapsedTime: nextWorld.elapsedTime + effectiveDt,
          };
          const ejection = evaluateEjection(nextWorld, stepParams);
          nextWorld = {
            ...nextWorld,
            ejectionCounterById: ejection.ejectionCounterById,
            ejectedBodyId: ejection.ejectedBodyId,
            isRunning: ejection.isRunning,
          };
          accumulatorRef.current -= effectiveDt;
          stepCount += 1;
          if (!nextWorld.isRunning) {
            break;
          }
        }
        const maxBacklog = effectiveDt * maxStepsThisFrame;
        if (accumulatorRef.current > maxBacklog) {
          accumulatorRef.current = maxBacklog;
        }

        if (nextWorld !== currentWorld) {
          worldRef.current = nextWorld;
          setWorld(nextWorld);
        }
      }

      const com = centerOfMass(worldRef.current.bodies);
      const cam = manualPanZoom
        ? cameraRef.current
        : (() => {
            const trackedCamera = updateCamera(cameraRef.current, worldRef.current.bodies, viewport);
            const targetCenter =
              lockMode === "com"
                ? com
                : lockMode === "origin"
                ? { x: 0, y: 0 }
                : trackedCamera.center;

            const xs = worldRef.current.bodies.map((body) => body.position.x);
            const ys = worldRef.current.bodies.map((body) => body.position.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const spanX = Math.max(0.5, maxX - minX);
            const spanY = Math.max(0.5, maxY - minY);
            const universalRequiredWorldUnitsPerPixel = Math.max(
              0.001,
              spanX / Math.max(1, viewport.width * VIEWPORT_TARGET_FRACTION),
              spanY / Math.max(1, viewport.height * VIEWPORT_TARGET_FRACTION),
            );

            const maxOffsetX = worldRef.current.bodies.reduce(
              (max, body) => Math.max(max, Math.abs(body.position.x - targetCenter.x)),
              0,
            );
            const maxOffsetY = worldRef.current.bodies.reduce(
              (max, body) => Math.max(max, Math.abs(body.position.y - targetCenter.y)),
              0,
            );
            const requiredWorldUnitsPerPixel = Math.max(
              universalRequiredWorldUnitsPerPixel,
              maxOffsetX / Math.max(1, viewport.width * 0.5 * VIEWPORT_TARGET_FRACTION),
              maxOffsetY / Math.max(1, viewport.height * 0.5 * VIEWPORT_TARGET_FRACTION),
            );
            return {
              ...trackedCamera,
              center: targetCenter,
              worldUnitsPerPixel:
                cameraRef.current.worldUnitsPerPixel +
                (requiredWorldUnitsPerPixel - cameraRef.current.worldUnitsPerPixel) * ZOOM_DAMPING,
            };
          })();
      cameraRef.current = cam;
      trailsRef.current = fadeAndPruneTrails(trailsRef.current, currentParams.trailFade);

      drawFrame(ctx, trailsRef.current, worldRef.current.bodies, cam, viewport, {
        showOrigin: showOriginMarker,
        showGrid,
        showCenterOfMass,
        centerOfMass: com,
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [lockMode, manualPanZoom, showCenterOfMass, showGrid, showOriginMarker, viewport]);

  const onBodyChange = (
    index: number,
    field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y",
    value: number,
  ) => {
    setDraftBodies((prev) => {
      const next = prev.map((body, i) => (i === index ? applyBodyField(body, field, value) : body));
      if (!worldRef.current.isRunning && worldRef.current.elapsedTime === 0) {
        const synced = {
          ...worldRef.current,
          bodies: next,
          ejectedBodyId: null,
          ejectionCounterById: {},
        };
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
        next = { ...next, ejectedBodyId: null, ejectionCounterById: {} };
      }
      worldRef.current = next;
      return next;
    });
  };

  const onReset = () => {
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    setManualMode(false);
    const next: WorldState = {
      bodies: cloneBodies(draftBodies),
      elapsedTime: 0,
      isRunning: false,
      ejectedBodyId: null,
      ejectionCounterById: {},
    };
    worldRef.current = next;
    setWorld(next);
    setBaselineDiagnostics(diagnosticsSnapshot(next.bodies, paramsRef.current));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
    cameraRef.current = { ...initialCamera };
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
      isRunning: false,
    };
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    trailsRef.current = appendTrailPoints(trailsRef.current, nextWorld.bodies);
  };

  const onApplyPreset = () => {
    const preset = PRESETS.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) {
      return;
    }

    const nextBodies = cloneBodies(preset.bodies);
    const nextParams = { ...paramsRef.current, ...preset.params };
    setDraftBodies(nextBodies);
    setParams(nextParams);
    paramsRef.current = nextParams;

    const nextWorld: WorldState = {
      bodies: cloneBodies(nextBodies),
      elapsedTime: 0,
      isRunning: false,
      ejectedBodyId: null,
      ejectionCounterById: {},
    };
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setBaselineDiagnostics(diagnosticsSnapshot(nextWorld.bodies, nextParams));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
  };

  const applyBodiesAsNewInitialState = (nextBodies: BodyState[]) => {
    setDraftBodies(nextBodies);
    const nextWorld: WorldState = {
      bodies: cloneBodies(nextBodies),
      elapsedTime: 0,
      isRunning: false,
      ejectedBodyId: null,
      ejectionCounterById: {},
    };
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setBaselineDiagnostics(diagnosticsSnapshot(nextWorld.bodies, paramsRef.current));
    trailsRef.current = {};
    simStepCounterRef.current = 0;
  };

  const onGenerateRandomStable = () => {
    const nextBodies = generateRandomStableBodies();
    const nextParams = { ...paramsRef.current, G: 1, dt: 0.0045, speed: 1 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

  const onGenerateRandomChaotic = () => {
    const nextBodies = generateRandomChaoticBodies();
    const nextParams = { ...paramsRef.current, G: 1.1, dt: 0.005, speed: 1.3 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      setManualMode(true);
    }
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.pointerType === "touch") {
      touchRef.current.points.set(e.pointerId, { x, y });
      if (touchRef.current.points.size === 2) {
        const [a, b] = Array.from(touchRef.current.points.values());
        touchRef.current.lastDistance = Math.hypot(b.x - a.x, b.y - a.y);
        touchRef.current.lastMidpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      } else if (touchRef.current.points.size === 1) {
        touchRef.current.lastMidpoint = { x, y };
      }
      return;
    }

    dragRef.current = { active: true, pointerId: e.pointerId, x, y };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.pointerType === "touch") {
      if (!touchRef.current.points.has(e.pointerId)) {
        return;
      }
      touchRef.current.points.set(e.pointerId, { x, y });
      if (touchRef.current.points.size === 2) {
        const [a, b] = Array.from(touchRef.current.points.values());
        const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (touchRef.current.lastMidpoint) {
          panCameraByScreenDelta(
            midpoint.x - touchRef.current.lastMidpoint.x,
            midpoint.y - touchRef.current.lastMidpoint.y,
          );
        }
        if (touchRef.current.lastDistance && distance > 0) {
          zoomCameraAtScreenPoint(midpoint, touchRef.current.lastDistance / distance);
        }
        touchRef.current.lastDistance = distance;
        touchRef.current.lastMidpoint = midpoint;
      } else if (touchRef.current.points.size === 1) {
        const only = Array.from(touchRef.current.points.values())[0];
        if (touchRef.current.lastMidpoint) {
          panCameraByScreenDelta(
            only.x - touchRef.current.lastMidpoint.x,
            only.y - touchRef.current.lastMidpoint.y,
          );
        }
        touchRef.current.lastMidpoint = only;
      }
      return;
    }

    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) {
      return;
    }
    panCameraByScreenDelta(x - dragRef.current.x, y - dragRef.current.y);
    dragRef.current.x = x;
    dragRef.current.y = y;
  };

  const onCanvasPointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      return;
    }
    if (dragRef.current.active && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = { active: false, pointerId: null, x: 0, y: 0 };
    }
    touchRef.current.points.delete(e.pointerId);
    if (touchRef.current.points.size < 2) {
      touchRef.current.lastDistance = null;
      touchRef.current.lastMidpoint =
        touchRef.current.points.size === 1
          ? Array.from(touchRef.current.points.values())[0]
          : null;
    }
  };

  const onCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      setManualMode(true);
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const zoomFactor = Math.exp(e.deltaY * 0.0015);
    zoomCameraAtScreenPoint({ x, y }, zoomFactor);
  };

  const onCanvasDoubleClick = () => {
    setManualMode(false);
  };

  const diagnostics = diagnosticsSnapshot(world.bodies, params);
  const accelerations = computeAccelerations(world.bodies, params);
  const bodyVectors = world.bodies.map((body, index) => ({
    id: body.id,
    color: body.color,
    position: body.position,
    velocity: body.velocity,
    acceleration: accelerations[index],
  }));

  return (
    <div className="layout">
      <ControlPanel
        bodies={draftBodies}
        params={params}
        isRunning={world.isRunning}
        presets={PRESETS}
        selectedPresetId={selectedPresetId}
        diagnostics={diagnostics}
        baselineDiagnostics={baselineDiagnostics}
        bodyVectors={bodyVectors}
        lockMode={lockMode}
        manualPanZoom={manualPanZoom}
        showOriginMarker={showOriginMarker}
        showGrid={showGrid}
        showCenterOfMass={showCenterOfMass}
        onBodyChange={onBodyChange}
        onParamChange={onParamChange}
        onLockModeChange={setLockMode}
        onToggleManualPanZoom={setManualMode}
        onToggleShowOriginMarker={setShowOriginMarker}
        onToggleShowGrid={setShowGrid}
        onToggleShowCenterOfMass={setShowCenterOfMass}
        onResetParams={onResetParams}
        onPresetSelect={setSelectedPresetId}
        onApplyPreset={onApplyPreset}
        onGenerateRandomStable={onGenerateRandomStable}
        onGenerateRandomChaotic={onGenerateRandomChaotic}
      />
      <main className="stage-wrap" ref={containerRef}>
        <div className="stage-controls">
          <div className="button-row">
            <button onClick={onStartPause}>{world.isRunning ? "Pause" : "Start"}</button>
            <button onClick={onReset}>Reset</button>
            <button onClick={onStep}>Step</button>
          </div>
          {world.ejectedBodyId && <p className="warning">Paused: {world.ejectedBodyId} ejected from system.</p>}
        </div>
        <canvas
          ref={canvasRef}
          className={`stage${manualPanZoom ? " stage-manual" : ""}`}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUpOrCancel}
          onPointerCancel={onCanvasPointerUpOrCancel}
          onWheel={onCanvasWheel}
          onDoubleClick={onCanvasDoubleClick}
        />
        <div className="hud">t = {world.elapsedTime.toFixed(2)}</div>
      </main>
    </div>
  );
}

export default App;
