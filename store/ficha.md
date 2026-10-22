# Ficha de la Chrome Web Store / Store listing

Textos listos para pegar en el panel de desarrollador. Categoría: **Productividad** (Productivity). Idiomas: español (predeterminado) e inglés.

## Español

**Nombre:** DotSnap

**Resumen (≤132 caracteres):** Captura exactamente lo que necesitas, explica con claridad y exporta con control.

**Descripción detallada**

DotSnap captura, anota y exporta pantallas sin salir de tu dispositivo. Sin cuentas, sin analítica, sin conexiones de red.

CAPTURA
• Parte visible de la pestaña.
• Región: arrastra un rectángulo.
• Elemento: elige con el cursor un bloque de la página.
• Página completa: la recorre y la une en una sola imagen (por partes si es muy larga).
• Temporizador de 3, 5 o 10 segundos.
• Atajos: Alt+Shift+V, R, E y F (configurables en chrome://extensions/shortcuts).

ANOTA
• Flechas, líneas, rectángulos, elipses, resaltador, pasos numerados y texto con nueve fuentes del sistema.
• Censura segura: relleno negro opaco, pixelado o desenfoque. En el archivo exportado no quedan los píxeles ocultos con relleno sólido.
• Selecciona, mueve, redimensiona, borra, deshaz y rehaz.

EXPORTA CON CONTROL
• PNG (optimizado sin pérdida), JPEG, WebP y PDF (A4, Carta o tamaño original).
• Escala y peso objetivo para JPEG y WebP.
• Copia al portapapeles o descarga con una plantilla de nombre propia.

TUYO Y LOCAL
• Historial opcional de 1, 7 o 30 días, con búsqueda y renombrar; bórralo cuando quieras.
• Proyectos editables (.dotsnap.json) para seguir anotando después.
• Interfaz en español e inglés, tema claro y oscuro.
• Solo pide activeTab, scripting y storage; no se ejecuta en ninguna página hasta que se lo pides.

Código abierto (MIT): https://github.com/camiloruizx/dotsnap

## English

**Name:** DotSnap

**Summary (≤132 chars):** Capture exactly what you need, explain clearly, and export with control.

**Detailed description**

DotSnap captures, annotates and exports screenshots without anything leaving your device. No accounts, no analytics, no network connections.

CAPTURE
• Visible part of the tab.
• Region: drag a rectangle.
• Element: point at a block of the page.
• Full page: scrolls and stitches a single image (in parts if it is very long).
• 3, 5 or 10 second timer.
• Shortcuts: Alt+Shift+V, R, E and F (configurable at chrome://extensions/shortcuts).

ANNOTATE
• Arrows, lines, rectangles, ellipses, highlighter, numbered steps and text with nine system fonts.
• Safe redaction: opaque black fill, pixelate or blur. Solid redaction leaves no hidden pixels in the exported file.
• Select, move, resize, delete, undo and redo.

EXPORT WITH CONTROL
• PNG (losslessly optimised), JPEG, WebP and PDF (A4, Letter or original size).
• Scale and target file size for JPEG and WebP.
• Copy to the clipboard or download with your own file-name template.

YOURS AND LOCAL
• Optional 1, 7 or 30 day history with search and rename; delete it any time.
• Editable projects (.dotsnap.json) to keep annotating later.
• Spanish and English interface, light and dark themes.
• Only asks for activeTab, scripting and storage; it does not run on any page until you ask it to.

Open source (MIT): https://github.com/camiloruizx/dotsnap

## Pestaña «Prácticas de privacidad» / Privacy practices tab

**Propósito único / Single purpose:** Capturar capturas de pantalla de la pestaña activa, anotarlas y exportarlas. / Take screenshots of the active tab, annotate them and export them.

**Justificación de permisos / Permission justifications**

| Permiso     | Español                                                                                                                                        | English                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` | Captura la pestaña activa solo cuando el usuario pulsa un botón o atajo de DotSnap.                                                            | Captures the active tab only when the user clicks a DotSnap button or shortcut.                                                       |
| `scripting` | Inyecta, bajo demanda y solo en la pestaña activa, el selector de región/elemento y el agente que desplaza la página para la captura completa. | Injects, on demand and only into the active tab, the region/element picker and the agent that scrolls the page for full-page capture. |
| `storage`   | Guarda las preferencias del usuario y el último error de página completa; el historial usa IndexedDB local.                                    | Stores the user's preferences and the last full-page error; history uses local IndexedDB.                                             |

**Código remoto / Remote code:** No. Todo el código va empaquetado; la política de seguridad prohíbe `eval` y conexiones.
**Uso de datos / Data usage:** no se recopila ningún dato de usuario (todas las casillas sin marcar); no se vende ni se transfiere; no se usa para fines ajenos. / No user data is collected (all boxes unchecked); nothing is sold or transferred; nothing is used for unrelated purposes.
**URL de la política de privacidad / Privacy policy URL:** https://github.com/camiloruizx/dotsnap/blob/main/PRIVACY.md

## Recursos gráficos / Graphic assets

- Icono 128 × 128: `store/icon-128.png`.
- Capturas 1280 × 800 (PNG de 24 bits): `store/screenshots/{es,en}/01-editor.png`, `02-export.png`, `03-popup.png`, `04-historial.png`.
- Mosaico pequeño 440 × 280: `promo-small.png`. Mosaico grande 1400 × 560 (opcional): `promo-marquee.png`.
- Se regeneran con `npm run store:assets`. Las capturas usan una página de demostración propia con datos ficticios.
