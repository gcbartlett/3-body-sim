import { useState, type Dispatch, type SetStateAction } from "react";
import { validateEditedPresetDraft } from "./profileValidation";
import type { PresetProfile } from "./types";

export type EditProfileDraft = {
  originalId: string;
  id: string;
  name: string;
  description: string;
};

type UseEditPresetCommandsArgs = {
  allPresets: PresetProfile[];
  selectedPresetId: string;
  setSelectedPresetId: Dispatch<SetStateAction<string>>;
  userPresets: PresetProfile[];
  setUserPresets: Dispatch<SetStateAction<PresetProfile[]>>;
};

export const useEditPresetCommands = ({
  allPresets,
  selectedPresetId,
  setSelectedPresetId,
  userPresets,
  setUserPresets,
}: UseEditPresetCommandsArgs) => {
  const [editProfileDraft, setEditProfileDraft] = useState<EditProfileDraft | null>(null);

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
    editProfileDraft,
    onEditUserPreset,
    onEditProfileFieldChange,
    onCancelEditProfile,
    onConfirmEditProfile,
  };
};
