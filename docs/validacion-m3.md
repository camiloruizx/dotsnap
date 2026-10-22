# Validación M3: página completa

Estado: **verificado en Chromium 141 con la variante de pruebas; el gesto real de la barra de herramientas, el zoom real del navegador y páginas reales complejas siguen siendo manuales.**

## Cómo se verificó

`npm run test:m3` (con `DOTSNAP_CHROME` apuntando a un Chromium) compila la variante de pruebas, carga la extensión y sirve páginas locales: una de 3000 px con 29 franjas de color únicas, una imagen perezosa que carga con 400 ms de retraso, un header fixed, un footer fixed y un elemento sticky; una de 20 000 px; una de 12 000 px para cancelar; una de 100 000 px; y una más corta que el viewport. Se ejecuta con DPR 1 y 2 (las partes largas, la cancelación y los límites solo con DPR 1 por duración). Evidencia: `docs/evidence/m3/` (`report.json` y PNG). Pruebas unitarias de la composición en `tests/fullpage.test.ts`.

| Comprobación                                                                                          | Resultado                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Producción sin `content_scripts` ni `host_permissions`; sin scripts registrados antes de empezar      | Correcto                                                                                                                    |
| 5 tramos en 3,4 s (DPR 1) y 4,0 s (DPR 2), con mínimo de 2,4 s: cola de 600 ms respetada              | Correcto                                                                                                                    |
| Imagen = ancho útil × alto de página (1000 × 3000), escala medida                                     | Correcto                                                                                                                    |
| 29 franjas, en el centro y pegadas a los bordes, incluidas las costuras entre tramos                  | Correcto, sin huecos ni solapes                                                                                             |
| Imagen perezosa con carga retrasada                                                                   | Aparece cargada, no su marcador                                                                                             |
| Header fixed, footer fixed y sticky                                                                   | Una sola vez (primer tramo); no se repiten                                                                                  |
| Restauración tras terminar: scroll (250), visibilidad, atributo `style` idéntico, sin estado ni badge | Correcto                                                                                                                    |
| Página más corta que el viewport                                                                      | Un solo tramo                                                                                                               |
| Página de 100 000 px                                                                                  | Rechazada antes de capturar (`tooLarge`), scroll intacto, aviso en el icono, candado liberado                               |
| Progreso en el icono y capturas concurrentes durante la operación                                     | `busy` para visible y para otra página completa                                                                             |
| Escape durante la captura                                                                             | Cancela: sin editor, scroll y estilos restaurados, sin estado ni badge                                                      |
| Navegar durante la captura                                                                            | Aborta con aviso, sin estado ni editor                                                                                      |
| 20 000 px                                                                                             | 3 partes numeradas (8192 + 8192 + 3616), cada una dentro del presupuesto; costuras exactas y una fila de cada 37 comprobada |
| `chrome://`                                                                                           | `restricted`, sin estado                                                                                                    |
| `fullpage-cancel` desde la UI de extensión                                                            | Ignorado                                                                                                                    |
| Consola                                                                                               | 0 errores                                                                                                                   |

## Límites declarados

- **Solo se desplaza el documento.** Las páginas cuyo contenido está en un contenedor con scroll propio (aplicaciones con paneles) se capturan como el área visible; los contenedores con desplazamiento interno son C-07 (V1.1).
- **Fixed y sticky aparecen una vez, en el primer tramo**, donde el usuario los ve al iniciar (un footer fixed queda en la parte baja del primer tramo, no al final de la página).
- **Contenido que cambia durante la captura** (carrusel, vídeo, animaciones, scroll infinito): se captura lo que haya al pasar por cada tramo; la altura se mide una vez al inicio y el contenido añadido después se ignora. Si la página se acorta, la última parte se recorta a lo escrito.
- **Scroll horizontal:** no se recorre; se captura el ancho visible sin la barra de desplazamiento vertical.
- **Tope de producto:** 120 tramos y 12 partes (≈ 84 s). Por encima se rechaza antes de empezar; no se trunca en silencio.
- **Sin progreso en una ventana:** el popup se cierra al empezar; el avance se ve en el badge del icono (`3/8`) y el fallo como `!` con título explicativo durante 10 s.
- **DPR 2 emulado no escala el bitmap** en este Chromium (escala medida 1); la composición con escalas 1,25, 1,5 y 2 se cubre con pruebas unitarias fila por fila.
- **Reintentos por cuota** (hasta 3, espera creciente) implementados como defensa; no se han ejercitado contra una cuota real.
- **Pestañas en segundo plano o minimizadas:** `captureVisibleTab` necesita la pestaña activa y visible; si el usuario cambia de pestaña la operación se aborta (`tabChanged`).

## Comprobación manual pendiente (Chrome real, `chrome://extensions` → cargar descomprimida)

1. Abre una página larga real (un artículo) y elige **Página completa**: el icono muestra `n/N` y al terminar se abre el editor con la página entera.
2. Comprueba una página con cabecera fija, una con imágenes que cargan al desplazar y una con vídeo incrustado.
3. Con zoom del navegador al 125 %, 150 % y 200 % y, si tienes, en una pantalla de alta densidad: sin costuras visibles.
4. Pulsa Escape a mitad: la página debe volver exactamente a su posición y aspecto.
5. Una página muy larga (varios miles de píxeles de alto): debe abrir varias pestañas "Parte n de N".
6. Una página `chrome://` o la tienda: debe mostrar el error de página restringida.

## Fallo "!" en Chrome real (0.4.1)

En la primera prueba manual la captura de página completa terminó con el icono en «!». No se reprodujo en Chromium automatizado; desde 0.4.1 el popup muestra la causa y un detalle técnico (`ready-timeout`, `send:fp-scroll:…`, `grab`, etc.) para localizar el punto exacto.
