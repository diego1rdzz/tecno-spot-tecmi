# Tecno-Spot — memoria del proyecto

Léelo completo antes de trabajar. Resume lo acordado y lo construido para retomar sin perder datos.

## Quién y qué

- Negocio: **Tecno-Spot**, sucursal **Tecmilenio**. Atiende en la **cafetería de Tecmilenio**: ahí el cliente tiene su turno para dudas, para dejar su equipo a reparar o para recogerlo. Es un negocio real; el sistema es para operarlo.
- Giro: reparación de celulares (pantalla, batería, carga, bocinas, micrófono, cámara, tapa, humedad, botones, software, diagnóstico), garantía, servicio técnico, venta de equipos de todas las gamas, accesorios (fundas, micas de vidrio, de privacidad, hidrogel, cargadores, baterías portátiles, AirPods, Apple Watch), compra y venta de usados, toma a cuenta, liberación, recolección y servicio a domicilio, entrega final al cliente.
- Se trabaja en español. Se avanza paso a paso y se pregunta antes de decisiones grandes.
- Mismo esquema que el proyecto RR Médica (repo `diego1rdzz/rrmedicatodo`): núcleo común + sitio, portal y consola, modo local y Supabase.
- Repositorio público `diego1rdzz/tecno-spot-tecmi`, rama de trabajo `claude/phone-repair-system-fz9up4`. Por ser público, **nunca** se suben costos, datos de clientes ni claves secretas (la clave *publishable* de Supabase sí puede ir).

## Lo que pidió el usuario (22/10/2026)

- Sitio **muy didáctico**: “¿cuál es el problema de tu celular?” con opciones → marca → modelo → cotización → **cita** → ese día, turno en la cafetería.
- Primero la **estructura limpia**; los precios y el catálogo los irá pasando después. Mientras, todo precio dice “por confirmar”.

## Reglas que no se rompen

1. Toda cotización del sitio termina en una cita con folio, fecha, hora y turno.
2. Toda orden de servicio nace con folio, contacto, IMEI o serie y checklist de recepción.
3. No se repara sin presupuesto autorizado por el cliente (quién, cuándo, medio).
4. Presupuestos y ventas calculan utilidad y avisan debajo del margen mínimo; costos y utilidad solo dirección y administración.
5. Refacciones se apartan al autorizar y se descuentan al terminar; accesorios y celulares al vender.
6. Toda entrega cobra el saldo, genera garantía con fecha y registra el equipo del cliente con su IMEI; el código de desbloqueo se borra al entregar.
7. No se compra ni se toma a cuenta sin identificación, IMEI sin reporte y cuentas desvinculadas.
8. Todo lo que no se cierra captura su motivo (presupuesto no autorizado, cita cancelada, compra no cerrada).
9. Español y ningún dato inventado: lo no confirmado dice “por confirmar”.

## Lo construido

- `prototipo/comun/nucleo.js`: colecciones `config, modelos, tarifas, productos, costos, existencias, equipos, clientes, citas, ordenes, ventas, compras, movimientos` (+ `perfiles` en Supabase). Citas y turnos (horario, cupo por horario, turno consecutivo por día), órdenes (autorizar, apartar, descontar, entregar, reclamo de garantía), ventas, compras, caja, garantías, vistas públicas para consulta con folio y celular, vista resumida de la cuenta del cliente. Modo local (localStorage, con datos de demostración que se recorren a la fecha de hoy) o Supabase si existe `window.TS_SUPABASE`.
- `prototipo/sitio/app.js`: asistente con flujos `reparar` (problema → marca → modelo → cotización → cita → turno), `vender` (marca → modelo → estado → cita) y `cita` (motivo → cita); vistas Accesorios, Celulares, Vende o cambia, A domicilio, Garantía y Mi cita y mi equipo (`?folio=` abre la consulta). Archivo .ics para el calendario.
- `prototipo/consola/*.js` (un archivo por módulo, `z-registro.js` al final): Hoy en la cafetería, Citas, Órdenes de servicio, Punto de venta, Compra y toma a cuenta, Caja, Clientes, Garantías, Inventario, Precios y catálogo, Ajustes (solo dirección), Accesos (Supabase, solo dirección). Roles: dirección, administración, mostrador, técnico.
- `prototipo/portal/app.js`: Mis reparaciones (autoriza presupuesto), Mis citas (agenda y cancela), Mis equipos, Mis compras.
- `datos/`: `modelos.csv` (119 modelos reales de Apple, Samsung, Motorola, Xiaomi, Huawei, Honor, OPPO, Realme y ZTE con gama), `precios.csv` y `productos.csv` vacíos (solo encabezado), `empresa.json` (nombre, sucursal y lugar confirmados).
- `prototipo/demo.py`: datos de demostración (precios, costos y clientes inventados, marcados “demo”). Nunca entran a Supabase.
- `prototipo/build.py` arma `prototipo/dist/{sitio,portal,consola}.html` y `web/{sitio,portal,consola}/index.html`; con una carpeta como argumento, `sistema-tecno-spot.html` (las tres en una página con `#sitio`, `#portal`, `#consola`).
- `supabase/migrations/0001_esquema_y_reglas.sql` + `supabase/instalar.py` → `instalar.sql` (esquema, RLS, funciones `ts_tienda`, `ts_horarios`, `ts_agendar`, `ts_consulta`, `ts_autorizar`, `ts_cancelar_cita`, `ts_mi_cuenta`, ajustes y modelos; sin demo). Probado dos veces seguidas en Postgres 16 local con cada rol: anónimo solo agenda y consulta, técnico no vende, mostrador no ve costos (el costo de un usado lo pone un trigger), cliente solo su cuenta resumida.

## Demostraciones publicadas en Claude (privadas)

Cada herramienta tiene su propia página para modificarla por separado (pedido del usuario, 22/10/2026):

- Sitio: https://claude.ai/artifact/DnCk7TibsiujKAruQbs5Ua
- Consola: https://claude.ai/artifact/Dedpm8mCCZCQvzEvmYu59x
- Portal: https://claude.ai/artifact/4AkNYtn5TUQPKrDDwWM3Wg
- Las tres juntas (`#sitio`, `#consola`, `#portal`): https://claude.ai/artifact/EgT4y3M1qPTh478J97j7d6

Las direcciones están en `prototipo/artifacts.json`. `python3 prototipo/build.py <carpeta>` arma `tecno-spot-{sitio,consola,portal}.html` y `sistema-tecno-spot.html`; para actualizar una, se vuelve a publicar ese archivo con su dirección. Cada página separada guarda sus datos de ejemplo en el navegador de quien la abre, así que lo que se agenda en el sitio separado no aparece en la consola separada; la versión conectada de verdad es la de Vercel con Supabase. Llevan `window.TS_ARTIFACT` (sin imprimir ni descargar, porque el visor no lo permite). En vez de `confirm()`/`prompt()` se usa `T.confirmar()` (diálogo dentro de la página).

## Pendientes de confirmar con el negocio

- Precios de reparación por modelo, tiempos y garantías por servicio y por equipo nuevo/seminuevo.
- Catálogo de accesorios y celulares con precios; costos (se capturan en la consola, no en el repo).
- Horario de citas (inicial: lunes a viernes 9:00–15:00, cada 30 min, 2 clientes por horario), margen mínimo (inicial 30%), precio del diagnóstico.
- WhatsApp, teléfono, correo, dirección, horario, aviso de privacidad, términos de recepción y de garantía.
- Si hay servicio a domicilio: costo y zona.
- Colores y logotipo: los actuales (azul noche, verde azulado y amarillo “spot”) son provisionales.
- Nombres del personal (técnicos y mostrador).
- Proyecto de Supabase y proyectos de Vercel (todavía no existen).
