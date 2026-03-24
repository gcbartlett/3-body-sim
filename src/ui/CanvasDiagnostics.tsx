import { useEffect, useRef, useState } from "react";
import type {
  BodyEjectionStatusSnapshot,
  BodyVectorSnapshot,
  DisplayPairStateWithEps,
  PairEnergyDisplay,
} from "../sim/diagnosticsSelectors";
import type { DiagnosticsSnapshot } from "../sim/types";
import { BodyDiagnosticsColumn } from "./diagnostics/BodyDiagnosticsColumn";
import { DiagnosticsSummaryColumn } from "./diagnostics/DiagnosticsSummaryColumn";
import { loadCanvasDiagnosticsOpenState, saveCanvasDiagnosticsOpenState } from "./uiPrefsStorage";

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

  const pairColors: [string, string, string] = [
    bodyVectors[0]?.color ?? "#f7b731",
    bodyVectors[1]?.color ?? "#60a5fa",
    bodyVectors[2]?.color ?? "#8bd450",
  ];

  return (
    <details
      ref={rootRef}
      className="canvas-diagnostics"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="collapsible-summary">Diagnostics</summary>
      <div className="diagnostics-grid">
        <DiagnosticsSummaryColumn
          pairEnergies={pairEnergies}
          displayPairState={displayPairState}
          dissolutionCounterSec={dissolutionCounterSec}
          dissolutionThresholdSec={dissolutionThresholdSec}
          dissolutionDetected={dissolutionDetected}
          diagnostics={diagnostics}
          baselineDiagnostics={baselineDiagnostics}
          pairColors={pairColors}
        />
        {bodyVectors.map((body, index) => (
          <BodyDiagnosticsColumn
            key={body.id}
            body={body}
            bodyIndex={index}
            ejectionStatus={bodyEjectionStatuses[index]}
          />
        ))}
      </div>
    </details>
  );
};
