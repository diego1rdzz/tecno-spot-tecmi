-- Tecno-Spot · esquema, reglas por rol (RLS) y funciones para el sitio y el portal.
-- Cada colección del núcleo es una tabla (id, data jsonb). Las tres herramientas
-- leen la misma base; lo que cada una puede ver lo decide la base, no la pantalla.
-- Se puede correr más de una vez sin error.

create extension if not exists pgcrypto;
create schema if not exists privado;   -- funciones auxiliares; no se publica en la API
grant usage on schema privado to anon, authenticated;

-- ---------- Perfiles y roles ----------
create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  correo     text,
  nombre     text,
  rol        text not null default 'pendiente'
             check (rol in ('pendiente','direccion','administracion','mostrador','tecnico','cliente')),
  cliente_id text,              -- ficha del cliente cuando rol = cliente
  creado     timestamptz not null default now()
);

create or replace function privado.rol() returns text
language sql stable security definer set search_path = public as
$$ select coalesce((select rol from public.perfiles where user_id = (select auth.uid())), 'anonimo') $$;
create or replace function privado.interno() returns boolean
language sql stable security definer set search_path = public as
$$ select privado.rol() in ('direccion','administracion','mostrador','tecnico') $$;
-- Regla 4: costos y utilidad solo para dirección y administración.
create or replace function privado.admin() returns boolean
language sql stable security definer set search_path = public as
$$ select privado.rol() in ('direccion','administracion') $$;
create or replace function privado.vende() returns boolean
language sql stable security definer set search_path = public as
$$ select privado.rol() in ('direccion','administracion','mostrador') $$;
create or replace function privado.cliente() returns text
language sql stable security definer set search_path = public as
$$ select cliente_id from public.perfiles where user_id = (select auth.uid()) and rol = 'cliente' $$;

-- Toda cuenta nueva nace "pendiente": dirección le asigna rol desde la consola.
create or replace function privado.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.perfiles(user_id, correo, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists ts_nuevo_usuario on auth.users;
create trigger ts_nuevo_usuario after insert on auth.users
  for each row execute function privado.nuevo_usuario();

alter table public.perfiles enable row level security;
drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.rol()) = 'direccion');
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using ((select privado.rol()) = 'direccion') with check ((select privado.rol()) = 'direccion');

-- ---------- Colecciones ----------
do $$
declare t text;
begin
  foreach t in array array['config','modelos','tarifas','productos','costos','existencias','equipos','clientes','citas','ordenes','ventas','compras','movimientos'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null, actualizado timestamptz not null default now())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

create or replace function privado.tocar() returns trigger language plpgsql set search_path = public as
$$ begin new.actualizado := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['config','modelos','tarifas','productos','costos','existencias','equipos','clientes','citas','ordenes','ventas','compras','movimientos'] loop
    execute format('drop trigger if exists ts_tocar on public.%I', t);
    execute format('create trigger ts_tocar before update on public.%I for each row execute function privado.tocar()', t);
  end loop;
end $$;

-- Lo público (catálogo, precios al público, existencias y ajustes) lo lee cualquiera.
do $$
declare t text;
begin
  foreach t in array array['config','modelos','tarifas','productos','existencias'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_ver', t);
  end loop;
end $$;
drop policy if exists config_editar on public.config;
create policy config_editar on public.config for all to authenticated
  using ((select privado.rol()) = 'direccion') with check ((select privado.rol()) = 'direccion');
do $$
declare t text;
begin
  foreach t in array array['modelos','tarifas','productos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select privado.admin())) with check ((select privado.admin()))', t || '_editar', t);
  end loop;
end $$;
drop policy if exists existencias_editar on public.existencias;
create policy existencias_editar on public.existencias for all to authenticated
  using ((select privado.interno())) with check ((select privado.interno()));

-- costos: regla 4, solo dirección y administración.
drop policy if exists costos_todo on public.costos;
create policy costos_todo on public.costos for all to authenticated
  using ((select privado.admin())) with check ((select privado.admin()));

-- Operación diaria: todo el equipo interno.
do $$
declare t text;
begin
  foreach t in array array['equipos','clientes','citas','ordenes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_todo', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select privado.interno())) with check ((select privado.interno()))', t || '_todo', t);
  end loop;
end $$;
-- Ventas y compras de usados: las ve todo el equipo; las registran dirección, administración y mostrador.
do $$
declare t text;
begin
  foreach t in array array['ventas','compras'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select privado.interno()))', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select privado.vende())) with check ((select privado.vende()))', t || '_editar', t);
  end loop;
end $$;
drop policy if exists movimientos_ver on public.movimientos;
create policy movimientos_ver on public.movimientos for select to authenticated using ((select privado.interno()));
drop policy if exists movimientos_alta on public.movimientos;
create policy movimientos_alta on public.movimientos for insert to authenticated with check ((select privado.interno()));

create index if not exists ordenes_folio on public.ordenes ((data->>'folio'));
create index if not exists ordenes_cliente on public.ordenes ((data->>'clienteId'));
create index if not exists citas_folio on public.citas ((data->>'folio'));
create index if not exists citas_fecha on public.citas ((data->>'fecha'));
create index if not exists ventas_cliente on public.ventas ((data->>'clienteId'));
create index if not exists perfiles_cliente on public.perfiles (cliente_id);

-- ---------- Utilidades ----------
create or replace function privado.hoy() returns date language sql stable as
$$ select (now() at time zone 'America/Monterrey')::date $$;
create or replace function privado.ahora_hm() returns text language sql stable as
$$ select to_char(now() at time zone 'America/Monterrey', 'HH24:MI') $$;
create or replace function privado.minutos(hm text) returns int language sql immutable as
$$ select split_part(hm, ':', 1)::int * 60 + coalesce(nullif(split_part(hm, ':', 2), ''), '0')::int $$;
create or replace function privado.digitos(t text) returns text language sql immutable as
$$ select right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10) $$;
create or replace function privado.folio(pref text) returns text language sql volatile as
$$ select pref || '-' || to_char(now() at time zone 'America/Monterrey', 'YYMMDD') || '-'
     || (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 4)) $$;
create or replace function privado.cfg() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce((select data from public.config where id = 'general'), '{}'::jsonb) $$;
create or replace function privado.tel_de(cliente_id text, contacto jsonb) returns text language sql stable security definer set search_path = public as
$$ select privado.digitos(coalesce((select data->>'tel' from public.clientes where id = cliente_id), contacto->>'tel')) $$;
create index if not exists clientes_tel on public.clientes (privado.digitos(data->>'tel'));

-- Lo que el cliente ve de una orden: sin notas internas, costos ni código de desbloqueo.
create or replace function privado.vista_orden(o jsonb) returns jsonb language sql stable as
$$
  with x as (select (o->>'estado') in ('presupuesto','autorizado','reparacion','espera','listo','entregado','rechazado') as pres,
                    coalesce(o->'lineas', '[]'::jsonb) as ls)
  select jsonb_build_object(
    'tipo', 'orden', 'folio', o->>'folio', 'estado', o->>'estado',
    'equipo', trim(coalesce(o->'equipo'->>'marca', '') || ' ' || coalesce(o->'equipo'->>'modelo', '')),
    'problema', o->>'problema', 'creada', o->>'creada', 'promesa', o->>'promesa', 'modalidad', o->>'modalidad',
    'lineas', case when x.pres then (select coalesce(jsonb_agg(jsonb_build_object('desc', l->>'desc', 'cant', coalesce((l->>'cant')::numeric, 1), 'precio', l->'precio')), '[]'::jsonb) from jsonb_array_elements(x.ls) l) else '[]'::jsonb end,
    'total', case when x.pres then (select coalesce(sum(coalesce((l->>'precio')::numeric, 0) * coalesce((l->>'cant')::numeric, 1)), 0) from jsonb_array_elements(x.ls) l) end,
    'pagado', (select coalesce(sum((p->>'monto')::numeric), 0) from jsonb_array_elements(coalesce(o->'pagos', '[]'::jsonb)) p),
    'autorizacion', coalesce(o->'autorizacion', '{}'::jsonb) - 'por',
    'garantiaHasta', o->'entrega'->>'garantiaHasta',
    'diagnostico', case when x.pres then coalesce(o->>'diagnostico', '') else '' end,
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('fecha', h->>'fecha', 'hora', h->>'hora', 'nota', h->>'nota')), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(o->'historial', '[]'::jsonb)) h where coalesce(h->>'publico', 'false') = 'true'))
  from x
$$;
create or replace function privado.vista_cita(c jsonb) returns jsonb language sql stable security definer set search_path = public as
$$
  select jsonb_build_object('tipo', 'cita', 'folio', c->>'folio', 'estado', c->>'estado', 'fecha', c->>'fecha', 'hora', c->>'hora', 'turno', (c->>'turno')::int,
    'lugar', c->>'lugar', 'motivo', c->>'motivo', 'modalidad', c->>'modalidad', 'cotizacion', c->'cotizacion',
    'nombre', split_part(coalesce(c->'contacto'->>'nombre', ''), ' ', 1),
    'orden', (select o.data->>'folio' from public.ordenes o where o.id = c->>'ordenId'))
$$;
-- La cotización que manda el sitio se guarda limpia; el precio sale de la tarifa, no del navegador.
create or replace function privado.limpiar_cotizacion(q jsonb) returns jsonb language sql stable security definer set search_path = public as
$$
  select case when q is null or jsonb_typeof(q) <> 'object' then null else jsonb_strip_nulls(jsonb_build_object(
    'tipo', left(q->>'tipo', 20), 'problema', left(q->>'problema', 30), 'modeloId', left(q->>'modeloId', 80), 'marca', left(q->>'marca', 60),
    'modeloTexto', left(q->>'modeloTexto', 80), 'equipo', left(q->>'equipo', 120), 'tarifaId', t.id, 'precio', t.data->'precio',
    'condicion', left(q->>'condicion', 20), 'capacidad', left(q->>'capacidad', 20), 'preferencia', left(q->>'preferencia', 20),
    'productoId', left(q->>'productoId', 80), 'equipoId', left(q->>'equipoId', 80), 'ordenFolio', left(q->>'ordenFolio', 30))) end
  from (select 1) uno left join public.tarifas t on t.id = q->>'tarifaId'
$$;
revoke all on all functions in schema privado from public;
grant execute on all functions in schema privado to anon, authenticated;

-- Lo pagado por un equipo usado queda como su costo, aunque lo registre mostrador (que no ve costos).
create or replace function privado.costo_compra() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if new.data->>'estado' = 'aceptada' and new.data->>'equipoId' is not null and new.data->>'precio' is not null then
    insert into public.costos(id, data) values (new.data->>'equipoId', jsonb_build_object('costo', (new.data->>'precio')::numeric))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists ts_costo_compra on public.compras;
create trigger ts_costo_compra after insert or update on public.compras for each row execute function privado.costo_compra();

-- ---------- Funciones para el exterior (sitio y portal) ----------
-- Celulares a la venta, sin IMEI ni costo.
create or replace function public.ts_tienda() returns table(id text, data jsonb)
language sql stable security definer set search_path = public as
$$ select e.id, e.data - 'imei' - 'compraId' - 'ventaId' from public.equipos e where e.data->>'estado' = 'disponible' $$;

-- Lugares ocupados por día y hora (sin datos de nadie).
create or replace function public.ts_horarios(desde date, hasta date) returns table(fecha text, hora text, n int)
language sql stable security definer set search_path = public as
$$ select c.data->>'fecha', c.data->>'hora', count(*)::int from public.citas c
   where c.data->>'fecha' between desde::text and least(hasta, desde + 45)::text and c.data->>'estado' <> 'cancelada'
   group by 1, 2 $$;

-- Sitio y portal: agenda una cita con su turno del día (regla 1).
create or replace function public.ts_agendar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  g jsonb := privado.cfg();
  ci jsonb := coalesce(g->'citas', '{}'::jsonb);
  dias jsonb := coalesce(ci->'dias', '[1,2,3,4,5]'::jsonb);
  ini int := privado.minutos(coalesce(ci->>'inicio', '09:00'));
  fin int := privado.minutos(coalesce(ci->>'fin', '15:00'));
  paso int := greatest(10, coalesce((ci->>'intervalo')::int, 30));
  cupo int := greatest(1, coalesce((ci->>'cupo')::int, 2));
  visibles int := greatest(1, coalesce((ci->>'diasVisibles')::int, 8));
  ct jsonb := coalesce(p->'contacto', '{}'::jsonb);
  nombre text := left(trim(coalesce(ct->>'nombre', '')), 120);
  tel text := privado.digitos(ct->>'tel');
  motivo text := coalesce(nullif(p->>'motivo', ''), 'reparacion');
  modalidad text := coalesce(nullif(p->>'modalidad', ''), 'cafeteria');
  cid text := privado.cliente();
  origen text := case when privado.cliente() is not null then 'portal' else 'sitio' end;
  lugar text := coalesce(g->'empresa'->>'lugar', 'Cafetería de Tecmilenio');
  folio text := privado.folio('CT');
  nuevo text := 'ct-' || replace(gen_random_uuid()::text, '-', '');
  f date; h text := coalesce(p->>'hora', ''); m int; turno int; cl jsonb;
begin
  if length(p::text) > 6000 then raise exception 'La solicitud es demasiado grande.'; end if;
  begin f := (p->>'fecha')::date; exception when others then raise exception 'Fecha no válida.'; end;
  if h !~ '^\d{2}:\d{2}$' then raise exception 'Hora no válida.'; end if;
  m := privado.minutos(h);
  if f < privado.hoy() or f > privado.hoy() + visibles + 10 then raise exception 'Ese día no está disponible.'; end if;
  if not dias @> to_jsonb(extract(dow from f)::int) then raise exception 'Ese día no hay citas.'; end if;
  if m < ini or m + paso > fin or (m - ini) % paso <> 0 then raise exception 'Ese horario no está disponible.'; end if;
  if f = privado.hoy() and m < privado.minutos(privado.ahora_hm()) + 15 then raise exception 'Ese horario ya pasó. Elige otro.'; end if;
  if motivo not in ('reparacion','entrega','duda','compra','venta','garantia') then raise exception 'Motivo no válido.'; end if;
  if modalidad not in ('cafeteria','domicilio') or (modalidad = 'domicilio' and coalesce(g->'domicilio'->>'activo', 'false') <> 'true') then raise exception 'Esa modalidad no está disponible.'; end if;
  if cid is not null then
    select data into cl from public.clientes where id = cid;
    nombre := coalesce(cl->>'nombre', nombre); tel := privado.digitos(cl->>'tel');
  end if;
  if length(nombre) < 2 or length(tel) <> 10 then raise exception 'Escribe tu nombre y un celular de 10 dígitos.'; end if;
  perform pg_advisory_xact_lock(hashtext('ts-citas-' || f::text));
  if (select count(*) from public.citas c where c.data->>'fecha' = f::text and c.data->>'estado' = 'agendada' and privado.digitos(c.data->'contacto'->>'tel') = tel) >= 2 then
    raise exception 'Ya tienes dos citas agendadas ese día.';
  end if;
  if (select count(*) from public.citas c where c.data->>'fecha' = f::text and c.data->>'hora' = h and c.data->>'estado' <> 'cancelada') >= cupo then
    raise exception 'Ese horario se acaba de llenar. Elige otro.';
  end if;
  select coalesce(max((c.data->>'turno')::int), 0) + 1 into turno from public.citas c where c.data->>'fecha' = f::text;
  if cid is null then select c.id into cid from public.clientes c where privado.digitos(c.data->>'tel') = tel limit 1; end if;
  insert into public.citas(id, data) values (nuevo, jsonb_build_object(
    'folio', folio, 'fecha', f::text, 'hora', h, 'turno', turno, 'motivo', motivo, 'modalidad', modalidad, 'lugar', lugar,
    'direccion', case when modalidad = 'domicilio' then left(coalesce(p->>'direccion', ''), 300) else '' end,
    'clienteId', cid, 'contacto', jsonb_build_object('nombre', nombre, 'tel', tel, 'correo', left(coalesce(ct->>'correo', ''), 160), 'tecmi', coalesce(ct->>'tecmi', 'false') = 'true'),
    'cotizacion', privado.limpiar_cotizacion(p->'cotizacion'), 'nota', left(coalesce(p->>'nota', ''), 600),
    'estado', 'agendada', 'origen', origen, 'creada', privado.hoy()::text,
    'historial', jsonb_build_array(jsonb_build_object('fecha', privado.hoy()::text, 'hora', privado.ahora_hm(), 'autor', 'Cliente', 'nota', 'Cita agendada · desde el ' || origen))));
  return jsonb_build_object('folio', folio, 'fecha', f::text, 'hora', h, 'turno', turno, 'lugar', lugar);
end
$$;

-- Sitio: consulta de una cita o una orden con folio y celular.
create or replace function public.ts_consulta(folio text, tel text) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare t text := privado.digitos(tel); f text := upper(trim(coalesce(folio, ''))); o jsonb; c jsonb;
begin
  if length(t) <> 10 or length(f) < 8 then return null; end if;
  select data into o from public.ordenes where data->>'folio' = f;
  if o is not null then
    return case when privado.tel_de(o->>'clienteId', null) = t then privado.vista_orden(o) end;
  end if;
  select data into c from public.citas where data->>'folio' = f;
  if c is not null and privado.tel_de(c->>'clienteId', c->'contacto') = t then return privado.vista_cita(c); end if;
  return null;
end
$$;

-- Sitio y portal: el cliente autoriza o no su presupuesto (regla 3). Al autorizar se apartan refacciones (regla 5).
create or replace function public.ts_autorizar(folio text, tel text, decision text, motivo text, medio text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  t text := privado.digitos(tel); f text := upper(trim(coalesce(folio, ''))); cid text := privado.cliente();
  oid text; o jsonb; lin jsonb; nuevas jsonb := '[]'::jsonb; e jsonb;
  falt int := 0; need int; take int; disp int; ap int; total numeric; md text;
  hoy text := privado.hoy()::text; hm text := privado.ahora_hm(); nota text;
begin
  select id, data into oid, o from public.ordenes where data->>'folio' = f for update;
  if o is null or privado.tel_de(o->>'clienteId', null) <> t then raise exception 'No encontramos ese folio con ese celular.'; end if;
  if cid is not null and cid <> o->>'clienteId' then raise exception 'Esta orden no es de tu cuenta.'; end if;
  if o->>'estado' <> 'presupuesto' then raise exception 'Este presupuesto ya no está esperando autorización.'; end if;
  if decision not in ('si','no') then raise exception 'Decisión no válida.'; end if;
  md := case when medio = 'portal' and cid is not null then 'portal' else 'sitio' end;
  select coalesce(sum(coalesce((l->>'precio')::numeric, 0) * coalesce((l->>'cant')::numeric, 1)), 0) into total from jsonb_array_elements(coalesce(o->'lineas', '[]'::jsonb)) l;
  if decision = 'si' then
    for lin in select value from jsonb_array_elements(coalesce(o->'lineas', '[]'::jsonb)) loop
      if lin->>'productoId' is not null and exists (select 1 from public.productos where id = lin->>'productoId') then
        need := coalesce((lin->>'cant')::int, 1) - coalesce((lin->>'apartado')::int, 0);
        if need > 0 then
          select data into e from public.existencias where id = lin->>'productoId' for update;
          disp := coalesce((e->>'disp')::int, 0); ap := coalesce((e->>'apart')::int, 0); take := least(need, disp);
          if take > 0 then
            insert into public.existencias(id, data) values (lin->>'productoId', coalesce(e, '{}'::jsonb) || jsonb_build_object('disp', disp - take, 'apart', ap + take))
              on conflict (id) do update set data = excluded.data;
            insert into public.movimientos(id, data) values ('mv-' || replace(gen_random_uuid()::text, '-', ''), jsonb_build_object(
              'ts', (extract(epoch from now()) * 1000)::bigint, 'fecha', hoy, 'usuario', 'Cliente', 'tipo', 'apartado',
              'productoId', lin->>'productoId', 'cant', take, 'ref', f, 'motivo', 'Presupuesto autorizado'));
          end if;
          lin := jsonb_set(lin, '{apartado}', to_jsonb(coalesce((lin->>'apartado')::int, 0) + take));
          falt := falt + need - take;
        end if;
      end if;
      nuevas := nuevas || jsonb_build_array(lin);
    end loop;
    o := jsonb_set(o, '{lineas}', nuevas) || jsonb_build_object(
      'autorizacion', jsonb_build_object('estado', 'autorizado', 'medio', md, 'fecha', hoy, 'hora', hm, 'por', 'Cliente', 'monto', total),
      'estado', case when falt > 0 then 'espera' else 'autorizado' end);
    nota := 'Presupuesto autorizado (' || case md when 'portal' then 'En el portal del cliente' else 'En el sitio (folio y celular)' end || ') por $' || total::text
      || case when falt > 0 then ' · esperando ' || falt || ' refacción(es)' else '' end;
  else
    o := o || jsonb_build_object('autorizacion', jsonb_build_object('estado', 'rechazado', 'medio', md, 'fecha', hoy, 'hora', hm, 'por', 'Cliente', 'motivo', left(coalesce(motivo, 'otro'), 30)),
      'estado', 'rechazado');
    nota := 'Presupuesto no autorizado · ' || case motivo when 'precio' then 'Precio' when 'tiempo' then 'Tiempo de reparación' when 'noconviene' then 'Prefiere comprar otro equipo'
      when 'sinarreglo' then 'No tiene arreglo' else 'Otro' end || ' · el equipo se devuelve';
  end if;
  o := o || jsonb_build_object('actualizada', hoy, 'historial', coalesce(o->'historial', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('fecha', hoy, 'hora', hm, 'autor', 'Cliente', 'nota', nota, 'publico', true)));
  update public.ordenes set data = o where id = oid;
  return privado.vista_orden(o);
end
$$;

-- Sitio y portal: el cliente cancela su cita (queda el motivo, regla 8).
create or replace function public.ts_cancelar_cita(folio text, tel text, motivo text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare t text := privado.digitos(tel); f text := upper(trim(coalesce(folio, ''))); cid text; c jsonb; hoy text := privado.hoy()::text;
begin
  select id, data into cid, c from public.citas where data->>'folio' = f for update;
  if c is null or privado.tel_de(c->>'clienteId', c->'contacto') <> t then raise exception 'No encontramos esa cita con ese celular.'; end if;
  if c->>'estado' <> 'agendada' then raise exception 'Esta cita ya no se puede cancelar en línea.'; end if;
  c := c || jsonb_build_object('estado', 'cancelada', 'cierre', jsonb_build_object('motivo', case when motivo in ('cliente','reprogramo','otro') then motivo else 'cliente' end, 'fecha', hoy),
    'historial', coalesce(c->'historial', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('fecha', hoy, 'hora', privado.ahora_hm(), 'autor', 'Cliente', 'nota', 'Cancelada por el cliente')));
  update public.citas set data = c where id = cid;
  return privado.vista_cita(c);
end
$$;

-- Portal: la cuenta del cliente que entró, en forma resumida.
create or replace function public.ts_mi_cuenta() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare cid text := privado.cliente(); c jsonb;
begin
  if cid is null then raise exception 'Esta cuenta no está ligada a un cliente.'; end if;
  select data into c from public.clientes where id = cid;
  if c is null then raise exception 'No encontramos la ficha del cliente.'; end if;
  return jsonb_build_object(
    'cliente', jsonb_build_object('nombre', c->>'nombre', 'tel', c->>'tel', 'correo', coalesce(c->>'correo', ''),
      'dispositivos', (select coalesce(jsonb_agg(jsonb_build_object('marca', d->>'marca', 'modelo', d->>'modelo', 'imei', d->>'imei', 'color', d->>'color', 'origen', d->>'origen', 'ref', d->>'ref', 'garantiaHasta', d->>'garantiaHasta')), '[]'::jsonb)
                       from jsonb_array_elements(coalesce(c->'dispositivos', '[]'::jsonb)) d)),
    'ordenes', (select coalesce(jsonb_agg(privado.vista_orden(o.data) order by o.data->>'creada' desc), '[]'::jsonb) from public.ordenes o where o.data->>'clienteId' = cid),
    'citas', (select coalesce(jsonb_agg(privado.vista_cita(x.data) order by x.data->>'fecha' desc), '[]'::jsonb) from public.citas x where x.data->>'clienteId' = cid),
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('folio', v.data->>'folio', 'fecha', v.data->>'fecha', 'total', v.data->'total', 'credito', coalesce(v.data->'credito', '0'::jsonb),
                 'lineas', (select coalesce(jsonb_agg(jsonb_build_object('desc', l->>'desc', 'cant', l->'cant', 'precio', l->'precio', 'garantiaHasta', l->>'garantiaHasta')), '[]'::jsonb) from jsonb_array_elements(coalesce(v.data->'lineas', '[]'::jsonb)) l))
                 order by v.data->>'fecha' desc), '[]'::jsonb) from public.ventas v where v.data->>'clienteId' = cid));
end
$$;

revoke all on function public.ts_tienda(), public.ts_horarios(date, date), public.ts_agendar(jsonb), public.ts_consulta(text, text),
  public.ts_autorizar(text, text, text, text, text), public.ts_cancelar_cita(text, text, text), public.ts_mi_cuenta() from public;
grant execute on function public.ts_tienda(), public.ts_horarios(date, date), public.ts_agendar(jsonb), public.ts_consulta(text, text),
  public.ts_autorizar(text, text, text, text, text), public.ts_cancelar_cita(text, text, text) to anon, authenticated;
grant execute on function public.ts_mi_cuenta() to authenticated;
-- Supabase da permiso a anon por omisión en public; la cuenta del cliente solo con sesión.
revoke execute on function public.ts_mi_cuenta() from anon;

-- Tiempo real: las herramientas se actualizan solas cuando otra escribe.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['config','modelos','tarifas','productos','costos','existencias','equipos','clientes','citas','ordenes','ventas','compras','movimientos','perfiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
