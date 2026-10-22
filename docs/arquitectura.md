# Arquitectura

## Estado M1: captura visible → editor → PNG

Popup → worker (`{version:1,type:'capture-visible'}`, solo desde popup.html/options.html del mismo id) → `captureVisible()`: candado en `chrome.storage.session`, intervalo mínimo 600 ms, pestaña activa, `captureVisibleTab`, comprobación de que la pestaña activa no cambió, decodificación del data URL sin `fetch`, presupuesto de píxeles, blob en IndexedDB y apertura de `editor.html?capture=<uuid>`. El editor valida el id, lee el blob y dibuja con Konva sobre un modelo de documento propio (`src/editor/model.ts`); la exportación usa un stage aparte a tamaño nativo, sin elementos de selección. Región y elemento (M2): popup → worker (`{version:1,type:'start-selection',mode}`, solo UI de extensión) → estado `{requestId, tabId, mode}` en `chrome.storage.session` → `scripting.executeScript` solo en esa pestaña y solo tras el gesto (activeTab; sin `content_scripts` ni hosts en producción) → el script pide su configuración con `selection-ready` y dibuja un overlay en un shadow DOM cerrado (abierto solo en la variante de pruebas) → `selection-done` con la región en px CSS y el tamaño del viewport → el worker valida remitente, pestaña y marco 0 contra el estado guardado (nunca un tabId del mensaje), espera el repintado, llama a `captureVisible({tabId, crop})`, recorta con `captureScale`/`toPixelCrop` y abre el editor. Escape, scroll (en región), cambio de visibilidad o cierre cancelan y limpian el estado; el estado caduca a los 2 minutos.

## Estado M0

Entrypoints WXT en src/entrypoints: background.ts (worker sin estado global mutable), popup/ (React), options/ (React), selection.content.ts (registration runtime; no declaración content_scripts en producción; no inyección en M0). Compartidos: config, i18n, theme, ui, storage, messaging y geometry. Los módulos funcionales siguientes son diseño, no implementaciones vacías que aparenten actividad.

| Módulo futuro  | Responsabilidad / contexto                                                                 |
| -------------- | ------------------------------------------------------------------------------------------ |
| captura        | Orquestar captureVisibleTab, permisos, cuotas; worker                                      |
| selección      | Región/elemento, viewport, DPR, cancelación; content script aislado bajo demanda           |
| composición    | Tiles y ensamblado acotado; documento propio/worker dedicado                               |
| editor         | Documento de anotaciones y vista React; página de extensión                                |
| exportación    | Rasterización final y formatos reales; página de extensión, offscreen solo si se justifica |
| almacenamiento | Preferencias ahora; IndexedDB para blobs/historial después                                 |
| configuración  | product y políticas; preferencias validadas por esquema                                    |

## Mensajes y ciclos de vida

M0 solo admite {version:1,type:'health'} desde popup.html u options.html del mismo runtime.id. Responde {version:1,status:'foundation'}. Se validan claves exactas, versión, tipo, ID y URL completa de página de extensión. sender.tab puede existir cuando la propia página de extensión se abre en una pestaña; no se usa como rechazo por sí solo. Un content script sigue rechazado por su URL de página web. No onMessageExternal ni puente window.postMessage. Pruebas de rechazo en tests/foundation.test.ts.

Flujo posterior propuesto: popup → worker (start con requestId) → scripting.executeScript solo tras gesto/activeTab → content script (selección) → worker → editor (identificador opaco del recurso). No enviar bitmaps enormes por mensajes JSON: guardar blobs y pasar IDs. El content script es menos confiable: validar sender.id, sender.tab.id, frameId/documentId y operación vinculada a esa pestaña. Nunca aceptar un tabId arbitrario del mensaje como autorización. Respuestas y errores también tendrán esquema, tamaños máximos y requestId.

Estados propuestos: creada → seleccionando → capturando → componiendo → editando → exportada, cancelada o fallida. Persistir metadatos/checkpoints en almacenamiento; blobs en IndexedDB; limpieza por caducidad/cancelación. Reiniciar el worker debe recuperar o fallar de forma explícita, nunca continuar por variables globales. Temporizadores no garantizan vida del worker. Preferencias M0 viven en chrome.storage.local, no en el worker.

## Modelo de amenazas

- Página y DOM: hostiles, pueden cambiar dimensiones, falsificar etiquetas, navegar o contener datos privados. Selección aislada, no eval ni HTML interpolado; verificar documento actual antes de cada tile.
- Mensajes: otras extensiones, iframes y content scripts no autorizados pueden intentar iniciar acciones. Validar remitente y esquema en cada frontera, sin confiar solo en TypeScript.
- Nombres de archivo: entradas no confiables. Normalizar rutas separadoras, controles, longitud y extensiones; no permitir rutas absolutas ni traversal.
- Proyectos importados (V2): JSON/activos no confiables. Versionar esquema, limitar tamaño/número de objetos, bloquear URLs externas, scripts, SVG activo y contaminación de prototipos; no ejecutar contenido.
- Censura: desenfoque/pixelado no son borrado seguro. M1 debe sustituir píxeles por color opaco en el resultado y en cualquier proyecto compartido; evitar originales bajo capas recuperables.
- Privacidad: solo local, sin telemetría. Historial futuro optativo y borrable; incógnito sin historial por defecto. Errores sin URLs/imágenes privadas.

CSP de producción: script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'none'. En desarrollo (`wxt`, comando serve) wxt.config.ts omite connect-src para permitir el HMR local; WXT añade localhost solo a script-src. Sin recursos web accesibles ni hosts globales. Los permisos nuevos requieren justificación escrita. Documentación de [WXT](https://wxt.dev/guide/essentials/content-scripts.html) y [ciclo de vida del worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
