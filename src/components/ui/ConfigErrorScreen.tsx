/**
 * Tela exibida quando as variáveis de ambiente do Supabase não foram fornecidas
 * no build (causa comum de "tela em branco" após deploy sem env configurada).
 */
export function ConfigErrorScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-lg rounded-2xl border border-brand-moss/15 bg-white p-8 shadow-card">
        <h1 className="text-xl font-semibold text-brand-moss">
          Configuração ausente
        </h1>
        <p className="mt-2 text-sm text-brand-gray">
          O aplicativo não recebeu as credenciais do Supabase no build. Defina as
          variáveis de ambiente abaixo (no painel da hospedagem, ex.: Vercel) e
          faça um novo deploy.
        </p>

        <ul className="mt-4 space-y-2">
          {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2 font-mono text-sm text-brand-moss"
            >
              <span className="h-2 w-2 rounded-full bg-red-400" />
              {name}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-brand-gray">
          Importante: no Vite, as variáveis <code>VITE_*</code> são incorporadas
          durante o build. Após adicioná-las, é necessário{' '}
          <strong className="text-brand-moss">refazer o deploy</strong> para que
          tenham efeito. Veja o <code>DEPLOY.md</code> para detalhes.
        </p>
      </div>
    </div>
  );
}
