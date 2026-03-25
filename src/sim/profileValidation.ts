import { sanitizePresetDescription, sanitizePresetId, sanitizePresetName } from "./presetStorage";
import { cloneBodies } from "./presets";
import type { BodyState, PresetProfile, SimParams } from "./types";

type SaveProfileDraftInput = {
  id: string;
  name: string;
  description: string;
};

type BuildSavedPresetInput = {
  draft: SaveProfileDraftInput;
  existingIds: string[];
  bodies: BodyState[];
  params: SimParams;
};

type BuildSavedPresetResult =
  | {
      ok: true;
      preset: PresetProfile;
    }
  | {
      ok: false;
      message: string;
    };

type EditProfileDraftInput = {
  originalId: string;
  id: string;
  name: string;
  description: string;
};

type ValidateEditedPresetDraftInput = {
  draft: EditProfileDraftInput;
  existingIds: string[];
};

type ValidateEditedPresetDraftResult =
  | {
      ok: true;
      profile: {
        id: string;
        name: string;
        description: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

export const buildSavedPresetFromDraft = ({
  draft,
  existingIds,
  bodies,
  params,
}: BuildSavedPresetInput): BuildSavedPresetResult => {
  const id = sanitizePresetId(draft.id);
  const name = sanitizePresetName(draft.name);
  const description = sanitizePresetDescription(draft.description);

  if (!id) {
    return {
      ok: false,
      message: "Profile id must include letters, numbers, dots, underscores, or hyphens.",
    };
  }
  if (existingIds.includes(id)) {
    return {
      ok: false,
      message: `Profile id '${id}' already exists. Please use a unique id.`,
    };
  }
  if (!name) {
    return { ok: false, message: "Profile name cannot be empty." };
  }
  return {
    ok: true,
    preset: {
      id,
      name,
      description,
      bodies: cloneBodies(bodies),
      params: { ...params },
    },
  };
};

export const validateEditedPresetDraft = ({
  draft,
  existingIds,
}: ValidateEditedPresetDraftInput): ValidateEditedPresetDraftResult => {
  const id = sanitizePresetId(draft.id);
  const name = sanitizePresetName(draft.name);
  const description = sanitizePresetDescription(draft.description);
  const siblingIds = existingIds.filter((existingId) => existingId !== draft.originalId);

  if (!id) {
    return {
      ok: false,
      message: "Profile id must include letters, numbers, dots, underscores, or hyphens.",
    };
  }
  if (siblingIds.includes(id)) {
    return {
      ok: false,
      message: `Profile id '${id}' already exists. Please use a unique id.`,
    };
  }
  if (!name) {
    return { ok: false, message: "Profile name cannot be empty." };
  }

  return {
    ok: true,
    profile: { id, name, description },
  };
};
