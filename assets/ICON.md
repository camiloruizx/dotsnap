# Ícono de DotSnap / DotSnap icon

Marco de captura de dos tonos con un punto central: lo que se encuadra («snap») y el punto de la familia Dot. Mantiene el lenguaje de DotPilot y DotLens: mosaico oscuro, azules planos, un solo símbolo, sin degradados, sombras ni adornos.

Two-tone capture frame with a centre dot: what gets framed ("snap") plus the Dot family dot. Same language as DotPilot and DotLens: dark tile, flat blues, one symbol, no gradients, shadows or effects.

- `dotsnap-icon.svg`: maestro editable, 128 × 128. Mosaico `#1d2b40` con radio 30 (el mismo azul marino y radio que DotLens; la interfaz sigue usando `--brand-tile` de DotPilot), azul `#3794ff`, azul claro `#75beff` (los mismos tokens de DotPilot, ver `docs/design-system.md`). Trazo 11, remates redondeados, punto central de radio 14.
- `npm run icons` genera `public/icon/{16,32,48,128}.png` con resvg, sin dependencias de red.

Diseño original para DotSnap; no reproduce la flecha de DotPilot ni la lupa de DotLens. Revisión de marca, nombre comercial y legibilidad en la tienda siguen pendientes (M6). Probado visualmente en 16/32/48/128 px sobre fondo claro y oscuro; no se hizo prueba con usuarios.
