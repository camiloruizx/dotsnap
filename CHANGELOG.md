# Cambios

## 1.0.1 — 2026-10-22

- El historial conserva las capturas **1 día por defecto** (antes 7); se puede subir a 7 o 30 días en Configurar. Quien ya tenía guardado un plazo de 7 o 30 días lo conserva.
- El Historial muestra el total ocupado («Capturas guardadas: 12 · 8.4 MB de 300.0 MB como máximo») y escribe «1 día» en singular.

## Sin publicar — preparación de la tienda (M6)

- Licencia **MIT** y política de privacidad bilingüe (`PRIVACY.md`).
- Textos de la ficha, justificación de permisos y respuestas de privacidad en `store/ficha.md`.
- Capturas 1280×800 y mosaicos promocionales en español e inglés (`npm run store:assets`).
- Guía de publicación y pasos pendientes en `docs/publicacion.md`.

## 1.0.0 — 2026-10-22

Primera versión estable. Reúne todo lo hecho desde 0.4.2 (M4, M5, avisos, barra reordenada) más las mejoras finales.

- **Herramientas de anotación nuevas:** línea, elipse, resaltador (translúcido) y **pasos numerados** (numeración automática, color de número con contraste, redimensionables). Validación estricta al restaurar anotaciones guardadas.
- **Temporizador** de 3, 5 o 10 s para captura visible y página completa; la cuenta regresiva aparece en el icono de la extensión.
- **Historial:** renombrar capturas y buscar por nombre o fecha.
- **PNG optimizado sin pérdida** al descargar y exportar (filtros por fila, paleta cuando hay ≤256 colores); se usa solo si pesa menos que el PNG del navegador.
- El aviso del proyecto (imagen original incluida) solo aparece cuando hay censuras.
- La barra del editor mantiene siempre la misma altura al cambiar de herramienta (el lienzo ya no se desplaza).
- Pendiente para después de 1.0.0: lupa, dibujo libre, recorte y rotación.

## 0.6.2 — 2026-10-22

- Barra del editor reordenada: Deshacer y Rehacer, luego Descargar PNG, Copiar y Exportar…, y al final a la derecha **Eliminar** y **Descartar** en rojo, separados de las acciones seguras.

## 0.6.1 — 2026-10-22

- **Avisos tipo toast** abajo a la derecha para confirmar acciones: copiar, descargar, exportar, guardar proyecto, eliminar/borrar historial, abrir un proyecto y guardar un ajuste; los errores se muestran en rojo y duran más. Se cierran solos o con ✕. Sustituyen a la línea de estado del pie del editor.

## 0.6.0 — 2026-10-22

M5: historial, proyecto editable, ajustes y atajos.

- **Historial:** pestaña con las capturas recientes (miniatura, fecha, tamaño); abrir, eliminar y borrar todo. Las anotaciones se autoguardan y se restauran al reabrir. Retención de 1, 7 o 30 días y máximo de 60 capturas / 300 MB. No se guarda en incógnito y se puede desactivar.
- **Proyecto editable** `.dotsnap.json`: guardar desde «Exportar…» (con aviso de que contiene la imagen original) y abrir desde el historial. Validación estricta; formato documentado.
- **Configurar** dentro del popup: historial y retención, formato y calidad predeterminados, plantilla del nombre de archivo y lista de atajos.
- **Atajos:** Alt+Shift+V (visible), R (región), E (elemento) y F (página completa).
- Botón **Copiar** en la barra del editor.
- La insignia del popup muestra la versión.

## 0.5.1 — 2026-10-22

- El panel de exportación es ahora un **modal centrado** (Escape, ✕ o clic fuera lo cierran); los atajos del editor no se activan mientras está abierto.
- README: se quitó la imagen del editor.

## 0.5.0 — 2026-10-22

M4: formatos y peso.

- **Exportar…** en el editor: PNG, JPEG, WebP y PDF; escala; calidad; **peso objetivo** (busca la mayor calidad que cabe y avisa si no se alcanza); fondo para aplanar transparencia; PDF en A4, Carta o tamaño de la imagen, con las capturas largas repartidas en varias páginas.
- Se muestra el peso real del archivo junto al del PNG original. El formato se comprueba por su firma real.
- **Copiar PNG** al portapapeles.
- README bilingüe (`README.md` en inglés y `README.es.md`).
- PDF propio, sin librerías nuevas.

## 0.4.2 — 2026-10-22

- **Popup con pestañas:** Captura · Historial (próximamente) · Configurar. Configurar muestra idioma y tema dentro del mismo popup, sin abrir una pestaña a pantalla completa. Desaparecen «Ajustes», el enlace «Configurar idioma y tema», el texto «Disponible» y las líneas separadoras de las tarjetas; las tarjetas son más compactas.

- **Página completa:** corregido el fallo `render-range` que aparecía al terminar la captura en pantallas con escala o zoom (p. ej. 125 %): el navegador aterrizaba unas fracciones de píxel más abajo de lo pedido y la unión lo tomaba por un hueco. Ahora se absorben desfases de unas filas; un hueco real sigue rechazándose.
- El popup muestra el motivo del último fallo y, aparte, una línea «Detalle técnico (compártelo si reportas el problema)» con un código más preciso.

## 0.4.1 — 2026-10-22

- Pie de créditos «Creado por Camilo Ruiz · acrocode.dev · GitHub» en el popup y las opciones (enlaces que abren en pestaña nueva; sin permisos nuevos).
- Texto: combo de **fuente** con nueve fuentes del sistema (Sistema, Arial, Verdana, Trebuchet, Georgia, Times New Roman, monoespaciada, manuscrita, Impact), cada opción en su propia fuente. Aparece con la herramienta Texto o al seleccionar un texto, y cambiarla actualiza ese texto (se deshace con Ctrl+Z).
- **Descartar** ahora cierra la pestaña del editor en lugar de dejar una pantalla con datos de la extensión.
- Página completa: cuando falla, el popup muestra la causa y un detalle técnico del último fallo (el icono solo muestra «!»), para poder diagnosticarlo.

## 0.4.0 — 2026-10-22

M3: página completa por segmentos.

- **Página completa:** se desplaza la página, se captura por tramos respetando una cola de 600 ms entre capturas y se compone sin huecos ni solapes. El ancho útil excluye la barra de desplazamiento.
- Header y footer fixed y elementos sticky aparecen una sola vez; el contenido perezoso visible se espera antes de capturar.
- Si la página no cabe en una imagen (lado ≤ 8192 px, área ≤ 33 177 600 px), sale en **partes numeradas** ("Parte 2 de 3"), cada una en su pestaña del editor; nunca se une en un canvas gigante.
- Progreso en el icono (`3/8`), cancelación con Escape y aviso de error en el icono. La página queda como estaba (scroll y estilos exactos) al terminar, cancelar, fallar o navegar.
- Límite de 120 tramos y 12 partes: por encima se rechaza antes de capturar.
- Se corrigió la prueba de M0 (`test:browser`), que quedó desactualizada al habilitar los modos de captura en M2.

## 0.3.0 — 2026-10-22

M2: región y elemento inteligente.

- **Región:** arrastra un rectángulo sobre la página, ajústalo con ocho tiradores, muévelo arrastrando o con las flechas (Shift ×10, Ctrl redimensiona) y confirma con Enter o el botón; Escape cancela. Se muestra el tamaño en px CSS.
- **Elemento inteligente:** el hover resalta el elemento sin alterar la página; ↑ elige el padre y ↓ vuelve al hijo; clic o Enter captura. Los iframes se seleccionan completos y se avisa de que no se puede entrar.
- El recorte usa la escala medida del bitmap (válido con zoom y alta densidad). El script se inyecta solo tras el gesto y solo en esa pestaña; no hay `content_scripts` permanentes ni permisos de hosts.
- Pendiente: lupa de la región y temporizador.

## 0.2.0 — 2026-10-21

- Censura con tres estilos: sólido (predeterminado, el único que no deja rastro), pixelado y desenfocado. Pixelado y desenfoque usan bloques y radios proporcionales a la zona, con mínimos que impiden leer texto, y el resultado es siempre opaco. El estilo sólido sigue siendo el recomendado para datos sensibles.
- El selector de color es ahora un combo: cada opción muestra un cuadro de color y su nombre, con teclado (flechas, Inicio/Fin, Escape) y la opción «Personalizado» con la paleta nativa del navegador.
- Se agregan los colores Naranja y Morado.

## 0.1.0 — 2026-10-21

M1: captura visible → editor → PNG.

- Captura de la parte visible de la pestaña activa (`activeTab`), con medición real de escala.
- Editor con flecha, rectángulo, texto y censura opaca; selección, mover, borrar, deshacer y rehacer.
- Exportación a PNG aplanado a resolución nativa.
- Selector de color con fichas (cuadro y nombre) y paleta personalizada.
- Nuevo icono de la familia Dot, con el fondo azul marino de DotLens.
- Corrección: aviso «ResizeObserver loop completed with undelivered notifications» en el editor.

## 0.0.1

Fundaciones del proyecto (M0).
