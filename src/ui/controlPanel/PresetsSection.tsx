import type { PresetProfile } from "../../sim/types";

type Props = {
  presets: PresetProfile[];
  selectedPresetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPresetSelect: (id: string) => void;
  onApplyPreset: () => void;
  onSaveProfile: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const PresetsSection = ({
  presets,
  selectedPresetId,
  open,
  onOpenChange,
  onPresetSelect,
  onApplyPreset,
  onSaveProfile,
  onGenerateRandomStable,
  onGenerateRandomChaotic,
}: Props) => (
  <section>
    <details
      open={open}
      onToggle={(e) => {
        onOpenChange(e.currentTarget.open);
      }}
    >
      <summary className="collapsible-summary">Presets</summary>
      <label>
        Profile
        <select value={selectedPresetId} onChange={(e) => onPresetSelect(e.target.value)}>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{presets.find((preset) => preset.id === selectedPresetId)?.description}</p>
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
