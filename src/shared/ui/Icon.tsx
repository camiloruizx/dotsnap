const paths = {
  visible: 'M3 4h18v16H3ZM3 8h18M6 6h.01M9 6h.01',
  region: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 8h8v8H8Z',
  element: 'M4 4h16v16H4ZM4 9h16M9 9v11m4-7h4m-4 3h4',
  fullPage: 'M6 3h12v18H6Zm3 4h6M9 11h6m-6 4h6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  history: 'M3 11a9 9 0 1 1 3 8M3 4v7h7m2-4v6l4 2',
  select: 'M5 3l14 7-6 2-2 6Z',
  arrow: 'M5 19L19 5m0 0H9m10 0v10',
  rect: 'M4 6h16v12H4Z',
  text: 'M5 6V4h14v2M12 4v16m-3 0h6',
  redact: 'M4 6h16v12H4ZM7 10h10M7 14h10',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  download: 'M12 4v11m-4-4l4 4 4-4M5 20h14',
  copy: 'M9 9h11v11H9ZM5 15V4h11',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
