import { useState, type Dispatch, type SetStateAction } from "react";
import { buildSavedPresetFromDraft } from "./profileValidation";
import type { BodyState, PresetProfile, SimParams } from "./types";

export type SaveProfileDraft = {
  id: string;
  name: string;
  description: string;
};

type UseSavePresetCommandsArgs = {
  allPresets: PresetProfile[];
  draftBodies: BodyState[];
  getCurrentParams: () => SimParams;
  setUserPresets: Dispatch<SetStateAction<PresetProfile[]>>;
  setSelectedPresetId: Dispatch<SetStateAction<string>>;
};

const nextUserPresetNumber = (presetIds: string[]): number => {
  const used = new Set<number>();
  for (const id of presetIds) {
    const match = /^user-(\d+)$/.exec(id);
    if (match) {
      used.add(Number(match[1]));
    }
  }
  let next = 1;
  while (used.has(next)) {
    next += 1;
  }
  return next;
};

export const useSavePresetCommands = ({
  allPresets,
  draftBodies,
  getCurrentParams,
  setUserPresets,
  setSelectedPresetId,
}: UseSavePresetCommandsArgs) => {
  const [saveProfileDraft, setSaveProfileDraft] = useState<SaveProfileDraft | null>(null);

  const onOpenSaveProfile = () => {
    const suggestedNumber = nextUserPresetNumber(allPresets.map((preset) => preset.id));
    setSaveProfileDraft({
      id: `user-${suggestedNumber}`,
      name: `User Profile #${suggestedNumber}`,
      description: "Saved from current initial conditions and simulation parameters.",
    });
  };

  const onSaveProfileFieldChange = (field: keyof SaveProfileDraft, value: string) => {
    setSaveProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const onCancelSaveProfile = () => {
    setSaveProfileDraft(null);
  };

  const onConfirmSaveProfile = () => {
    if (!saveProfileDraft) {
      return;
    }
    const result = buildSavedPresetFromDraft({
      draft: saveProfileDraft,
      existingIds: allPresets.map((preset) => preset.id),
      bodies: draftBodies,
      params: getCurrentParams(),
    });
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    setUserPresets((prev) => [...prev, result.preset]);
    setSelectedPresetId(result.preset.id);
    setSaveProfileDraft(null);
  };

  return {
    saveProfileDraft,
    onOpenSaveProfile,
    onSaveProfileFieldChange,
    onCancelSaveProfile,
    onConfirmSaveProfile,
  };
};
