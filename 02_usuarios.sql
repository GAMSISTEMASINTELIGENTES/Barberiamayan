-- =====================================================================
--  Asignar rol a cada usuario
--  1) Primero crea los 3 usuarios en: Supabase > Authentication > Users > Add user
--     (marca "Auto Confirm User"). Usa los correos que quieras.
--  2) Cambia los correos y nombres de abajo y ejecuta este script.
-- =====================================================================

insert into public.perfiles (id, nombre, rol, sucursal_id)
select id, 'Dueño', 'dueno', null from auth.users where email = 'dueno@tubarberia.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, sucursal_id = excluded.sucursal_id;

insert into public.perfiles (id, nombre, rol, sucursal_id)
select id, 'Encargado Centro', 'encargado', 'centro' from auth.users where email = 'centro@tubarberia.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, sucursal_id = excluded.sucursal_id;

insert into public.perfiles (id, nombre, rol, sucursal_id)
select id, 'Encargado Norte', 'encargado', 'norte' from auth.users where email = 'norte@tubarberia.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, sucursal_id = excluded.sucursal_id;

-- Verifica: deben salir 3 filas
select u.email, p.nombre, p.rol, p.sucursal_id
from public.perfiles p join auth.users u on u.id = p.id;
