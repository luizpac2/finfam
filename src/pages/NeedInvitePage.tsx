import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

/**
 * Tela amigável exibida quando uma conta Google autentica, mas o e-mail não
 * está autorizado (sem convite) ou teve o acesso revogado.
 */
export default function NeedInvitePage() {
  const { isAuthenticated, isAuthorized, isRevoked, email, loading, signOut } =
    useAuth();

  if (loading) return <FullScreenLoader />;

  // Sem sessão → vai para o login. Autorizado → vai para o painel.
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAuthorized) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-moss/15 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-cream">
          <svg
            className="h-8 w-8 text-brand-moss"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-brand-moss">
          {isRevoked ? 'Acesso revogado' : 'Você precisa de um convite'}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-brand-gray">
          {isRevoked ? (
            <>
              O acesso da conta <strong className="text-brand-moss">{email}</strong>{' '}
              foi revogado pelo administrador da família. Caso acredite que isso
              é um engano, entre em contato com o responsável.
            </>
          ) : (
            <>
              A conta <strong className="text-brand-moss">{email}</strong> ainda
              não está autorizada. Peça ao administrador da família para
              convidar este e-mail e tente novamente.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-brand-moss/25 px-5 py-2.5 text-sm font-medium text-brand-moss transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-aqua/50"
        >
          Usar outra conta
        </button>
      </div>
    </div>
  );
}
