import { useEffect } from 'react';
import { usePreferences } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import { Brand } from '../../shared/ui/Brand';
import { Credits } from '../../shared/ui/Credits';
import { SettingsPanel } from '../../shared/ui/SettingsPanel';

export function Options() {
  const { t } = usePreferences();
  useEffect(() => {
    document.title = `${product.name} · ${t('settingsTitle')}`;
  }, [t]);
  return (
    <div className="shell options-shell">
      <Brand />
      <main>
        <SettingsPanel />
        <a className="preferences-link" href="popup.html">
          {t('back')}
          <span aria-hidden="true">↗</span>
        </a>
      </main>
      <footer>
        {t('localOnly')}
        <Credits />
      </footer>
    </div>
  );
}
