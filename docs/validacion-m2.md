# Validación M2: región y elemento inteligente

Estado: **verificado en Chromium 141 con la variante de pruebas; el gesto real de la barra de herramientas y el zoom real del navegador siguen siendo manuales.**

## Cómo se verificó

`npm run test:m2` (con `DOTSNAP_CHROME` apuntando a un Chromium) compila la variante de pruebas, carga la extensión y sirve una página local con un bloque rojo dentro de un contenedor, un bloque azul, un iframe de otro origen y altura suficiente para desplazarse. Se ejecuta con DPR 1 y 2. Evidencia: `docs/evidence/m2/` (`report.json`, PNG exportados y `overlay-iframe.png`). Pruebas unitarias en `tests/selection.test.ts`.

| Comprobación                                                                                          | Resultado |
| ----------------------------------------------------------------------------------------------------- | --------- |
| Producción: sin `content_scripts` ni `host_permissions`; permisos `activeTab`, `scripting`, `storage` | Correcto  |
| Antes de iniciar: sin scripts registrados y sin overlay                                               | Correcto  |
| Región: arrastre, tiradores, mover, flechas, Shift y Ctrl+flechas                                     | Correcto  |
| Escape limpia overlay y estado; la página queda byte a byte igual; no se abre editor                  | Correcto  |
| Recorte de región 300×240 con bordes exactos (48 px fuera, 52 dentro)                                 | Correcto  |
| Scroll cancela la región sin capturar                                                                 | Correcto  |
| Hover resalta sin cambiar layout ni DOM de la página                                                  | Correcto  |
| ↑ padre / ↓ hijo; clic captura el elemento exacto y la página no recibe el clic                       | Correcto  |
| iframe de otro origen: se selecciona completo y se muestra el límite                                  | Correcto  |
| `selection-done` enviado desde la UI de extensión se ignora                                           | Correcto  |
| `chrome://`: error `restricted` y sin estado residual                                                 | Correcto  |
| Consola                                                                                               | 0 errores |

## Límites declarados

- **DPR 2 emulado no escala el bitmap** en este Chromium (la escala medida fue 1), igual que en M1. La corrección del recorte con escala 2 y 1,25 se cubre con pruebas unitarias de `captureScale`/`toPixelCrop`; falta comprobarlo en una pantalla de alta densidad real.
- **Lupa (C-02) no implementada.** Requeriría una captura previa de la pestaña para ampliar píxeles; se muestra el tamaño en px CSS.
- **Temporizador (C-05)** aplazado: la especificación no le asigna versión.
- No se entra en iframes (ni del mismo origen): se captura el marco completo.
- El overlay no cubre contenido que cambie bajo él (animaciones, vídeo): la captura refleja el estado en el momento de confirmar.
- Una región cancela al desplazar; en modo elemento el desplazamiento revalida el elemento bajo el cursor.

## Comprobación manual pendiente (Chrome real, `chrome://extensions` → cargar descomprimida)

1. Con el icono de DotSnap, elige **Región**: aparece el overlay y el popup se cierra. Arrastra, ajusta con tiradores, confirma con Enter y comprueba que el editor muestra exactamente esa zona.
2. Repite con **Elemento inteligente** sobre una tarjeta, un botón y una imagen; prueba ↑ y ↓.
3. Repite con zoom del navegador al 125 %, 150 % y 200 % y, si tienes, en una pantalla de alta densidad: el recorte debe coincidir con lo seleccionado.
4. Prueba una página con barra de desplazamiento, otra con iframe (vídeo incrustado) y una página `chrome://` (debe mostrar el error de página restringida).
5. Escape debe dejar la página exactamente como estaba.
