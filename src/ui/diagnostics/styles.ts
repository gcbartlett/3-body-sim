import type { CSSProperties } from "react";

const HIGHLIGHT_TEXT_COLOR = "#0b1220";
const ALERT_HIGHLIGHT_BACKGROUND = "#fca5a5";

const solidHighlightStyle = (backgroundColor: string): CSSProperties => ({
  backgroundColor,
  color: HIGHLIGHT_TEXT_COLOR,
});

export const pairEnergyHighlightStyle = (
  energy: number,
  colorA: string,
  colorB: string,
): CSSProperties | undefined =>
  energy > 0
    ? {
        background: `linear-gradient(90deg, ${colorA}, ${colorB})`,
        color: HIGHLIGHT_TEXT_COLOR,
      }
    : undefined;

export const nboundHighlightStyle = (nbound: number): CSSProperties | undefined =>
  nbound < 1 ? solidHighlightStyle(ALERT_HIGHLIGHT_BACKGROUND) : undefined;

export const dissolutionHighlightStyle = (
  dissolutionCounterSec: number,
  dissolutionDetected: boolean,
): CSSProperties | undefined =>
  dissolutionCounterSec > 0 || dissolutionDetected
    ? solidHighlightStyle(ALERT_HIGHLIGHT_BACKGROUND)
    : undefined;

export const positiveValueHighlightStyle = (
  value: number,
  bodyColor: string,
): CSSProperties | undefined => (value > 0 ? solidHighlightStyle(bodyColor) : undefined);

export const speedRatioHighlightStyle = (
  speedRatioToEscape: number,
  bodyColor: string,
): CSSProperties | undefined => (speedRatioToEscape > 1 ? solidHighlightStyle(bodyColor) : undefined);

export const farCoreRatioHighlightStyle = (
  farCoreRatio: number,
  farFieldRatioGate: number,
  bodyColor: string,
): CSSProperties | undefined =>
  farCoreRatio > farFieldRatioGate ? solidHighlightStyle(bodyColor) : undefined;

export const outwardHighlightStyle = (
  outward: boolean,
  bodyColor: string,
): CSSProperties | undefined => (outward ? solidHighlightStyle(bodyColor) : undefined);
