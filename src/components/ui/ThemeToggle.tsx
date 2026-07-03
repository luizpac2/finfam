import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  /** Modo compacto (apenas ícone) — usado quando a sidebar está recolhida. */
  collapsed?: boolean;
}

/** Alterna entre tema claro e escuro em toda a aplicação. */
export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Tema claro' : 'Tema escuro';

  return (
    <button
      type="button"
      onClick={toggle}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`flex w-full items-center rounded-xl text-sm font-medium text-brand-gray transition hover:bg-brand-light hover:text-brand-moss ${
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
      }`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 shrink-0" strokeWidth={1.8} />
      ) : (
        <Moon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
      )}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
