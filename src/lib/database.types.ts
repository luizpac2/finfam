/**
 * Tipos do banco de dados (espelham `supabase/migrations`).
 *
 * Em um fluxo de produção, este arquivo pode ser gerado automaticamente com:
 *   `supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
 * Mantemos uma versão escrita à mão para tipar o cliente sem depender da CLI.
 */

export type UserRole = 'admin' | 'member';
export type UserStatus = 'invited' | 'active' | 'revoked';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'paid' | 'cancelled';
export type CategoryKind = 'income' | 'expense' | 'credit_card';
export type RuleAction = 'categorize' | 'ignore';

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
          kind: CategoryKind;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          kind?: CategoryKind;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          kind?: CategoryKind;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category_rules: {
        Row: {
          id: string;
          keyword: string | null;
          amount: number | null;
          action: RuleAction;
          category_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          keyword?: string | null;
          amount?: number | null;
          action?: RuleAction;
          category_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          keyword?: string | null;
          amount?: number | null;
          action?: RuleAction;
          category_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          full_name: string;
          role: UserRole;
          status: UserStatus;
          avatar_url: string | null;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email: string;
          full_name?: string;
          role?: UserRole;
          status?: UserStatus;
          avatar_url?: string | null;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          email?: string;
          full_name?: string;
          role?: UserRole;
          status?: UserStatus;
          avatar_url?: string | null;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          date: string;
          description: string;
          amount: number;
          type: TransactionType;
          status: TransactionStatus;
          category_id: string | null;
          card_id: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date?: string;
          description: string;
          amount: number;
          type: TransactionType;
          status?: TransactionStatus;
          category_id?: string | null;
          card_id?: string | null;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          description?: string;
          amount?: number;
          type?: TransactionType;
          status?: TransactionStatus;
          category_id?: string | null;
          card_id?: string | null;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      sync_current_user: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['users']['Row'];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      months_with_transactions: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      transaction_type: TransactionType;
      transaction_status: TransactionStatus;
      category_kind: CategoryKind;
    };
    CompositeTypes: Record<string, never>;
  };
}

/* Aliases de conveniência usados pelos serviços. */
export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type CategoryRuleRow =
  Database['public']['Tables']['category_rules']['Row'];
export type CategoryRuleInsert =
  Database['public']['Tables']['category_rules']['Insert'];
export type CategoryRuleUpdate =
  Database['public']['Tables']['category_rules']['Update'];

export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert =
  Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate =
  Database['public']['Tables']['transactions']['Update'];

/** Linha de transação com a categoria embutida (join via FK). */
export type TransactionRowWithCategory = TransactionRow & {
  categories: CategoryRow | null;
};
