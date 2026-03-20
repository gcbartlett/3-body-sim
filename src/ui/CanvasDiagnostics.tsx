import { useEffect, useRef, useState } from "react";
import { formatDiagnosticValue } from "../sim/diagnosticFormatting";
import { FAR_FIELD_RATIO_GATE } from "../sim/ejection";
import type {
  BodyEjectionStatusSnapshot,
  BodyVectorSnapshot,
  DisplayPairState,
} from "../sim/simulationSelectors";
import type { DiagnosticsSnapshot } from "../sim/types";
import { magnitude } from "../sim/vector";
import { loadCanvasDiagnosticsOpenState, saveCanvasDiagnosticsOpenState } from "./uiPrefsStorage";

type DisplayPairStateWithEps = DisplayPairState & { eps: number };
type PairEnergyDisplay = { eps12: number; eps13: number; eps23: number };

type Props = {
  pairEnergies: PairEnergyDisplay;
  displayPairState: DisplayPairStateWithEps;
  dissolutionCounterSec: number;
  dissolutionThresholdSec: number;
  dissolutionDetected: boolean;
  diagnostics: DiagnosticsSnapshot;
  baselineDiagnostics: DiagnosticsSnapshot;
  bodyVectors: BodyVectorSnapshot[];
  bodyEjectionStatuses: BodyEjectionStatusSnapshot[];
  onVisibleHeightChange?: (height: number) => void;
};

export const CanvasDiagnostics = ({
  pairEnergies,
  displayPairState,
  dissolutionCounterSec,
  dissolutionThresholdSec,
  dissolutionDetected,
  diagnostics,
  baselineDiagnostics,
  bodyVectors,
  bodyEjectionStatuses,
  onVisibleHeightChange,
}: Props) => {
  const [isOpen, setIsOpen] = useState<boolean>(loadCanvasDiagnosticsOpenState);
  const rootRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    saveCanvasDiagnosticsOpenState(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!onVisibleHeightChange) {
      return;
    }
    const element = rootRef.current;
    if (!element) {
      onVisibleHeightChange(0);
      return;
    }

    const emit = () => {
      const h = isOpen ? element.getBoundingClientRect().height + 10 : 0;
      onVisibleHeightChange(h);
    };
    emit();
    const observer = new ResizeObserver(() => emit());
    observer.observe(element);
    return () => {
      observer.disconnect();
      onVisibleHeightChange(0);
    };
  }, [isOpen, onVisibleHeightChange]);

  const deltaEnergy = diagnostics.energy - baselineDiagnostics.energy;
  const energyDriftPct = (Math.abs(deltaEnergy) / Math.max(1e-9, Math.abs(baselineDiagnostics.energy))) * 100;
  const deltaMomentum = {
    x: diagnostics.momentum.x - baselineDiagnostics.momentum.x,
    y: diagnostics.momentum.y - baselineDiagnostics.momentum.y,
  };
  const deltaMomentumMag = magnitude(deltaMomentum);
  const baselineMomentumMag = magnitude(baselineDiagnostics.momentum);
  const momentumDriftPct = (deltaMomentumMag / Math.max(1e-9, baselineMomentumMag)) * 100;
  const c1 = bodyVectors[0]?.color ?? "#f7b731";
  const c2 = bodyVectors[1]?.color ?? "#60a5fa";
  const c3 = bodyVectors[2]?.color ?? "#8bd450";
  const pairGradient = (a: string, b: string) => ({
    background: `linear-gradient(90deg, ${a}, ${b})`,
    color: "#0b1220",
  });

  return (
    <details
      ref={rootRef}
      className="canvas-diagnostics"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="collapsible-summary">Diagnostics</summary>
      <div className="diagnostics-grid">
        <div className="diag-column">
          <p className="metric" title="Total mechanical energy (kinetic + potential) of the system at this instant.">Energy: {formatDiagnosticValue(diagnostics.energy)}</p>
          <p className="metric" title="Energy drift from baseline at run/reset start. Smaller drift indicates better numerical stability.">ΔE: {formatDiagnosticValue(deltaEnergy)} ({formatDiagnosticValue(energyDriftPct)}%)</p>
          <p className="metric" title="Magnitude of total linear momentum of all bodies.">
            |P|: {formatDiagnosticValue(magnitude(diagnostics.momentum))}
          </p>
          <p className="metric" title="Momentum drift from baseline at run/reset start.">Δ|P|: {formatDiagnosticValue(deltaMomentumMag)} ({formatDiagnosticValue(momentumDriftPct)}%)</p>
          <p className="metric" title="Pairwise specific relative energies. Negative means the pair is bound in two-body sense.">
            Eij:{" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.eps12 > 0 ? pairGradient(c1, c2) : undefined}
            >
              {formatDiagnosticValue(pairEnergies.eps12)}
            </span>
            {" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.eps13 > 0 ? pairGradient(c1, c3) : undefined}
            >
              {formatDiagnosticValue(pairEnergies.eps13)}
            </span>
            {" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.eps23 > 0 ? pairGradient(c2, c3) : undefined}
            >
              {formatDiagnosticValue(pairEnergies.eps23)}
            </span>
          </p>
          <p className="metric" title="Fallback non-hierarchical indicator (for k < 5): count of bound pairs using pairwise specific energies εij.">
            nbound:{" "}
            <span
              className="diag-positive-lozenge"
              style={
                displayPairState.nbound < 1
                  ? { backgroundColor: "#fca5a5", color: "#0b1220" }
                  : undefined
              }
            >
              {displayPairState.nbound}/3
            </span>
          </p>
          <p className="metric" title="Accumulated time spent in dissolving state (no bound pairs). Reaching threshold pauses simulation.">
            dissolve:{" "}
            <span
              className="diag-positive-lozenge"
              style={
                dissolutionCounterSec > 0 || dissolutionDetected
                  ? { backgroundColor: "#fca5a5", color: "#0b1220" }
                  : undefined
              }
            >
              {dissolutionDetected ? "dissolved" : `${dissolutionCounterSec.toFixed(1)}s/${dissolutionThresholdSec.toFixed(0)}s`}
            </span>
          </p>
        </div>
        {bodyVectors.map((body, index) => (
          <div key={body.id} className="diag-column body-vector-column" style={{ color: body.color }}>
            <p className="metric diag-body-heading" title="Diagnostics for this body.">Body {index + 1}</p>
            <p className="metric" title="Current position vector of this body in world units.">r: ({formatDiagnosticValue(body.position.x)}, {formatDiagnosticValue(body.position.y)})</p>
            <p className="metric" title="Current velocity vector of this body in world-units per second.">
              v: ({formatDiagnosticValue(body.velocity.x)}, {formatDiagnosticValue(body.velocity.y)}) |v|: {formatDiagnosticValue(magnitude(body.velocity))}
            </p>
            <p className="metric" title="Current acceleration vector of this body from gravitational interactions.">
              a: ({formatDiagnosticValue(body.acceleration.x)}, {formatDiagnosticValue(body.acceleration.y)}) a||:{" "}
              {formatDiagnosticValue(
                magnitude(body.velocity) > 1e-9
                  ? (body.acceleration.x * body.velocity.x + body.acceleration.y * body.velocity.y) /
                      magnitude(body.velocity)
                  : 0,
              )}
            </p>
            <p className="metric" title="Core-relative specific energy for this body. Positive values indicate unbound tendency relative to the other two-body core.">
              Erel:{" "}
              <span
                className="diag-positive-lozenge"
                style={
                  (bodyEjectionStatuses[index]?.energy ?? 0) > 0
                    ? { backgroundColor: body.color, color: "#0b1220" }
                    : undefined
                }
              >
                {formatDiagnosticValue(bodyEjectionStatuses[index]?.energy ?? 0)}
              </span>
            </p>
            <p className="metric" title="Relative speed divided by local escape speed from the two-body core. Values above +1 indicate escape-speed excess.">
              v/vesc:{" "}
              <span
                className="diag-positive-lozenge"
                style={
                  (bodyEjectionStatuses[index]?.speedRatioToEscape ?? 0) > 1
                    ? { backgroundColor: body.color, color: "#0b1220" }
                    : undefined
                }
              >
                {formatDiagnosticValue(bodyEjectionStatuses[index]?.speedRatioToEscape ?? 0)}
              </span>
            </p>
            <p className="metric" title="Core-distance ratio: r_rel / a_core, where a_core is separation of the other two bodies. A common conservative guide is k >= 5.">
              rrel/acore:{" "}
              <span
                className="diag-positive-lozenge"
                style={
                  (bodyEjectionStatuses[index]?.farCoreRatio ?? 0) > FAR_FIELD_RATIO_GATE
                    ? { backgroundColor: body.color, color: "#0b1220" }
                    : undefined
                }
              >
                {formatDiagnosticValue(bodyEjectionStatuses[index]?.farCoreRatio ?? 0)}
              </span>
            </p>
            <p className="metric" title="Outward indicates motion away from the two-body core. Count tracks accumulated strong-escape time toward the ejection threshold in seconds.">
              out:{" "}
              <span
                className="diag-positive-lozenge"
                style={
                  bodyEjectionStatuses[index]?.outward
                    ? { backgroundColor: body.color, color: "#0b1220" }
                    : undefined
                }
              >
                {bodyEjectionStatuses[index]?.outward ? "Y" : "N"}
              </span>
              {" "}
              cnt:{" "}
              <span
                className="diag-positive-lozenge"
                style={
                  (bodyEjectionStatuses[index]?.counter ?? 0) > 0
                    ? { backgroundColor: body.color, color: "#0b1220" }
                    : undefined
                }
              >
                {(bodyEjectionStatuses[index]?.isEjected ?? false) ||
                (bodyEjectionStatuses[index]?.counter ?? 0) >= (bodyEjectionStatuses[index]?.threshold ?? 0)
                  ? "ejected"
                  : `${(bodyEjectionStatuses[index]?.counter ?? 0).toFixed(1)}s/${(
                      bodyEjectionStatuses[index]?.threshold ?? 0
                    ).toFixed(0)}s`}
              </span>
            </p>
          </div>
        ))}
      </div>
    </details>
  );
};
