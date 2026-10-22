import { useEffect, useId, useRef, useState } from 'react';
import {
  PALETTE,
  isHexColor,
  paletteIdOf,
  type PaletteId,
} from '../../editor/model';

interface Props {
  label: string;
  customLabel: string;
  pickLabel: string;
  names: Record<PaletteId, string>;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}

/** Combo con cuadro de color y nombre en cada opción, más un selector de paleta libre. */
export function ColorCombo({
  label,
  customLabel,
  pickLabel,
  names,
  value,
  disabled,
  onChange,
}: Props) {
  const [openRequested, setOpen] = useState(false);
  const open = openRequested && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const currentId = paletteIdOf(value);
  const currentName = currentId ? names[currentId] : value.toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    const selected =
      rootRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      rootRef.current?.querySelector<HTMLElement>('[role="option"]');
    selected?.focus();
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const onListKey = (event: React.KeyboardEvent) => {
    const options = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  };

  return (
    <div className="color-combo" ref={rootRef}>
      <span className="color-combo-label">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className="color-combo-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${currentName}`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="color-swatch"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <span>{currentName}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="color-popup" onKeyDown={onListKey}>
          <div role="listbox" id={listId} aria-label={label}>
            {PALETTE.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={currentId === item.id}
                className="color-option"
                onClick={() => {
                  onChange(item.value);
                  close();
                }}
              >
                <span
                  className="color-swatch"
                  style={{ backgroundColor: item.value }}
                  aria-hidden="true"
                />
                <span>{names[item.id]}</span>
              </button>
            ))}
          </div>
          <label className="color-custom" data-active={currentId === null}>
            <input
              type="color"
              aria-label={pickLabel}
              value={value}
              onChange={(event) => {
                if (isHexColor(event.target.value))
                  onChange(event.target.value.toLowerCase());
              }}
            />
            <span>
              {currentId === null ? value.toUpperCase() : customLabel}
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
