# Privacy policy / Política de privacidad

**DotSnap** · Last updated / Última actualización: 2026-10-22

## English

DotSnap is a Chrome extension to capture, annotate and export screenshots. **It does not collect, transmit, sell or share any data.** Everything happens on your device.

**What DotSnap does not do**

- It makes no network requests: its content security policy forbids connections (`connect-src 'none'`).
- It has no accounts, analytics, telemetry, advertising or remote code.
- It never reads page content except to take the screenshot you ask for.

**What DotSnap stores, only on your device**

- _Preferences_ (language, theme, default format and quality, file-name template, timer, history settings) in `chrome.storage.local`.
- _Recent captures_ and their annotations in the browser's IndexedDB (a thumbnail, the original image and your annotations), so you can reopen them. History can be turned off in Settings, it keeps captures 1, 7 or 30 days (up to 60 captures / 300 MB), and you can delete one capture or all of them at any time. In incognito windows (only if you allow the extension there) the history is not listed and annotations are not saved. Without history, or in incognito, the captured image is still held temporarily so the editor can open it, and it is purged after 24 hours at most.
- Nothing else. Files you export or save (PNG, JPEG, WebP, PDF, `.dotsnap.json` projects) go to your Downloads folder and are yours to manage. A `.dotsnap.json` project contains the original image: redacted areas are recoverable in it, so share the exported image instead when you need to hide information.

**Permissions and why**

- `activeTab`: take a screenshot of the tab you are on, only after you click the button or press a shortcut.
- `scripting`: show the region/element selector and scroll the page for full-page capture, only in that tab and only on request.
- `storage`: save your preferences and the last full-page error message.
  No host permissions are requested, and the extension does not run on pages until you ask it to.

**Children, changes, contact.** DotSnap is not directed at children and collects nothing from anyone. If this policy changes, the new version will be published here with its date. The popup and settings show links to acrocode.dev, GitHub and Ko-fi (optional donations); they open in a new tab only when you click them, and the extension itself sends nothing. Questions: open an issue at https://github.com/camiloruizx/dotsnap or visit https://acrocode.dev/.

## Español

DotSnap es una extensión de Chrome para capturar, anotar y exportar pantallas. **No recopila, envía, vende ni comparte ningún dato.** Todo ocurre en tu dispositivo.

**Lo que DotSnap no hace**

- No hace peticiones de red: su política de seguridad de contenido prohíbe las conexiones (`connect-src 'none'`).
- No tiene cuentas, analítica, telemetría, publicidad ni código remoto.
- Nunca lee el contenido de la página salvo para tomar la captura que pides.

**Lo que DotSnap guarda, solo en tu dispositivo**

- _Preferencias_ (idioma, tema, formato y calidad predeterminados, plantilla del nombre, temporizador, ajustes del historial) en `chrome.storage.local`.
- _Capturas recientes_ y sus anotaciones en el IndexedDB del navegador (miniatura, imagen original y anotaciones), para poder reabrirlas. El historial se puede desactivar en Configurar, conserva las capturas 1, 7 o 30 días (hasta 60 capturas / 300 MB) y puedes borrar una o todas cuando quieras. En ventanas de incógnito (solo si permites la extensión allí) el historial no se lista y no se guardan anotaciones. Sin historial, o en incógnito, la imagen capturada se retiene temporalmente para que el editor pueda abrirla y se purga a las 24 horas como máximo.
- Nada más. Los archivos que exportas o guardas (PNG, JPEG, WebP, PDF, proyectos `.dotsnap.json`) van a tu carpeta de Descargas y los administras tú. Un proyecto `.dotsnap.json` contiene la imagen original: las zonas censuradas se pueden recuperar en él, así que comparte la imagen exportada cuando necesites ocultar información.

**Permisos y para qué**

- `activeTab`: capturar la pestaña en la que estás, solo cuando pulsas el botón o un atajo.
- `scripting`: mostrar el selector de región/elemento y desplazar la página en la captura completa, solo en esa pestaña y a petición tuya.
- `storage`: guardar tus preferencias y el último mensaje de error de página completa.
  No se piden permisos de sitios y la extensión no se ejecuta en las páginas hasta que lo pides.

**Menores, cambios y contacto.** DotSnap no está dirigido a menores y no recopila nada de nadie. Si esta política cambia, se publicará aquí la nueva versión con su fecha. El popup y Configurar muestran enlaces a acrocode.dev, GitHub y Ko-fi (donaciones opcionales); se abren en una pestaña nueva solo cuando haces clic, y la extensión no envía nada. Dudas: abre un issue en https://github.com/camiloruizx/dotsnap o visita https://acrocode.dev/.
