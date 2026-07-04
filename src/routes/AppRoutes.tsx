import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import Login from '../pages/Login'; // eager: primeira tela dos não autenticados

// Carregamento sob demanda — mantém o login leve (sem Recharts no bundle inicial).
const Dashboard = lazy(() => import('../pages/Dashboard'));
const AnalyticsDashboard = lazy(() => import('../pages/AnalyticsDashboard'));
const Import = lazy(() => import('../pages/Import'));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const CategoryTransactionsPage = lazy(
  () => import('../pages/CategoryTransactionsPage')
);
const RulesPage = lazy(() => import('../pages/RulesPage'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const NeedInvitePage = lazy(() => import('../pages/NeedInvitePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/** Tabela central de rotas da aplicação. */
export function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* Públicas / fora do layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/sem-acesso" element={<NeedInvitePage />} />

        {/* Área autenticada (membro ativo) dentro do layout principal */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<AnalyticsDashboard />} />
          <Route path="/importar" element={<Import />} />
          <Route path="/transacoes" element={<TransactionsPage />} />
          <Route
            path="/categoria/:categoryId"
            element={<CategoryTransactionsPage />}
          />
          <Route
            path="/categorias"
            element={
              <ProtectedRoute requireAdmin>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/regras"
            element={
              <ProtectedRoute requireAdmin>
                <RulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
