import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { categoryService, categoryRuleService } from '../services';
import type { Category } from '../domain/entities/Category';
import type { CategoryRule } from '../domain/entities/CategoryRule';
import { useAuth } from '../hooks/useAuth';

export interface ReferenceDataValue {
  categories: Category[];
  rules: CategoryRule[];
  loadingCategories: boolean;
  loadingRules: boolean;
  /** Recarrega as categorias (chamar após criar/editar/excluir). */
  refreshCategories: () => Promise<void>;
  /** Recarrega as regras (chamar após criar/excluir regra). */
  refreshRules: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ReferenceDataContext = createContext<ReferenceDataValue | null>(
  null
);

/**
 * Cache compartilhado de dados de referência (categorias e regras), carregado
 * uma vez quando o usuário está autorizado. Evita que cada página busque a
 * lista de categorias de novo a cada visita. Mutações chamam refresh*.
 */
export function ReferenceDataProvider({ children }: { children: ReactNode }) {
  const { isAuthorized } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingRules, setLoadingRules] = useState(true);

  const refreshCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      setCategories(await categoryService.list());
    } catch (err) {
      console.error('[refdata] Falha ao carregar categorias:', err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const refreshRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      setRules(await categoryRuleService.list());
    } catch (err) {
      console.error('[refdata] Falha ao carregar regras:', err);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) {
      setCategories([]);
      setRules([]);
      setLoadingCategories(false);
      setLoadingRules(false);
      return;
    }
    void refreshCategories();
    void refreshRules();
  }, [isAuthorized, refreshCategories, refreshRules]);

  const value = useMemo<ReferenceDataValue>(
    () => ({
      categories,
      rules,
      loadingCategories,
      loadingRules,
      refreshCategories,
      refreshRules,
    }),
    [
      categories,
      rules,
      loadingCategories,
      loadingRules,
      refreshCategories,
      refreshRules,
    ]
  );

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}
