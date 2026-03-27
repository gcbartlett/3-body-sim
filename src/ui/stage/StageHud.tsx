import type { EjectedBodyStatusBadge } from "../../sim/stageSelectors";

type StageHudProps = {
  statusLabel: string;
  ejectedStatusRows: EjectedBodyStatusBadge[];
  elapsedTime: number;
  speed: number;
  panelExpanded: boolean;
  onTogglePanelExpanded: () => void;
};

export const StageHud = ({
  statusLabel,
  ejectedStatusRows,
  elapsedTime,
  speed,
  panelExpanded,
  onTogglePanelExpanded,
}: StageHudProps) => (
  <>
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
      <div
        className="hud"
        title={
            "Elapsed simulation time and current simulation rate.\n" +
            "Hotkeys: Space start/pause/resume, Right Arrow step, '+' faster, '-' slower,\n" +
            "L cycle lock mode, G toggle grid, C toggle COM, O toggle origin."
        }
      >
        <div>t = {elapsedTime.toFixed(3)}</div>
        <div>rate = {speed.toFixed(2)}x</div>
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
  </>
);
