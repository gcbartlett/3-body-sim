import { useEffect, useState } from "react";
import type { BodyState, PresetProfile, SimParams } from "../sim/types";
import { loadSectionOpenState, saveSectionOpenState, type SectionOpenState } from "./uiPrefsStorage";
import { BodyConfigurationSection } from "./controlPanel/BodyConfigurationSection";
import { PresetsSection } from "./controlPanel/PresetsSection";
import { SimulationParametersSection } from "./controlPanel/SimulationParametersSection";
import type { BodyConfigField, LockMode } from "./controlPanel/types";

type Props = {
  bodies: BodyState[];
  params: SimParams;
  appVersion: string;
  presets: PresetProfile[];
  selectedPresetId: string;
  defaultPresetIds: string[];
  selectedUserPresetIbcDirty: boolean;
  lockMode: LockMode;
  manualPanZoom: boolean;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  onBodyChange: (index: number, field: BodyConfigField, value: number) => void;
  onParamChange: (field: keyof SimParams, value: number) => void;
  onLockModeChange: (mode: LockMode) => void;
  onToggleManualPanZoom: (value: boolean) => void;
  onToggleShowOriginMarker: (value: boolean) => void;
  onToggleShowGrid: (value: boolean) => void;
  onToggleShowCenterOfMass: (value: boolean) => void;
  onResetParams: () => void;
  onPresetSelect: (id: string) => void;
  onEditUserPreset: (id: string) => void;
  onDeleteUserPreset: (id: string) => void;
  onApplyPreset: () => void;
  onSaveProfile: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const ControlPanel = ({
  bodies,
  params,
  appVersion,
  presets,
  selectedPresetId,
  defaultPresetIds,
  selectedUserPresetIbcDirty,
  lockMode,
  manualPanZoom,
  showOriginMarker,
  showGrid,
  showCenterOfMass,
  onBodyChange,
  onParamChange,
  onLockModeChange,
  onToggleManualPanZoom,
  onToggleShowOriginMarker,
  onToggleShowGrid,
  onToggleShowCenterOfMass,
  onResetParams,
  onPresetSelect,
  onEditUserPreset,
  onDeleteUserPreset,
  onApplyPreset,
  onSaveProfile,
  onGenerateRandomStable,
  onGenerateRandomChaotic,
}: Props) => {
  const [sectionState, setSectionState] = useState<SectionOpenState>(loadSectionOpenState);

  useEffect(() => {
    saveSectionOpenState(sectionState);
  }, [sectionState]);

  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <img className="panel-title-icon" src="/favicon.svg" alt="" aria-hidden="true" />
          <h1>Three-Body Simulator</h1>
        </div>
        <div className="panel-version muted">build {appVersion}</div>
      </div>
      <p className="muted">Set initial conditions, then start the simulation.</p>

      <SimulationParametersSection
        params={params}
        lockMode={lockMode}
        manualPanZoom={manualPanZoom}
        showOriginMarker={showOriginMarker}
        showGrid={showGrid}
        showCenterOfMass={showCenterOfMass}
        open={sectionState.simParamsOpen}
        onOpenChange={(open) => {
          setSectionState((prev) => ({ ...prev, simParamsOpen: open }));
        }}
        onParamChange={onParamChange}
        onLockModeChange={onLockModeChange}
        onToggleManualPanZoom={onToggleManualPanZoom}
        onToggleShowOriginMarker={onToggleShowOriginMarker}
        onToggleShowGrid={onToggleShowGrid}
        onToggleShowCenterOfMass={onToggleShowCenterOfMass}
        onResetParams={onResetParams}
      />
      <BodyConfigurationSection
        bodies={bodies}
        open={sectionState.bodyConfigOpen}
        onOpenChange={(open) => {
          setSectionState((prev) => ({ ...prev, bodyConfigOpen: open }));
        }}
        onBodyChange={onBodyChange}
      />
      <PresetsSection
        presets={presets}
        selectedPresetId={selectedPresetId}
        defaultPresetIds={defaultPresetIds}
        selectedUserPresetIbcDirty={selectedUserPresetIbcDirty}
        open={sectionState.presetsOpen}
        onOpenChange={(open) => {
          setSectionState((prev) => ({ ...prev, presetsOpen: open }));
        }}
        onPresetSelect={onPresetSelect}
        onEditUserPreset={onEditUserPreset}
        onDeleteUserPreset={onDeleteUserPreset}
        onApplyPreset={onApplyPreset}
        onSaveProfile={onSaveProfile}
        onGenerateRandomStable={onGenerateRandomStable}
        onGenerateRandomChaotic={onGenerateRandomChaotic}
      />
    </aside>
  );
};
