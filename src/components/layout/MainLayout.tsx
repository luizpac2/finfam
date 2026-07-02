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

/**
 * Layout principal da aplicação autenticada.
 * Sidebar fixa (desktop) + drawer (mobile), com a área de conteúdo em #F2F2F2.
 */
export function MainLayout() {
  const { isAdmin } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-brand-light">
      {/* Sidebar fixa (desktop) — o #6D7368 aparece nos detalhes/ícones/textos */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-brand-moss/15 md:block">
        <Sidebar items={items} />
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
      <div className="md:pl-64">
        {/* Top bar (apenas mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-moss/15 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
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
