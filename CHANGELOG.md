# Cambios

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
