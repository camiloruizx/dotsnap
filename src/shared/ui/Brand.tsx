import { product } from '../config/product';
import { usePreferences } from '../i18n';
export function Brand() {
  const { t } = usePreferences();
  return (
    <header className="brand-header">
      <img
        className="brand-icon"
        src="/icon/48.png"
        alt={t('provisional')}
        title={t('provisional')}
      />
      <div className="brand-copy">
        <span className="brand-name">{product.name}</span>
        <p className="subtitle">{t('tagline')}</p>
      </div>
      <span className="badge">v{chrome.runtime.getManifest().version}</span>
    </header>
  );
}
