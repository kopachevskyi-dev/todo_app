import { useId, useState } from 'react';
import { listPalette, type List } from '../shared/contract';
import { BottomSheet, Button, Icon, Modal } from './components';

export function ListForm({
  list,
  mobile,
  pending,
  error,
  onSave,
  onClose,
}: {
  list?: List;
  mobile: boolean;
  pending: boolean;
  error?: string;
  onSave: (values: { name: string; color: List['color'] }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState<List['color']>(list?.color ?? '#8E7CC3');
  const nameId = useId();
  const errorId = useId();
  const Container = mobile ? BottomSheet : Modal;
  return (
    <Container
      label={list ? 'Edit list' : 'New list'}
      className="list-dialog"
      onClose={onClose}
    >
      <h3>{list ? 'Edit list' : 'New list'}</h3>
      <form
        className="list-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, color });
        }}
      >
        <label htmlFor={nameId}>List name</label>
        <input
          id={nameId}
          value={name}
          required
          maxLength={40}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <fieldset disabled={pending}>
          <legend>Color</legend>
          <div className="list-swatches">
            {listPalette.map((preset) => (
              <Button
                key={preset.hex}
                variant="outline"
                aria-label={`${preset.name}${color === preset.hex ? ', selected' : ''}`}
                aria-pressed={color === preset.hex}
                onClick={() => setColor(preset.hex)}
              >
                <span className="list-dot" style={{ background: preset.hex }} />
                {preset.name}
                {color === preset.hex && <Icon name="check" size={16} />}
              </Button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Container>
  );
}
