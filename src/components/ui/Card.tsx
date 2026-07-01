import type { ReactNode } from 'react';

/** Cartão reutilizável com o estilo da marca. */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-brand-moss/15 bg-white p-5 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
