# Validación M0

Fecha: 21 de octubre de 2026. Plataforma: Windows, Node 24.14.1 y npm 11.19.0. Solo cimientos; captura/editor/exportación pendientes.

## Comprobaciones ejecutadas

Las salidas completas reales de la última ejecución se guardan en `evidence/build.txt`, `lint.txt`, `typecheck.txt`, `test.txt`, `zip.txt` y `browser.txt`. No son ejemplos ni resultados de funciones futuras. El informe estructurado de Chrome es [browser-report.json](evidence/browser-report.json).

| Comprobación        | Resultado / evidencia                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Producción WXT      | Build correcto, sin advertencias relevantes. Artefacto `.output/chrome-mv3`                                                   |
| ESLint + Prettier   | Salida y código de salida 0 en evidence/lint.txt                                                                              |
| TypeScript estricto | Código 0 en evidence/typecheck.txt                                                                                            |
| Vitest              | 1 archivo, 6 pruebas correctas; evidence/test.txt                                                                             |
| ZIP                 | Generación correcta; evidence/zip.txt; inspección del manifest incluido                                                       |
| Chrome real         | 156.0.8078.48, instalado, perfil aislado nuevo; carga descomprimida vía CDP                                                   |
| chrome://extensions | ENABLED y UNPACKED; 0 runtimeErrors y 0 manifestErrors; chrome-extensions.png                                                 |
| Permisos            | activeTab, scripting, storage; cambio autorizado a criterio original; sin host_permissions ni content_scripts                 |
| 8 vistas            | Popup/opciones × ES/EN × claro/oscuro; PNG de cada combinación; inspeccionadas visualmente                                    |
| Accesibilidad       | axe WCAG 2 A/AA y 2.1 AA: 0 infracciones en 8 vistas; etiquetas/selects nativos; tabulado y foco 2px; sin overflow horizontal |
| Estado de acciones  | 6 botones disabled reales, ningún botón habilitado en popup; enlace de preferencias funcional                                 |
| Preferencias        | Guardado por selectores, recarga conserva EN/oscuro; Sistema sigue idioma de chrome.i18n y apariencia simulada light/dark     |
| Mensajes            | health válido funciona desde página propia; remitente/esquema rechazados en unitarias                                         |
| Red y errores       | 0 errores de consola de páginas y 0 solicitudes HTTP(S) de popup/opciones durante prueba                                      |
| Iconos              | PNG locales 16/32/48/128 generados desde SVG original (reemplazado por el ícono de la familia Dot el 21/10/2026)              |

Chrome muestra un aviso de procedencia no verificada para la extensión local en el perfil de prueba: es una carga descomprimida, no un paquete firmado de tienda. No se ha ocultado ese aviso. No hay errores de manifest o runtime.

Contrastes calculados desde los tokens efectivos del navegador (relación WCAG): texto/superficie 13.70:1 claro y 11.98:1 oscuro; ayuda/tarjeta 6.56:1 y 7.10:1; enlace/superficie 5.44:1 y 5.79:1; foco/superficie 4.19:1 y 5.79:1; borde de control/control 4.10:1 y 3.67:1. Se comprobaron mínimos de 4.5:1 para esos textos y 3:1 para foco/borde. Valores y aserciones reales en browser-report.json y scripts/verify-browser.mjs. El contraste de botones disabled también se conserva legible aunque estén exentos del requisito de contraste para controles inactivos.

El ZIP generado es `.output/dotsnap-0.0.1-chrome.zip`: 15 archivos; se abrió e inspeccionó su manifest para confirmar los mismos tres permisos y ausencia de hosts/contenidos permanentes. El repositorio se inicializó para el primer commit local de M0; no se publicó ni se configuró un remoto.

## Revisión visual y límites de evidencia

Las ocho capturas muestran densidad compacta, tarjetas de radio 7px, controles de radio 4/5px, tipografía del sistema, iconos de trazo fino y paleta oscura coherente con DotPilot. El tema claro es adaptación documentada. Las capturas conservan foco visible para evidenciar navegación por teclado.

La prueba abre popup.html y options.html como documentos de extensión en pestañas Chrome headless. No verifica anclaje/cierre de la ventana de acción del toolbar ni instalación mediante el selector de archivos del perfil personal. Sí verifica la misma extensión de producción cargada descomprimida y su estado real en chrome://extensions. No es Chromium simulado ni un mock de chrome.storage.

No se probaron captura ni inyección (no implementadas), portapapeles, descargas, canvas extremo, incógnito, Chrome 120 ni Edge. Tampoco se ha ejecutado revisión manual con lector de pantalla. axe es una comprobación automática, no certificación completa de accesibilidad. El cero de red se limita a solicitudes observadas desde las páginas de la extensión durante esta ejecución.

## Incidencias corregidas durante M0

- WXT añadía hosts a partir de matches de un content script runtime. Se omitieron los matches; el manifest final y la prueba de navegador impiden esa regresión.
- Las páginas propias abiertas en pestañas tienen sender.tab: la validación acepta únicamente ID y URL exactos propios, sin asumir que sender.tab implica página hostil.
- Se usan perfiles nuevos en cada prueba para evitar código cacheado de una extensión descomprimida tras recompilar.

## Cierre de M0 (revisión del 21/10/2026)

Cambios posteriores a la evidencia de arriba: matriz de funciones reconstruida por secciones de la especificación; CSP sin `connect-src` solo en desarrollo; geometría con escala medida por eje (`captureScale`); preferencias aplicadas antes del primer render. Los archivos de `evidence/` corresponden al estado anterior a estos cambios y no se reescribieron.

Re-ejecutado tras los cambios, en copia limpia con `npm ci` (Linux, Node 22.23): typecheck, ESLint, Prettier, Vitest y build; resultados en el mensaje de entrega del commit. **No re-ejecutado**: `npm run test:browser` (requiere Chrome en Windows). Debe correrse en el equipo del propietario antes de dar por probado B-08; hasta entonces la fila queda como pendiente. `npm run dev` tampoco se ha ejecutado para confirmar el HMR.

## Pendiente

M1–M6 y V2 según plan. Antes de lanzamiento: revisión comercial del nombre/marca, logo definitivo y decisión de licencia de distribución. No se necesita otra decisión para M0. M1 requiere aprobación explícita.
