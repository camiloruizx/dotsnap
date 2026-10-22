# Publicación en la Chrome Web Store

Estado al cerrar 1.0.0 + M6 (preparación). Lo marcado con 👤 lo hace Camilo; el resto está en el repositorio.

## Listo

- [x] Licencia MIT (`LICENSE`, `package.json`, README).
- [x] Política de privacidad bilingüe (`PRIVACY.md`).
- [x] Icono definitivo: se conserva el actual (`assets/dotsnap-icon.svg`, 16/32/48/128).
- [x] Textos de la ficha, justificación de permisos y respuestas de privacidad (`store/ficha.md`).
- [x] Capturas 1280×800 y mosaicos en ES y EN (`store/screenshots`, `npm run store:assets`).
- [x] Zip de producción: `npm run zip` → `.output/dotsnap-1.0.0-chrome.zip` (permisos solo `activeTab`, `scripting`, `storage`; sin host_permissions ni content_scripts estáticos).

## Pasos 👤

1. Crear la cuenta de desarrollador de Chrome Web Store (pago único de registro) en https://chrome.google.com/webstore/devconsole.
2. Subir `dotsnap-1.0.0-chrome.zip` como elemento nuevo.
3. Ficha: pegar textos de `store/ficha.md`, subir icono, capturas y mosaico; categoría Productividad; idiomas ES (predeterminado) y EN.
4. Prácticas de privacidad: propósito único, justificación de permisos, «no recopila datos» y la URL de `PRIVACY.md` (la rama `main` debe ser pública o publicar la política en una página propia, por ejemplo en acrocode.dev).
5. Distribución: pública o no listada la primera vez (recomendado no listada para probar el flujo de revisión).
6. Enviar a revisión. Los permisos `activeTab` + `scripting` suelen pasar revisión rápida; se pide justificación de cada uno (ya redactada).

## Pendiente / riesgos conocidos

- **Repositorio privado:** el enlace a `PRIVACY.md` solo funciona si el repositorio es público; si sigue privado, alojar la política en acrocode.dev.
- **Pruebas por versión de Chrome:** se probó con Chromium 141 (variante de pruebas). Falta probar en Chrome estable instalado desde el zip de producción: atajos reales, incógnito, portapapeles, página completa a tu escala de pantalla.
- **Funciones aplazadas:** lupa, dibujo libre, recorte, rotación, importación de imágenes (ver `docs/matriz-de-funciones.md`).
- **Marca:** revisión de nombre comercial (comprobar que «DotSnap» está libre en la tienda) y legibilidad del icono en la tienda.
