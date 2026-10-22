# Hoja de ruta de DotSnap después de 1.0

Plan de mejoras para liberar **una versión pequeña por mes**, de menor a mayor riesgo. Los identificadores (E-02, C-06…) son los de `docs/matriz-de-funciones.md`. Es una propuesta: el orden se puede cambiar según lo que pidan los usuarios y lo que diga la revisión de la tienda.

Reglas de cada versión: una sola mejora principal, pruebas unitarias y de navegador nuevas, CHANGELOG, sin permisos nuevos salvo que se justifique en la ficha, y publicación primero como «No listada» si añade permisos.

## Antes de la primera publicación (fin de octubre)

- Pruebas manuales en Chrome real: atajos, incógnito, portapapeles, proyectos, página completa a tu escala.
- Crear la cuenta de desarrollador y subir `dotsnap-1.0.1-chrome.zip` (ver `docs/publicacion.md`).
- **1.0.x**: solo correcciones de lo que aparezca en esas pruebas o en la revisión de la tienda.

## Noviembre 2026 — 1.1: más herramientas de dibujo

- **Dibujo libre** (lápiz) con grosor y color.
- **Globos de texto** (texto dentro de una burbuja con cola) — E-02.
- Colores recientes y **gotero** para tomar un color de la imagen.
- Duplicar (Ctrl+D) y traer al frente / enviar al fondo — E-05.

## Diciembre 2026 — 1.2: editar la imagen

- **Recortar** con proporciones predefinidas — E-04.
- **Rotar 90°** y voltear.
- **Zoom y desplazamiento** del lienzo (rueda, Ctrl+0 para ajustar) — E-05.
- Redimensionar la imagen manteniendo la proporción.

## Enero 2027 — 1.3: entrada de imágenes

- **Importar** una imagen: selector, arrastrar y soltar y pegar desde el portapapeles — C-06.
- **Insertar una imagen** dentro de otra como anotación — E-03.
- Guardar directamente sin abrir el editor (opción en Configurar) — U-02.

## Febrero 2027 — 1.4: presentación y repetición

- **Fondo, margen, borde y sombra** para presentar la captura — E-06.
- **Presets de anotación** (guardar color, grosor y fuente favoritos) — P-04.
- **Multiselección** y alinear/distribuir — E-05.

## Marzo 2027 — 1.5: capturas más difíciles

- **Contenedores con desplazamiento interno** en la captura completa — C-07 / P-01.
- Elementos fijos o pegajosos (cabeceras) solo en el primer segmento, sin repetirse.
- **Lupa** al elegir la región (vista ampliada junto al cursor).
- Mejor aviso cuando una página no se puede capturar y cómo repetirla.

## Abril 2027 — 1.6: flujo de trabajo

- **Onboarding** breve con una página de práctica — U-03.
- **Proyectos reutilizables** (plantillas de anotaciones sobre otra captura) — P-02.
- **Exportación por lotes** de varias capturas del historial — P-03.
- Plantillas de nombre con más variables (título de la página, dominio).

## Mayo 2027 — 1.7: calidad y accesibilidad

- Auditoría de accesibilidad (teclado completo en el editor, lector de pantalla, alto contraste).
- Más idiomas de interfaz (portugués y francés como primeros candidatos).
- Pruebas por versión de Chrome (estable y las dos anteriores) y rendimiento con capturas muy largas.
- Revisión de tamaño y arranque de la extensión.

## Junio 2027 y después — 2.0: ideas mayores (cada una necesita su propia decisión)

- **OCR local** y búsqueda por texto dentro del historial — P-05 (requiere un modelo local; evaluar peso y permisos).
- **Comparación visual** de dos capturas y **marcas de agua** — P-06.
- Captura de **pantalla o ventana del sistema** — C-08 (permisos adicionales; solo si hay demanda).
- **Sincronización opcional** y colaboración — P-07 (rompería la promesa «todo local»; solo como opción explícita y con nueva política de privacidad).
- Versión para Edge y Firefox.

## Qué no se hará sin decisión expresa

- Cualquier conexión de red, analítica o cuenta obligatoria: contradice la política de privacidad actual.
- Pedir permisos de sitios (`host_permissions`) para toda la web.
