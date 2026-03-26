import type { Dispatch, SetStateAction } from "react";
import { useEditPresetCommands, type EditProfileDraft } from "./useEditPresetCommands";
import { useSavePresetCommands, type SaveProfileDraft } from "./useSavePresetCommands";
import type { BodyState, PresetProfile, SimParams } from "./types";

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

export type { SaveProfileDraft, EditProfileDraft };

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
  const savePresetCommands = useSavePresetCommands({
    allPresets,
    draftBodies,
    getCurrentParams,
    setUserPresets,
    setSelectedPresetId,
  });

  const editPresetCommands = useEditPresetCommands({
    allPresets,
    selectedPresetId,
    setSelectedPresetId,
    userPresets,
    setUserPresets,
  });

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

  return {
    ...savePresetCommands,
    onDeleteUserPreset,
    ...editPresetCommands,
  };
};
