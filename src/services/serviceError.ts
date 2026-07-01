import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Erro de aplicação padronizado para falhas vindas da camada de dados.
 * Encapsula o erro original do Supabase/PostgREST mantendo uma mensagem
 * amigável para a interface.
 */
export class ServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.cause = cause;
  }
}

interface SupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Lança um `ServiceError` quando a resposta do Supabase contém erro.
 * Centraliza o tratamento, evitando repetir `if (error) throw` em todo serviço.
 * Como lançamos em caso de erro, o `data` retornado é considerado válido.
 */
export const unwrap = <T>(
  { data, error }: SupabaseResponse<T>,
  context: string
): NonNullable<T> => {
  if (error) {
    console.error(`[service] Falha ao ${context}:`, error);
    throw new ServiceError(`Não foi possível ${context}.`, error);
  }
  return data as NonNullable<T>;
};
