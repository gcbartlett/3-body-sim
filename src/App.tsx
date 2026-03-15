import { useEffect, useRef, useState } from "react";
import "./styles.css";
import { drawFrame, clearTrails } from "./render/canvasRenderer";
import { updateCamera, type Camera } from "./sim/camera";
import { defaultBodies, defaultParams, initialWorld } from "./sim/defaults";
import { evaluateEjection } from "./sim/ejection";
import { velocityVerletStep } from "./sim/integrators";
import type { BodyState, SimParams, WorldState } from "./sim/types";
import { ControlPanel } from "./ui/ControlPanel";

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

function App() {
  const [params, setParams] = useState<SimParams>(defaultParams);
  const [draftBodies, setDraftBodies] = useState<BodyState[]>(defaultBodies);
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [viewport, setViewport] = useState({ width: 900, height: 700 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const worldRef = useRef(world);
  const paramsRef = useRef(params);
  const cameraRef = useRef(initialCamera);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

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
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!trailCanvasRef.current) {
      trailCanvasRef.current = document.createElement("canvas");
    }
    trailCanvasRef.current.width = viewport.width;
    trailCanvasRef.current.height = viewport.height;

    const trailCtx = trailCanvasRef.current.getContext("2d");
    if (trailCtx) {
      clearTrails(trailCtx, viewport);
    }
  }, [viewport]);

  useEffect(() => {
    const tick = (time: number) => {
      const canvas = canvasRef.current;
      const trailCanvas = trailCanvasRef.current;
      if (!canvas || !trailCanvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d");
      const trailCtx = trailCanvas.getContext("2d");
      if (!ctx || !trailCtx) {
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
        accumulatorRef.current += dtReal * currentParams.speed;
        let stepCount = 0;
        while (accumulatorRef.current >= currentParams.dt && stepCount < 12) {
          const steppedBodies = velocityVerletStep(nextWorld.bodies, currentParams);
          nextWorld = {
            ...nextWorld,
            bodies: steppedBodies,
            elapsedTime: nextWorld.elapsedTime + currentParams.dt,
          };
          const ejection = evaluateEjection(nextWorld, currentParams);
          nextWorld = {
            ...nextWorld,
            ejectionCounterById: ejection.ejectionCounterById,
            ejectedBodyId: ejection.ejectedBodyId,
            isRunning: ejection.isRunning,
          };
          accumulatorRef.current -= currentParams.dt;
          stepCount += 1;
          if (!nextWorld.isRunning) {
            break;
          }
        }

        if (nextWorld !== currentWorld) {
          worldRef.current = nextWorld;
          setWorld(nextWorld);
        }
      }

      const cam = updateCamera(cameraRef.current, worldRef.current.bodies, viewport);
      cameraRef.current = cam;

      drawFrame(ctx, trailCtx, worldRef.current.bodies, cam, viewport, currentParams.trailFade);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [viewport]);

  const onBodyChange = (
    index: number,
    field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y",
    value: number,
  ) => {
    setDraftBodies((prev) => {
      const next = prev.map((body, i) => (i === index ? applyBodyField(body, field, value) : body));
      if (!worldRef.current.isRunning) {
        const synced = {
          ...worldRef.current,
          bodies: next,
          ejectedBodyId: null,
          ejectionCounterById: {},
        };
        worldRef.current = synced;
        setWorld(synced);
      }
      return next;
    });
  };

  const onParamChange = (field: keyof SimParams, value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    setParams((prev) => {
      const next = { ...prev, [field]: value };
      paramsRef.current = next;
      return next;
    });
  };

  const onStartPause = () => {
    setWorld((prev) => {
      const next = { ...prev, isRunning: !prev.isRunning };
      worldRef.current = next;
      return next;
    });
  };

  const onReset = () => {
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    const next: WorldState = {
      bodies: draftBodies.map((b) => ({ ...b })),
      elapsedTime: 0,
      isRunning: false,
      ejectedBodyId: null,
      ejectionCounterById: {},
    };
    worldRef.current = next;
    setWorld(next);

    const trailCanvas = trailCanvasRef.current;
    const trailCtx = trailCanvas?.getContext("2d");
    if (trailCtx) {
      clearTrails(trailCtx, viewport);
    }
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
  };

  return (
    <div className="layout">
      <ControlPanel
        bodies={draftBodies}
        params={params}
        isRunning={world.isRunning}
        ejectedBodyId={world.ejectedBodyId}
        onBodyChange={onBodyChange}
        onParamChange={onParamChange}
        onStartPause={onStartPause}
        onReset={onReset}
        onStep={onStep}
      />
      <main className="stage-wrap" ref={containerRef}>
        <canvas ref={canvasRef} className="stage" />
        <div className="hud">t = {world.elapsedTime.toFixed(2)}</div>
      </main>
    </div>
  );
}

export default App;
