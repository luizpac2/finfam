import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  CATEGORY_ICONS,
  CATEGORY_ICON_NAMES,
  CategoryIcon,
} from '../../lib/categoryIcons';

interface IconPickerProps {
  value?: string | null;
  onChange: (icon: string) => void;
  /** Cor usada para tingir o ícone selecionado. */
  color?: string | null;
}

/**
 * Seletor visual de ícone: um botão mostra o ícone atual e abre uma grade
 * para escolher — sem precisar decorar o nome do ícone.
 */
export function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[38px] w-14 items-center justify-center gap-1 rounded-lg border border-brand-moss/25 bg-white text-brand-moss transition hover:bg-brand-light"
        aria-label="Escolher ícone"
      >
        <CategoryIcon name={value} className="h-5 w-5" />
        <ChevronDown className="h-3 w-3 text-brand-gray" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-xl border border-brand-moss/15 bg-white p-2 shadow-card">
          <div className="grid max-h-56 grid-cols-7 gap-1 overflow-auto">
            {CATEGORY_ICON_NAMES.map((name) => {
              const Icon = CATEGORY_ICONS[name];
              const selected = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    selected
                      ? 'bg-brand-aqua/25'
                      : 'hover:bg-brand-light'
                  }`}
                >
                  <Icon
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    style={selected && color ? { color } : undefined}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
