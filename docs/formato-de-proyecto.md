# Formato de proyecto `.dotsnap.json` (versión 1)

Archivo JSON UTF-8 que guarda una captura y sus anotaciones para seguir editándola.

```json
{
  "format": "dotsnap-project",
  "version": 1,
  "createdAt": "2026-10-22T18:00:00.000Z",
  "width": 1000,
  "height": 600,
  "image": "data:image/png;base64,…",
  "annotations": [ { "id": "…", "type": "arrow|rect|text|redact", … } ]
}
```

- `image` es la captura **original** en PNG. **Los píxeles que quedan bajo una censura siguen dentro del archivo**: un proyecto no debe compartirse como si fuera la imagen exportada. El editor lo avisa al guardar.
- `annotations` usa el modelo del editor (`src/editor/model.ts`): `arrow` (x1, y1, x2, y2, color, strokeWidth), `rect` (x, y, width, height, color, strokeWidth), `text` (x, y, text, color, fontSize, fontFamily opcional) y `redact` (mode, x, y, width, height). Coordenadas en píxeles de la imagen.
- **Validación al abrir** (`parseProject` / `parseAnnotations`): formato y versión exactos (una versión mayor se rechaza con aviso); `width`/`height` enteros positivos que deben coincidir con la imagen decodificada y estar dentro del presupuesto de píxeles; imagen solo `data:image/png;base64`; hasta 500 anotaciones con claves exactas, ids únicos, números finitos acotados, colores `#rrggbb`, texto de hasta 2000 caracteres y modos de censura conocidos. Cualquier incumplimiento rechaza el archivo completo: no se repara ni se acepta parcialmente. Tamaño máximo: 120 MiB.
- Cambios futuros: se sube `version`; un lector antiguo rechaza un archivo más nuevo, y uno nuevo debe seguir leyendo la versión 1.
