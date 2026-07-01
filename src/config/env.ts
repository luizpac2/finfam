/**
 * Acesso centralizado e validado às variáveis de ambiente.
 *
 * Concentrar a leitura de `import.meta.env` em um único módulo evita que
 * strings mágicas se espalhem pelo código e nos dá um ponto único para
 * validar a configuração na inicialização (fail-fast).
 */

const requireEnv = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];
  if (!value || value.includes('SEU-PROJETO') || value.includes('sua-chave')) {
    console.warn(
      `[config] A variável de ambiente "${key}" não está definida. ` +
        'Copie ".env.example" para ".env.local" e preencha com as credenciais do Supabase.'
    );
  }
  return value ?? '';
};

export const env = Object.freeze({
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
});
