import { useState, type RefObject, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onConfirm: (nameOverride?: string) => void;
  onReset: () => void;
  canSubmit: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  onConfirm,
  onReset,
  canSubmit,
  inputRef,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  const query = value.trim().toLowerCase();
  const filtered = query.length > 0
    ? suggestions.filter((s) => s.toLowerCase().startsWith(query))
    : suggestions;

  const safeIndex = filtered.length > 0 ? selectedIndex % filtered.length : 0;

  const selectSuggestion = (name: string) => {
    onChange(name);
    onConfirm(name);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length > 0 && query.length > 0) {
      if (e.key === 'Tab' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && query.length > 0) {
        selectSuggestion(filtered[safeIndex]);
      } else if (canSubmit) {
        onConfirm();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      onReset();
      (document.activeElement as HTMLElement)?.blur?.();
    }
  };

  const showDropdown = focused && filtered.length > 0 && query.length > 0;

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setSelectedIndex(0);
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Player name"
        autoComplete="off"
        className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />

      {showDropdown && (
        <div className="mt-1 border border-gray-700 rounded-lg overflow-hidden">
          {filtered.map((name, i) => (
            <button
              key={name}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(name);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${
                i === safeIndex
                  ? 'bg-amber-600/20 text-amber-300'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span>{name}</span>
              {i === safeIndex && (
                <span className="text-[10px] text-amber-500/60">Enter ↵</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
