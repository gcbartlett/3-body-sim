import { formatDiagnosticValue } from "../../sim/diagnosticFormatting";
import { diagnosticsDriftMetrics } from "../../sim/diagnosticsSelectors";
import type {
  DisplayPairStateWithEps,
  PairEnergyDisplay,
} from "../../sim/diagnosticsSelectors";
import type { DiagnosticsSnapshot } from "../../sim/types";
import { magnitude } from "../../sim/vector";
import {
  dissolutionHighlightStyle,
  nboundHighlightStyle,
  pairEnergyHighlightStyle,
} from "./styles";

type Props = {
  pairEnergies: PairEnergyDisplay;
  displayPairState: DisplayPairStateWithEps;
  dissolutionCounterSec: number;
  dissolutionThresholdSec: number;
  dissolutionDetected: boolean;
  diagnostics: DiagnosticsSnapshot;
  baselineDiagnostics: DiagnosticsSnapshot;
  pairColors: [string, string, string];
};

export const DiagnosticsSummaryColumn = ({
  pairEnergies,
  displayPairState,
  dissolutionCounterSec,
  dissolutionThresholdSec,
  dissolutionDetected,
  diagnostics,
  baselineDiagnostics,
  pairColors,
}: Props) => {
  const [c1, c2, c3] = pairColors;
  const { deltaEnergy, energyDriftPct, deltaMomentumMag, momentumDriftPct } = diagnosticsDriftMetrics(
    diagnostics,
    baselineDiagnostics,
  );

  return (
    <div className="diag-column">
      <p className="metric" title="Total mechanical energy (kinetic + potential) of the system at this instant.">
        Energy: {formatDiagnosticValue(diagnostics.energy)}
      </p>
      <p
        className="metric"
        title="Energy drift from baseline at run/reset start. Smaller drift indicates better numerical stability."
      >
        ΔE: {formatDiagnosticValue(deltaEnergy)} ({formatDiagnosticValue(energyDriftPct)}%)
      </p>
      <p className="metric" title="Magnitude of total linear momentum of all bodies.">
        |P|: {formatDiagnosticValue(magnitude(diagnostics.momentum))}
      </p>
      <p className="metric" title="Momentum drift from baseline at run/reset start.">
        Δ|P|: {formatDiagnosticValue(deltaMomentumMag)} ({formatDiagnosticValue(momentumDriftPct)}%)
      </p>
      <p className="metric" title="Pairwise specific relative energies. Negative means the pair is bound in two-body sense.">
        Eij:{" "}
        <span className="diag-positive-lozenge" style={pairEnergyHighlightStyle(pairEnergies.eps12, c1, c2)}>
          {formatDiagnosticValue(pairEnergies.eps12)}
        </span>{" "}
        <span className="diag-positive-lozenge" style={pairEnergyHighlightStyle(pairEnergies.eps13, c1, c3)}>
          {formatDiagnosticValue(pairEnergies.eps13)}
        </span>{" "}
        <span className="diag-positive-lozenge" style={pairEnergyHighlightStyle(pairEnergies.eps23, c2, c3)}>
          {formatDiagnosticValue(pairEnergies.eps23)}
        </span>
      </p>
      <p
        className="metric"
        title="Fallback non-hierarchical indicator (for k < 5): count of bound pairs using pairwise specific energies εij."
      >
        nbound:{" "}
        <span className="diag-positive-lozenge" style={nboundHighlightStyle(displayPairState.nbound)}>
          {displayPairState.nbound}/3
        </span>
      </p>
      <p
        className="metric"
        title="Accumulated time spent in dissolving state (no bound pairs). Reaching threshold pauses simulation."
      >
        dissolve:{" "}
        <span
          className="diag-positive-lozenge"
          style={dissolutionHighlightStyle(dissolutionCounterSec, dissolutionDetected)}
        >
          {dissolutionDetected
            ? "dissolved"
            : `${dissolutionCounterSec.toFixed(1)}s/${dissolutionThresholdSec.toFixed(0)}s`}
        </span>
      </p>
    </div>
  );
};
