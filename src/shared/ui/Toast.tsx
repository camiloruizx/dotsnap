import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePreferences } from '../i18n';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  key: string;
  text: string;
  kind: ToastKind;
}
type Show = (text: string, kind?: ToastKind, options?: { id?: string }) => void;

const Context = createContext<Show>(() => {});
export const useToast = (): Show => useContext(Context);

const MAX_TOASTS = 4;
const LIFETIME_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  error: 7000,
};

/** Avisos efímeros abajo a la derecha: confirman lo que pasó al pulsar un botón. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
    setItems((list) => list.filter((item) => item.key !== key));
  }, []);

  const show = useCallback<Show>(
    (text, kind = 'success', options) => {
      const key = options?.id ?? `t${(counter.current += 1)}`;
      const previous = timers.current.get(key);
      if (previous) clearTimeout(previous);
      timers.current.set(
        key,
        setTimeout(() => dismiss(key), LIFETIME_MS[kind]),
      );
      setItems((list) => {
        const without = list.filter((item) => item.key !== key);
        return [...without, { key, text, kind }].slice(-MAX_TOASTS);
      });
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <Context.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.key} className={`toast toast-${item.kind}`}>
            <span className="toast-text">{item.text}</span>
            <button
              className="toast-close"
              aria-label={t('toastDismiss')}
              title={t('toastDismiss')}
              onClick={() => dismiss(item.key)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
