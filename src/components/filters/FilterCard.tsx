import type { ReactNode } from 'react';

/** Cartão de um bloco de filtros na coluna lateral (Período, Categorias…). */
export function FilterCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
        {title}
      </h2>
      {children}
    </div>
  );
}
