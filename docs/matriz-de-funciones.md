# Matriz de funciones

«Implementado» significa presente en código; «probado» exige evidencia ejecutada. Cada fila conserva ambos campos para no equipararlos. Probado (alcance en validacion-m0.md) para alcance real de pruebas.

| Versión / hito         | Función                                                                          | Implementación       | Pruebas                                            |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| Base M0                | Scaffold WXT/React/TS, MV3 y empaquetado                                         | Implementado         | Probado (alcance en validacion-m0.md)              |
| Base M0                | Popup con 4 modos, Ajustes/Historial disabled                                    | Implementado         | Probado (alcance en validacion-m0.md)              |
| Base M0                | Preferencias locales idioma/tema                                                 | Implementado         | Probado (alcance en validacion-m0.md)              |
| Base M0                | ES/EN, tema claro/oscuro/Sistema, tokens                                         | Implementado         | Probado (alcance en validacion-m0.md)              |
| Base M0                | Icono provisional original SVG/PNG                                               | Implementado         | Probado (alcance en validacion-m0.md)              |
| Base M0                | Validación de mensaje health y remitente                                         | Implementado         | Probado: unitaria e integración (validacion-m0.md) |
| Base M0                | Geometría pura CSS → píxeles                                                     | Implementado         | Probado en Vitest; no captura                      |
| V1 / M1                | Captura visible, editor flecha/rectángulo/texto/censura segura, PNG              | Pendiente            | Pendiente                                          |
| V1 / M2                | Región y selección de elemento inteligente                                       | Pendiente            | Pendiente                                          |
| V1 / M3                | Página completa por segmentos                                                    | Pendiente            | Pendiente                                          |
| V1.1 / M4              | JPEG/WebP/PDF y control de peso real                                             | Pendiente            | Pendiente                                          |
| V1.1 / M5              | Historial local, ajustes completos y atajos                                      | Pendiente            | Pendiente                                          |
| V1.1 / M6              | Paquete de tienda, manual, auditoría y matriz navegadores                        | Pendiente            | Pendiente                                          |
| V2 / sin hito aprobado | Proyectos editables importables/exportables; mejoras de selección/multiselección | Pendiente, propuesta | Pendiente                                          |

V2 no añade propósito nuevo ni sincronización/nube. Publicación incremental de V1 posible tras controles de M6 para su alcance, sin anunciar funciones de V1.1/V2 como disponibles.
