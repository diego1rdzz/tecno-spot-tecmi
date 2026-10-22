-- Tecno-Spot · avisos para n8n.
-- Cada evento importante (cita nueva, presupuesto listo, equipo listo…) queda registrado en
-- public.avisos y se manda al webhook de n8n. A hora fija, Supabase también manda los
-- recordatorios de las citas de mañana y el reporte del día. n8n no necesita ninguna clave
-- de Supabase: solo recibe. Correr después de instalar.sql. Se puede correr varias veces.

create extension if not exists pg_net;    -- peticiones HTTP desde la base (viene en Supabase)
create extension if not exists pg_cron;   -- tareas programadas (viene en Supabase)

create table if not exists public.avisos (
  id        bigint generated always as identity primary key,
  evento    text not null,
  datos     jsonb not null,
  creado    timestamptz not null default now(),
  solicitud bigint            -- id de la petición en pg_net cuando se mandó a n8n
);
alter table public.avisos enable row level security;
drop policy if exists avisos_ver on public.avisos;
create policy avisos_ver on public.avisos for select to authenticated using ((select privado.admin()));
create index if not exists avisos_creado on public.avisos (creado desc);

-- Dirección del webhook de n8n y secreto compartido: viven en la base, nunca en el repositorio.
create table if not exists privado.n8n (
  id      int primary key default 1 check (id = 1),
  url     text,
  secreto text not null default replace(gen_random_uuid()::text, '-', '')
);
insert into privado.n8n (id) values (1) on conflict (id) do nothing;
revoke all on privado.n8n from public, anon, authenticated;

-- Registra el aviso y, si ya hay webhook, lo manda. Si n8n falla, la operación del cliente no se cae.
create or replace function privado.avisar(evento text, datos jsonb) returns void
language plpgsql security definer set search_path = public as
$$
declare w record; aid bigint; req bigint;
begin
  insert into public.avisos(evento, datos) values (evento, datos) returning id into aid;
  select url, secreto into w from privado.n8n where id = 1;
  if coalesce(w.url, '') <> '' then
    begin
      select net.http_post(url := w.url,
        body := jsonb_build_object('id', aid, 'evento', evento, 'negocio', 'Tecno-Spot', 'datos', datos),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-tecno-spot', w.secreto)) into req;
      update public.avisos set solicitud = req where id = aid;
    exception when others then
      raise warning 'No se pudo mandar el aviso % a n8n: %', aid, sqlerrm;
    end;
  end if;
end
$$;

create or replace function privado.contacto_orden(o jsonb) returns jsonb
language sql stable security definer set search_path = public as
$$ select jsonb_build_object('nombre', coalesce(c.data->>'nombre', ''), 'tel', coalesce(c.data->>'tel', ''))
   from (select 1) uno left join public.clientes c on c.id = o->>'clienteId' $$;

-- Citas: nueva, reprogramada y cancelada.
create or replace function privado.aviso_cita() returns trigger
language plpgsql security definer set search_path = public as
$$
declare d jsonb;
begin
  d := jsonb_build_object('folio', new.data->>'folio', 'fecha', new.data->>'fecha', 'hora', new.data->>'hora', 'turno', (new.data->>'turno')::int,
    'motivo', new.data->>'motivo', 'modalidad', new.data->>'modalidad', 'lugar', new.data->>'lugar', 'direccion', new.data->>'direccion',
    'nombre', new.data->'contacto'->>'nombre', 'tel', privado.tel_de(new.data->>'clienteId', new.data->'contacto'),
    'tecmi', coalesce(new.data->'contacto'->'tecmi', 'false'::jsonb), 'origen', new.data->>'origen', 'nota', new.data->>'nota', 'cotizacion', new.data->'cotizacion');
  if tg_op = 'INSERT' then
    perform privado.avisar('cita_nueva', d);
  elsif new.data->>'estado' = 'cancelada' and old.data->>'estado' is distinct from 'cancelada' then
    perform privado.avisar('cita_cancelada', d || jsonb_build_object('motivo_cancelacion', new.data->'cierre'->>'motivo'));
  elsif new.data->>'estado' = 'agendada' and (new.data->>'fecha', new.data->>'hora') is distinct from (old.data->>'fecha', old.data->>'hora') then
    perform privado.avisar('cita_reprogramada', d || jsonb_build_object('antes', (old.data->>'fecha') || ' ' || (old.data->>'hora')));
  end if;
  return null;
end
$$;
drop trigger if exists ts_aviso_cita on public.citas;
create trigger ts_aviso_cita after insert or update on public.citas for each row execute function privado.aviso_cita();

-- Órdenes: presupuesto listo, autorizado o no, equipo listo y entregado.
create or replace function privado.aviso_orden() returns trigger
language plpgsql security definer set search_path = public as
$$
declare antes text := old.data->>'estado'; ahora text := new.data->>'estado'; ev text; v jsonb;
begin
  if antes is not distinct from ahora then return null; end if;
  ev := case
    when ahora = 'presupuesto' then 'presupuesto_listo'
    when antes = 'presupuesto' and ahora in ('autorizado','espera') then 'presupuesto_autorizado'
    when ahora = 'rechazado' then 'presupuesto_rechazado'
    when ahora = 'listo' then 'equipo_listo'
    when ahora = 'entregado' then 'equipo_entregado'
  end;
  if ev is null then return null; end if;
  v := privado.vista_orden(new.data) - 'historial';
  perform privado.avisar(ev, v || privado.contacto_orden(new.data) || jsonb_build_object(
    'saldo', greatest(0, coalesce((v->>'total')::numeric, 0) - coalesce((v->>'pagado')::numeric, 0)),
    'motivo_rechazo', new.data->'autorizacion'->>'motivo', 'medio', new.data->'autorizacion'->>'medio'));
  return null;
end
$$;
drop trigger if exists ts_aviso_orden on public.ordenes;
create trigger ts_aviso_orden after update on public.ordenes for each row execute function privado.aviso_orden();

-- Recordatorios: las citas agendadas de un día, con su celular.
create or replace function privado.recordatorios(dia date) returns void
language plpgsql security definer set search_path = public as
$$
declare lista jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('folio', c.data->>'folio', 'hora', c.data->>'hora', 'turno', (c.data->>'turno')::int,
           'motivo', c.data->>'motivo', 'modalidad', c.data->>'modalidad', 'lugar', c.data->>'lugar',
           'nombre', c.data->'contacto'->>'nombre', 'tel', privado.tel_de(c.data->>'clienteId', c.data->'contacto')) order by c.data->>'hora'), '[]'::jsonb)
    into lista from public.citas c where c.data->>'fecha' = dia::text and c.data->>'estado' = 'agendada';
  perform privado.avisar('recordatorios', jsonb_build_object('fecha', dia::text, 'citas', lista));
end
$$;

-- Reporte del día para dirección: citas, taller, caja y ventas.
create or replace function privado.reporte(dia date) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare d text := dia::text; citas jsonb; taller jsonb; caja jsonb; ventas jsonb;
  abiertos text[] := array['recibido','diagnostico','autorizado','reparacion','espera'];
begin
  select jsonb_build_object('total', count(*) filter (where data->>'estado' <> 'cancelada'), 'atendidas', count(*) filter (where data->>'estado' = 'atendida'),
      'no_asistieron', count(*) filter (where data->>'estado' = 'noasistio'), 'canceladas', count(*) filter (where data->>'estado' = 'cancelada'),
      'sin_cerrar', count(*) filter (where data->>'estado' in ('agendada','llego','atendiendo')),
      'manana', (select count(*) from public.citas where data->>'fecha' = (dia + 1)::text and data->>'estado' = 'agendada'))
    into citas from public.citas where data->>'fecha' = d;
  select jsonb_build_object(
      'recibidas', count(*) filter (where data->>'creada' = d),
      'entregadas', count(*) filter (where data->'entrega'->>'fecha' = d),
      'en_taller', count(*) filter (where data->>'estado' = any(abiertos)),
      'esperando_autorizacion', count(*) filter (where data->>'estado' = 'presupuesto'),
      'listas_sin_recoger', coalesce(jsonb_agg(jsonb_build_object('folio', data->>'folio', 'equipo', trim(coalesce(data->'equipo'->>'marca', '') || ' ' || coalesce(data->'equipo'->>'modelo', '')), 'desde', data->>'actualizada'))
                              filter (where data->>'estado' = 'listo'), '[]'::jsonb),
      'atrasadas', coalesce(jsonb_agg(jsonb_build_object('folio', data->>'folio', 'promesa', data->>'promesa', 'tecnico', data->>'tecnico'))
                     filter (where data->>'estado' = any(abiertos) and data->>'promesa' < d), '[]'::jsonb))
    into taller from public.ordenes;
  with pagos as (
    select p->>'forma' as forma, (p->>'monto')::numeric as monto, 'reparaciones' as origen
      from public.ordenes o, jsonb_array_elements(coalesce(o.data->'pagos', '[]'::jsonb)) p where p->>'fecha' = d
    union all
    select p->>'forma', (p->>'monto')::numeric - case when p->>'forma' = 'efectivo' then coalesce((v.data->>'cambio')::numeric, 0) else 0 end, 'ventas'
      from public.ventas v, jsonb_array_elements(coalesce(v.data->'pagos', '[]'::jsonb)) p where coalesce(p->>'fecha', v.data->>'fecha') = d
    union all
    select c.data->'pago'->>'forma', -((c.data->'pago'->>'monto')::numeric), 'compras' from public.compras c where c.data->'pago'->>'fecha' = d)
  select jsonb_build_object('reparaciones', coalesce(sum(monto) filter (where origen = 'reparaciones'), 0), 'ventas', coalesce(sum(monto) filter (where origen = 'ventas'), 0),
      'compras_de_usados', coalesce(-sum(monto) filter (where origen = 'compras'), 0),
      'por_forma', coalesce((select jsonb_object_agg(forma, total) from (select forma, sum(monto) as total from pagos group by forma) z), '{}'::jsonb))
    into caja from pagos;
  select jsonb_build_object('n', count(*), 'total', coalesce(sum((data->>'total')::numeric), 0)) into ventas from public.ventas where data->>'fecha' = d;
  return jsonb_build_object('fecha', d, 'citas', citas, 'taller', taller, 'caja', caja, 'ventas', ventas);
end
$$;
revoke all on function privado.avisar(text, jsonb), privado.recordatorios(date), privado.reporte(date), privado.contacto_orden(jsonb) from public, anon, authenticated;

-- Horario de Monterrey (UTC−6 todo el año): a las 19:00 los recordatorios de mañana y a las 21:00 el reporte del día.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tecno-spot-recordatorios', '0 1 * * *', 'select privado.recordatorios(privado.hoy() + 1)');
    perform cron.schedule('tecno-spot-reporte', '0 3 * * *', $c$select privado.avisar('reporte_diario', privado.reporte(privado.hoy()))$c$);
  end if;
end $$;

select 'Copia este secreto en n8n (nodo “Revisar y redactar”): ' || secreto as siguiente_paso from privado.n8n;
