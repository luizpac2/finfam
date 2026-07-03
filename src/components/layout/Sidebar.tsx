import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';

/**
 * Balão colorido que aparece ao passar o mouse quando a sidebar está recolhida,
 * revelando o rótulo do item mesmo sem texto visível.
 */
function CollapsedBalloon({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-brand-aqua px-3 py-2 text-sm font-semibold text-brand-moss opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
      {label}
      <span className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-brand-aqua" />
    </span>
  );
}

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  /** Chamado ao navegar — usado para fechar o drawer no mobile. */
  onNavigate?: () => void;
  /** Modo recolhido (somente ícones). */
  collapsed?: boolean;
  /** Se fornecido, mostra o botão de recolher/expandir (desktop). */
  onToggleCollapse?: () => void;
}

/**
 * Conteúdo da barra lateral. Suporta modo "sanfonável" (recolhido/expandido):
 * quando recolhido, mostra apenas os ícones.
 */
export function Sidebar({
  items,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { profile, email, signOut } = useAuth();

  const displayName = profile?.fullName || email || 'Membro';
  const initials = (profile?.fullName || email || 'F')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Marca + botão de recolher */}
      <div
        className={`flex items-center py-5 ${
          collapsed ? 'flex-col gap-2 px-2' : 'gap-3 px-4'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-aqua/20">
          <span className="text-lg font-bold text-brand-moss">F</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-none text-brand-moss">
              FinFam
            </p>
            <p className="mt-1 text-xs text-brand-gray">Finanças da família</p>
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-brand-gray transition hover:bg-brand-light hover:text-brand-moss"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group relative flex items-center rounded-xl text-sm font-medium transition',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-brand-aqua/20 text-brand-moss'
                  : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
            {!collapsed && <span>{label}</span>}
            {collapsed && <CollapsedBalloon label={label} />}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé: usuário + sair */}
      <div className="border-t border-brand-moss/10 p-3">
        <div
          className={`flex items-center rounded-xl py-2 ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          }`}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-moss/15 text-sm font-semibold text-brand-moss">
              {initials}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-moss">
                {displayName}
              </p>
              <p className="truncate text-xs text-brand-gray">{email}</p>
            </div>
          )}
        </div>
        <ThemeToggle collapsed={collapsed} />
        <button
          type="button"
          onClick={() => signOut()}
          className={`group relative mt-1 flex w-full items-center rounded-xl text-sm font-medium text-brand-gray transition hover:bg-brand-light hover:text-brand-moss ${
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.8} />
          {!collapsed && <span>Sair</span>}
          {collapsed && <CollapsedBalloon label="Sair" />}
        </button>
      </div>
    </div>
  );
}
