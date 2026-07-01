/** Indicador de carregamento em tela cheia, usado durante a resolução de sessão. */
export function FullScreenLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-brand-aqua border-t-brand-moss"
          role="status"
          aria-label={label}
        />
        <p className="text-sm text-brand-gray">{label}</p>
      </div>
    </div>
  );
}
