import { useEffect, useState } from "react";
import type { BodyState, PresetProfile, SimParams } from "../sim/types";

type LockMode = "none" | "origin" | "com";

type Props = {
  bodies: BodyState[];
  params: SimParams;
  isRunning: boolean;
  presets: PresetProfile[];
  selectedPresetId: string;
  lockMode: LockMode;
  manualPanZoom: boolean;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  onBodyChange: (index: number, field: "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y", value: number) => void;
  onParamChange: (field: keyof SimParams, value: number) => void;
  onLockModeChange: (mode: LockMode) => void;
  onToggleManualPanZoom: (value: boolean) => void;
  onToggleShowOriginMarker: (value: boolean) => void;
  onToggleShowGrid: (value: boolean) => void;
  onToggleShowCenterOfMass: (value: boolean) => void;
  onResetParams: () => void;
  onPresetSelect: (id: string) => void;
  onApplyPreset: () => void;
  onSaveProfile: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

const number = (value: number) => Number.isFinite(value) ? value : 0;
const UI_SECTIONS_STORAGE_KEY = "three-body-sim.ui.sections.v1";
type SectionOpenState = {
  presetsOpen: boolean;
  simParamsOpen: boolean;
  bodyConfigOpen: boolean;
};

const loadSectionOpenState = (): SectionOpenState => {
  const fallback: SectionOpenState = {
    presetsOpen: true,
    simParamsOpen: false,
    bodyConfigOpen: false,
  };
  try {
    const raw = localStorage.getItem(UI_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<SectionOpenState>;
    return {
      presetsOpen: parsed.presetsOpen === undefined ? true : Boolean(parsed.presetsOpen),
      simParamsOpen: Boolean(parsed.simParamsOpen),
      bodyConfigOpen: Boolean(parsed.bodyConfigOpen),
    };
  } catch {
    return fallback;
  }
};

const bodyConfigRows = [
  { label: "Mass", field: "mass" as const, step: "0.1", min: "0.1", tooltip: "Mass of the body used in gravitational force calculations." },
  { label: "Position X", field: "position.x" as const, step: "0.05", tooltip: "Initial x-coordinate in world units." },
  { label: "Position Y", field: "position.y" as const, step: "0.05", tooltip: "Initial y-coordinate in world units." },
  { label: "Velocity X", field: "velocity.x" as const, step: "0.05", tooltip: "Initial x-velocity in world-units per second." },
  { label: "Velocity Y", field: "velocity.y" as const, step: "0.05", tooltip: "Initial y-velocity in world-units per second." },
];

export const ControlPanel = ({
  bodies,
  params,
  presets,
  selectedPresetId,
  lockMode,
  manualPanZoom,
  showOriginMarker,
  showGrid,
  showCenterOfMass,
  onBodyChange,
  onParamChange,
  onLockModeChange,
  onToggleManualPanZoom,
  onToggleShowOriginMarker,
  onToggleShowGrid,
  onToggleShowCenterOfMass,
  onResetParams,
  onPresetSelect,
  onApplyPreset,
  onSaveProfile,
  onGenerateRandomStable,
  onGenerateRandomChaotic,
}: Props) => {
  const formatBodyInputValue = (value: number) => Number(value.toFixed(3));

  const [sectionState, setSectionState] = useState<SectionOpenState>(loadSectionOpenState);
  const isPresetsOpen = sectionState.presetsOpen;
  const isSimParamsOpen = sectionState.simParamsOpen;
  const isBodyConfigOpen = sectionState.bodyConfigOpen;

  useEffect(() => {
    try {
      localStorage.setItem(UI_SECTIONS_STORAGE_KEY, JSON.stringify(sectionState));
    } catch {
      // Ignore storage failures (quota/private mode).
    }
  }, [sectionState]);

  return (
    <aside className="panel">
      <h1>Three-Body Simulator</h1>
      <p className="muted">Set initial conditions, then start the simulation.</p>

      <section>
        <details
          open={isSimParamsOpen}
          onToggle={(e) => {
            const open = e.currentTarget.open;
            setSectionState((prev) => ({ ...prev, simParamsOpen: open }));
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
            <span className="control-matrix-label" title="Select which reference point is kept at the viewport center.">Lock:</span>
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

            <span className="control-matrix-label" title="Toggle visual overlays in the canvas.">Show:</span>
            <div className="control-options-grid">
              <label className="show-option" title="Display the background coordinate grid.">
                Grid
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => onToggleShowGrid(e.target.checked)}
                />
              </label>
              <label className="show-option" title="Display the center-of-mass marker.">
                COM
                <input
                  type="checkbox"
                  checked={showCenterOfMass}
                  onChange={(e) => onToggleShowCenterOfMass(e.target.checked)}
                />
              </label>
              <label className="show-option" title="Display the world origin marker at (0,0).">
                Origin
                <input
                  type="checkbox"
                  checked={showOriginMarker}
                  onChange={(e) => onToggleShowOriginMarker(e.target.checked)}
                />
              </label>
            </div>
          </div>
          <label title="Enable manual camera control: drag to pan and scroll/pinch to zoom.">
            Manual pan/zoom
            <input
              type="checkbox"
              checked={manualPanZoom}
              onChange={(e) => onToggleManualPanZoom(e.target.checked)}
            />
          </label>
          <div className="button-row">
            <button onClick={onResetParams} title="Restore simulation parameter defaults only.">
              Reset Parameters
            </button>
          </div>
        </details>
      </section>

      <section>
        <details
          open={isBodyConfigOpen}
          onToggle={(e) => {
            const open = e.currentTarget.open;
            setSectionState((prev) => ({ ...prev, bodyConfigOpen: open }));
          }}
        >
          <summary className="collapsible-summary">Initial Body Configuration</summary>
          <div className="body-config-matrix">
            <div className="body-config-header body-config-label-header">Parameter</div>
            {bodies.map((body, index) => (
            <div
              key={`header-${body.id}`}
              className="body-config-header"
              style={{ color: body.color }}
              title="Column for this body's initial conditions."
            >
              Body {index + 1}
            </div>
          ))}

            {bodyConfigRows.map((row) => (
              <div key={`row-${row.field}`} className="body-config-row">
                <div className="body-config-label" title={row.tooltip}>{row.label}</div>
                {bodies.map((body, index) => {
                  const value =
                    row.field === "mass"
                      ? body.mass
                      : row.field === "position.x"
                      ? body.position.x
                      : row.field === "position.y"
                      ? body.position.y
                      : row.field === "velocity.x"
                      ? body.velocity.x
                      : body.velocity.y;
                  return (
                    <div key={`${body.id}-${row.field}`} className="body-config-cell">
                      <input
                        className="body-input"
                        style={{ color: body.color, borderColor: body.color }}
                        title={row.tooltip}
                        type="number"
                        step={row.step}
                        min={row.min}
                        value={formatBodyInputValue(value)}
                        onChange={(e) => onBodyChange(index, row.field, number(e.target.valueAsNumber))}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </details>
      </section>

      <section>
        <details
          open={isPresetsOpen}
          onToggle={(e) => {
            const open = e.currentTarget.open;
            setSectionState((prev) => ({ ...prev, presetsOpen: open }));
          }}
        >
          <summary className="collapsible-summary">Presets</summary>
          <label>
            Profile
            <select value={selectedPresetId} onChange={(e) => onPresetSelect(e.target.value)}>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {presets.find((preset) => preset.id === selectedPresetId)?.description}
          </p>
          <div className="button-row">
            <button onClick={onApplyPreset}>Load Profile</button>
            <button onClick={onSaveProfile} title="Save the current initial conditions and simulation parameters as a new user profile.">
              Save Profile
            </button>
            <button onClick={onGenerateRandomStable} title="Generate a random near-bound initial configuration.">
              Random Stable
            </button>
            <button onClick={onGenerateRandomChaotic} title="Generate a random high-chaos initial configuration.">
              Random Chaotic
            </button>
          </div>
        </details>
      </section>

    </aside>
  );
};
