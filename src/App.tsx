import { AppRoutes } from './routes/AppRoutes';

/**
 * Componente raiz da aplicação.
 * A árvore de provedores (Router, Auth) vive em `main.tsx`; aqui mantemos
 * apenas a definição de rotas para preservar a separação de responsabilidades.
 */
export default function App() {
  return <AppRoutes />;
}
