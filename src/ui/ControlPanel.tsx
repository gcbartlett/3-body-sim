import { useState } from "react";
import { APP_LINKS } from "../config/appLinks";
import type { BodyState, PresetProfile, SimParams } from "../sim/types";
import { BodyConfigurationSection } from "./controlPanel/BodyConfigurationSection";
import { PresetsSection } from "./controlPanel/PresetsSection";
import { SimulationParametersSection } from "./controlPanel/SimulationParametersSection";
import type { BodyConfigField, LockMode } from "./controlPanel/types";
import { openSponsorPage } from "./sponsorPage";
import { useControlPanelSections } from "./useControlPanelSections";
import { loadAppLikedState, saveAppLikedState } from "./uiPrefsStorage";

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
  const { sectionState, setSimParamsOpen, setBodyConfigOpen, setPresetsOpen } = useControlPanelSections();
  const [likedApp, setLikedApp] = useState(loadAppLikedState);

  const onLikeApp = () => {
    const nextLikedState = !likedApp;
    setLikedApp(nextLikedState);
    saveAppLikedState(nextLikedState);
    if (nextLikedState) {
      openSponsorPage(window.open);
    }
  };

  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="panel-header-top">
          <div className="panel-title">
            <img className="panel-title-icon" src="/favicon.svg" alt="" aria-hidden="true" />
            <h1>Three-Body Simulator</h1>
          </div>
          <button
            className={`panel-like-button${likedApp ? " is-liked" : ""}`}
            type="button"
            aria-label={likedApp ? "App liked" : "Like this app and sponsor via Buy Me a Coffee"}
            aria-pressed={likedApp}
            title={
              likedApp
                ? "Thank you for liking this app."
                : "Love this app? Please consider sponsoring me by buying me a coffee."
            }
            onClick={onLikeApp}
          >
            <span aria-hidden="true">{likedApp ? "♥" : "♡"}</span>
          </button>
        </div>
        <a
          className="panel-version muted"
          href={APP_LINKS.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open GitHub project repository"
        >
          build {appVersion}
        </a>
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
        onOpenChange={setSimParamsOpen}
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
        onOpenChange={setBodyConfigOpen}
        onBodyChange={onBodyChange}
      />
      <PresetsSection
        presets={presets}
        selectedPresetId={selectedPresetId}
        defaultPresetIds={defaultPresetIds}
        selectedUserPresetIbcDirty={selectedUserPresetIbcDirty}
        open={sectionState.presetsOpen}
        onOpenChange={setPresetsOpen}
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
