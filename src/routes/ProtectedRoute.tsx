import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Exige perfil de administrador além de autenticação. */
  requireAdmin?: boolean;
}

/**
 * Protege rotas autenticadas e aplica a whitelist:
 *  - sem sessão Google           → /login
 *  - sessão sem autorização/revogada → /sem-acesso
 *  - rota de admin sem permissão → / (dashboard)
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isAuthorized, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAuthorized) {
    return <Navigate to="/sem-acesso" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
