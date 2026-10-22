import { usePreferences } from '../i18n';

const links = [
  { label: 'acrocode.dev', href: 'https://acrocode.dev' },
  { label: 'GitHub', href: 'https://github.com/camiloruizx' },
] as const;

/** Pie de créditos: enlaces externos que se abren en una pestaña nueva; sin permisos ni peticiones. */
export function Credits() {
  const { t } = usePreferences();
  return (
    <div className="credits">
      <span>
        {t('createdBy')} <strong>Camilo Ruiz</strong>
      </span>
      <span>
        {links.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? ' · ' : ''}
            <a href={link.href} target="_blank" rel="noreferrer">
              {link.label}
              {link.label === 'GitHub' ? (
                <span aria-hidden="true"> ↗</span>
              ) : null}
            </a>
          </span>
        ))}
      </span>
    </div>
  );
}
