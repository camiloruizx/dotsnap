import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider } from '../../shared/i18n';
import { Options } from './Options';
import '../../shared/theme/tokens.css';
import '../../shared/theme/layout.css';
document.documentElement.dataset.surface = 'options';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <Options />
    </PreferencesProvider>
  </React.StrictMode>,
);
