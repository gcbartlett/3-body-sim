import { useEffect, useState } from "react";
import { loadSectionOpenState, saveSectionOpenState, type SectionOpenState } from "./uiPrefsStorage";

type UseControlPanelSectionsResult = {
  sectionState: SectionOpenState;
  setSimParamsOpen: (open: boolean) => void;
  setBodyConfigOpen: (open: boolean) => void;
  setPresetsOpen: (open: boolean) => void;
};

export const useControlPanelSections = (): UseControlPanelSectionsResult => {
  const [sectionState, setSectionState] = useState<SectionOpenState>(loadSectionOpenState);

  useEffect(() => {
    saveSectionOpenState(sectionState);
  }, [sectionState]);

  return {
    sectionState,
    setSimParamsOpen: (open) => {
      setSectionState((prev) => ({ ...prev, simParamsOpen: open }));
    },
    setBodyConfigOpen: (open) => {
      setSectionState((prev) => ({ ...prev, bodyConfigOpen: open }));
    },
    setPresetsOpen: (open) => {
      setSectionState((prev) => ({ ...prev, presetsOpen: open }));
    },
  };
};
