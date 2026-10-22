# Avisos con n8n

Supabase manda cada aviso a n8n en el momento en que pasa. n8n solo redacta el mensaje y lo envía por el canal que elijas. n8n no necesita ninguna clave de Supabase.

| Aviso | Cuándo | A quién |
|---|---|---|
| `cita_nueva` | El cliente agenda en el sitio o el portal, o mostrador agenda una cita | Negocio (con lo que cotizó) y cliente (confirmación con folio y turno) |
| `cita_reprogramada` | Cambia la fecha u hora de una cita | Negocio y cliente |
| `cita_cancelada` | Se cancela una cita | Negocio |
| `presupuesto_listo` | La orden pasa a “Esperando autorización” | Cliente (diagnóstico, total y enlace para autorizar) |
| `presupuesto_autorizado` / `presupuesto_rechazado` | El cliente responde | Negocio |
| `equipo_listo` | Reparación terminada | Cliente (con saldo) |
| `equipo_entregado` | Entrega con garantía | Cliente (hasta cuándo cubre la garantía) |
| `recordatorios` | Todos los días a las 19:00 | Cada cliente con cita al día siguiente |
| `reporte_diario` | Todos los días a las 21:00 | Dirección: citas, taller, caja y ventas |

Todo aviso queda además en la tabla `avisos` de Supabase (solo dirección y administración la ven).

## Pasos

1. **Supabase.** Después de `instalar.sql`, corre `supabase/migrations/0002_avisos_n8n.sql` en *SQL Editor*. Al terminar muestra el **secreto**. También lo puedes consultar después con `select secreto from privado.n8n;`.
2. **n8n.** *Import from file* → `n8n/tecno-spot-avisos.json`.
3. Abre el nodo **Revisar y redactar** y pega:
   - el secreto en `SECRETO`;
   - la dirección del sitio en `SITIO`, cuando ya esté publicado.
4. Cambia los tres nodos grises por tus canales:
   - **Aviso al negocio**: por ejemplo Telegram *Send Message* o WhatsApp al número del negocio. El texto va en `{{ $json.texto }}`.
   - **Mensaje al cliente**: WhatsApp al número `{{ $json.whatsapp }}` (ya lleva el 52) con el texto `{{ $json.texto }}`.
   - **Reporte a dirección**: por ejemplo Gmail *Send*, con el asunto “Reporte Tecno-Spot” y el cuerpo `{{ $json.texto }}`.
5. Activa el flujo y copia la *Production URL* del nodo **Avisos de Supabase**. En Supabase:
   ```sql
   update privado.n8n set url = 'https://…/webhook/tecno-spot';
   select privado.avisar('prueba', '{"texto": "Hola desde Tecno-Spot"}');
   ```
   El segundo comando manda un aviso de prueba: debe aparecer en *Executions* de n8n y llegar por el canal del negocio.

## Antes de mandar WhatsApp a clientes

WhatsApp solo deja que un negocio escriba primero con **plantillas aprobadas por Meta** (WhatsApp Business Platform), y un número de WhatsApp Business conectado a n8n. Falta confirmar:
- el proveedor: WhatsApp Cloud API directo o un servicio intermedio;
- el número del negocio;
- la aprobación de una plantilla por cada mensaje al cliente (confirmación de cita, recordatorio, presupuesto, equipo listo y garantía).

Mientras no esté, deja **Mensaje al cliente** desactivado y usa los avisos al negocio y el reporte.

## Cambiar textos y horarios

- Los textos están en `n8n/redactar.js`. Después de cambiarlos, `python3 n8n/armar.py` vuelve a armar el flujo; luego se importa otra vez o se pega el código en el nodo.
- Los horarios de los recordatorios y del reporte están al final de `0002_avisos_n8n.sql` (`cron.schedule`, en hora UTC: Monterrey es UTC−6).
