import type { Delay } from '../messaging';

export interface DelayDeps {
  sleep: (ms: number) => Promise<void>;
  badge: (text: string) => void | Promise<void>;
}

/**
 * Cuenta regresiva en la insignia del icono (el popup se cierra al perder el foco, así que
 * no puede mostrarla). Devuelve false si `cancelled()` pidió abortar antes de terminar.
 */
export async function countdown(
  seconds: Delay,
  deps: DelayDeps,
  cancelled: () => boolean = () => false,
): Promise<boolean> {
  try {
    for (let left: number = seconds; left > 0; left--) {
      if (cancelled()) return false;
      await deps.badge(String(left));
      await deps.sleep(1000);
    }
    return !cancelled();
  } finally {
    await deps.badge('');
  }
}
