# Validación M4: formatos y peso

Estado: **verificado en Chromium 141 con la variante de pruebas** (`npm run test:m4`); la copia al portapapeles y la apertura de los PDF en un lector real quedan para revisión manual.

## Qué se implementó

Panel «Exportar…» en el editor: formato (PNG, JPEG, WebP, PDF), escala (100/75/50/25 %), calidad (JPEG/WebP), peso objetivo en KB (JPEG/WebP), fondo para aplanar transparencia (JPEG y PDF), página del PDF (tamaño de la imagen, A4, Carta) y margen. El panel codifica con el navegador y muestra el **peso del archivo real** junto al del PNG original. El botón «Descargar PNG» rápido se conserva. Código: `src/shared/export/` (formatos, codificación, PDF) y `src/entrypoints/editor/ExportPanel.tsx`.

- Cada archivo se verifica por su **firma real**, no por el tipo MIME declarado: si el navegador no puede generar WebP y devuelve otro formato, se informa en lugar de entregar un archivo con extensión falsa.
- **Peso objetivo:** búsqueda binaria sobre la calidad con codificaciones reales; devuelve la mayor calidad que cabe. Si ni la calidad mínima (5 %) cabe, lo dice («no se alcanzó el objetivo») y entrega ese mínimo. PNG y PDF no tienen calidad: se reducen con la escala.
- **PDF propio** sin dependencias: una imagen RGB sin pérdida (FlateDecode) por página; las capturas largas se reparten por filas exactas (A4: página fija; tamaño original: página a la medida con tope de 14 400 pt y 8192 filas por franja). No se incorporó pdf-lib ni jsPDF.

## Resultados

| Comprobación                                                                                                                                                                                                                             | Resultado                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| PNG descargado: firma, dimensiones 1000 × 600, nombre `dotsnap-AAAAMMDD-HHMMSS.png`                                                                                                                                                      | Correcto                         |
| JPEG: firma, formato real, pesa menos que el PNG (293 KB frente a 1,7 MB con ruido); el peso mostrado coincide con el archivo                                                                                                            | Correcto                         |
| WebP: firma y apertura con una librería externa (Pillow)                                                                                                                                                                                 | Correcto                         |
| Calidad 20 % pesa menos que la predeterminada                                                                                                                                                                                            | Correcto                         |
| Escala 50 %: 500 × 300 y menos peso                                                                                                                                                                                                      | Correcto                         |
| Peso objetivo 60 KB: 60 411 B (≤ objetivo, cerca de él)                                                                                                                                                                                  | Correcto                         |
| Peso objetivo 1 KB: declarado no alcanzado; entrega el mínimo (4694 B)                                                                                                                                                                   | Correcto                         |
| PDF A4 de una página: `pdfinfo` 595,28 × 841,89 pt                                                                                                                                                                                       | Correcto                         |
| PDF de una página larga (3000 px): 3 páginas A4; `pdfimages` suma 3000 filas (sin pérdida ni repetición); al rasterizar con `pdftoppm`, la primera y la última franja tienen el color esperado                                           | Correcto                         |
| Consola                                                                                                                                                                                                                                  | 0 errores, 0 peticiones externas |
| Unitarias (`tests/export.test.ts`): firmas, escala, búsqueda de peso (alcanzado, holgado, imposible), plan del PDF (filas exactas, márgenes, A4/Carta/original, imágenes enormes) y estructura del PDF (xref con desplazamientos reales) | 60 de 60 pasan                   |

## Límites

- Un PDF contiene una captura; las partes de una página muy larga (varias pestañas) se exportan por separado.
- No hay recompresión de PNG (X-03 parcial) ni formato de proyecto editable (X-05) ni presets.
- La calidad que se muestra para el peso objetivo es la del codificador de Chrome: otros navegadores pueden dar pesos distintos.
- El PDF sin pérdida puede pesar más que un JPEG de la misma imagen; para un PDF liviano, reduce la escala.
- Copiar al portapapeles necesita que Chrome lo permita en esa pestaña; en Chromium de pruebas funcionó, en Chrome real queda por comprobar.

## Comprobación manual pendiente

1. Exporta el mismo recorte en PNG, JPEG, WebP y PDF y ábrelos con tu visor habitual.
2. Fija un peso objetivo y comprueba que el archivo pesa lo mostrado.
3. Exporta una página larga a PDF A4 y revisa que no se corten líneas de texto entre páginas (se corta por filas de píxeles, no por líneas de texto).
4. Pulsa «Copiar PNG» y pégalo en otra aplicación.
