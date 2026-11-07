-- =====================================================================
--  Barbería · Esquema para Supabase
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
--
--  Reglas de acceso (las aplica la base de datos, no la página):
--   · Dueño:      ve TODO de ambas sucursales. No puede crear, editar ni borrar nada.
--   · Encargado:  ve y opera SOLO su sucursal.
--   · Sin sesión: no ve nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- Fecha "de hoy" en hora de México (Supabase trabaja en UTC)
create or replace function public.hoy_mx() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- ---------------------------------------------------------------------
--  Sucursales y perfiles de usuario
-- ---------------------------------------------------------------------
create table public.sucursales (
  id     text primary key,
  nombre text not null
);

create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null check (rol in ('dueno','encargado')),
  sucursal_id text references public.sucursales(id),
  constraint rol_sucursal check (
    (rol = 'dueno' and sucursal_id is null) or (rol = 'encargado' and sucursal_id is not null)
  )
);

-- Funciones auxiliares para las reglas de acceso
create or replace function public.mi_sucursal() returns text
language sql stable security definer set search_path = public as $$
  select sucursal_id from perfiles where id = auth.uid()
$$;

create or replace function public.puede_ver(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles p
                 where p.id = auth.uid() and (p.rol = 'dueno' or p.sucursal_id = s))
$$;

create or replace function public.puede_operar(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles p
                 where p.id = auth.uid() and p.rol = 'encargado' and p.sucursal_id = s)
$$;

-- ---------------------------------------------------------------------
--  Tablas operativas (todas llevan sucursal_id)
-- ---------------------------------------------------------------------
create table public.peluqueros (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id text not null default public.mi_sucursal() references public.sucursales(id),
  nombre      text not null check (length(trim(nombre)) > 0),
  esquema     text not null check (esquema in ('porcentaje','fijo')),
  valor       numeric(10,2) not null check (valor >= 0),
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  constraint porcentaje_max check (esquema <> 'porcentaje' or valor <= 100)
);

create table public.servicios (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id text not null default public.mi_sucursal() references public.sucursales(id),
  nombre      text not null check (length(trim(nombre)) > 0),
  precio      numeric(10,2) not null check (precio >= 0),
  activo      boolean not null default true,
  orden       int not null default 0
);

create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id text not null default public.mi_sucursal() references public.sucursales(id),
  nombre      text not null check (length(trim(nombre)) > 0),
  nacimiento  date not null,
  telefono    text not null check (telefono ~ '^[0-9]{10}$'),
  notas       text not null default '',
  creado      timestamptz not null default now(),
  unique (sucursal_id, telefono)
);

create table public.cortes (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    text not null default public.mi_sucursal() references public.sucursales(id),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  peluquero_id   uuid not null references public.peluqueros(id),
  servicio_id    uuid references public.servicios(id) on delete set null,
  servicio       text not null,
  descripcion    text not null check (length(trim(descripcion)) > 0),
  precio         numeric(10,2) not null check (precio >= 0),
  propina        numeric(10,2) not null default 0 check (propina >= 0),
  metodo         text not null default 'efectivo' check (metodo in ('efectivo','tarjeta','transferencia')),
  fecha          date not null default public.hoy_mx(),
  hora           time not null default (now() at time zone 'America/Mexico_City')::time,
  comision       numeric(10,2) not null default 0,   -- la calcula el servidor
  esquema        text not null default '',           -- la calcula el servidor
  registrado_por uuid default auth.uid(),
  creado         timestamptz not null default now()
);
create index cortes_suc_fecha on public.cortes (sucursal_id, fecha desc);
create index cortes_cliente on public.cortes (cliente_id, fecha desc);
create index cortes_peluquero on public.cortes (peluquero_id, fecha);

create table public.mensajes (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id text not null default public.mi_sucursal() references public.sucursales(id),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null check (tipo in ('cumple','recordatorio')),
  fecha       date not null default public.hoy_mx(),
  enviado_por uuid default auth.uid(),
  creado      timestamptz not null default now()
);
create index mensajes_cliente on public.mensajes (cliente_id, tipo, fecha desc);

create table public.pagos (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    text not null default public.mi_sucursal() references public.sucursales(id),
  peluquero_id   uuid not null references public.peluqueros(id),
  desde          date not null,
  hasta          date not null check (hasta >= desde),
  monto          numeric(10,2) not null,
  fecha          date not null default public.hoy_mx(),
  registrado_por uuid default auth.uid(),
  creado         timestamptz not null default now(),
  unique (peluquero_id, desde, hasta)
);

create table public.ajustes (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    text not null default public.mi_sucursal() references public.sucursales(id),
  peluquero_id   uuid not null references public.peluqueros(id),
  tipo           text not null check (tipo in ('adelanto','descuento','bono')),
  monto          numeric(10,2) not null,
  concepto       text not null default '',
  fecha          date not null default public.hoy_mx(),
  registrado_por uuid default auth.uid(),
  creado         timestamptz not null default now(),
  constraint signo check ((tipo = 'bono' and monto > 0) or (tipo <> 'bono' and monto < 0))
);

create table public.config (
  sucursal_id            text primary key references public.sucursales(id),
  negocio                text not null default 'Barbería',
  plantilla_cumple       text not null,
  plantilla_recordatorio text not null,
  dias_recordatorio      int  not null default 21 check (dias_recordatorio between 7 and 90)
);

create table public.bitacora (
  id             bigint generated always as identity primary key,
  sucursal_id    text not null,
  usuario        uuid,
  usuario_nombre text,
  tabla          text not null,
  accion         text not null,
  antes          jsonb,
  despues        jsonb,
  creado         timestamptz not null default now()
);
create index bitacora_suc on public.bitacora (sucursal_id, creado desc);

-- ---------------------------------------------------------------------
--  Validaciones y cálculo de comisión en el servidor
-- ---------------------------------------------------------------------
create or replace function public.antes_de_corte() returns trigger
language plpgsql set search_path = public as $$
declare p peluqueros; c clientes;
begin
  -- Solo ve sus propios peluqueros/clientes (RLS), así que uno de otra sucursal sale nulo
  select * into p from peluqueros where id = new.peluquero_id;
  if p.id is null or p.sucursal_id <> new.sucursal_id then
    raise exception 'El peluquero no pertenece a esta sucursal';
  end if;
  select * into c from clientes where id = new.cliente_id;
  if c.id is null or c.sucursal_id <> new.sucursal_id then
    raise exception 'El cliente no pertenece a esta sucursal';
  end if;
  if new.fecha > hoy_mx() then
    raise exception 'No se pueden registrar cortes con fecha futura';
  end if;
  if tg_op = 'INSERT' or new.precio <> old.precio or new.peluquero_id <> old.peluquero_id then
    new.comision := case p.esquema when 'fijo' then p.valor else round(new.precio * p.valor / 100) end;
    new.esquema  := case p.esquema when 'fijo' then '$' || trim(to_char(p.valor, 'FM999990')) || ' fijo'
                                   else trim(to_char(p.valor, 'FM990.##')) || '%' end;
  else
    new.comision := old.comision;
    new.esquema  := old.esquema;
  end if;
  if tg_op = 'UPDATE' then
    new.registrado_por := old.registrado_por;
    new.creado := old.creado;
  end if;
  return new;
end $$;

create trigger cortes_validar before insert or update on public.cortes
for each row execute function public.antes_de_corte();

create or replace function public.antes_de_pago_o_ajuste() returns trigger
language plpgsql set search_path = public as $$
declare p peluqueros;
begin
  select * into p from peluqueros where id = new.peluquero_id;
  if p.id is null or p.sucursal_id <> new.sucursal_id then
    raise exception 'El peluquero no pertenece a esta sucursal';
  end if;
  return new;
end $$;

create trigger pagos_validar before insert or update on public.pagos
for each row execute function public.antes_de_pago_o_ajuste();
create trigger ajustes_validar before insert or update on public.ajustes
for each row execute function public.antes_de_pago_o_ajuste();

-- ---------------------------------------------------------------------
--  Bitácora: el dueño ve quién cambió precios, comisiones, pagos o borró cortes
-- ---------------------------------------------------------------------
create or replace function public.registrar_bitacora() returns trigger
language plpgsql security definer set search_path = public as $$
declare fila jsonb := to_jsonb(coalesce(new, old));
begin
  -- Solo se registran cambios hechos por usuarios de la app (no los del administrador en Supabase)
  if auth.uid() is null then return coalesce(new, old); end if;
  insert into bitacora (sucursal_id, usuario, usuario_nombre, tabla, accion, antes, despues)
  values (fila->>'sucursal_id', auth.uid(),
          (select nombre from perfiles where id = auth.uid()),
          tg_table_name, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger bitacora_peluqueros after insert or update or delete on public.peluqueros
for each row execute function public.registrar_bitacora();
create trigger bitacora_servicios after insert or update or delete on public.servicios
for each row execute function public.registrar_bitacora();
create trigger bitacora_pagos after insert or update or delete on public.pagos
for each row execute function public.registrar_bitacora();
create trigger bitacora_ajustes after insert or update or delete on public.ajustes
for each row execute function public.registrar_bitacora();
create trigger bitacora_config after update on public.config
for each row execute function public.registrar_bitacora();
create trigger bitacora_cortes after update or delete on public.cortes
for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
--  Reglas de acceso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.sucursales enable row level security;
alter table public.perfiles   enable row level security;
alter table public.config     enable row level security;
alter table public.bitacora   enable row level security;

create policy ver_sucursales on public.sucursales for select to authenticated using (public.puede_ver(id));
create policy ver_mi_perfil  on public.perfiles   for select to authenticated using (id = auth.uid());
create policy ver_config     on public.config     for select to authenticated using (public.puede_ver(sucursal_id));
create policy editar_config  on public.config     for update to authenticated
  using (public.puede_operar(sucursal_id)) with check (public.puede_operar(sucursal_id));
create policy ver_bitacora   on public.bitacora   for select to authenticated using (public.puede_ver(sucursal_id));

do $$
declare t text;
begin
  foreach t in array array['peluqueros','servicios','clientes','cortes','mensajes','pagos','ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ver on public.%I for select to authenticated using (public.puede_ver(sucursal_id))', t);
    execute format('create policy crear on public.%I for insert to authenticated with check (public.puede_operar(sucursal_id))', t);
    execute format('create policy editar on public.%I for update to authenticated using (public.puede_operar(sucursal_id)) with check (public.puede_operar(sucursal_id))', t);
    execute format('create policy borrar on public.%I for delete to authenticated using (public.puede_operar(sucursal_id))', t);
  end loop;
end $$;

-- Permisos de tabla para usuarios con sesión (las reglas de arriba deciden qué filas)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Nadie sin sesión toca nada
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
--  Datos iniciales (se pueden cambiar después desde la app)
-- ---------------------------------------------------------------------
insert into public.sucursales (id, nombre) values ('centro','Centro'), ('norte','Norte');

insert into public.servicios (sucursal_id, nombre, precio, orden)
select s.id, v.nombre, v.precio, v.orden
from public.sucursales s
cross join (values ('Corte clásico',180,1), ('Degradado / Fade',200,2), ('Corte + barba',280,3),
                   ('Barba',120,4), ('Corte niño',150,5), ('Diseño / líneas',230,6)) as v(nombre, precio, orden);

insert into public.config (sucursal_id, negocio, plantilla_cumple, plantilla_recordatorio)
select id, 'Barbería',
  E'¡Feliz cumpleaños, {nombre}! 🎉✂️\nTodo el equipo de {negocio} {sucursal} te desea un gran día. Esta semana tu corte tiene 20% de descuento, ¡te esperamos!',
  '¡Hola {nombre}! 💈 Ya van {dias} días desde tu último corte con {peluquero}. ¿Te apartamos lugar esta semana en {negocio} {sucursal}? Responde este mensaje y te agendamos.'
from public.sucursales;
