import { useEffect, useRef, useState } from "react";
import { FAR_FIELD_RATIO_GATE } from "../sim/ejection";
import type { DiagnosticsSnapshot } from "../sim/types";
import { magnitude } from "../sim/vector";
import { loadCanvasDiagnosticsOpenState, saveCanvasDiagnosticsOpenState } from "./uiPrefsStorage";

type Vec2 = { x: number; y: number };
type BodyVectors = {
  id: string;
  color: string;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
};
type BodyEjectionStatus = {
  id: string;
  energy: number;
  speedRatioToEscape: number;
  farCoreRatio: number;
  outward: boolean;
  counter: number;
  threshold: number;
  isEjected: boolean;
};

type Props = {
  pairEnergies: {
    e12: number;
    e13: number;
    e23: number;
  };
  displayPairState: {
    nbound: number;
    state: "dissolving" | "binary+single" | "resonant";
    eps: number;
  };
  dissolutionCounterSec: number;
  dissolutionThresholdSec: number;
  dissolutionDetected: boolean;
  diagnostics: DiagnosticsSnapshot;
  baselineDiagnostics: DiagnosticsSnapshot;
  bodyVectors: BodyVectors[];
  bodyEjectionStatuses: BodyEjectionStatus[];
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

  const fmt = (value: number) => {
    const normalized = Math.abs(value) < 0.0005 ? 0 : value;
    const abs = Math.abs(normalized);
    const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(dp)}`;
  };
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
          <p className="metric" title="Total mechanical energy (kinetic + potential) of the system at this instant.">Energy: {fmt(diagnostics.energy)}</p>
          <p className="metric" title="Energy drift from baseline at run/reset start. Smaller drift indicates better numerical stability.">ΔE: {fmt(deltaEnergy)} ({fmt(energyDriftPct)}%)</p>
          <p className="metric" title="Magnitude of total linear momentum of all bodies.">
            |P|: {fmt(magnitude(diagnostics.momentum))}
          </p>
          <p className="metric" title="Momentum drift from baseline at run/reset start.">Δ|P|: {fmt(deltaMomentumMag)} ({fmt(momentumDriftPct)}%)</p>
          <p className="metric" title="Pairwise specific relative energies. Negative means the pair is bound in two-body sense.">
            Eij:{" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.e12 > 0 ? pairGradient(c1, c2) : undefined}
            >
              {fmt(pairEnergies.e12)}
            </span>
            {" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.e13 > 0 ? pairGradient(c1, c3) : undefined}
            >
              {fmt(pairEnergies.e13)}
            </span>
            {" "}
            <span
              className="diag-positive-lozenge"
              style={pairEnergies.e23 > 0 ? pairGradient(c2, c3) : undefined}
            >
              {fmt(pairEnergies.e23)}
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
            <p className="metric" title="Current position vector of this body in world units.">r: ({fmt(body.position.x)}, {fmt(body.position.y)})</p>
            <p className="metric" title="Current velocity vector of this body in world-units per second.">
              v: ({fmt(body.velocity.x)}, {fmt(body.velocity.y)}) |v|: {fmt(magnitude(body.velocity))}
            </p>
            <p className="metric" title="Current acceleration vector of this body from gravitational interactions.">
              a: ({fmt(body.acceleration.x)}, {fmt(body.acceleration.y)}) a||:{" "}
              {fmt(
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
                {fmt(bodyEjectionStatuses[index]?.energy ?? 0)}
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
                {fmt(bodyEjectionStatuses[index]?.speedRatioToEscape ?? 0)}
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
                {fmt(bodyEjectionStatuses[index]?.farCoreRatio ?? 0)}
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
