import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Tags,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { Sidebar, type NavItem } from './Sidebar';

const COLLAPSE_KEY = 'finfam:sidebar-collapsed';

/**
 * Layout principal da aplicação autenticada.
 * Sidebar fixa e "sanfonável" (recolhível) no desktop + drawer no mobile,
 * com a área de conteúdo em #F2F2F2.
 */
export function MainLayout() {
  const { isAdmin } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () =>
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignora indisponibilidade do storage */
      }
      return next;
    });

  const items: NavItem[] = [
    { label: 'Visão geral', to: '/', icon: LayoutDashboard },
    { label: 'Importar', to: '/importar', icon: Upload },
    ...(isAdmin
      ? [
          { label: 'Categorias', to: '/categorias', icon: Tags },
          { label: 'Administração', to: '/admin', icon: ShieldCheck },
        ]
      : []),
  ];

  const asideWidth = collapsed ? 'w-[4.5rem]' : 'w-64';
  const contentPad = collapsed ? 'md:pl-[4.5rem]' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-brand-light">
      {/* Sidebar fixa (desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-brand-moss/15 transition-[width] duration-200 md:block ${asideWidth}`}
      >
        <Sidebar
          items={items}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Drawer (mobile) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-brand-moss/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-brand-gray hover:bg-brand-light"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar items={items} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Área de conteúdo */}
      <div className={`transition-[padding] duration-200 ${contentPad}`}>
        {/* Top bar (apenas mobile) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-brand-moss/15 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-brand-moss hover:bg-brand-light"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-base font-semibold text-brand-moss">FinFam</span>
        </header>

        <main className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
