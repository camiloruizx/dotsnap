# Riesgos y límites de API

Fuentes oficiales consultadas el 21/10/2026. Separar contrato documentado, política de producto propuesta y prueba ejecutada. M0 no implementa ni prueba captura.

## Frecuencia

Chrome define MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2 para captureVisibleTab. Propuesta M3: cola única, al menos 600ms entre inicios de captura, sin ráfagas; backoff acotado al recibir cuota, cancelar/revalidar pestaña antes de reintentar. Persistir progreso/última llamada; suspensión del worker invalida temporizadores. [Referencia tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs#property-MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND).

## Escala del bitmap y CSP

El bitmap de captureVisibleTab no siempre mide `innerWidth × devicePixelRatio` (zoom del navegador, barras de desplazamiento, pellizco). Los recortes usan `captureScale(bitmap, viewport)` por eje y `toPixelCrop` con esa escala; devicePixelRatio no es entrada de cálculo. Pendiente: pruebas reales con zoom 50–300 % y DPR 1/1.25/2 en M1.

El CSP de producción incluye `connect-src 'none'`: `fetch(dataUrl)` y cualquier otra petición desde páginas de la extensión quedan bloqueadas. Para convertir el resultado de captureVisibleTab (data URL) en bitmap en M1, decodificar el base64 a bytes manualmente o cargarlo con `Image`/`createImageBitmap`; no usar `fetch`. En `wxt` (desarrollo) la directiva se omite solo para el HMR; el manifest de producción la conserva.

## Canvas: lado y área

No existe un máximo portable garantizado. Depende de navegador, OS, GPU y memoria. No se ha medido aquí un máximo de lado o área de Chrome; no se trasladan límites de vídeo/GPU al canvas HTML. Presupuesto conservador inicial **supuesto**: lado máximo de producto ≤8192px y área máxima de producto ≤16777216 px (64MiB RGBA por buffer, antes de copias/cachés). Son límites de producto propuestos, no capacidad garantizada del dispositivo.

M3 comprobará lado, área y presupuesto de memoria antes de asignar; prueba acotada de canvas/exportación, detectar contexto nulo, blob nulo/error y PNG vacío. Mantener tiles, componer por bandas sin imagen monolítica y exportar archivos numerados o páginas PDF; informar división antes de exportar. Nunca asignar un canvas enorme solo para detectar el límite. [Referencia de canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas#maximum_canvas_size).

## Portapapeles y descargas

PNG es el formato de imagen interoperable de referencia para ClipboardItem; no prometer JPEG/WebP en portapapeles. Escribir desde página de editor activa con gesto explícito y tratar rechazo. El service worker no tiene DOM/Clipboard API de documento: si se necesita escritura iniciada allí, usar offscreen document y mensajes validados, con permisos offscreen/clipboardWrite justificados en su hito; no presentes en M0. [Offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen), [especificación Clipboard API](https://www.w3.org/TR/clipboard-apis/#writing-to-clipboard).

Descarga propuesta: blob local → URL.createObjectURL → ancla con download en documento de extensión, gesto explícito, revocar URL al terminar. No requiere el permiso chrome.downloads. No ofrece las mismas capacidades de rutas/seguimiento/diálogo que chrome.downloads.download. Solicitar downloads solo ante necesidad concreta documentada. [HTML download](https://html.spec.whatwg.org/multipage/links.html#downloading-resources).

## Incógnito

Chrome exige que el usuario active «Permitir en incógnito». Manifest M0 fija split: worker/contextos separados; storage.local y sync siguen compartidos entre perfiles normal/incógnito. M0 solo almacena idioma/tema. No se implementa historial ni captura; no se ha verificado aún captura en incógnito. M5 deberá excluir imágenes/URLs de historial incógnito y probar cierre de todas sus ventanas. [Manifest incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito).

## Píxeles ≠ inyección

captureVisibleTab con activeTab puede capturar píxeles de algunas páginas sensibles donde no se permite inyectar scripts. No declarar chrome:// y tienda como absolutamente imposibles de capturar: comprobar cada capacidad por separado y capturar errores sin intentar evasiones. [Contrato captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab).

| Superficie                                             | Píxeles visibles                                                                            | Scripts / selección / página completa                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| http/https normal                                      | Requiere activeTab y gesto; prueba pendiente M1                                             | activeTab+scripting en origen autorizado; prueba pendiente M2                                                                    |
| chrome://, chrome-extension:// ajena, Chrome Web Store | Puede estar permitido por captureVisibleTab con activeTab; dependiente del caso, no probado | Restringida; no prometer inyección                                                                                               |
| Visor PDF integrado                                    | Posible captura del viewport según contexto, sin prueba M0                                  | No asumir acceso al DOM del visor ni al documento PDF; página completa no garantizada                                            |
| file://                                                | Captura requiere acceso a archivos concedido por usuario                                    | Sin «Permitir acceso a URL de archivo» no funciona; no solicitar hosts globales por comodidad                                    |
| iframe de otro origen                                  | Puede aparecer en el bitmap del viewport                                                    | activeTab del origen principal no concede acceso al DOM del iframe; no selección interna ni scroll interno sin permiso explícito |
| Incógnito                                              | Extensión debe estar habilitada por el usuario                                              | Igual requisito más límites anteriores                                                                                           |

M1/M2 deben registrar matrices distintas: capacidad de obtener bitmap y capacidad de ejecutar script; nunca inferir una a partir de otra. Zoom, DPR, viewport visual, fixed/sticky, animaciones, scroll, contenido lazy y cambios de navegación requieren pruebas separadas. [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).

## Atajos y vida del worker

Máximo **4 atajos sugeridos** mediante suggested_key en manifest; pueden declararse comandos adicionales sin sugerencia y el usuario configurarlos. Conflictos y asignaciones reales se consultan; M0 no registra comandos. [Commands](https://developer.chrome.com/docs/extensions/reference/api/commands).

El worker puede suspenderse, normalmente tras 30s inactivo: ninguna operación vive solo en variables globales. Guardar checkpoints/metadatos y blobs por ID; reanudar con validación de documento o cancelar limpiamente. M0 solo responde health de forma sin estado. [Ciclo de vida](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Compatibilidad y seguridad

Sin promesa de captura universal. Edge comparte APIs Chromium, pero su instalación y funcionamiento no se han probado: compatibilidad Edge pendiente. Importaciones, nombres, páginas y mensajes son entradas no confiables (arquitectura.md). El nombre comercial requiere revisión antes de lanzamiento; este documento no ofrece dictamen de marcas.
