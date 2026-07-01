import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import type { Database } from './database.types';

/**
 * Instância única (singleton) do cliente Supabase, tipada pelo schema.
 *
 * Esta é a fronteira de infraestrutura da aplicação: nenhum outro módulo
 * deve importar `@supabase/supabase-js` diretamente. Os serviços de dados
 * consomem este cliente, mantendo o restante do app desacoplado do backend.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
