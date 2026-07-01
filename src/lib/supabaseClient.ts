import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import type { Database } from './database.types';

/**
 * Indica se as variáveis do Supabase foram fornecidas no build.
 * Em produção (Vite), as `VITE_*` são "assadas" no build — se faltarem, o app
 * não consegue autenticar. Expor esta flag permite mostrar uma tela de
 * configuração amigável em vez de quebrar silenciosamente.
 */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey
);

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY ausentes no build. ' +
      'Configure as variáveis de ambiente (ex.: painel da Vercel) e refaça o deploy.'
  );
}

/**
 * Instância única (singleton) do cliente Supabase, tipada pelo schema.
 *
 * Esta é a fronteira de infraestrutura da aplicação: nenhum outro módulo
 * deve importar `@supabase/supabase-js` diretamente. Os serviços de dados
 * consomem este cliente, mantendo o restante do app desacoplado do backend.
 *
 * Usamos fallbacks inócuos quando as env vars faltam para que `createClient`
 * NÃO lance no momento do import (o que deixaria a tela em branco). Nesse caso
 * a aplicação renderiza uma tela de configuração e as chamadas ao Supabase
 * simplesmente falham de forma tratável.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
