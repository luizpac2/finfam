import { Skeleton } from '../ui/Skeleton';

/** Placeholder de um cartão de KPI enquanto os dados carregam. */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

/** Placeholder do gráfico de barras (barras de alturas variadas). */
export function BarChartSkeleton() {
  const heights = ['h-24', 'h-36', 'h-28', 'h-44', 'h-32', 'h-40'];
  return (
    <div className="flex h-72 items-end justify-between gap-3 px-2 pb-6">
      {heights.map((height, index) => (
        <div key={index} className="flex flex-1 items-end justify-center gap-1">
          <Skeleton className={`w-1/2 ${height}`} />
          <Skeleton
            className={`w-1/2 ${heights[(index + 2) % heights.length]}`}
          />
        </div>
      ))}
    </div>
  );
}

/** Placeholder do gráfico de rosca (círculo + legenda). */
export function DonutChartSkeleton() {
  return (
    <div className="flex h-72 flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <Skeleton className="h-40 w-40 shrink-0 rounded-full sm:h-52 sm:w-52" />
      <div className="w-full flex-1 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
