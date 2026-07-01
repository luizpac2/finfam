import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Captura erros de renderização e exibe uma mensagem legível em vez de uma
 * tela em branco — melhora a UX e facilita o diagnóstico em produção.
 *
 * (Observação: não captura erros de carregamento de módulo/import; para esses,
 * ver a guarda de configuração em `supabaseClient.ts` + a tela de configuração.)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Erro não tratado:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-light px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand-moss/15 bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-semibold text-brand-moss">
            Algo deu errado
          </h1>
          <p className="mt-2 text-sm text-brand-gray">
            Ocorreu um erro inesperado ao carregar o aplicativo. Tente recarregar
            a página.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-brand-light px-3 py-2 text-left text-xs text-brand-moss">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-aqua px-5 py-2.5 font-medium text-brand-moss shadow-sm transition hover:brightness-95"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
