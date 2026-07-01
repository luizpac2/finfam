import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { GoogleIcon } from '../components/ui/GoogleIcon';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

/**
 * Tela de login minimalista e premium.
 * Fundo #F2F2F2, bordas suaves, cores #6D7368 (musgo) e #9BBFB5 (água).
 * Acesso EXCLUSIVO via Google.
 */
export default function Login() {
  const { isAuthenticated, isAuthorized, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <FullScreenLoader />;

  // Já autenticado: encaminha conforme a autorização.
  if (isAuthenticated) {
    return <Navigate to={isAuthorized ? '/' : '/sem-acesso'} replace />;
  }

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle(); // redireciona para o Google
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-brand-moss/15 bg-white p-8 shadow-card">
          {/* Marca */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-aqua/20">
              <span className="text-2xl font-bold text-brand-moss">F</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-moss">
              FinFam
            </h1>
            <p className="mt-1 text-sm text-brand-gray">
              Gestão financeira da família, em um só lugar.
            </p>
          </div>

          {/* Ação principal */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-brand-moss/20 bg-white px-4 py-3 font-medium text-brand-moss shadow-sm transition hover:border-brand-aqua hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-aqua/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            <span>{submitting ? 'Redirecionando…' : 'Entrar com Google'}</span>
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Nota de acesso restrito */}
          <div className="mt-8 border-t border-brand-moss/10 pt-5">
            <p className="text-center text-xs leading-relaxed text-brand-gray">
              Acesso restrito por convite. Apenas e-mails autorizados pelo
              administrador da família podem entrar.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-brand-gray/80">
          © {new Date().getFullYear()} FinFam · Premium Family Finance
        </p>
      </div>
    </div>
  );
}
