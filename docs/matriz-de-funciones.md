# Matriz de funciones

Organizada por la especificación original (secciones 2 a 13). «Implementado» significa presente en código; «probado» exige evidencia ejecutada (alcance real en validacion-m0.md). Cada fila conserva ambos campos para no equipararlos. La versión sigue la sección 13 de la especificación; donde la especificación no asigna versión, la columna Nota lo indica como **propuesta** reversible.

Estados posibles: Pendiente · Implementado · Probado.

## Base (M0)

| ID   | Función                                              | Versión / hito | Implementación | Pruebas                                          | Nota                                                   |
| ---- | ---------------------------------------------------- | -------------- | -------------- | ------------------------------------------------ | ------------------------------------------------------ |
| B-01 | Scaffold WXT/React/TS, MV3 y empaquetado             | M0             | Implementado   | Probado (validacion-m0.md)                       |                                                        |
| B-02 | Popup con 4 modos y Ajustes/Historial deshabilitados | M0             | Implementado   | Probado (validacion-m0.md)                       | Modos de B-02 son placeholders                         |
| B-03 | Preferencias locales de idioma y tema                | M0             | Implementado   | Probado (validacion-m0.md)                       |                                                        |
| B-04 | ES/EN, tema claro/oscuro/Sistema, tokens             | M0             | Implementado   | Probado (validacion-m0.md)                       |                                                        |
| B-05 | Ícono original SVG/PNG de la familia Dot             | M0             | Implementado   | Probado (validacion-m0.md)                       | Revisión de marca pendiente en M6                      |
| B-06 | Validación de mensaje `health` y remitente           | M0             | Implementado   | Probado: unitaria e integración                  |                                                        |
| B-07 | Geometría CSS → píxeles con escala medida por eje    | M0             | Implementado   | Probado en Vitest; no hay captura real           | Cierre de M0: `captureScale`                           |
| B-08 | Preferencias aplicadas antes del primer render       | M0             | Implementado   | Pendiente de repetir `test:browser` en el equipo | Evita destello de tema/idioma; el destello no se midió |

## §2 Modos de captura

| ID   | Función                                                       | Versión / hito | Implementación        | Pruebas                                                                                                                                   | Nota                                                                                                                                                |
| ---- | ------------------------------------------------------------- | -------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Área visible                                                  | V1 / M1        | Implementado          | Probado en Chromium 141 con variante de pruebas; gesto `activeTab` real: manual pendiente                                                 | Ver validacion-m1.md                                                                                                                                |
| C-02 | Región personalizada (tiradores, lupa, teclado, Enter/Escape) | V1 / M2        | Implementado sin lupa | Probado en Chromium 141 con variante de pruebas (DPR 1 y 2); gesto `activeTab` real: manual pendiente                                     | Tiradores, mover, flechas (Shift ×10, Ctrl redimensiona), Enter/Escape. **Lupa no implementada**: exigiría una captura previa; ver validacion-m2.md |
| C-03 | Selección inteligente de elementos                            | V1 / M2        | Implementado          | Probado en Chromium 141 con variante de pruebas (DPR 1 y 2); gesto `activeTab` real: manual pendiente                                     | Hover sin tocar la página, ↑ padre / ↓ hijo, iframes completos con aviso; no entra en iframes                                                       |
| C-04 | Página completa por segmentos                                 | V1 / M3        | Implementado          | Probado en Chromium 141 con variante de pruebas (DPR 1 y 2, 20 000 px, cancelación, navegación); gesto `activeTab` real: manual pendiente | Solo el scroll del documento (no contenedores internos: C-07); salida en partes de ≤ 8192 px; ver validacion-m3.md                                  |
| C-05 | Captura con temporizador (inmediata, 3, 5, 10 s)              | V1 / M2        | Pendiente             | Pendiente                                                                                                                                 | **Propuesta**: la especificación no asigna versión; se aplaza fuera de M2                                                                           |
| C-06 | Importación (selector, arrastrar y soltar, pegar)             | V1 / M5        | Pendiente             | Pendiente                                                                                                                                 | **Propuesta**                                                                                                                                       |
| C-07 | Contenedor con desplazamiento interno                         | V1.1           | Pendiente             | Pendiente                                                                                                                                 | §13 lo incluye como «avanzado» en V1.1; sin hito aún                                                                                                |
| C-08 | Pantalla o ventana del sistema                                | Posterior a V1 | Pendiente             | Pendiente                                                                                                                                 | Requiere verificar viabilidad y permisos antes de planificar                                                                                        |

## §3 Editor de anotaciones

| ID   | Función                                                                | Versión / hito | Implementación                                                              | Pruebas                                                     | Nota                                                                  |
| ---- | ---------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| E-01 | Flecha, rectángulo, texto y censura segura (conjunto mínimo)           | V1 / M1        | Implementado                                                                | Probado (crear, mover, borrar, editar texto)                | Redimensionar con el transformador no está automatizado               |
| E-02 | Resto de herramientas: elipse, línea, dibujo libre, resaltador, globos | V1 / M1–M4     | Pendiente                                                                   | Pendiente                                                   | Reparto fino al cerrar M1                                             |
| E-03 | Pasos numerados, inserción de imágenes, desenfoque y pixelado          | V1 / M1–M4     | Pendiente                                                                   | Pendiente                                                   |                                                                       |
| E-04 | Recorte, rotación 90°, redimensionado con proporción                   | V1 / M1–M4     | Pendiente                                                                   | Pendiente                                                   |                                                                       |
| E-05 | Selección, multiselección, capas, duplicar, deshacer/rehacer, zoom     | V1 / M1–M4     | Parcial: selección simple, mover, redimensionar, eliminar, deshacer/rehacer | Probado: deshacer/rehacer, mover, eliminar                  | Faltan multiselección, capas, duplicar y zoom; historial por comandos |
| E-06 | Fondo, margen, borde y sombra de presentación                          | V1 / M4        | Pendiente                                                                   | Pendiente                                                   |                                                                       |
| E-07 | Censura aplanada sin píxeles originales y aviso en proyectos editables | V1 / M1        | Implementado (exportación aplanada; modos sólido, pixelado y desenfocado)   | Probado: 0 píxeles originales bajo la censura (modo sólido) | Aviso de proyecto editable pendiente con X-05                         |

## §4 Formatos y exportación

| ID   | Función                                                         | Versión / hito | Implementación                        | Pruebas                                                                                     | Nota                                                                                                                                         |
| ---- | --------------------------------------------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| X-01 | PNG con dimensiones correctas                                   | V1 / M1        | Implementado                          | Probado: firma PNG y dimensiones nativas                                                    | Sin optimizar (X-03)                                                                                                                         |
| X-02 | JPEG y WebP con calidad, peso real y peso objetivo              | V1 / M4        | Implementado                          | Probado en Chromium 141: archivos reales (firma, dimensiones, peso mostrado = archivo)      | Sin presets ni vista previa visual de la compresión; el peso real se calcula con el codificador del navegador                                |
| X-03 | PNG redimensionado (sin control de calidad ficticio)            | V1 / M4        | Parcial                               | Probado: escala 25–100 %                                                                    | Sin recompresión/optimización de PNG: pendiente, sin librería añadida                                                                        |
| X-04 | PDF una o varias páginas (original, A4, Carta, márgenes)        | V1 / M4        | Implementado                          | Probado: pdfinfo, pdfimages y rasterizado con pdftoppm; 3 páginas A4 con 3000 filas exactas | PDF propio sin dependencias, imagen sin pérdida (FlateDecode); una captura por PDF (las partes de una página larga se exportan por separado) |
| X-05 | Formato de proyecto editable, versionado y documentado          | V1 / M4–M5     | Implementado                          | Probado: guardar, importar, exportar el mismo PNG, rechazo de archivos inválidos            | `.dotsnap.json` v1 (docs/formato-de-proyecto.md); contiene la imagen original: aviso visible                                                 |
| X-06 | Peso objetivo aproximado y comparación original/exportada       | V1 / M4        | Implementado                          | Probado: objetivo alcanzado (60 KB) y no alcanzado (1 KB) declarado                         | Solo JPEG/WebP; en PNG y PDF se reduce con la escala                                                                                         |
| X-07 | Copiar al portapapeles (PNG) y descarga con plantilla de nombre | V1 / M1–M4     | Portapapeles y descarga implementados | Descarga probada; copia probada en Chromium de pruebas, en Chrome real: manual              | Nombre `dotsnap-fecha-hora.ext`; plantilla configurable pendiente                                                                            |

## §5–§6 Experiencia, historial y almacenamiento

| ID   | Función                                                      | Versión / hito | Implementación | Pruebas                                                                                                      | Nota                                                                                                            |
| ---- | ------------------------------------------------------------ | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| U-01 | Atajos configurables (máximo 4 sugeridos)                    | V1 / M5        | Implementado   | Declaración, descripciones y lista en Configurar probadas; la pulsación real: manual                         | Alt+Shift+V/R/E/F; Chrome los deja sin asignar si chocan; se cambian en chrome://extensions/shortcuts           |
| U-02 | Guardar directamente sin abrir el editor                     | V1 / M5        | Pendiente      | Pendiente                                                                                                    | **Propuesta**                                                                                                   |
| U-03 | Onboarding breve con página de práctica                      | V1 / M6        | Pendiente      | Pendiente                                                                                                    | **Propuesta**                                                                                                   |
| H-01 | Historial local con miniaturas, búsqueda, renombrar y borrar | V1 / M5        | Parcial        | Probado: lista con miniatura, abrir, eliminar, borrar todo                                                   | Sin búsqueda ni renombrar                                                                                       |
| H-02 | Límite visible, borrado total y recuperación de borradores   | V1 / M5        | Implementado   | Probado: retención 7 días, cuota de 60 elementos / 300 MB, borrado total, anotaciones recuperadas al reabrir | La retención se elige en Configurar (1, 7 o 30 días)                                                            |
| H-03 | Sin persistencia de capturas de incógnito por defecto        | V1 / M5        | Implementado   | Por código; no se puede probar un perfil de incógnito en la automatización                                   | En incógnito no se lista ni se guardan anotaciones (las capturas viven en el almacén del propio modo incógnito) |

## §12 Tienda

| ID   | Función                                                           | Versión / hito | Implementación | Pruebas   | Nota |
| ---- | ----------------------------------------------------------------- | -------------- | -------------- | --------- | ---- |
| S-01 | Paquete, política de privacidad, inventario de permisos y guías   | V1 / M6        | Pendiente      | Pendiente |      |
| S-02 | Nombre y marca revisados; icono definitivo; licencias y changelog | V1 / M6        | Pendiente      | Pendiente |      |

## §13 Versiones posteriores

| ID   | Función                                             | Versión | Implementación | Pruebas   |
| ---- | --------------------------------------------------- | ------- | -------------- | --------- |
| P-01 | Contenedores desplazables avanzados                 | V1.1    | Pendiente      | Pendiente |
| P-02 | Proyectos reutilizables                             | V1.1    | Pendiente      | Pendiente |
| P-03 | Exportación por lotes                               | V1.1    | Pendiente      | Pendiente |
| P-04 | Presets de anotación y herramientas de presentación | V1.1    | Pendiente      | Pendiente |
| P-05 | OCR local y búsqueda por texto                      | V2      | Pendiente      | Pendiente |
| P-06 | Comparación visual y marcas de agua                 | V2      | Pendiente      | Pendiente |
| P-07 | Sincronización optativa y colaboración              | V2      | Pendiente      | Pendiente |

Ni cobros, cuentas, nube ni grabación de vídeo entran en V1 sin decisión expresa. Cada hito debe actualizar esta matriz antes de declararse probado; ninguna función de V1.1 o V2 se anuncia como disponible.
