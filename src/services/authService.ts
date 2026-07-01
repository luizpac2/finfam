import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import { ServiceError } from './serviceError';

/**
 * Serviço de autenticação.
 *
 * A aplicação aceita EXCLUSIVAMENTE login social via Google (OAuth). Não há
 * fluxo de senha local — a segurança de credenciais é delegada ao Google.
 * O provedor de e-mail/senha deve ser DESATIVADO no painel do Supabase
 * (Authentication → Providers).
 */
export const authService = {
  /**
   * Inicia o fluxo OAuth do Google. Redireciona o navegador para o Google e,
   * ao retornar, o Supabase resolve a sessão automaticamente
   * (`detectSessionInUrl`).
   */
  async signInWithGoogle(redirectTo: string = window.location.origin): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      throw new ServiceError('Não foi possível iniciar o login com o Google.', error);
    }
  },

  /** Encerra a sessão atual. */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ServiceError('Não foi possível sair.', error);
  },

  /** Retorna a sessão atual (ou null). */
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Registra um listener para mudanças de autenticação.
   * @returns Função para cancelar a inscrição.
   */
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => subscription.unsubscribe();
  },
};
