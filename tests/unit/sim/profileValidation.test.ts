import { describe, expect, it } from "vitest";
import {
  buildSavedPresetFromDraft,
  selectedUserPresetIbcDirty,
  validateEditedPresetDraft,
} from "~/src/sim/profileValidation";
import type { BodyState, PresetProfile, SimParams } from "~/src/sim/types";

const makeBodies = (): BodyState[] => [
  {
    id: "body-1",
    mass: 1,
    position: { x: 1, y: 2 },
    velocity: { x: 3, y: 4 },
    color: "#f00",
  },
  {
    id: "body-2",
    mass: 2,
    position: { x: 5, y: 6 },
    velocity: { x: 7, y: 8 },
    color: "#0f0",
  },
  {
    id: "body-3",
    mass: 3,
    position: { x: 9, y: 10 },
    velocity: { x: 11, y: 12 },
    color: "#00f",
  },
];

const makeParams = (): SimParams => ({
  G: 1,
  dt: 0.01,
  speed: 1.2,
  softening: 0.02,
  trailFade: 0.03,
});

const makeUserPresets = (bodies: BodyState[]): PresetProfile[] => [
  {
    id: "user-1",
    name: "User 1",
    description: "",
    bodies,
    params: makeParams(),
  },
];

describe("buildSavedPresetFromDraft", () => {
  it("rejects invalid sanitized id with validation message", () => {
    const result = buildSavedPresetFromDraft({
      draft: { id: "!!!", name: "Valid Name", description: "" },
      existingIds: [],
      bodies: makeBodies(),
      params: makeParams(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile id must include letters, numbers, dots, underscores, or hyphens.",
    });
  });

  it("rejects duplicate id after sanitization", () => {
    const result = buildSavedPresetFromDraft({
      draft: { id: " already there ", name: "Valid Name", description: "" },
      existingIds: ["already-there"],
      bodies: makeBodies(),
      params: makeParams(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile id 'already-there' already exists. Please use a unique id.",
    });
  });

  it("rejects empty sanitized name", () => {
    const result = buildSavedPresetFromDraft({
      draft: { id: "new-id", name: "<>", description: "" },
      existingIds: [],
      bodies: makeBodies(),
      params: makeParams(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile name cannot be empty.",
    });
  });

  it("returns cloned bodies and copied params on success", () => {
    const bodies = makeBodies();
    const params = makeParams();
    const result = buildSavedPresetFromDraft({
      draft: { id: "new-id", name: "Demo", description: "desc" },
      existingIds: [],
      bodies,
      params,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected a successful result");
    }

    expect(result.preset.bodies).toEqual(bodies);
    expect(result.preset.bodies).not.toBe(bodies);
    expect(result.preset.bodies[0]).not.toBe(bodies[0]);
    expect(result.preset.bodies[0].position).not.toBe(bodies[0].position);
    expect(result.preset.params).toEqual(params);
    expect(result.preset.params).not.toBe(params);
  });

  it("preserves sanitized description in resulting preset", () => {
    const result = buildSavedPresetFromDraft({
      draft: { id: "new-id", name: "Demo", description: "  hello   world  " },
      existingIds: [],
      bodies: makeBodies(),
      params: makeParams(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected a successful result");
    }
    expect(result.preset.description).toBe("hello world");
  });
});

describe("validateEditedPresetDraft", () => {
  it("rejects invalid sanitized id with validation message", () => {
    const result = validateEditedPresetDraft({
      draft: { originalId: "user-1", id: "!!!", name: "Valid Name", description: "" },
      existingIds: ["user-1", "user-2"],
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile id must include letters, numbers, dots, underscores, or hyphens.",
    });
  });

  it("rejects duplicate id after sanitization excluding original id", () => {
    const result = validateEditedPresetDraft({
      draft: {
        originalId: "user-1",
        id: " already there ",
        name: "Valid Name",
        description: "",
      },
      existingIds: ["user-1", "already-there"],
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile id 'already-there' already exists. Please use a unique id.",
    });
  });

  it("allows unchanged id for the edited profile", () => {
    const result = validateEditedPresetDraft({
      draft: { originalId: "user-1", id: "user-1", name: "Valid Name", description: "" },
      existingIds: ["user-1", "user-2"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected a successful result");
    }
    expect(result.profile.id).toBe("user-1");
  });

  it("rejects empty sanitized name", () => {
    const result = validateEditedPresetDraft({
      draft: { originalId: "user-1", id: "new-id", name: "<>", description: "" },
      existingIds: ["user-1"],
    });

    expect(result).toEqual({
      ok: false,
      message: "Profile name cannot be empty.",
    });
  });

  it("returns sanitized id, name, and description on success", () => {
    const result = validateEditedPresetDraft({
      draft: {
        originalId: "user-1",
        id: " next id ",
        name: "  Demo   Name ",
        description: "  hello   world  ",
      },
      existingIds: ["user-1", "user-2"],
    });

    expect(result).toEqual({
      ok: true,
      profile: {
        id: "next-id",
        name: "Demo Name",
        description: "hello world",
      },
    });
  });
});

describe("selectedUserPresetIbcDirty", () => {
  it("returns false when selected preset is not a user preset", () => {
    const result = selectedUserPresetIbcDirty({
      selectedPresetId: "figure-8",
      userPresets: makeUserPresets(makeBodies()),
      draftBodies: makeBodies(),
    });

    expect(result).toBe(false);
  });

  it("returns false when draft bodies match selected user preset", () => {
    const result = selectedUserPresetIbcDirty({
      selectedPresetId: "user-1",
      userPresets: makeUserPresets(makeBodies()),
      draftBodies: makeBodies(),
    });

    expect(result).toBe(false);
  });

  it("returns true when draft bodies differ from selected user preset", () => {
    const presetBodies = makeBodies();
    const draftBodies = makeBodies();
    draftBodies[1] = {
      ...draftBodies[1],
      velocity: { ...draftBodies[1].velocity, y: draftBodies[1].velocity.y + 0.5 },
    };

    const result = selectedUserPresetIbcDirty({
      selectedPresetId: "user-1",
      userPresets: makeUserPresets(presetBodies),
      draftBodies,
    });

    expect(result).toBe(true);
  });

  it("treats tiny numeric deltas within epsilon as unchanged", () => {
    const presetBodies = makeBodies();
    const draftBodies = makeBodies();
    draftBodies[0] = {
      ...draftBodies[0],
      mass: draftBodies[0].mass + 1e-13,
    };

    const result = selectedUserPresetIbcDirty({
      selectedPresetId: "user-1",
      userPresets: makeUserPresets(presetBodies),
      draftBodies,
    });

    expect(result).toBe(false);
  });
});
