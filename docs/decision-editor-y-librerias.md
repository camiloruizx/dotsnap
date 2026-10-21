# Propuesta de editor y librerías

Consulta de fuentes oficiales: 21/10/2026. Ninguna de estas librerías está instalada. Comparación cualitativa, sin benchmarks ni cifras de tamaño inventadas.

| Opción              | Capas y selección                                                                                                                                   | Memoria                                                                                             | Licencia                                                        | Tamaño y coste                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Konva + react-konva | Stage/Layer, Transformer; multiselección requiere lógica de selección y Transformer compartido; texto editable suele necesitar textarea superpuesto | Cada Layer usa canvas de escena/hit detection; reducir capas y pixelRatio de vista, exportar aparte | MIT (ambos; revisar versión elegida)                            | Núcleo + adaptador React; cargar solo en página editor; medir bundle min/gzip real antes de adopción |
| Fabric              | Modelo de objetos, ActiveSelection, controles, texto editable; capas mediante orden de objetos                                                      | Cachés por objeto y canvas auxiliar; desactivar caché cuando no aporte                              | MIT                                                             | Superficie funcional amplia; imports selectivos posibles; medir build real, no asumir tamaño fijo    |
| Canvas propio       | Escena, orden, hit testing, controles, multiselección y texto desde cero                                                                            | Control total de buffers, pero hay que gestionar hit testing/cachés y liberación                    | Sin dependencia de editor; licencia del código propio pendiente | Cero paquete de editor, mayor código y mantenimiento propio; no equivale a coste cero                |

Recomendación reversible: **Konva + react-konva** para M1 por integración declarativa con React y formas simples. Usar un fondo rasterizado y pocas capas de anotación; modelo de documento propio separado del árbol Konva. Fabric es preferible si texto avanzado y selección de objetos dominan tras un prototipo. Canvas propio no se recomienda para resolver interacción, undo/redo y accesibilidad desde cero. Aprobar mediante prototipo local en M1, sin instalar ahora.

La censura segura es responsabilidad del pipeline: aplanar máscaras opacas sobre píxeles y eliminar datos originales de exportaciones compartibles. Ninguna biblioteca garantiza eso automáticamente.

## PDF

**pdf-lib (MIT)** propuesto en M4: embedPng/embedJpg y páginas con tamaño controlado; apropiado para páginas rasterizadas y documentos multipágina. **jsPDF (MIT)** es alternativa con addImage; revisar plugins y dependencias que realmente se incorporen. Ambos se importarán de forma local y diferida; sin conversión HTML remota. Comparar peso, memoria y fidelidad con el mismo corpus, todavía sin medición.

## PNG real

**UPNG.js (MIT)** codifica PNG/APNG y permite cuantización de paleta (puede ser con pérdida); pako y dependencias deben auditarse al fijar versión. **oxipng (MIT)** optimiza PNG sin pérdida; compilar/usar wrapper WASM añade su propia licencia, procedencia y validación. Recomendación inicial: evaluar UPNG local en worker dedicado por simplicidad; ofrecer modo sin pérdida y distinguir cuantización. Evaluar oxipng WASM si mejora el corpus con presupuesto razonable. M0 no habilita wasm-unsafe-eval; cualquier cambio CSP por WASM deberá justificarse y probarse en MV3, sin scripts remotos.

`canvas.toBlob('image/png', quality)` no ofrece control real de compresión PNG por quality. Medir bytes del blob final, decodificar y comparar píxeles en modo sin pérdida; nunca prometer un porcentaje de ahorro.

## Fuentes y controles pendientes

- [Konva, MIT](https://github.com/konvajs/konva), [react-konva](https://github.com/konvajs/react-konva), [multiselección oficial](https://konvajs.org/docs/select_and_transform/Basic_demo.html).
- [Fabric, MIT y modelo de objetos](https://github.com/fabricjs/fabric.js).
- [pdf-lib, MIT](https://github.com/Hopding/pdf-lib), [jsPDF, MIT](https://github.com/parallax/jsPDF).
- [UPNG.js, MIT](https://github.com/photopea/UPNG.js), [oxipng, MIT](https://github.com/oxipng/oxipng).
- [Canvas toBlob](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-toblob-dev).

Antes de instalación: fijar versiones, inspeccionar archivos LICENSE y dependencias transitivas, generar avisos, medir bundle de producción y memoria en corpus reproducible. No hay decisión de costes ni servicio externo.
