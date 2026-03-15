import type { BodyState, SimParams } from "../sim/types";

type Props = {
  bodies: BodyState[];
  params: SimParams;
  isRunning: boolean;
  ejectedBodyId: string | null;
  onBodyChange: (index: number, field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y", value: number) => void;
  onParamChange: (field: keyof SimParams, value: number) => void;
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
};

const number = (value: number) => Number.isFinite(value) ? value : 0;

export const ControlPanel = ({
  bodies,
  params,
  isRunning,
  ejectedBodyId,
  onBodyChange,
  onParamChange,
  onStartPause,
  onReset,
  onStep,
}: Props) => {
  return (
    <aside className="panel">
      <h1>Three-Body Simulator</h1>
      <p className="muted">Set initial conditions, then start the simulation.</p>

      <section>
        <h2>Simulation</h2>
        <label>
          Gravity G
          <input
            type="number"
            step="0.05"
            value={params.G}
            onChange={(e) => onParamChange("G", number(e.target.valueAsNumber))}
          />
        </label>
        <label>
          Time step dt
          <input
            type="number"
            step="0.001"
            min="0.0001"
            value={params.dt}
            onChange={(e) => onParamChange("dt", number(e.target.valueAsNumber))}
          />
        </label>
        <label>
          Speed {params.speed.toFixed(2)}x
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={params.speed}
            onChange={(e) => onParamChange("speed", Number(e.target.value))}
          />
        </label>
        <label>
          Trail fade
          <input
            type="range"
            min="0.01"
            max="0.2"
            step="0.005"
            value={params.trailFade}
            onChange={(e) => onParamChange("trailFade", Number(e.target.value))}
          />
        </label>
        <label>
          Softening epsilon
          <input
            type="number"
            step="0.005"
            min="0"
            value={params.softening}
            onChange={(e) => onParamChange("softening", number(e.target.valueAsNumber))}
          />
        </label>
      </section>

      {bodies.map((body, index) => (
        <section key={body.id}>
          <h2 style={{ color: body.color }}>Body {index + 1}</h2>
          <label>
            Mass
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={body.mass}
              onChange={(e) => onBodyChange(index, "mass", number(e.target.valueAsNumber))}
            />
          </label>
          <label>
            Position X
            <input
              type="number"
              step="0.05"
              value={body.position.x}
              onChange={(e) => onBodyChange(index, "position.x", number(e.target.valueAsNumber))}
            />
          </label>
          <label>
            Position Y
            <input
              type="number"
              step="0.05"
              value={body.position.y}
              onChange={(e) => onBodyChange(index, "position.y", number(e.target.valueAsNumber))}
            />
          </label>
          <label>
            Velocity X
            <input
              type="number"
              step="0.05"
              value={body.velocity.x}
              onChange={(e) => onBodyChange(index, "velocity.x", number(e.target.valueAsNumber))}
            />
          </label>
          <label>
            Velocity Y
            <input
              type="number"
              step="0.05"
              value={body.velocity.y}
              onChange={(e) => onBodyChange(index, "velocity.y", number(e.target.valueAsNumber))}
            />
          </label>
        </section>
      ))}

      <section>
        <div className="button-row">
          <button onClick={onStartPause}>{isRunning ? "Pause" : "Start"}</button>
          <button onClick={onReset}>Reset</button>
          <button onClick={onStep}>Step</button>
        </div>
        {ejectedBodyId && <p className="warning">Paused: {ejectedBodyId} ejected from system.</p>}
      </section>
    </aside>
  );
};
