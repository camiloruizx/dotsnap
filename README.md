# DotSnap · Fase 0 + M0 + M1

Base local de una extensión Chrome MV3. Captura exactamente lo que necesitas, explica con claridad y exporta con control. **M1 implementa Área visible → editor (flecha, rectángulo, texto, censura) → PNG.** Región, elemento inteligente, página completa, JPEG/WebP/PDF, historial y portapapeles siguen pendientes.

M0 incluye popup honesto con cuatro modos deshabilitados, Ajustes/Historial «Próximamente», enlace funcional a preferencias de idioma/tema, ES/EN, tema Sistema/Claro/Oscuro, icono provisional original, arquitectura y planificación. No usa CDN, fuentes remotas, cuentas ni analítica.

## Compilación reproducible

Requiere Node 22.12+ o 24 y npm. Entorno verificado: Node 24.14.1, npm 11.19.0 en Windows. El lockfile fija las dependencias; usar npm ci, no actualizar paquetes durante la reproducción.

```powershell
cd C:\Proyectos\dotsnap
npm ci
npm run build
npm run lint
npm run typecheck
npm run test
npm run zip
```

La compilación genera `.output/chrome-mv3`; ZIP en `.output/`. No incluye sourcemaps ni servicios remotos. La instalación de dependencias requiere Internet, la extensión compilada funciona localmente. «Reproducible» significa mismo código y versiones mediante lockfile; no se promete ZIP idéntico byte a byte por timestamps.

## Cargar descomprimida en Chrome

1. Compila y abre `chrome://extensions`.
2. Activa «Modo de desarrollador» y pulsa «Cargar descomprimida».
3. Selecciona `C:\Proyectos\dotsnap\.output\chrome-mv3`.
4. Abre el popup desde el icono. Los seis botones futuros están realmente deshabilitados.
5. Usa «Configurar idioma y tema» para abrir opciones. Los selectores guardan automáticamente en este dispositivo.
6. Después de recompilar, pulsa «Recargar» en la tarjeta de la extensión. Comprueba que no hay errores de manifest/runtime.

Permisos: activeTab y scripting para el flujo futuro bajo gesto; **storage añadido con autorización explícita del usuario** para las preferencias. Sin host_permissions, debugger, downloads ni content_scripts permanentes. El content script se empaqueta, pero M0 no lo inyecta. No hay captura funcional ni soporte universal de páginas.

## Desarrollo y verificación

| Script               | Resultado                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run dev          | WXT con recarga de desarrollo; usa un artefacto distinto de producción                                                                      |
| npm run build        | Iconos locales + extensión Chrome de producción                                                                                             |
| npm run zip          | Iconos y ZIP WXT, sin publicación                                                                                                           |
| npm run lint         | ESLint y verificación Prettier                                                                                                              |
| npm run typecheck    | Tipos WXT + TypeScript estricto                                                                                                             |
| npm run test         | Vitest: geometría, confianza, preferencias e idiomas                                                                                        |
| npm run test:m1      | Compila la variante de pruebas y verifica M1 en Chromium/Chrome (captura, anotaciones, PNG, censura); `DOTSNAP_CHROME` apunta a un Chromium |
| npm run build:test   | Solo la variante de pruebas (`.output-test`, con `<all_urls>`); no es el paquete de producción                                              |
| npm run test:browser | Chrome instalado, perfil nuevo aislado, 8 vistas, axe, persistencia, teclado, errores y screenshots                                         |

La prueba de navegador requiere Chrome instalado y el comando CDP Extensions.loadUnpacked disponible. Usa únicamente un perfil de pruebas bajo `.browser-profile/` y habilita depuración de extensiones solo en ese proceso. No cambia tu perfil habitual ni instala en él la extensión. Genera evidencia real en `docs/evidence/`. No descarga otro navegador ni requiere cuenta.

Estado de las pruebas, salidas reales y límites en [docs/validacion-m0.md](docs/validacion-m0.md). Capturas del popup se prueban como documentos de extensión en pestañas de Chrome headless, no como ventana del toolbar. Edge y Chrome anteriores a la versión verificada no se han probado. La revisión manual con lector de pantalla sigue pendiente.

## Organización

- `src/entrypoints/`: worker mínimo, popup, opciones y content script sin registro.
- `src/shared/config/product.ts`: **única constante del nombre visible**. Cambiarla y recompilar actualiza UI y manifest/locales; los IDs técnicos y documentos se mantienen por separado.
- `src/shared/i18n/{es,en}.json`: catálogo único para React y `_locales/*/messages.json` generado. Chrome usa el idioma del navegador para el manifest; React permite override.
- `src/shared/theme/tokens.css`: única fuente de valores visuales de UI; `layout.css` compone con esos tokens.
- `assets/icon-provisional.svg`: original editable; `npm run icons` genera PNG 16/32/48/128 locales con resvg, sin copiar la marca DotPilot.
- `docs/`: decisiones, riesgos de API con fuentes, arquitectura, matriz de funciones, hitos y propuesta de librerías.
- `tests/`: pruebas puras. `scripts/verify-browser.mjs`: verificación real de la extensión compilada.

DotPilot se inspeccionó solo en lectura; las fuentes y supuestos están en [docs/design-system.md](docs/design-system.md). No se instalaron librerías de editor/PDF/optimización. Nombre comercial, logo definitivo y licencia de distribución pendientes antes del lanzamiento. No se afirma disponibilidad de la marca.

**Estado:** M1 implementado y verificado parcialmente (validacion-m1.md, con checklist manual del gesto real). **M2 no está autorizado ni iniciado.** Uso: abre una página web, pulsa el icono y elige «Área visible»; se abre el editor en una pestaña nueva. Las capturas temporales se conservan 24 h en este dispositivo; las anotaciones no se guardan al recargar.
