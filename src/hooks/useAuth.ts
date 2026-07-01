import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '../context/AuthContext';

/**
 * Hook de acesso ao contexto de autenticação.
 * Falha cedo (fail-fast) caso seja usado fora do `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.');
  }
  return context;
}
