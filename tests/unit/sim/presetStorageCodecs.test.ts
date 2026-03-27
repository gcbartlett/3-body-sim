import { describe, expect, it } from "vitest";
import {
  decodePersistedParams,
  decodePersistedUiPrefs,
  decodePersistedUserPresets,
  sanitizePresetDescription,
  sanitizePresetId,
  sanitizePresetName,
} from "~/src/sim/presetStorageCodecs";

describe("decodePersistedParams", () => {
  it("returns defaults when raw payload is missing or invalid", () => {
    expect(decodePersistedParams(null)).toEqual({
      G: 1,
      dt: 0.005,
      speed: 1,
      softening: 0.02,
      trailFade: 0.05,
    });
    expect(decodePersistedParams("{bad-json")).toEqual({
      G: 1,
      dt: 0.005,
      speed: 1,
      softening: 0.02,
      trailFade: 0.05,
    });
  });

  it("sanitizes numeric bounds and falls back for invalid values", () => {
    const result = decodePersistedParams(
      JSON.stringify({
        G: -1,
        dt: 0,
        speed: Number.NaN,
        softening: -2,
        trailFade: 0,
      }),
    );

    expect(result).toEqual({
      G: 0,
      dt: 0.0001,
      speed: 1,
      softening: 0,
      trailFade: 0.0001,
    });
  });
});

describe("decodePersistedUiPrefs", () => {
  it("uses defaults when values are missing or invalid", () => {
    expect(
      decodePersistedUiPrefs({
        panelExpanded: null,
        lockMode: "invalid-mode",
        showOriginMarker: null,
        showGrid: null,
        showCenterOfMass: null,
      }),
    ).toEqual({
      panelExpanded: true,
      lockMode: "com",
      showOriginMarker: true,
      showGrid: true,
      showCenterOfMass: true,
    });
  });

  it("decodes persisted booleans and lock mode", () => {
    expect(
      decodePersistedUiPrefs({
        panelExpanded: "0",
        lockMode: "origin",
        showOriginMarker: "1",
        showGrid: "0",
        showCenterOfMass: "1",
      }),
    ).toEqual({
      panelExpanded: false,
      lockMode: "origin",
      showOriginMarker: true,
      showGrid: false,
      showCenterOfMass: true,
    });
  });

  it('treats non-"1" non-null boolean payloads as false', () => {
    expect(
      decodePersistedUiPrefs({
        panelExpanded: "true",
        lockMode: "origin",
        showOriginMarker: "yes",
        showGrid: "2",
        showCenterOfMass: "",
      }),
    ).toEqual({
      panelExpanded: false,
      lockMode: "origin",
      showOriginMarker: false,
      showGrid: false,
      showCenterOfMass: false,
    });
  });

  it("uses fallback defaults only for null keys in mixed payloads", () => {
    expect(
      decodePersistedUiPrefs({
        panelExpanded: null,
        lockMode: "origin",
        showOriginMarker: "0",
        showGrid: null,
        showCenterOfMass: "1",
      }),
    ).toEqual({
      panelExpanded: true,
      lockMode: "origin",
      showOriginMarker: false,
      showGrid: true,
      showCenterOfMass: true,
    });
  });

  it('accepts "none" and "com" lock modes', () => {
    expect(
      decodePersistedUiPrefs({
        panelExpanded: "1",
        lockMode: "none",
        showOriginMarker: "1",
        showGrid: "1",
        showCenterOfMass: "1",
      }).lockMode,
    ).toBe("none");

    expect(
      decodePersistedUiPrefs({
        panelExpanded: "1",
        lockMode: "com",
        showOriginMarker: "1",
        showGrid: "1",
        showCenterOfMass: "1",
      }).lockMode,
    ).toBe("com");
  });
});

describe("decodePersistedUserPresets", () => {
  it("returns empty array when raw payload is missing or malformed", () => {
    expect(decodePersistedUserPresets(null)).toEqual([]);
    expect(decodePersistedUserPresets("{oops")).toEqual([]);
    expect(decodePersistedUserPresets(JSON.stringify({ id: "x" }))).toEqual([]);
  });

  it("filters invalid presets, deduplicates ids, and sanitizes fields", () => {
    const raw = JSON.stringify([
      {
        id: " user profile ",
        name: "  <Demo> Name ",
        description: "line 1\r\n\r\n\r\nline 2",
        bodies: [
          {
            id: "override-1",
            color: "#fff",
            mass: -2,
            position: { x: 1, y: "bad" },
            velocity: { x: 5, y: 6 },
          },
          {
            id: "override-2",
            color: "#fff",
            mass: 2,
            position: { x: 7, y: 8 },
            velocity: { x: 9, y: 10 },
          },
          {
            id: "override-3",
            color: "#fff",
            mass: 3,
            position: { x: 11, y: 12 },
            velocity: { x: 13, y: 14 },
          },
        ],
        params: { G: -3, dt: 0.25, speed: 0, softening: -1, trailFade: 0 },
      },
      {
        id: "user-profile",
        name: "Duplicate Id",
        description: "",
        bodies: [],
      },
      {
        id: "!!!",
        name: "Invalid id",
        description: "",
        bodies: [],
      },
    ]);

    const result = decodePersistedUserPresets(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "user-profile",
      name: "Demo Name",
      description: "line 1\n\nline 2",
      bodies: [
        {
          id: "body-1",
          color: "#f7b731",
          mass: 0.001,
          position: { x: 1, y: 0 },
          velocity: { x: 5, y: 6 },
        },
        {
          id: "body-2",
          color: "#60a5fa",
          mass: 2,
          position: { x: 7, y: 8 },
          velocity: { x: 9, y: 10 },
        },
        {
          id: "body-3",
          color: "#8bd450",
          mass: 3,
          position: { x: 11, y: 12 },
          velocity: { x: 13, y: 14 },
        },
      ],
      params: {
        G: 0,
        dt: 0.25,
        speed: 0.01,
        softening: 0,
        trailFade: 0.0001,
      },
    });
  });
});

describe("preset text sanitizers", () => {
  it("normalizes id/name/description consistently", () => {
    expect(sanitizePresetId("  !!a  b__c..  ")).toBe("a-b__c");
    expect(sanitizePresetName("  hello   <world>  ")).toBe("hello world");
    expect(sanitizePresetDescription("a\r\n\r\n\r\n< b >")).toBe("a\n\n b");
  });
});
