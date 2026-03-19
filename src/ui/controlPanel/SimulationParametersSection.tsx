import type { SimParams } from "../../sim/types";
import type { LockMode } from "./types";

type Props = {
  params: SimParams;
  lockMode: LockMode;
  manualPanZoom: boolean;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParamChange: (field: keyof SimParams, value: number) => void;
  onLockModeChange: (mode: LockMode) => void;
  onToggleManualPanZoom: (value: boolean) => void;
  onToggleShowOriginMarker: (value: boolean) => void;
  onToggleShowGrid: (value: boolean) => void;
  onToggleShowCenterOfMass: (value: boolean) => void;
  onResetParams: () => void;
};

const number = (value: number) => (Number.isFinite(value) ? value : 0);

export const SimulationParametersSection = ({
  params,
  lockMode,
  manualPanZoom,
  showOriginMarker,
  showGrid,
  showCenterOfMass,
  open,
  onOpenChange,
  onParamChange,
  onLockModeChange,
  onToggleManualPanZoom,
  onToggleShowOriginMarker,
  onToggleShowGrid,
  onToggleShowCenterOfMass,
  onResetParams,
}: Props) => (
  <section>
    <details
      open={open}
      onToggle={(e) => {
        onOpenChange(e.currentTarget.open);
      }}
    >
      <summary className="collapsible-summary">Simulation Parameters</summary>
      <label title="Gravitational constant controlling force strength between bodies.">
        Gravity G
        <input
          type="number"
          step="0.05"
          value={params.G}
          onChange={(e) => onParamChange("G", number(e.target.valueAsNumber))}
        />
      </label>
      <label title="Unified simulation rate control. Higher values prioritize throughput over precision using adaptive high-speed integration.">
        Rate {params.speed.toFixed(2)}x
        <input
          type="range"
          min="0.01"
          max="30"
          step="0.01"
          value={params.speed}
          onChange={(e) => onParamChange("speed", Number(e.target.value))}
        />
      </label>
      <p className="muted" title="Base dt used at low/normal rates. At high rate, effective dt and trail sampling are adapted automatically.">
        Base dt: {params.dt.toFixed(4)} (auto-adaptive at high rate)
      </p>
      <label title="How quickly trail points fade over time. Higher values fade faster.">
        Trail fade
        <input
          type="range"
          min="0.001"
          max="0.2"
          step="0.001"
          value={params.trailFade}
          onChange={(e) => onParamChange("trailFade", Number(e.target.value))}
        />
      </label>
      <label title="Softening term to reduce singular acceleration during close approaches.">
        Softening epsilon
        <input
          type="number"
          step="0.005"
          min="0"
          value={params.softening}
          onChange={(e) => onParamChange("softening", number(e.target.valueAsNumber))}
        />
      </label>
      <div className="control-matrix">
        <span className="control-matrix-label" title="Select which reference point is kept at the viewport center.">
          Lock:
        </span>
        <div className="control-options-grid">
          <label className="lock-option" title="No lock. Camera tracks body bounds naturally.">
            None
            <input
              type="radio"
              name="lock-mode"
              checked={lockMode === "none"}
              onChange={() => onLockModeChange("none")}
            />
          </label>
          <label className="lock-option" title="Lock viewport center to the instantaneous center of mass.">
            COM
            <input
              type="radio"
              name="lock-mode"
              checked={lockMode === "com"}
              onChange={() => onLockModeChange("com")}
            />
          </label>
          <label className="lock-option" title="Lock viewport center to world origin (0,0).">
            Origin
            <input
              type="radio"
              name="lock-mode"
              checked={lockMode === "origin"}
              onChange={() => onLockModeChange("origin")}
            />
          </label>
        </div>

        <span className="control-matrix-label" title="Toggle visual overlays in the canvas.">
          Show:
        </span>
        <div className="control-options-grid">
          <label className="show-option" title="Display the background coordinate grid.">
            Grid
            <input type="checkbox" checked={showGrid} onChange={(e) => onToggleShowGrid(e.target.checked)} />
          </label>
          <label className="show-option" title="Display the center-of-mass marker.">
            COM
            <input type="checkbox" checked={showCenterOfMass} onChange={(e) => onToggleShowCenterOfMass(e.target.checked)} />
          </label>
          <label className="show-option" title="Display the world origin marker at (0,0).">
            Origin
            <input type="checkbox" checked={showOriginMarker} onChange={(e) => onToggleShowOriginMarker(e.target.checked)} />
          </label>
        </div>
      </div>
      <label title="Enable manual camera control: drag to pan and scroll/pinch to zoom.">
        Manual pan/zoom
        <input type="checkbox" checked={manualPanZoom} onChange={(e) => onToggleManualPanZoom(e.target.checked)} />
      </label>
      <div className="button-row">
        <button onClick={onResetParams} title="Restore simulation parameter defaults only.">
          Reset Parameters
        </button>
      </div>
    </details>
  </section>
);
