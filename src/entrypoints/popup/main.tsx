import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider } from '../../shared/i18n';
import { Popup } from './Popup';
import '../../shared/theme/tokens.css';
import '../../shared/theme/layout.css';
document.documentElement.dataset.surface = 'popup';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <Popup />
    </PreferencesProvider>
  </React.StrictMode>,
);
