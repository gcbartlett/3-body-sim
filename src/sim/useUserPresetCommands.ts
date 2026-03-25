import { useState, type Dispatch, type SetStateAction } from "react";
import { buildSavedPresetFromDraft, validateEditedPresetDraft } from "./profileValidation";
import type { BodyState, PresetProfile, SimParams } from "./types";

export type SaveProfileDraft = {
  id: string;
  name: string;
  description: string;
};

export type EditProfileDraft = {
  originalId: string;
  id: string;
  name: string;
  description: string;
};

type UseUserPresetCommandsArgs = {
  userPresets: PresetProfile[];
  setUserPresets: Dispatch<SetStateAction<PresetProfile[]>>;
  allPresets: PresetProfile[];
  selectedPresetId: string;
  setSelectedPresetId: Dispatch<SetStateAction<string>>;
  defaultPresetId: string;
  draftBodies: BodyState[];
  getCurrentParams: () => SimParams;
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

export const useUserPresetCommands = ({
  userPresets,
  setUserPresets,
  allPresets,
  selectedPresetId,
  setSelectedPresetId,
  defaultPresetId,
  draftBodies,
  getCurrentParams,
}: UseUserPresetCommandsArgs) => {
  const [saveProfileDraft, setSaveProfileDraft] = useState<SaveProfileDraft | null>(null);
  const [editProfileDraft, setEditProfileDraft] = useState<EditProfileDraft | null>(null);

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

  const onDeleteUserPreset = (id: string) => {
    const target = userPresets.find((preset) => preset.id === id);
    if (!target) {
      return;
    }
    setUserPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (selectedPresetId === id) {
      setSelectedPresetId(defaultPresetId);
    }
  };

  const onEditUserPreset = (id: string) => {
    const target = userPresets.find((preset) => preset.id === id);
    if (!target) {
      return;
    }
    setEditProfileDraft({
      originalId: target.id,
      id: target.id,
      name: target.name,
      description: target.description,
    });
  };

  const onEditProfileFieldChange = (field: "id" | "name" | "description", value: string) => {
    setEditProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const onCancelEditProfile = () => {
    setEditProfileDraft(null);
  };

  const onConfirmEditProfile = () => {
    if (!editProfileDraft) {
      return;
    }
    const result = validateEditedPresetDraft({
      draft: editProfileDraft,
      existingIds: allPresets.map((preset) => preset.id),
    });
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    setUserPresets((prev) =>
      prev.map((preset) =>
        preset.id === editProfileDraft.originalId
          ? { ...preset, ...result.profile }
          : preset,
      ),
    );
    if (selectedPresetId === editProfileDraft.originalId) {
      setSelectedPresetId(result.profile.id);
    }
    setEditProfileDraft(null);
  };

  return {
    saveProfileDraft,
    editProfileDraft,
    onOpenSaveProfile,
    onSaveProfileFieldChange,
    onCancelSaveProfile,
    onConfirmSaveProfile,
    onDeleteUserPreset,
    onEditUserPreset,
    onEditProfileFieldChange,
    onCancelEditProfile,
    onConfirmEditProfile,
  };
};
