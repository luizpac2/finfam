import type { ReactNode } from 'react';

import type { Category } from '../../domain/entities/Category';
import { CategoryFilter } from './CategoryFilter';
import { PeriodNavigator, type Period } from './PeriodNavigator';

interface FilterSidebarProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  categories: Category[];
  selectedCategories: Set<string>;
  onCategoriesChange: (next: Set<string>) => void;
  loadingCategories?: boolean;
  /** Meses ("YYYY-MM") que têm lançamentos. */
  monthsWithData?: Set<string>;
  /** Conteúdo extra (ex.: totais) renderizado abaixo dos filtros. */
  children?: ReactNode;
}

/**
 * Coluna lateral de filtros compartilhada pela Visão geral e por Transações:
 * navegação de período (mês/ano) + filtro de categorias. Fica "grudada" no topo
 * ao rolar em telas grandes.
 */
export function FilterSidebar({
  period,
  onPeriodChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  loadingCategories = false,
  monthsWithData,
  children,
}: FilterSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <FilterCard title="Período">
        <PeriodNavigator
          value={period}
          onChange={onPeriodChange}
          monthsWithData={monthsWithData}
        />
      </FilterCard>

      <FilterCard title="Categorias">
        <CategoryFilter
          categories={categories}
          selected={selectedCategories}
          onChange={onCategoriesChange}
          loading={loadingCategories}
        />
      </FilterCard>

      {children}
    </aside>
  );
}

function FilterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
        {title}
      </h2>
      {children}
    </div>
  );
}
