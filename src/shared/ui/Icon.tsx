const paths = {
  visible: 'M3 4h18v16H3ZM3 8h18M6 6h.01M9 6h.01',
  region: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 8h8v8H8Z',
  element: 'M4 4h16v16H4ZM4 9h16M9 9v11m4-7h4m-4 3h4',
  fullPage: 'M6 3h12v18H6Zm3 4h6M9 11h6m-6 4h6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  history: 'M3 11a9 9 0 1 1 3 8M3 4v7h7m2-4v6l4 2',
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
