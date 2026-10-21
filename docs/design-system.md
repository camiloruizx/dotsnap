# Sistema visual: DotPilot → DotSnap

Inspección directa y de solo lectura de C:\Proyectos\dotpilot, 21 de octubre de 2026. DotPilot es una extensión de VS Code; sus variables `--vscode-*` reciben el tema del editor. Los valores siguientes son fallbacks reales, no una paleta clara/oscura publicada. La línea 24 de `src/view.js` contiene todo el CSS.

## Tokens confirmados

Todas las rutas de origen de esta tabla se resuelven bajo `C:/Proyectos/dotpilot/`.

| Familia / tokens DotSnap                                  | Valor encontrado                                                          | Origen exacto                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| surface / surface-card / text / muted, oscuro             | #181818 / #1f1f1f / #d4d4d4 / #aaa                                        | src/view.js:24, body, .card, .subtitle                                  |
| border / control / control-hover, oscuro                  | #3a3a3a / #313131 / #3b3b3b                                               | src/view.js:24, button y .select                                        |
| accent / accent-hover / on-accent                         | #0078d4 / #026ec1 / #fff                                                  | src/view.js:24, button.primary                                          |
| focus / link, oscuro                                      | #3794ff                                                                   | src/view.js:24, :focus-visible y button.link                            |
| error, oscuro                                             | #f48771                                                                   | src/view.js:24, .result.error                                           |
| éxito (reservado, no usado en M0)                         | #73c991                                                                   | src/view.js:24, .dot.active                                             |
| brand-tile / brand-blue / brand-blue-light                | #181b20 / #3794ff / #75beff                                               | media/dotpilot-icon.svg:2–5; media/ICON.md:9                            |
| font-family / font-body / line-body                       | var(--vscode-font-family,system-ui) / var(--vscode-font-size,13px) / 1.45 | src/view.js:24, body                                                    |
| font-badge / font-small / font-label / font-brand         | 10 / 11 / 12 / 15px                                                       | src/view.js:24, .version / .hint / h2 / .brand                          |
| weight-strong / weight-brand / tracking-brand             | 600 / 650 / .1px                                                          | src/view.js:24, h2 / .brand                                             |
| line-button / control-height                              | 1.35 / 32px                                                               | src/view.js:24, button                                                  |
| space-1…space-10                                          | 2,5,6,7,8,9,10,12,14,16px                                                 | src/view.js:24, .version, label, button, .grid, header, .card, .setting |
| radius-input / radius-button / radius-card / radius-badge | 4 / 5 / 7 / 10px                                                          | src/view.js:24, select / button / .card / .version                      |
| radius-round                                              | 50%                                                                       | src/view.js:24, .dot                                                    |
| border-width / focus-width / focus-offset                 | 1 / 2 / 2px                                                               | src/view.js:24, button y :focus-visible                                 |
| icon-size / icon-stroke                                   | 16px / 1.6                                                                | src/view.js:24, button svg                                              |
| brand-size                                                | 29px                                                                      | src/view.js:24, .brand-icon                                             |
| transition                                                | .12s                                                                      | src/view.js:24, button                                                  |
| shadow                                                    | ninguna declaración box-shadow                                            | src/view.js:24, media/ICON.md:5: sin sombras en el icono                |

## Adaptaciones y supuestos explícitos

`src/shared/theme/tokens.css` es la única fuente de valores visuales de UI; `layout.css` solo usa tokens y reglas de composición. El SVG es un activo vectorial autónomo y conserva los tres colores confirmados de marca.

La paleta clara es **supuesto/adaptación**: surface #f5f6f8, card/control #fff, text #24282e, muted #565e69, border #c6cbd2, control-hover #e8edf3, control-border #767e8a, link #0066b5, focus #0078d4, error #ac3024. No se encontró una paleta clara fija en DotPilot. El borde de controles oscuro #888 es una adaptación para identificar el select con contraste ≥3:1; el borde de tarjetas oscuro conserva #3a3a3a y es decorativo.

Dimensiones propias **supuestas/reversibles**: popup 372px, opciones 560px, margen opciones 48px, tarjeta de modo 126px, espacio adicional 24px. Fuente local system-ui (sin fuente VS Code disponible). No se hereda la opacidad .45 de los botones deshabilitados: el estado se expresa con disabled real, ausencia de hover y texto Próximamente legible. Sin sombras.

Iconografía: DotPilot usa SVG 24×24, trazo redondeado sin relleno (`src/view.js:8–16,24`), además de codicons en package.json. DotSnap dibuja SVG propios con ese grosor; no incorpora codicons. Marca provisional original: marco de recorte y cuadrado central con punto, no el triángulo de navegación de DotPilot. Logotipo tipográfico local: nombre desde configuración, sin fuente/logotipo externo; debe revisarse antes de tienda.

Inputs: select nativo, etiqueta encima y ayuda debajo. Botones compactos, radio 5px. Tooltips DotPilot: atributo title nativo (`src/view.js:21`), sin sistema personalizado. DotSnap usa title y texto de estado permanente, sin depender del tooltip de un control disabled. Foco de 2px y separación 2px. Los controles disabled no entran al tabulado; enlace y selects sí.

## Voz y convenciones encontradas

`src/view.js:26–40`, `src/i18n.js:5–10` y `src/locales/en.json`: verbos breves («Ejecutar», «Ver salida»), etiquetas en estilo oración («Proyecto de inicio»), ayudas concretas y estados («Guardando…», «Guardado»). Mayúsculas para siglas, no para títulos completos. DotSnap mantiene esa voz ES/EN.

`CONTRIBUTING.md:17–35` y `package.json:scripts`: CommonJS JS con 'use strict', módulos por responsabilidad en src/controller, lógica pura en src, test/ con node --test, test-integration/ para VS Code. Sin configuración ESLint/Prettier/TypeScript encontrada en la raíz inspeccionada ni scripts lint/format. Scripts reales: test, test:ci, release-notes, test:integration, package, test:assistant y variantes. DotSnap adopta separación de responsabilidades y honestidad de VALIDACION.md, pero usa TS/React/WXT y herramientas propias requeridas por este proyecto.

La verificación de contraste y las imágenes reales de M0 se registran en `validacion-m0.md`; no se deduce una aprobación visual únicamente de los valores CSS.
