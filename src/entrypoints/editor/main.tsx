import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider, loadInitialPreferences } from '../../shared/i18n';
import { Editor } from './Editor';
import '../../shared/theme/tokens.css';
import '../../shared/theme/layout.css';
document.documentElement.dataset.surface = 'editor';
const initial = await loadInitialPreferences();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider initial={initial}>
      <Editor />
    </PreferencesProvider>
  </React.StrictMode>,
);
