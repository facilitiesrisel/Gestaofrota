import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cleanStorageHealthCheck } from './utils/safeStorage';
import './index.css';

// Executa limpeza proativa de armazenamento para prevenir QuotaExceededError
cleanStorageHealthCheck();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

