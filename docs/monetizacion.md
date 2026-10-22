# Diseño técnico: versión Pro con licencia sin conexión

Estado: **descartada por ahora (2026-10-22): DotSnap se queda gratis y MIT**. Se conserva como referencia por si se retoma. Nada de esto está implementado. Resuelve cómo cobrar por historial, proyectos y exportación avanzada sin romper la promesa de DotSnap («todo local, sin cuentas, sin red»). No es asesoría legal ni fiscal.

## 1. Principios

1. **La extensión no usa la red para licenciar.** Se mantiene `connect-src 'none'`, sin permisos nuevos y sin cuentas.
2. **La licencia es una clave firmada** que la extensión verifica sola con una clave pública incluida en el código.
3. **Lo básico sigue gratis** (capturar, anotar, descargar PNG) y nunca se retiene como rehén lo que el usuario ya creó (ver §6).
4. **Cobrar es un proceso aparte de la extensión**: una página de compra, un correo con la clave y, opcionalmente, un servicio tuyo que la firma. La extensión nunca habla con él.

## 2. Reparto propuesto Gratis / Pro

| Función                                                             | Gratis                        | Pro |
| ------------------------------------------------------------------- | ----------------------------- | --- |
| Captura visible, región, elemento, página completa, temporizador    | Sí                            | Sí  |
| Todas las herramientas de anotación y censura                       | Sí                            | Sí  |
| Descargar y copiar PNG                                              | Sí                            | Sí  |
| Historial de capturas (búsqueda, renombrar, retención de 7/30 días) | No (solo la captura en curso) | Sí  |
| Proyectos `.dotsnap.json` (guardar y abrir)                         | No                            | Sí  |
| Exportar JPEG, WebP, PDF, escala y peso objetivo                    | No                            | Sí  |
| Funciones nuevas de la hoja de ruta (presets, lotes, OCR…)          | Se decide una a una           | Sí  |

Es una propuesta: lo importante es que el candado se pueda cambiar editando una sola tabla (`src/shared/license/features.ts`).

## 3. Formato de la clave

Una cadena de texto copiable:

```
DSNP1.<payload en base64url>.<firma en base64url>
```

- **Payload** (JSON UTF-8): `{ "v": 1, "id": "<uuid>", "plan": "pro", "issued": "2026-11-01", "expires": null, "holder": "J. Pérez" }`.
  - `expires` es `null` para pago único; una fecha ISO para suscripción o prueba.
  - `holder` es opcional y solo se muestra en Configurar. No se guarda el correo completo.
- **Firma:** ECDSA P-256 con SHA-256 (WebCrypto `crypto.subtle`, disponible en todas las versiones de Chrome compatibles). Ed25519 sería más corto, pero solo existe en versiones recientes de Chrome.
- **Clave pública:** constante en `src/shared/license/publicKey.ts` (formato JWK). La **clave privada** vive solo en tu equipo (o en el secreto de un servicio de firma) y nunca entra en el repositorio ni en el zip.
- **Verificación:** separar en tres partes, comprobar el prefijo y `v`, decodificar, verificar la firma sobre `DSNP1.<payload>`, validar esquema estricto (mismo estilo que `parseAnnotations`) y comparar `expires` con la fecha actual.

## 4. Dónde vive en la extensión

- `src/shared/license/verify.ts`: `verifyLicense(key, now): { ok: true, license } | { ok: false, reason }` (razones: `format`, `signature`, `expired`, `unsupported`).
- `src/shared/license/features.ts`: tabla de funciones y `isAllowed(feature, license)`.
- `src/shared/license/storage.ts`: la clave se guarda en `chrome.storage.local` (`license.v1`) y se re-verifica al cargar. No se confía en un campo «es pro» guardado: siempre se verifica la firma.
- Interfaz: en **Configurar**, un campo «Clave de licencia» con estado (activa, caduca el…, inválida) y botón «Obtener Pro» que abre la página de compra con `chrome.tabs.create` (no requiere permisos). Las funciones Pro muestran un candado y un aviso breve con ese botón; nunca bloquean la ventana ni piden la clave a mitad de una tarea.
- Los avisos y textos nuevos entran en `es.json` y `en.json`; el test de paridad ya los exige.

## 5. Cobro y entrega de la clave

1. **Pasarela:** Lemon Squeezy o Paddle (comerciante de registro: gestionan impuestos en el extranjero) o Stripe (más control, más trabajo fiscal). Producto: «DotSnap Pro», pago único.
2. **Página de compra** en acrocode.dev (o la página del producto de la pasarela) con descripción, precio, política de reembolso y enlace a `PRIVACY.md`.
3. **Entrega:** al confirmar el pago, el webhook de la pasarela llama a un servicio tuyo que firma la clave con la clave privada y la envía por correo. Para empezar con pocas ventas se puede hacer a mano con `scripts/license-sign.mjs`, que se ejecuta en tu equipo y **no se publica en el repositorio ni en el zip**. Más adelante se automatiza con una función serverless (por ejemplo Cloudflare Workers) que guarda la clave privada como secreto.
4. **La extensión nunca contacta a ese servicio.** Para el usuario, la clave llega por correo y la pega en Configurar.
5. **Soporte:** reenviar la clave (se puede regenerar con el mismo `id`), y una lista de claves revocadas **solo si hace falta** (ver límites).

## 6. Qué pasa sin licencia o al caducar

- Lo creado no se pierde: el historial y los proyectos ya guardados se pueden **abrir y exportar a PNG**, pero no se pueden crear nuevos ni usar los formatos Pro.
- Si caduca una suscripción, un aviso en Configurar lo explica sin interrumpir el trabajo.
- Nunca se borra nada por falta de licencia.

## 7. Límites que hay que aceptar

- **Compartir claves:** sin servidor no se puede limitar dispositivos. Se puede reducir con una clave por compra y `holder` visible, pero no impedir.
- **Revocación:** una clave firmada vale hasta que caduque. Si hubiera abuso grave, la única vía sin red es una lista de claves revocadas incluida en la siguiente actualización de la extensión.
- **Alteración local:** el código corre en el equipo del usuario, así que alguien podría modificar su copia. Es un disuasivo, no un DRM; no vale la pena complicarlo.
- **Licencia del código:** hoy el repositorio es MIT. Las versiones ya publicadas bajo MIT seguirán siéndolo. Para cobrar hay que decidir antes (ver §9).

## 8. Privacidad, tienda y pruebas

- **`PRIVACY.md`:** añadir que la clave de licencia se guarda localmente, se verifica sin conexión y no se envía a ningún sitio. La parte de compra ocurre en el sitio de la pasarela, con su propia política.
- **Ficha de la tienda:** declarar las funciones de pago y el precio; permisos y política de seguridad **sin cambios**.
- **Pruebas unitarias:** firmar/verificar con un par de claves de prueba; rechazar firma alterada, payload alterado, prefijo o versión desconocida, clave caducada, campos extra; fecha límite exacta.
- **Pruebas de navegador:** sin clave, Historial, proyectos y formatos Pro aparecen con candado y no abren; con una clave de prueba válida se desbloquean; clave inválida muestra el error sin romper la interfaz; lo ya guardado sigue abriéndose al caducar.
- La clave pública de las pruebas es distinta de la de producción y se inyecta solo en la variante de pruebas.

## 9. Decisiones que necesita Camilo

1. **Modelo y licencia del código:** (a) núcleo abierto (MIT) + módulos Pro en un repositorio privado; (b) código visible con licencia que restrinja el uso comercial; (c) todo propietario. Hay que decidirlo antes de implementar, porque cambia la estructura del repositorio.
2. **Reparto Gratis/Pro** de la tabla del §2, sobre todo si el historial y los proyectos deben ser Pro desde el primer lanzamiento.
3. **Precio y tipo:** pago único (recomendado) o suscripción; si habrá prueba gratuita.
4. **Pasarela y fiscal:** cuál usar y cómo facturar desde México (consultar con contador).
5. **Momento:** antes de la primera publicación (lo más limpio) o como versión posterior.

## 10. Plan de trabajo (cuando se decida)

1. Decidir §9 y actualizar licencia/README.
2. Módulo `license` con verificación, tabla de funciones, script de firma y pruebas unitarias.
3. Candados en Historial, Proyectos y Exportación, y campo de licencia en Configurar, con ES/EN.
4. Página de compra, entrega de claves y política de reembolso.
5. Actualizar `PRIVACY.md`, ficha y capturas; pruebas de navegador.
6. Publicar como versión menor nueva (por ejemplo 1.1 o 1.2 según el calendario de `docs/hoja-de-ruta.md`).
