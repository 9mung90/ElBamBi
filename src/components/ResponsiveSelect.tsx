import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

export type ResponsiveSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ResponsiveSelectProps = {
  value: string;
  options: ResponsiveSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  sheetTitle?: string;
};

function getSelectedLabel(options: ResponsiveSelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? '';
}

export default function ResponsiveSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  required = false,
  sheetTitle,
}: ResponsiveSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const selectedLabel = getSelectedLabel(options, value);
  const title = sheetTitle ?? ariaLabel ?? 'Select';

  const overlay = isOpen ? (
    <div className="responsive-select-overlay" role="presentation" onClick={() => setIsOpen(false)}>
      <div
        className="responsive-select-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="responsive-select-heading">
          <strong id={titleId}>{title}</strong>
          <button type="button" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </div>
        <div className="responsive-select-options" role="listbox" aria-label={title}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={isSelected ? 'is-selected' : ''}
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="responsive-select">
      <select
        className={className}
        value={value}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="responsive-select-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true">v</span>
      </button>

      {overlay ? createPortal(overlay, document.body) : null}
    </div>
  );
}
