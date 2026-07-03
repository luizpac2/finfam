import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeApi {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeApi | null>(null);

const STORAGE_KEY = 'finfam:theme';

/** Descobre o tema inicial: preferência salva → preferência do sistema → claro. */
const getInitialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage indisponível */
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
};

/**
 * Provedor de tema claro/escuro. Aplica a classe `dark` em <html> (Tailwind
 * `darkMode: 'class'`) e persiste a escolha do usuário.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignora indisponibilidade do storage */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  );

  const api = useMemo<ThemeApi>(
    () => ({ theme, toggle, setTheme }),
    [theme, toggle, setTheme]
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}
