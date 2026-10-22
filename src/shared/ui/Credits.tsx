import { usePreferences } from '../i18n';

const links = [
  { label: 'acrocode.dev', href: 'https://acrocode.dev' },
  { label: 'GitHub', href: 'https://github.com/camiloruizx' },
  { label: 'Ko-fi', href: 'https://ko-fi.com/camiloruizx' },
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
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              title={link.label === 'Ko-fi' ? t('supportKofi') : undefined}
            >
              {link.label}
              {link.label !== 'acrocode.dev' ? (
                <span aria-hidden="true"> ↗</span>
              ) : null}
            </a>
          </span>
        ))}
      </span>
    </div>
  );
}
