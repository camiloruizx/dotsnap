import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../../shared/ui/Toast';
import { PreferencesProvider, loadInitialPreferences } from '../../shared/i18n';
import { Options } from './Options';
import '../../shared/theme/tokens.css';
import '../../shared/theme/layout.css';
document.documentElement.dataset.surface = 'options';
const initial = await loadInitialPreferences();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider initial={initial}>
      <ToastProvider>
        <Options />
      </ToastProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);
