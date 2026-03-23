import type { PresetProfile } from "../../sim/types";

type Props = {
  presets: PresetProfile[];
  selectedPresetId: string;
  defaultPresetIds: string[];
  selectedUserPresetIbcDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPresetSelect: (id: string) => void;
  onEditUserPreset: (id: string) => void;
  onDeleteUserPreset: (id: string) => void;
  onApplyPreset: () => void;
  onSaveProfile: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const PresetsSection = ({
  presets,
  selectedPresetId,
  defaultPresetIds,
  selectedUserPresetIbcDirty,
  open,
  onOpenChange,
  onPresetSelect,
  onEditUserPreset,
  onDeleteUserPreset,
  onApplyPreset,
  onSaveProfile,
  onGenerateRandomStable,
  onGenerateRandomChaotic,
}: Props) => {
  const selectedProfile = presets.find((preset) => preset.id === selectedPresetId);
  const selectedIsUserProfile = !!selectedProfile && !defaultPresetIds.includes(selectedProfile.id);
  const disableEdit = selectedIsUserProfile && selectedUserPresetIbcDirty;

  return (
    <section>
      <details
        open={open}
        onToggle={(e) => {
          onOpenChange(e.currentTarget.open);
        }}
      >
        <summary className="collapsible-summary">Presets</summary>
        <div className="preset-profile-row">
          <span className="preset-profile-label">Profile</span>
          <div className="preset-selector-row">
            <div className="preset-action-slot">
              {selectedIsUserProfile ? (
                <button
                  type="button"
                  className="preset-edit-inline"
                  title={disableEdit ? "Reload the profile to edit it." : "Edit this user profile"}
                  aria-label={`Edit profile ${selectedProfile.name}`}
                  disabled={disableEdit}
                  onClick={() => onEditUserPreset(selectedProfile.id)}
                >
                  <span aria-hidden="true">✏️</span>
                </button>
              ) : null}
            </div>
            <div className="preset-action-slot">
              {selectedIsUserProfile ? (
                <button
                  type="button"
                  className="preset-delete-inline"
                  title="Delete this user profile"
                  aria-label={`Delete profile ${selectedProfile.name}`}
                  onClick={() => onDeleteUserPreset(selectedProfile.id)}
                >
                  <span aria-hidden="true">🗑️</span>
                </button>
              ) : null}
            </div>
            <select value={selectedPresetId} onChange={(e) => onPresetSelect(e.target.value)}>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="muted">{selectedProfile?.description}</p>
        <div className="button-row">
          <button onClick={onApplyPreset}>Load Profile</button>
          <button onClick={onSaveProfile} title="Save the current initial conditions and simulation parameters as a new user profile.">
            Save Profile
          </button>
          <button onClick={onGenerateRandomStable} title="Generate a random near-bound initial configuration.">
            Random Stable
          </button>
          <button onClick={onGenerateRandomChaotic} title="Generate a random high-chaos initial configuration.">
            Random Chaotic
          </button>
        </div>
      </details>
    </section>
  );
};
