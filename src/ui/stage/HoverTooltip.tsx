type HoverTooltipBody = {
  x: number;
  y: number;
  color: string;
  lines: string[];
};

type HoverTooltipProps = {
  hoverBody: HoverTooltipBody | null;
  viewportWidth: number;
  viewportHeight: number;
};

export const HoverTooltip = ({ hoverBody, viewportWidth, viewportHeight }: HoverTooltipProps) => {
  if (!hoverBody) {
    return null;
  }

  return (
    <div
      className="body-hover-tooltip"
      style={{
        left: Math.min(viewportWidth - 420, hoverBody.x + 12),
        top: Math.min(viewportHeight - 90, hoverBody.y + 12),
        borderColor: hoverBody.color,
        color: hoverBody.color,
      }}
    >
      {hoverBody.lines.map((line, index) => (
        <div key={index} className={index === 0 ? "body-hover-title" : "body-hover-line"}>
          {line}
        </div>
      ))}
    </div>
  );
};
