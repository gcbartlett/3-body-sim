import { memo, useEffect, useRef, useState, type ReactElement } from "react";
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
import { perfMonitor } from "../perf/perfMonitor";

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
  onOpenChange?: (isOpen: boolean) => void;
};

const DIAGNOSTICS_LAYOUT_BOTTOM_PADDING_PX = 10;

export const diagnosticsVisibleHeightForLayout = (elementHeight: number): number =>
  Math.max(0, elementHeight + DIAGNOSTICS_LAYOUT_BOTTOM_PADDING_PX);

const CanvasDiagnosticsComponent = ({
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
  onOpenChange,
}: Props) => {
  const [isOpen, setIsOpen] = useState<boolean>(loadCanvasDiagnosticsOpenState);
  const rootRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    saveCanvasDiagnosticsOpenState(isOpen);
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

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
      const measureStart = performance.now();
      const h = diagnosticsVisibleHeightForLayout(element.getBoundingClientRect().height);
      perfMonitor.recordDuration("layout.canvasDiagnostics.measure", performance.now() - measureStart);
      onVisibleHeightChange(h);
      perfMonitor.incrementCounter("layout.canvasDiagnostics.emit");
    };
    emit();
    const observer = new ResizeObserver(() => {
      perfMonitor.incrementCounter("layout.canvasDiagnostics.resizeObserver.callback");
      emit();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [isOpen, onVisibleHeightChange]);

  let diagnosticsGrid: ReactElement | null = null;
  if (isOpen) {
    const pairColors: [string, string, string] = [
      bodyVectors[0]?.color ?? "#f7b731",
      bodyVectors[1]?.color ?? "#60a5fa",
      bodyVectors[2]?.color ?? "#8bd450",
    ];
    diagnosticsGrid = (
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
    );
  }

  return (
    <details
      ref={rootRef}
      className="canvas-diagnostics"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="collapsible-summary">Diagnostics</summary>
      {diagnosticsGrid}
    </details>
  );
};

export const CanvasDiagnostics = memo(CanvasDiagnosticsComponent);
CanvasDiagnostics.displayName = "CanvasDiagnostics";
