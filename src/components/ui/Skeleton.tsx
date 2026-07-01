/**
 * Bloco base de "skeleton loading".
 * Usa o cinza da marca (#8C888A) com opacidade reduzida e animação de pulso.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-brand-gray/20 ${className}`}
      aria-hidden="true"
    />
  );
}
