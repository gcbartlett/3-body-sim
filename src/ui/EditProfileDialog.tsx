import {
  PRESET_DESCRIPTION_MAX_LENGTH,
  PRESET_ID_MAX_LENGTH,
  PRESET_NAME_MAX_LENGTH,
} from "../sim/presetStorage";

export type EditProfileDraft = {
  originalId: string;
  id: string;
  name: string;
  description: string;
};

type EditProfileDialogProps = {
  draft: EditProfileDraft | null;
  onFieldChange: (field: "id" | "name" | "description", value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function EditProfileDialog({
  draft,
  onFieldChange,
  onSave,
  onCancel,
}: EditProfileDialogProps) {
  if (!draft) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Edit Profile">
        <h3>Edit Profile</h3>
        <label title="Unique profile identifier used internally and in preset selection.">
          Id
          <input
            type="text"
            value={draft.id}
            maxLength={PRESET_ID_MAX_LENGTH}
            onChange={(e) => onFieldChange("id", e.target.value)}
          />
        </label>
        <label title="Display name shown in the profile dropdown.">
          Name
          <input
            type="text"
            value={draft.name}
            maxLength={PRESET_NAME_MAX_LENGTH}
            onChange={(e) => onFieldChange("name", e.target.value)}
          />
        </label>
        <label title="Short description shown under the profile selector.">
          Description
          <textarea
            value={draft.description}
            maxLength={PRESET_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => onFieldChange("description", e.target.value)}
          />
        </label>
        <div className="button-row">
          <button onClick={onSave}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
