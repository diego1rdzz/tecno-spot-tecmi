# Tecno-Spot

Sistema para un negocio de celulares que atiende en la cafetería de Tecmilenio: reparación, servicio técnico, garantía, venta de accesorios y de celulares de todas las gamas, compra y toma a cuenta de equipos usados, liberación, recolección y servicio a domicilio.

Son tres herramientas sobre los mismos datos:

| Herramienta | Para quién | Qué hace |
|---|---|---|
| **Sitio** (`web/sitio`) | Clientes | Paso a paso: *¿qué le pasa a tu celular?* → marca → modelo → **cotización** → **cita con turno** en la cafetería. También: accesorios, celulares a la venta, vende o cambia tu celular, a domicilio, garantía y “Mi cita y mi equipo” (consulta con folio y celular, y autorización del presupuesto). |
| **Consola** (`web/consola`) | Equipo del negocio | Turnos del día en la cafetería, citas, órdenes de servicio (recepción con checklist, diagnóstico, presupuesto, autorización, reparación, entrega con garantía, hojas para imprimir), punto de venta con toma a cuenta, compra de usados, caja con corte, clientes, garantías, inventario, precios y ajustes. |
| **Mi cuenta** (`web/portal`) | Clientes frecuentes | Sus reparaciones (y autorizar presupuestos), sus citas, sus equipos con garantía y sus compras. |

## Las reglas que no se rompen

1. Toda cotización del sitio termina en una cita con folio, fecha, hora y turno.
2. Toda orden de servicio nace con folio, datos de contacto, IMEI o número de serie y checklist de recepción.
3. No se repara sin presupuesto autorizado por el cliente; queda quién, cuándo y por qué medio.
4. Todo presupuesto y toda venta calculan utilidad y avisan debajo del margen mínimo. Costos y utilidad solo para dirección y administración.
5. Las refacciones se apartan al autorizar y se descuentan al terminar la reparación; accesorios y celulares se descuentan al vender.
6. Toda entrega cobra el saldo, genera garantía con fecha y registra el equipo del cliente con su IMEI; el código de desbloqueo se borra al entregar.
7. No se compra ni se toma a cuenta un equipo sin identificación del vendedor, IMEI sin reporte y cuentas (iCloud/Google) desvinculadas.
8. Todo lo que no se cierra captura su motivo: presupuestos no autorizados, citas canceladas y compras de usados que no se hicieron.
9. Interfaz en español y ningún dato inventado: lo no confirmado dice “por confirmar”.

## Probarlo

```bash
python3 prototipo/build.py          # arma prototipo/dist y web/
cd prototipo/dist && python3 -m http.server 8000
```

Abre `http://localhost:8000/sitio.html`, `consola.html` y `portal.html`. Trabajan en modo local con **datos de demostración** (clientes, citas, órdenes, precios y costos inventados, marcados como “demo”). Las tres comparten el almacenamiento del navegador: lo que agendas en el sitio aparece en los turnos de la consola. En la consola, “Ver como” simula cada rol y “Restablecer demostración” regresa a los datos iniciales.

## Cargar precios y catálogo

Los precios viven en archivos fáciles de llenar en Excel o Google Sheets (guardar como CSV):

- `datos/modelos.csv` — `marca,modelo,gama` (lista inicial de modelos; también se agregan en la consola).
- `datos/precios.csv` — `marca,modelo,problema,calidad,precio,tiempo,garantia_dias`. El problema es uno de: `pantalla, bateria, carga, bocina, microfono, camara, tapa, humedad, botones, software, liberacion, mantenimiento, diagnostico`. La calidad distingue opciones (por ejemplo *Original* y *Genérica*).
- `datos/productos.csv` — `categoria,nombre,marca,compatible,precio,sku,minimo`. Categorías: `fundas, micas, privacidad, hidrogel, cargadores, baterias, audio, relojes, refacciones`.
- `datos/empresa.json` — datos confirmados del negocio (WhatsApp, teléfono, horario…).

**Los costos no van en estos archivos**: el repositorio es público. Se capturan en la consola (Inventario y Precios), y solo los ven dirección y administración.

## Base de datos (Supabase)

1. Crea un proyecto en Supabase.
2. `python3 supabase/instalar.py` y pega `supabase/instalar.sql` completo en *SQL Editor › Run*. Crea tablas, reglas por rol, funciones y la lista de modelos; se puede correr varias veces. Si hay precios en los CSV, también genera `supabase/precios.sql`.
3. Copia `supabase/config.example.json` a `supabase/config.json` con la URL y la clave pública (*publishable*) del proyecto, y vuelve a correr `python3 prototipo/build.py`. Con eso `web/` deja el modo de demostración y se conecta a la base.
4. Entra a la consola, crea tu cuenta y conviértela en dirección desde el SQL Editor:
   `update perfiles set rol = 'direccion' where correo = 'tu@correo';`
   Las demás cuentas se asignan desde Consola › Accesos.

Roles: `direccion`, `administracion`, `mostrador`, `tecnico` y `cliente` (cada cuenta nueva nace `pendiente`).

## Avisos con n8n

Supabase manda a n8n cada cita nueva, presupuesto listo, equipo listo y lo demás, y a hora fija los recordatorios y el reporte del día. Pasos en [`n8n/README.md`](n8n/README.md).

## Publicar (Vercel)

El `vercel.json` de la raíz publica `web/sitio`. Para la consola y el portal crea otros dos proyectos con *Root Directory* `web/consola` y `web/portal` (Framework “Other”, sin comando de build). Pon esas direcciones en `supabase/config.json › enlaces` y vuelve a armar.

## Estructura

```
datos/                 catálogo real (modelos, precios, productos, datos del negocio)
prototipo/
  comun/nucleo.js      datos, reglas, citas y turnos, órdenes, inventario, caja, Supabase
  comun/base.css       estilos compartidos (marca provisional por confirmar)
  sitio/               sitio público (asistente paso a paso)
  consola/             consola interna, un archivo por módulo
  portal/              mi cuenta
  catalogo.py          lee datos/
  demo.py              datos de demostración
  build.py             arma prototipo/dist y web/
supabase/
  migrations/          esquema, reglas por rol y funciones; avisos para n8n
  instalar.py          genera instalar.sql (y precios.sql)
n8n/                   flujo de avisos para importar en n8n
web/                   lo que se publica
```
