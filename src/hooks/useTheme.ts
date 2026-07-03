import { useContext } from 'react';

import { ThemeContext, type ThemeApi } from '../context/ThemeContext';

/**
 * Hook de acesso ao tema (claro/escuro).
 * Falha cedo (fail-fast) caso seja usado fora do `ThemeProvider`.
 */
export function useTheme(): ThemeApi {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme deve ser usado dentro de um <ThemeProvider>.');
  }
  return context;
}
