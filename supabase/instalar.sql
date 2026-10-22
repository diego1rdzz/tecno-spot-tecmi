-- Tecno-Spot · instalación (esquema, reglas, ajustes iniciales y modelos). Sin datos de demostración.
-- Pegar completo en Supabase > SQL Editor > New query > Run. Si se corre otra vez no pasa nada:
-- lo que ya existe se deja como está.

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

-- ---------- Datos iniciales ----------
insert into public.config (id, data) values
  ('general', '{"empresa":{"nombre":"Tecno-Spot","sucursal":"Tecmilenio","lugar":"Cafetería de Tecmilenio","lugarFrase":"la cafetería de Tecmilenio"}}'::jsonb)
on conflict (id) do nothing;

insert into public.modelos (id, data) values
  ('apple-iphone-17-pro-max', '{"marca":"Apple","modelo":"iPhone 17 Pro Max","gama":"alta","orden":0}'::jsonb),
  ('apple-iphone-17-pro', '{"marca":"Apple","modelo":"iPhone 17 Pro","gama":"alta","orden":1}'::jsonb),
  ('apple-iphone-air', '{"marca":"Apple","modelo":"iPhone Air","gama":"alta","orden":2}'::jsonb),
  ('apple-iphone-17', '{"marca":"Apple","modelo":"iPhone 17","gama":"alta","orden":3}'::jsonb),
  ('apple-iphone-16e', '{"marca":"Apple","modelo":"iPhone 16e","gama":"media","orden":4}'::jsonb),
  ('apple-iphone-16-pro-max', '{"marca":"Apple","modelo":"iPhone 16 Pro Max","gama":"alta","orden":5}'::jsonb),
  ('apple-iphone-16-pro', '{"marca":"Apple","modelo":"iPhone 16 Pro","gama":"alta","orden":6}'::jsonb),
  ('apple-iphone-16-plus', '{"marca":"Apple","modelo":"iPhone 16 Plus","gama":"alta","orden":7}'::jsonb),
  ('apple-iphone-16', '{"marca":"Apple","modelo":"iPhone 16","gama":"alta","orden":8}'::jsonb),
  ('apple-iphone-15-pro-max', '{"marca":"Apple","modelo":"iPhone 15 Pro Max","gama":"alta","orden":9}'::jsonb),
  ('apple-iphone-15-pro', '{"marca":"Apple","modelo":"iPhone 15 Pro","gama":"alta","orden":10}'::jsonb),
  ('apple-iphone-15-plus', '{"marca":"Apple","modelo":"iPhone 15 Plus","gama":"alta","orden":11}'::jsonb),
  ('apple-iphone-15', '{"marca":"Apple","modelo":"iPhone 15","gama":"alta","orden":12}'::jsonb),
  ('apple-iphone-14-pro-max', '{"marca":"Apple","modelo":"iPhone 14 Pro Max","gama":"alta","orden":13}'::jsonb),
  ('apple-iphone-14-pro', '{"marca":"Apple","modelo":"iPhone 14 Pro","gama":"alta","orden":14}'::jsonb),
  ('apple-iphone-14-plus', '{"marca":"Apple","modelo":"iPhone 14 Plus","gama":"media","orden":15}'::jsonb),
  ('apple-iphone-14', '{"marca":"Apple","modelo":"iPhone 14","gama":"media","orden":16}'::jsonb),
  ('apple-iphone-se-3-generacion', '{"marca":"Apple","modelo":"iPhone SE (3.ª generación)","gama":"entrada","orden":17}'::jsonb),
  ('apple-iphone-13-pro-max', '{"marca":"Apple","modelo":"iPhone 13 Pro Max","gama":"media","orden":18}'::jsonb),
  ('apple-iphone-13-pro', '{"marca":"Apple","modelo":"iPhone 13 Pro","gama":"media","orden":19}'::jsonb),
  ('apple-iphone-13', '{"marca":"Apple","modelo":"iPhone 13","gama":"media","orden":20}'::jsonb),
  ('apple-iphone-13-mini', '{"marca":"Apple","modelo":"iPhone 13 mini","gama":"media","orden":21}'::jsonb),
  ('apple-iphone-12-pro-max', '{"marca":"Apple","modelo":"iPhone 12 Pro Max","gama":"media","orden":22}'::jsonb),
  ('apple-iphone-12-pro', '{"marca":"Apple","modelo":"iPhone 12 Pro","gama":"media","orden":23}'::jsonb),
  ('apple-iphone-12', '{"marca":"Apple","modelo":"iPhone 12","gama":"media","orden":24}'::jsonb),
  ('apple-iphone-12-mini', '{"marca":"Apple","modelo":"iPhone 12 mini","gama":"media","orden":25}'::jsonb),
  ('apple-iphone-se-2-generacion', '{"marca":"Apple","modelo":"iPhone SE (2.ª generación)","gama":"entrada","orden":26}'::jsonb),
  ('apple-iphone-11-pro-max', '{"marca":"Apple","modelo":"iPhone 11 Pro Max","gama":"media","orden":27}'::jsonb),
  ('apple-iphone-11-pro', '{"marca":"Apple","modelo":"iPhone 11 Pro","gama":"media","orden":28}'::jsonb),
  ('apple-iphone-11', '{"marca":"Apple","modelo":"iPhone 11","gama":"media","orden":29}'::jsonb),
  ('apple-iphone-xs-max', '{"marca":"Apple","modelo":"iPhone XS Max","gama":"entrada","orden":30}'::jsonb),
  ('apple-iphone-xs', '{"marca":"Apple","modelo":"iPhone XS","gama":"entrada","orden":31}'::jsonb),
  ('apple-iphone-xr', '{"marca":"Apple","modelo":"iPhone XR","gama":"entrada","orden":32}'::jsonb),
  ('apple-iphone-x', '{"marca":"Apple","modelo":"iPhone X","gama":"entrada","orden":33}'::jsonb),
  ('apple-iphone-8-plus', '{"marca":"Apple","modelo":"iPhone 8 Plus","gama":"entrada","orden":34}'::jsonb),
  ('apple-iphone-8', '{"marca":"Apple","modelo":"iPhone 8","gama":"entrada","orden":35}'::jsonb),
  ('samsung-galaxy-s25-ultra', '{"marca":"Samsung","modelo":"Galaxy S25 Ultra","gama":"alta","orden":36}'::jsonb),
  ('samsung-galaxy-s25-edge', '{"marca":"Samsung","modelo":"Galaxy S25 Edge","gama":"alta","orden":37}'::jsonb),
  ('samsung-galaxy-s25-plus', '{"marca":"Samsung","modelo":"Galaxy S25+","gama":"alta","orden":38}'::jsonb),
  ('samsung-galaxy-s25', '{"marca":"Samsung","modelo":"Galaxy S25","gama":"alta","orden":39}'::jsonb),
  ('samsung-galaxy-z-fold7', '{"marca":"Samsung","modelo":"Galaxy Z Fold7","gama":"alta","orden":40}'::jsonb),
  ('samsung-galaxy-z-flip7', '{"marca":"Samsung","modelo":"Galaxy Z Flip7","gama":"alta","orden":41}'::jsonb),
  ('samsung-galaxy-z-fold6', '{"marca":"Samsung","modelo":"Galaxy Z Fold6","gama":"alta","orden":42}'::jsonb),
  ('samsung-galaxy-z-flip6', '{"marca":"Samsung","modelo":"Galaxy Z Flip6","gama":"alta","orden":43}'::jsonb),
  ('samsung-galaxy-z-fold5', '{"marca":"Samsung","modelo":"Galaxy Z Fold5","gama":"alta","orden":44}'::jsonb),
  ('samsung-galaxy-z-flip5', '{"marca":"Samsung","modelo":"Galaxy Z Flip5","gama":"alta","orden":45}'::jsonb),
  ('samsung-galaxy-s24-ultra', '{"marca":"Samsung","modelo":"Galaxy S24 Ultra","gama":"alta","orden":46}'::jsonb),
  ('samsung-galaxy-s24-plus', '{"marca":"Samsung","modelo":"Galaxy S24+","gama":"alta","orden":47}'::jsonb),
  ('samsung-galaxy-s24', '{"marca":"Samsung","modelo":"Galaxy S24","gama":"alta","orden":48}'::jsonb),
  ('samsung-galaxy-s24-fe', '{"marca":"Samsung","modelo":"Galaxy S24 FE","gama":"media","orden":49}'::jsonb),
  ('samsung-galaxy-s23-ultra', '{"marca":"Samsung","modelo":"Galaxy S23 Ultra","gama":"alta","orden":50}'::jsonb),
  ('samsung-galaxy-s23-plus', '{"marca":"Samsung","modelo":"Galaxy S23+","gama":"alta","orden":51}'::jsonb),
  ('samsung-galaxy-s23', '{"marca":"Samsung","modelo":"Galaxy S23","gama":"alta","orden":52}'::jsonb),
  ('samsung-galaxy-s23-fe', '{"marca":"Samsung","modelo":"Galaxy S23 FE","gama":"media","orden":53}'::jsonb),
  ('samsung-galaxy-s22-ultra', '{"marca":"Samsung","modelo":"Galaxy S22 Ultra","gama":"alta","orden":54}'::jsonb),
  ('samsung-galaxy-s22-plus', '{"marca":"Samsung","modelo":"Galaxy S22+","gama":"media","orden":55}'::jsonb),
  ('samsung-galaxy-s22', '{"marca":"Samsung","modelo":"Galaxy S22","gama":"media","orden":56}'::jsonb),
  ('samsung-galaxy-s21-ultra', '{"marca":"Samsung","modelo":"Galaxy S21 Ultra","gama":"media","orden":57}'::jsonb),
  ('samsung-galaxy-s21-plus', '{"marca":"Samsung","modelo":"Galaxy S21+","gama":"media","orden":58}'::jsonb),
  ('samsung-galaxy-s21', '{"marca":"Samsung","modelo":"Galaxy S21","gama":"media","orden":59}'::jsonb),
  ('samsung-galaxy-s21-fe', '{"marca":"Samsung","modelo":"Galaxy S21 FE","gama":"media","orden":60}'::jsonb),
  ('samsung-galaxy-a56', '{"marca":"Samsung","modelo":"Galaxy A56","gama":"media","orden":61}'::jsonb),
  ('samsung-galaxy-a36', '{"marca":"Samsung","modelo":"Galaxy A36","gama":"media","orden":62}'::jsonb),
  ('samsung-galaxy-a26', '{"marca":"Samsung","modelo":"Galaxy A26","gama":"media","orden":63}'::jsonb),
  ('samsung-galaxy-a55', '{"marca":"Samsung","modelo":"Galaxy A55","gama":"media","orden":64}'::jsonb),
  ('samsung-galaxy-a35', '{"marca":"Samsung","modelo":"Galaxy A35","gama":"media","orden":65}'::jsonb),
  ('samsung-galaxy-a25', '{"marca":"Samsung","modelo":"Galaxy A25","gama":"entrada","orden":66}'::jsonb),
  ('samsung-galaxy-a54', '{"marca":"Samsung","modelo":"Galaxy A54","gama":"media","orden":67}'::jsonb),
  ('samsung-galaxy-a34', '{"marca":"Samsung","modelo":"Galaxy A34","gama":"media","orden":68}'::jsonb),
  ('samsung-galaxy-a24', '{"marca":"Samsung","modelo":"Galaxy A24","gama":"entrada","orden":69}'::jsonb),
  ('samsung-galaxy-a16', '{"marca":"Samsung","modelo":"Galaxy A16","gama":"entrada","orden":70}'::jsonb),
  ('samsung-galaxy-a15', '{"marca":"Samsung","modelo":"Galaxy A15","gama":"entrada","orden":71}'::jsonb),
  ('samsung-galaxy-a14', '{"marca":"Samsung","modelo":"Galaxy A14","gama":"entrada","orden":72}'::jsonb),
  ('samsung-galaxy-a06', '{"marca":"Samsung","modelo":"Galaxy A06","gama":"entrada","orden":73}'::jsonb),
  ('samsung-galaxy-a05s', '{"marca":"Samsung","modelo":"Galaxy A05s","gama":"entrada","orden":74}'::jsonb),
  ('samsung-galaxy-a05', '{"marca":"Samsung","modelo":"Galaxy A05","gama":"entrada","orden":75}'::jsonb),
  ('motorola-razr-50-ultra', '{"marca":"Motorola","modelo":"Razr 50 Ultra","gama":"alta","orden":76}'::jsonb),
  ('motorola-razr-50', '{"marca":"Motorola","modelo":"Razr 50","gama":"media","orden":77}'::jsonb),
  ('motorola-razr-40-ultra', '{"marca":"Motorola","modelo":"Razr 40 Ultra","gama":"alta","orden":78}'::jsonb),
  ('motorola-razr-40', '{"marca":"Motorola","modelo":"Razr 40","gama":"media","orden":79}'::jsonb),
  ('motorola-edge-50-pro', '{"marca":"Motorola","modelo":"Edge 50 Pro","gama":"media","orden":80}'::jsonb),
  ('motorola-edge-50-fusion', '{"marca":"Motorola","modelo":"Edge 50 Fusion","gama":"media","orden":81}'::jsonb),
  ('motorola-edge-40-neo', '{"marca":"Motorola","modelo":"Edge 40 Neo","gama":"media","orden":82}'::jsonb),
  ('motorola-edge-40', '{"marca":"Motorola","modelo":"Edge 40","gama":"media","orden":83}'::jsonb),
  ('motorola-moto-g85', '{"marca":"Motorola","modelo":"Moto G85","gama":"media","orden":84}'::jsonb),
  ('motorola-moto-g84', '{"marca":"Motorola","modelo":"Moto G84","gama":"media","orden":85}'::jsonb),
  ('motorola-moto-g54', '{"marca":"Motorola","modelo":"Moto G54","gama":"entrada","orden":86}'::jsonb),
  ('motorola-moto-g34', '{"marca":"Motorola","modelo":"Moto G34","gama":"entrada","orden":87}'::jsonb),
  ('motorola-moto-g24', '{"marca":"Motorola","modelo":"Moto G24","gama":"entrada","orden":88}'::jsonb),
  ('motorola-moto-g04', '{"marca":"Motorola","modelo":"Moto G04","gama":"entrada","orden":89}'::jsonb),
  ('motorola-moto-e13', '{"marca":"Motorola","modelo":"Moto E13","gama":"entrada","orden":90}'::jsonb),
  ('xiaomi-xiaomi-14t', '{"marca":"Xiaomi","modelo":"Xiaomi 14T","gama":"alta","orden":91}'::jsonb),
  ('xiaomi-xiaomi-13t', '{"marca":"Xiaomi","modelo":"Xiaomi 13T","gama":"media","orden":92}'::jsonb),
  ('xiaomi-poco-x6-pro', '{"marca":"Xiaomi","modelo":"POCO X6 Pro","gama":"media","orden":93}'::jsonb),
  ('xiaomi-redmi-note-14-pro', '{"marca":"Xiaomi","modelo":"Redmi Note 14 Pro","gama":"media","orden":94}'::jsonb),
  ('xiaomi-redmi-note-14', '{"marca":"Xiaomi","modelo":"Redmi Note 14","gama":"entrada","orden":95}'::jsonb),
  ('xiaomi-redmi-note-13-pro', '{"marca":"Xiaomi","modelo":"Redmi Note 13 Pro","gama":"media","orden":96}'::jsonb),
  ('xiaomi-redmi-note-13', '{"marca":"Xiaomi","modelo":"Redmi Note 13","gama":"entrada","orden":97}'::jsonb),
  ('xiaomi-redmi-note-12', '{"marca":"Xiaomi","modelo":"Redmi Note 12","gama":"entrada","orden":98}'::jsonb),
  ('xiaomi-redmi-14c', '{"marca":"Xiaomi","modelo":"Redmi 14C","gama":"entrada","orden":99}'::jsonb),
  ('xiaomi-redmi-13c', '{"marca":"Xiaomi","modelo":"Redmi 13C","gama":"entrada","orden":100}'::jsonb),
  ('huawei-nova-9', '{"marca":"Huawei","modelo":"nova 9","gama":"media","orden":101}'::jsonb),
  ('huawei-p40-lite', '{"marca":"Huawei","modelo":"P40 Lite","gama":"entrada","orden":102}'::jsonb),
  ('huawei-p30-lite', '{"marca":"Huawei","modelo":"P30 Lite","gama":"entrada","orden":103}'::jsonb),
  ('huawei-y9-2019', '{"marca":"Huawei","modelo":"Y9 2019","gama":"entrada","orden":104}'::jsonb),
  ('honor-magic5-lite', '{"marca":"Honor","modelo":"Magic5 Lite","gama":"media","orden":105}'::jsonb),
  ('honor-x8a', '{"marca":"Honor","modelo":"X8a","gama":"entrada","orden":106}'::jsonb),
  ('honor-x7b', '{"marca":"Honor","modelo":"X7b","gama":"entrada","orden":107}'::jsonb),
  ('oppo-reno10-5g', '{"marca":"OPPO","modelo":"Reno10 5G","gama":"media","orden":108}'::jsonb),
  ('oppo-a78', '{"marca":"OPPO","modelo":"A78","gama":"entrada","orden":109}'::jsonb),
  ('oppo-a58', '{"marca":"OPPO","modelo":"A58","gama":"entrada","orden":110}'::jsonb),
  ('oppo-a38', '{"marca":"OPPO","modelo":"A38","gama":"entrada","orden":111}'::jsonb),
  ('oppo-a18', '{"marca":"OPPO","modelo":"A18","gama":"entrada","orden":112}'::jsonb),
  ('realme-11-pro', '{"marca":"Realme","modelo":"11 Pro","gama":"media","orden":113}'::jsonb),
  ('realme-c67', '{"marca":"Realme","modelo":"C67","gama":"entrada","orden":114}'::jsonb),
  ('realme-c55', '{"marca":"Realme","modelo":"C55","gama":"entrada","orden":115}'::jsonb),
  ('realme-c53', '{"marca":"Realme","modelo":"C53","gama":"entrada","orden":116}'::jsonb),
  ('zte-blade-v40', '{"marca":"ZTE","modelo":"Blade V40","gama":"entrada","orden":117}'::jsonb),
  ('zte-blade-a54', '{"marca":"ZTE","modelo":"Blade A54","gama":"entrada","orden":118}'::jsonb)
on conflict (id) do nothing;

select (select count(*) from public.modelos) as modelos, (select count(*) from public.config) as ajustes;
