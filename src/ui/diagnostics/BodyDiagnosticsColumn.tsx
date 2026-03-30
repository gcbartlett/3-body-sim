import { memo } from "react";
import { FAR_FIELD_RATIO_GATE } from "../../sim/ejection";
import { formatDiagnosticValue } from "../../sim/diagnosticFormatting";
import type {
  BodyEjectionStatusSnapshot,
  BodyVectorSnapshot,
} from "../../sim/diagnosticsSelectors";
import { magnitude } from "../../sim/vector";
import {
  farCoreRatioHighlightStyle,
  outwardHighlightStyle,
  positiveValueHighlightStyle,
  speedRatioHighlightStyle,
} from "./styles";

type Props = {
  body: BodyVectorSnapshot;
  bodyIndex: number;
  ejectionStatus?: BodyEjectionStatusSnapshot;
};

const BodyDiagnosticsColumnComponent = ({ body, bodyIndex, ejectionStatus }: Props) => {
  const speed = magnitude(body.velocity);
  const parallelAcceleration =
    speed > 1e-9
      ? (body.acceleration.x * body.velocity.x + body.acceleration.y * body.velocity.y) / speed
      : 0;

  return (
    <div className="diag-column body-vector-column" style={{ color: body.color }}>
      <p className="metric diag-body-heading" title="Diagnostics for this body.">
        Body {bodyIndex + 1}
      </p>
      <p className="metric" title="Current position vector of this body in world units.">
        r: ({formatDiagnosticValue(body.position.x)}, {formatDiagnosticValue(body.position.y)})
      </p>
      <p className="metric" title="Current velocity vector of this body in world-units per second.">
        v: ({formatDiagnosticValue(body.velocity.x)}, {formatDiagnosticValue(body.velocity.y)}) |v|:{" "}
        {formatDiagnosticValue(speed)}
      </p>
      <p className="metric" title="Current acceleration vector of this body from gravitational interactions.">
        a: ({formatDiagnosticValue(body.acceleration.x)}, {formatDiagnosticValue(body.acceleration.y)}) a||:{" "}
        {formatDiagnosticValue(parallelAcceleration)}
      </p>
      <p
        className="metric"
        title="Core-relative specific energy for this body. Positive values indicate unbound tendency relative to the other two-body core."
      >
        Erel:{" "}
        <span className="diag-positive-lozenge" style={positiveValueHighlightStyle(ejectionStatus?.energy ?? 0, body.color)}>
          {formatDiagnosticValue(ejectionStatus?.energy ?? 0)}
        </span>
      </p>
      <p
        className="metric"
        title="Relative speed divided by local escape speed from the two-body core. Values above +1 indicate escape-speed excess."
      >
        v/vesc:{" "}
        <span
          className="diag-positive-lozenge"
          style={speedRatioHighlightStyle(ejectionStatus?.speedRatioToEscape ?? 0, body.color)}
        >
          {formatDiagnosticValue(ejectionStatus?.speedRatioToEscape ?? 0)}
        </span>
      </p>
      <p
        className="metric"
        title="Core-distance ratio: r_rel / a_core, where a_core is separation of the other two bodies. A common conservative guide is k >= 5."
      >
        rrel/acore:{" "}
        <span
          className="diag-positive-lozenge"
          style={farCoreRatioHighlightStyle(ejectionStatus?.farCoreRatio ?? 0, FAR_FIELD_RATIO_GATE, body.color)}
        >
          {formatDiagnosticValue(ejectionStatus?.farCoreRatio ?? 0)}
        </span>
      </p>
      <p
        className="metric"
        title="Outward indicates motion away from the two-body core. Count tracks accumulated strong-escape time toward the ejection threshold in seconds."
      >
        out:{" "}
        <span className="diag-positive-lozenge" style={outwardHighlightStyle(ejectionStatus?.outward ?? false, body.color)}>
          {ejectionStatus?.outward ? "Y" : "N"}
        </span>{" "}
        cnt:{" "}
        <span className="diag-positive-lozenge" style={positiveValueHighlightStyle(ejectionStatus?.counter ?? 0, body.color)}>
          {(ejectionStatus?.isEjected ?? false) || (ejectionStatus?.counter ?? 0) >= (ejectionStatus?.threshold ?? 0)
            ? "ejected"
            : `${(ejectionStatus?.counter ?? 0).toFixed(1)}s/${(ejectionStatus?.threshold ?? 0).toFixed(0)}s`}
        </span>
      </p>
    </div>
  );
};

export const BodyDiagnosticsColumn = memo(BodyDiagnosticsColumnComponent);
BodyDiagnosticsColumn.displayName = "BodyDiagnosticsColumn";
