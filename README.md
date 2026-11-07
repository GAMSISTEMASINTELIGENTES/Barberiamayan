# Barbería · Sistema de sucursales

Aplicación web para una barbería con dos sucursales (Centro y Norte).

- **Encargados**: cada uno opera **solo su sucursal**. Registra clientes y cortes, lleva la caja, paga a los peluqueros y envía los WhatsApp de cumpleaños y recordatorios.
- **Dueño**: **solo supervisa**. Ve el rendimiento de ambas sucursales, compara entre ellas y revisa una bitácora con los cambios sensibles. No puede modificar nada.

**Arquitectura**
- **GitHub Pages** sirve la página.
- **Supabase** guarda los datos y maneja el login.
- Las reglas de acceso las aplica la base de datos. Aunque alguien manipule la página, un encargado no puede ver ni tocar la otra sucursal, y el dueño no puede modificar datos.

```
index.html          Página principal
styles.css          Estilos
config.js           ← Aquí van la URL y la llave de Supabase
js/api.js           Conexión a Supabase (o modo demostración si config.js está vacío)
js/app.js           Interfaz
supabase/01_esquema.sql   Tablas, reglas de acceso, bitácora, datos iniciales
supabase/02_usuarios.sql  Asigna el rol a cada usuario
```

---

## Instalación (una sola vez, unos 15 minutos)

### 1. Base de datos en Supabase
1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo, por ejemplo `barberia`. Región recomendada: la más cercana a México.
2. Ve a **SQL Editor → New query**, pega el contenido completo de `supabase/01_esquema.sql` y presiona **Run**.

### 2. Cierra el registro público
En **Authentication → Sign In / Providers**, desactiva **"Allow new users to sign up"**.
Así solo existen los usuarios que tú crees. Aun si alguien se registrara, no vería nada sin un rol asignado, pero es mejor cerrarlo.

### 3. Crea los usuarios
En **Authentication → Users → Add user → Create new user**, crea 3 usuarios con **"Auto Confirm User"** marcado:

| Usuario | Ejemplo de correo | Rol |
|---|---|---|
| Dueño | dueno@tubarberia.com | Solo supervisa ambas sucursales |
| Encargado Centro | centro@tubarberia.com | Opera Centro |
| Encargado Norte | norte@tubarberia.com | Opera Norte |

Los correos no tienen que existir de verdad. Solo funcionan como nombre de usuario.

### 4. Asigna los roles
Abre `supabase/02_usuarios.sql`, cambia los correos (y los nombres, si quieres) por los que usaste y ejecútalo en el **SQL Editor**. Al final debe mostrar 3 filas.

### 5. Conecta la página con Supabase
En **Project Settings → API** (o **Data API**) copia:
- **Project URL** → `supabaseUrl` en `config.js`
- La llave **anon / publishable** → `supabaseAnonKey` en `config.js`

> ⚠️ Nunca uses la llave **service_role / secret**. La llave *anon* sí puede estar pública en GitHub: lo que protege los datos son las reglas de acceso y las contraseñas.

### 6. Publica en GitHub Pages
1. Sube todos los archivos a un repositorio de GitHub. Puede ser privado si tu plan de GitHub permite Pages en repos privados; si no, público. Los datos **no** están en el repositorio.
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. En uno o dos minutos la app queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

### 7. Primer uso (cada encargado)
1. Entrar con su correo y contraseña.
2. **Equipo y precios**: dar de alta a sus peluqueros (porcentaje o monto fijo por corte) y ajustar precios. Ya vienen 6 servicios de ejemplo.
3. **WhatsApp → Mensajes**: poner el nombre real del negocio y ajustar los textos si quieren.
4. Empezar a registrar clientes y cortes.

---

## Operación diaria

- **Registrar corte**: buscar al cliente, tocar "Lo mismo que la última vez" o armar la descripción con los botones rápidos, elegir forma de pago y guardar. La comisión la calcula el servidor con el esquema vigente del peluquero.
- **Corte de caja**: en *Cortes → Hoy* sale lo cobrado en efectivo, con tarjeta y por transferencia.
- **Pagos**: elegir el periodo, revisar, agregar adelantos, descuentos o bonos, marcar como pagado y copiar el recibo para el peluquero.
- **WhatsApp**: cada día aparecen los cumpleaños y los clientes con 21 días o más sin venir (configurable). El botón abre WhatsApp con el mensaje ya escrito y queda marcado como enviado.

## Lo que ve el dueño

- Ingresos de hoy, la semana y el mes, la gráfica de 14 días y el comparativo entre sucursales contra el mes pasado.
- **Seguimiento de encargados**: cortes de hoy, clientes nuevos y si están enviando los WhatsApp.
- Cortes, pagos, clientes, equipo y precios, todo en modo consulta.
- **Bitácora**: cambios de comisiones y precios, pagos, adelantos y **cortes eliminados**, con quién y cuándo. Lo que hace un encargado no se puede borrar de la bitácora.

---

## Mantenimiento

- **Cambiar una contraseña**: Supabase → Authentication → Users → el usuario → *Reset password* o *Update user*.
- **Cambiar de encargado**: crea el usuario nuevo, asígnale el rol con `02_usuarios.sql` y elimina el anterior en Authentication → Users.
- **Inactividad**: en el plan gratuito, Supabase puede pausar un proyecto sin actividad por varios días. Con uso diario no pasa. Si se pausa, se reactiva desde el panel de Supabase.
- **Respaldos**: revisa qué incluye tu plan de Supabase (Project Settings → Database → Backups). Para datos de un negocio real conviene tener respaldos automáticos.
- **Agregar una tercera sucursal** (en el SQL Editor):
  ```sql
  insert into sucursales (id, nombre) values ('sur', 'Sur');
  insert into config (sucursal_id, negocio, plantilla_cumple, plantilla_recordatorio)
    select 'sur', negocio, plantilla_cumple, plantilla_recordatorio from config where sucursal_id = 'centro';
  insert into servicios (sucursal_id, nombre, precio, orden)
    select 'sur', nombre, precio, orden from servicios where sucursal_id = 'centro';
  ```
  Luego crea su usuario y asígnale `rol = 'encargado'`, `sucursal_id = 'sur'`.

## Modo demostración

Si `config.js` está vacío, la app arranca con datos ficticios y botones para entrar como cada usuario. Sirve para enseñársela al cliente sin tocar datos reales. Los cambios que se hagan ahí se guardan solo en ese navegador.
