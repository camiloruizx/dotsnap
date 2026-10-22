# Validación M5: historial, proyecto, ajustes y atajos

Estado: **verificado en Chromium 141 con la variante de pruebas** (`npm run test:m5`); la pulsación real de los atajos, el modo incógnito y el portapapeles en Chrome real quedan para revisión manual.

## Qué se implementó

- **Historial** (pestaña «Historial» del popup): capturas recientes con miniatura, fecha, tamaño y marca de anotaciones; abrir, eliminar y borrar todo (con segunda pulsación). Las anotaciones se **autoguardan** (600 ms tras cada cambio) y se restauran al reabrir. Descartar elimina la captura.
- **Retención y cuota:** 1, 7 o 30 días (7 por defecto) desde la última modificación; máximo de 60 capturas y 300 MB (se elimina lo más antiguo, nunca la recién creada). Con el historial desactivado, las capturas se purgan a las 24 h, no se listan y no se guardan anotaciones. **En incógnito** no se lista ni se guardan anotaciones.
- **Proyecto editable** (`.dotsnap.json` v1, [formato](formato-de-proyecto.md)): guardar desde «Exportar…» (con aviso de que contiene la imagen original) y abrir desde el historial, con validación estricta.
- **Configurar** (pestaña del popup y página de opciones): idioma y tema, historial y retención, formato y calidad predeterminados de exportación, plantilla del nombre de archivo (`{app}`, `{date}`, `{time}`, con vista previa; una plantilla inválida no se guarda) y los atajos.
- **Atajos:** Alt+Shift+V (área visible), R (región), E (elemento) y F (página completa), cuatro en total. Si chocan con otros, Chrome los deja sin asignar y Configurar lo muestra; se cambian en `chrome://extensions/shortcuts`.
- **Copiar** en la barra del editor, además del botón del modal de exportación.
- La insignia del popup muestra la versión (antes «Base M1»).

## Resultados

| Comprobación                                                                                                                                                                                            | Resultado                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Captura → historial: 1 elemento con miniatura, 1000 × 600 px y anotación guardada sola                                                                                                                  | Correcto                             |
| Reabrir desde el historial: el PNG exportado es idéntico (hash) al del editor original                                                                                                                  | Correcto                             |
| Botón Copiar de la barra                                                                                                                                                                                | PNG copiado (en Chromium de pruebas) |
| Proyecto: guardar con nombre `…dotsnap.json`, formato y versión, aviso visible                                                                                                                          | Correcto                             |
| Importar el proyecto: se abre con sus anotaciones y exporta el mismo PNG (hash)                                                                                                                         | Correcto                             |
| Proyectos inválidos (anotación desconocida, no JSON): aviso y ninguna captura creada                                                                                                                    | Correcto                             |
| Eliminar una captura y borrar todo                                                                                                                                                                      | Correcto                             |
| Retención de 7 días: la de 8 días se purga al capturar; las recientes se conservan                                                                                                                      | Correcto                             |
| Cuota: 62 capturas → 60 (se elimina lo más antiguo)                                                                                                                                                     | Correcto                             |
| Historial desactivado: no se guardan anotaciones, el popup lo indica                                                                                                                                    | Correcto                             |
| Formato predeterminado JPEG aplicado en «Exportar…»; plantilla `{app}-{date}` produce `dotsnap-AAAAMMDD.jpg`; plantilla inválida no se guarda                                                           | Correcto                             |
| 4 atajos declarados con descripciones localizadas (no `__MSG_`) y listados en Configurar                                                                                                                | Correcto                             |
| Consola                                                                                                                                                                                                 | 0 errores, 0 peticiones externas     |
| Unitarias (`tests/m5.test.ts` y existentes): validación de anotaciones (válidas y 15 casos inválidos), `History.load`, plantilla de nombre, preferencias ampliadas, ida y vuelta y rechazo de proyectos | 70 de 70 pasan                       |

## Límites

- Historial sin búsqueda ni renombrar. No hay migración de capturas antiguas: las anteriores a esta versión se listan sin miniatura ni tamaño hasta que caduquen.
- Una captura abierta en un segundo editor al mismo tiempo guarda las anotaciones de quien escribió último.
- El autoguardado puede perder el último medio segundo de cambios si se cierra la pestaña justo entonces.
- Los atajos solo se pueden comprobar a mano (la automatización no puede pulsarlos). Chrome concede `activeTab` al pulsar un atajo, igual que con el icono.
- En incógnito la extensión solo funciona si el usuario lo permite en `chrome://extensions`; no se pudo probar un perfil de incógnito.

## Comprobación manual pendiente

1. Pulsa cada atajo en una página normal y comprueba que captura y abre el editor.
2. En «Configurar» → «Cambiar atajos», asigna otro y comprueba que se actualiza al reabrir el popup.
3. Anota una captura, ciérrala sin descartar y reábrela desde «Historial».
4. Guarda un proyecto, ábrelo desde «Abrir proyecto…» y comprueba el aviso sobre la imagen original.
5. Con una ventana de incógnito (si permites la extensión): el historial debe quedar vacío y sin anotaciones guardadas.
