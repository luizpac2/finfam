import { formatCurrency } from '../../lib/format';

interface TooltipItem {
  name?: string;
  value?: number | string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  /** Mapeia o nome técnico da série para um rótulo amigável. */
  labels?: Record<string, string>;
}

/** Tooltip customizado, alinhado à identidade visual (usado por todos os gráficos). */
export function ChartTooltip({ active, payload, label, labels }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-moss/15 bg-white px-3 py-2 shadow-card">
      {label && (
        <p className="mb-1 text-xs font-semibold text-brand-moss">{label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-brand-gray">
              {labels?.[item.name ?? ''] ?? item.name}
            </span>
            <span className="ml-auto pl-3 font-semibold text-brand-moss">
              {formatCurrency(Number(item.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
