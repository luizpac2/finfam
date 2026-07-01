import { NavLink } from 'react-router-dom';
import { LogOut, type LucideIcon } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  /** Chamado ao navegar — usado para fechar o drawer no mobile. */
  onNavigate?: () => void;
}

/**
 * Conteúdo da barra lateral (logo, navegação e rodapé do usuário).
 * Reutilizado tanto no painel fixo (desktop) quanto no drawer (mobile).
 */
export function Sidebar({ items, onNavigate }: SidebarProps) {
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
      {/* Marca */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-aqua/20">
          <span className="text-lg font-bold text-brand-moss">F</span>
        </div>
        <div>
          <p className="text-base font-semibold leading-none text-brand-moss">
            FinFam
          </p>
          <p className="mt-1 text-xs text-brand-gray">Finanças da família</p>
        </div>
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
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-aqua/20 text-brand-moss'
                  : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Rodapé: usuário + sair */}
      <div className="border-t border-brand-moss/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-moss/15 text-sm font-semibold text-brand-moss">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-brand-moss">
              {displayName}
            </p>
            <p className="truncate text-xs text-brand-gray">{email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-gray transition hover:bg-brand-light hover:text-brand-moss"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.8} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
