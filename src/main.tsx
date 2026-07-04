import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ReferenceDataProvider } from './context/ReferenceDataContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ConfigErrorScreen } from './components/ui/ConfigErrorScreen';
import { isSupabaseConfigured } from './lib/supabaseClient';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento #root não encontrado no documento.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {isSupabaseConfigured ? (
          <BrowserRouter>
            <ToastProvider>
              <AuthProvider>
                <ReferenceDataProvider>
                  <App />
                </ReferenceDataProvider>
              </AuthProvider>
            </ToastProvider>
          </BrowserRouter>
        ) : (
          <ConfigErrorScreen />
        )}
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
