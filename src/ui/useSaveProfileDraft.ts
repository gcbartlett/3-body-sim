import { useState } from "react";
import type { PresetProfile } from "../sim/types";

export type SaveProfileDraft = {
  id: string;
  name: string;
  description: string;
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

export const useSaveProfileDraft = (presets: PresetProfile[]) => {
  const [saveProfileDraft, setSaveProfileDraft] = useState<SaveProfileDraft | null>(null);

  const beginSaveProfileDraft = () => {
    const existingIds = presets.map((preset) => preset.id);
    const suggestedNumber = nextUserPresetNumber(existingIds);
    setSaveProfileDraft({
      id: `user-${suggestedNumber}`,
      name: `User Profile #${suggestedNumber}`,
      description: "Saved from current initial conditions and simulation parameters.",
    });
  };

  const onSaveProfileFieldChange = (field: keyof SaveProfileDraft, value: string) => {
    setSaveProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const cancelSaveProfileDraft = () => {
    setSaveProfileDraft(null);
  };

  return {
    saveProfileDraft,
    beginSaveProfileDraft,
    onSaveProfileFieldChange,
    cancelSaveProfileDraft,
  };
};
