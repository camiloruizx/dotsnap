# Validación M1

Fecha: 21 de octubre de 2026. Alcance: captura de **Área visible** → editor (flecha, rectángulo, texto, censura) → **PNG**. Región, elemento, página completa, JPEG/WebP/PDF, historial y portapapeles siguen pendientes (matriz-de-funciones.md).

## Entorno de las pruebas ejecutadas

Linux (contenedor), Node 22.22, **Chromium 141.0.7390.37** de Playwright, headless, `--load-extension`. **No** es Chrome estable en Windows. Detalles y salidas en `docs/evidence/m1/` (`report.json`, capturas, PNG exportados).

| Comprobación                          | Resultado                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, Prettier, TypeScript estricto | Sin errores                                                                                                                                                                                                          |
| Vitest                                | 2 archivos, 20 pruebas correctas (historial por comandos, geometría de dibujo, nombre de descarga, decodificación de data URL, presupuesto de píxeles, clasificación de errores, esquema de mensajes, escala medida) |
| Build de producción                   | Correcto; 475.58 kB; manifest con `activeTab`, `scripting`, `storage`, sin hosts, sin `content_scripts`, sin recursos web accesibles; CSP con `connect-src 'none'`                                                   |
| `npm run test:m1` (Chromium 141)      | 20 comprobaciones correctas, 0 errores de consola, 0 solicitudes a hosts distintos de la página local                                                                                                                |

Lo que cubre `test:m1`, ejecutado dos veces (viewport 1000×600, emulación DPR 1 y DPR 2):

- Dos capturas simultáneas: una termina bien y la otra recibe `busy`.
- El editor se abre con el bitmap capturado; el tamaño mostrado es el del bitmap.
- Se dibujan censura, rectángulo, flecha y texto con el ratón; se exporta el PNG descargado, se comprueba su firma, que su nombre sigue `dotsnap-AAAAMMDD-HHMMSS.png` y que sus dimensiones son las nativas del bitmap.
- **Censura**: todos los píxeles muestreados bajo el rectángulo censurado son negro opaco (0 píxeles del bloque rojo original visibles); el contenido vecino queda intacto.
- Deshacer ×4 devuelve el píxel rojo original; rehacer funciona.
- (Solo DPR 1) Seleccionar y mover un rectángulo cambia su posición en el PNG; `Delete` lo elimina; `Ctrl+Z` lo devuelve; el doble clic reabre un texto existente y la edición persiste; axe (WCAG 2 A/AA y 2.1 AA) sin infracciones en el editor.
- (Solo DPR 1) En una pestaña `chrome://version` la captura devuelve `restricted` y el popup muestra el mensaje accionable.

## Hallazgos reales durante la verificación

1. **`captureVisibleTab` exige `<all_urls>` o `activeTab`.** Un permiso de host concreto (`http://127.0.0.1/*`) no basta: error observado «Either the '<all_urls>' or 'activeTab' permission is required.». Consecuencia: `test:m1` usa una variante de **solo pruebas** (`DOTSNAP_TEST_BUILD=1`, salida `.output-test/`, con `<all_urls>`), porque Playwright no puede producir el gesto de la barra de herramientas. Esa variante no es el paquete de producción ni se distribuye.
2. **El bitmap no es `innerWidth × devicePixelRatio`.** Con la emulación `deviceScaleFactor: 2` de Playwright el bitmap de `captureVisibleTab` midió 1000×600 para un viewport de 1000×600 y `devicePixelRatio` 2. Es un artefacto de emulación probablemente, pero confirma que el recorte debe usar la escala medida (`captureScale`) y no DPR. **No se probó en una pantalla real de alta densidad.**
3. Dos errores del propio código, encontrados por estas pruebas y corregidos: reconstruir los nodos al seleccionar cancelaba el arrastre; el lienzo de detección de clics de Konva quedaba desactualizado tras añadir un texto.

## Lo que NO se probó (pendiente o manual)

- **Gesto real de la barra de herramientas con `activeTab`** en la build de producción. Checklist manual abajo.
- Chrome estable en Windows; Chrome 120; Edge; macOS.
- Pantallas de alta densidad reales, zoom del navegador distinto de 100 %, ventanas con barras de desplazamiento.
- Incógnito (`split`), pantallas táctiles, lector de pantalla y uso solo con teclado. **Dibujar anotaciones requiere ratón o táctil**: no hay alternativa de teclado todavía.
- Interfaz del editor en español en navegador real (la prueba corre en inglés; hay prueba unitaria de paridad ES/EN del catálogo).
- Páginas con iframes de otros orígenes, visor PDF, `file://` y la tienda web.
- Rendimiento, memoria y tiempos: no se midió nada; no hay benchmarks.
- `npm run test:browser` (M0, requiere Chrome en Windows) no se re-ejecutó tras estos cambios; `npm run dev` tampoco.

## Checklist manual para el propietario

En la build de producción cargada descomprimida (`npm run build`):

1. Abre una página web normal, pulsa el icono de DotSnap y elige «Área visible». Debe abrirse el editor en una pestaña nueva con la imagen.
2. Dibuja una flecha, un rectángulo, un texto y una censura. Mueve y redimensiona el rectángulo; edita el texto con doble clic.
3. Descarga el PNG y ábrelo: la censura debe ser negra opaca; el tamaño en píxeles debe coincidir con el que muestra el editor.
4. Repite en una pantalla con escala 125 % o 200 % y con zoom 50 % y 200 % del navegador; anota las dimensiones (editor vs ventana).
5. Abre `chrome://extensions` o la tienda web y pulsa «Área visible»: debe aparecer el mensaje de página no capturable, sin editor.
6. Cambia de pestaña justo al pulsar el botón: la captura debe descartarse con el mensaje de cambio de pestaña, o completarse solo si no cambió.
7. Cierra el editor con anotaciones: el navegador debe avisar. Reabre desde el historial del navegador: la captura sigue 24 h, **las anotaciones no**.

## Limitaciones conocidas de M1

Sin portapapeles, sin zoom ni 100 %, sin multiselección, capas ni duplicar, sin recuperación de anotaciones al recargar, sin plantilla de nombre configurable, PNG sin optimizar, sin JPEG/WebP/PDF, sin historial. Grosor y tamaño de texto proporcionales al ancho del bitmap (supuesto, ajustable).
