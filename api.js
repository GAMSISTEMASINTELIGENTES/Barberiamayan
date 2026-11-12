/* =========================================================
   Capa de datos
   - Con config.js lleno  -> Supabase (datos reales, login real)
   - Con config.js vacío  -> Modo demostración (datos ficticios en el navegador)
   La interfaz (app.js) solo usa window.api, así que no le importa cuál de los dos es.
   ========================================================= */
(function(){
const CFG = window.BARBERIA_CONFIG || {};
const pad = n => String(n).padStart(2,'0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hoy = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const NUM = ['valor','precio','propina','comision','monto','dias_recordatorio','orden','sellos_iniciales','sellos_usados','sellos_para_gratis','pago_corte_gratis','sellos'];
const mapaSellos = filas => filas ? Object.fromEntries(filas.map(r=>[r.cliente_id, Number(r.sellos)||0])) : null;
const norm = r => { if (!r) return r; for (const k of NUM) if (k in r && r[k] !== null) r[k] = Number(r[k]); if (r.hora) r.hora = String(r.hora).slice(0,5); return r; };

// Ventanas de datos que se cargan al entrar (el historial completo de un cliente se pide aparte)
const VENTANA = { cortes:200, mensajes:400, pagos:130 };

function traducirError(e){
  const m = (e && (e.message || e.msg || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'El usuario no está confirmado. Confírmalo en Supabase > Authentication.';
  if (/clientes_sucursal_id_telefono_key|duplicate key.*telefono/i.test(m)) return 'Ya hay un cliente con ese número de WhatsApp.';
  if (/pagos_peluquero_id_desde_hasta_key/i.test(m)) return 'Ese periodo ya estaba marcado como pagado.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
  if (/multiple \(or no\) rows|PGRST116/i.test(m)) return 'No tienes permiso para hacer esto o el registro ya no existe.';
  if (/no pertenece a esta sucursal/i.test(m)) return 'Ese peluquero o cliente no es de tu sucursal.';
  if (/fecha futura/i.test(m)) return 'No se pueden registrar cortes con fecha futura.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión a internet. Revisa la red e intenta de nuevo.';
  return m;
}

/* ---------------------- Supabase ---------------------- */
function supabaseApi(){
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
  const ok = ({data, error}) => { if (error) throw error; return data; };
  async function fetchAll(build){
    let out = [], from = 0; const step = 1000;
    for(;;){ const rows = ok(await build().range(from, from+step-1)); out = out.concat(rows); if (rows.length < step) break; from += step; }
    return out.map(norm);
  }
  async function perfilActual(){
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('perfiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data){ await sb.auth.signOut(); throw new Error('Tu usuario existe pero no tiene un rol asignado. Pide al administrador que lo configure.'); }
    return { ...data, email: session.user.email };
  }
  return {
    demo:false,
    traducirError,
    sesion: perfilActual,
    async login(email, password){ ok(await sb.auth.signInWithPassword({ email, password })); return perfilActual(); },
    async logout(){ await sb.auth.signOut(); },
    async cargar(){
      const T = hoy();
      const [sucursales, config, peluqueros, servicios, clientes, cortes, mensajes, pagos, ajustes, saldos] = await Promise.all([
        fetchAll(()=>sb.from('sucursales').select('*').order('id')),
        fetchAll(()=>sb.from('config').select('*').order('sucursal_id')),
        fetchAll(()=>sb.from('peluqueros').select('*').order('nombre')),
        fetchAll(()=>sb.from('servicios').select('*').order('orden').order('nombre')),
        fetchAll(()=>sb.from('clientes').select('*').order('id')),
        fetchAll(()=>sb.from('cortes').select('*').gte('fecha', dkey(addDays(T,-VENTANA.cortes))).order('fecha',{ascending:false}).order('id')),
        fetchAll(()=>sb.from('mensajes').select('*').gte('fecha', dkey(addDays(T,-VENTANA.mensajes))).order('id')),
        fetchAll(()=>sb.from('pagos').select('*').gte('hasta', dkey(addDays(T,-VENTANA.pagos))).order('id')),
        fetchAll(()=>sb.from('ajustes').select('*').gte('fecha', dkey(addDays(T,-VENTANA.pagos))).order('id')),
        // Si la actualización de la tarjeta de lealtad (03_lealtad.sql) no está instalada, la app sigue funcionando sin ella
        fetchAll(()=>sb.from('saldo_sellos').select('cliente_id,sellos').order('cliente_id')).catch(()=>null),
      ]);
      return { sucursales, config, peluqueros, servicios, clientes, cortes, mensajes, pagos, ajustes, sellos: mapaSellos(saldos) };
    },
    async crear(tabla, fila){ return norm(ok(await sb.from(tabla).insert(fila).select().single())); },
    async editar(tabla, id, cambios, llave='id'){ return norm(ok(await sb.from(tabla).update(cambios).eq(llave, id).select().single())); },
    async borrar(tabla, id){ ok(await sb.from(tabla).delete().eq('id', id)); },
    async historial(clienteId){ return (ok(await sb.from('cortes').select('*').eq('cliente_id', clienteId).order('fecha',{ascending:false}).order('hora',{ascending:false}))).map(norm); },
    async bitacora(limite=300){ return ok(await sb.from('bitacora').select('*').order('creado',{ascending:false}).limit(limite)); },
  };
}

/* ---------------------- Modo demostración ---------------------- */
function demoApi(){
  const KEY = 'barberia-demo-v5';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36));
  const PERFILES = [
    { id:'demo-dueno',  nombre:'Dueño',            rol:'dueno',     sucursal_id:null,     email:'dueno@demo' },
    { id:'demo-centro', nombre:'Encargado Centro', rol:'encargado', sucursal_id:'centro', email:'centro@demo' },
    { id:'demo-norte',  nombre:'Encargado Norte',  rol:'encargado', sucursal_id:'norte',  email:'norte@demo' },
  ];
  let db, yo = null;
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e){} };
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if (!db) { db = semilla(); guardar(); }
  try { yo = PERFILES.find(p=>p.id===sessionStorage.getItem(KEY+'-yo')) || null; } catch(e){}

  const visible = r => yo && (yo.rol==='dueno' || r.sucursal_id===yo.sucursal_id);
  const exigirOperar = s => { if (!yo || yo.rol!=='encargado' || (s && s!==yo.sucursal_id)) throw new Error('No tienes permiso para hacer esto.'); };
  const copia = x => JSON.parse(JSON.stringify(x));
  function log(tabla, accion, antes, despues){
    db.bitacora.push({ id:db.bitacora.length+1, sucursal_id:(despues||antes).sucursal_id, usuario_nombre:yo.nombre, tabla, accion, antes:antes||null, despues:despues||null, creado:new Date().toISOString() });
  }
  const LOGEAR = { peluqueros:['insert','update','delete'], servicios:['insert','update','delete'], pagos:['insert','update','delete'], ajustes:['insert','update','delete'], config:['update'], cortes:['update','delete'] };
  const saldoDe = cid => { const c = db.clientes.find(x=>x.id===cid); return (c?.sellos_iniciales||0) + db.cortes.filter(k=>k.cliente_id===cid).reduce((s,k)=>s+(k.sello?1:0)-(k.sellos_usados||0),0); };
  // Mismo cálculo que hace el servidor (antes_de_corte)
  function comision(fila){
    const p = db.peluqueros.find(x=>x.id===fila.peluquero_id);
    if (!p || p.sucursal_id!==fila.sucursal_id) throw new Error('El peluquero no pertenece a esta sucursal');
    const cfg = db.config.find(c=>c.sucursal_id===fila.sucursal_id);
    if (fila.gratis){
      if (saldoDe(fila.cliente_id) < cfg.sellos_para_gratis) throw new Error('El cliente todavía no completa su tarjeta de lealtad');
      Object.assign(fila, {precio:0, sello:false, sellos_usados:cfg.sellos_para_gratis, comision:cfg.pago_corte_gratis, esquema:'Corte gratis'});
      return;
    }
    const s = db.servicios.find(x=>x.id===fila.servicio_id);
    fila.gratis = false; fila.sello = !!(s && s.da_sello); fila.sellos_usados = 0;
    fila.comision = p.esquema==='fijo' ? p.valor : Math.round(fila.precio*p.valor/100);
    fila.esquema  = p.esquema==='fijo' ? `$${p.valor} fijo` : `${p.valor}%`;
  }
  return {
    demo:true, perfilesDemo:PERFILES, traducirError,
    async sesion(){ return yo; },
    async login(email){ const p = PERFILES.find(x=>x.email===email); if (!p) throw new Error('Usuario de demostración no válido.'); yo = p; try{ sessionStorage.setItem(KEY+'-yo', p.id); }catch(e){} return p; },
    async logout(){ yo = null; try{ sessionStorage.removeItem(KEY+'-yo'); }catch(e){} },
    async cargar(){
      const f = t => copia(db[t].filter(visible));
      return { sucursales: copia(db.sucursales.filter(s=>visible({sucursal_id:s.id}))), config:f('config'), peluqueros:f('peluqueros'), servicios:f('servicios'),
               clientes:f('clientes'), cortes:f('cortes'), mensajes:f('mensajes'), pagos:f('pagos'), ajustes:f('ajustes'),
               sellos: Object.fromEntries(db.clientes.filter(visible).map(c=>[c.id, saldoDe(c.id)])) };
    },
    async crear(tabla, fila){
      exigirOperar(fila.sucursal_id);
      const n = { id:uid(), creado:new Date().toISOString(), ...fila, sucursal_id: yo.sucursal_id };
      if (tabla==='clientes' && db.clientes.some(c=>c.sucursal_id===n.sucursal_id && c.telefono===n.telefono)) throw new Error('duplicate key telefono');
      if (tabla==='pagos' && db.pagos.some(p=>p.peluquero_id===n.peluquero_id && p.desde===n.desde && p.hasta===n.hasta)) throw new Error('pagos_peluquero_id_desde_hasta_key');
      if (tabla==='cortes') comision(n);
      db[tabla].push(n);
      if (LOGEAR[tabla]?.includes('insert') || (tabla==='cortes' && n.gratis) || (tabla==='clientes' && n.sellos_iniciales>0)) log(tabla,'insert',null,n);
      guardar(); return copia(n);
    },
    async editar(tabla, id, cambios, llave='id'){
      const r = db[tabla].find(x=>x[llave]===id); if (!r || !visible(r)) throw new Error('No encontrado'); exigirOperar(r.sucursal_id);
      const antes = copia(r); Object.assign(r, cambios, { sucursal_id: antes.sucursal_id });
      if (tabla==='cortes') Object.assign(r, { gratis:antes.gratis, sello:antes.sello, sellos_usados:antes.sellos_usados, ...(antes.gratis?{precio:0}:{}) });
      if (LOGEAR[tabla]?.includes('update') || (tabla==='clientes' && (antes.sellos_iniciales||0)!==(r.sellos_iniciales||0))) log(tabla,'update',antes,copia(r));
      guardar(); return copia(r);
    },
    async borrar(tabla, id){
      const r = db[tabla].find(x=>x.id===id); if (!r || !visible(r)) return; exigirOperar(r.sucursal_id);
      db[tabla] = db[tabla].filter(x=>x.id!==id);
      if (tabla==='clientes'){ db.cortes = db.cortes.filter(c=>c.cliente_id!==id); db.mensajes = db.mensajes.filter(m=>m.cliente_id!==id); }
      if (LOGEAR[tabla]?.includes('delete')) log(tabla,'delete',r,null); guardar();
    },
    async historial(clienteId){ return copia(db.cortes.filter(c=>c.cliente_id===clienteId && visible(c)).sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))); },
    async bitacora(){ return copia(db.bitacora.filter(visible).sort((a,b)=>b.creado.localeCompare(a.creado))); },
    reiniciar(){ db = semilla(); guardar(); },
  };

  function semilla(){
    let a = 20261107; const r = () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
    const pick = x => x[Math.floor(r()*x.length)]; const T = hoy();
    const sucursales = [{id:'centro', nombre:'Centro'}, {id:'norte', nombre:'Norte'}];
    const P = (id,nombre,s,esq,v) => ({id, sucursal_id:s, nombre, esquema:esq, valor:v, activo:true});
    const peluqueros = [P('p1','Luis Ramírez','centro','porcentaje',50), P('p2','Jorge Medina','centro','porcentaje',45), P('p3','Iván Torres','centro','fijo',90), P('p4','Mariana Ortiz','centro','porcentaje',40),
                        P('p5','Ricardo Salas','norte','porcentaje',50), P('p6','Kevin Aguilar','norte','fijo',100), P('p7','Emiliano Cruz','norte','porcentaje',45)];
    const base = [['Corte clásico',180],['Degradado / Fade',200],['Corte + barba',280],['Barba',120],['Corte niño',150],['Diseño / líneas',230]];
    const servicios = sucursales.flatMap(s=>base.map(([n,p],i)=>({id:`${s.id}-s${i+1}`, sucursal_id:s.id, nombre:n, precio:p, activo:true, orden:i+1, da_sello:n!=='Barba'})));
    const config = sucursales.map(s=>({sucursal_id:s.id, negocio:'Barbería El Filo', dias_recordatorio:21, sellos_para_gratis:5, pago_corte_gratis:50,
      plantilla_gratis:'¡Felicidades {nombre}! 🎁 Completaste tu tarjeta en {negocio} {sucursal}: tu próximo corte es GRATIS. ¡Te esperamos!',
      plantilla_cumple:'¡Feliz cumpleaños, {nombre}! 🎉✂️\nTodo el equipo de {negocio} {sucursal} te desea un gran día. Esta semana tu corte tiene 20% de descuento, ¡te esperamos!',
      plantilla_recordatorio:'¡Hola {nombre}! 💈 Ya van {dias} días desde tu último corte con {peluquero}. ¿Te apartamos lugar esta semana en {negocio} {sucursal}? Responde este mensaje y te agendamos.'}));
    const nombres = ['Alejandro','Daniel','Carlos','José','Fernando','Miguel','Diego','Eduardo','Arturo','Roberto','Sergio','Héctor','Andrés','Pablo','Óscar','Raúl','Tomás','Mauricio','Rodrigo','Adrián','Gael','Santiago','Mateo','Leonardo','Sebastián','Emilio','Joaquín','Francisco','Javier','Ángel','Brenda','Sofía'];
    const apellidos = ['García','Hernández','López','Martínez','González','Pérez','Rodríguez','Sánchez','Ramírez','Flores','Gómez','Díaz','Reyes','Morales','Cruz','Ortiz','Gutiérrez','Chávez','Ramos','Vargas','Castillo','Jiménez','Mendoza','Ruiz','Aguilar','Herrera','Medina','Castro','Rojas','Navarro'];
    const descs = ['Fade bajo #0 a los lados, tijera arriba 4 cm, peinado hacia atrás','Fade medio #1, raya izquierda','Casquete #2 parejo, nuca cuadrada','Taper en nuca y patillas, texturizado arriba','Fade medio #0.5, barba perfilada, contorno navaja','Clásico de tijera, nuca redonda','Crop francés, fleco texturizado, fade alto','Buzz cut #3 parejo, contorno navaja','Pompadour: lados #1, arriba 7 cm sin rebajar volumen','Undercut #0, arriba largo peinado de lado'];
    const clientes = [], cortes = [];
    const saldo = {}; // sellos por cliente, para simular la tarjeta de lealtad
    const corte = (cli, p, s, fecha, hora, desc, met, prop) => {
      const gratis = (saldo[cli]||0) >= 5;
      const n = {id:uid(), sucursal_id:p.sucursal_id, cliente_id:cli, peluquero_id:p.id, servicio_id:s.id, servicio:s.nombre, descripcion:desc, precio:gratis?0:s.precio, propina:prop, metodo:met, fecha, hora,
        comision: gratis?50 : p.esquema==='fijo'?p.valor:Math.round(s.precio*p.valor/100), esquema: gratis?'Corte gratis' : p.esquema==='fijo'?`$${p.valor} fijo`:`${p.valor}%`,
        gratis, sello: !gratis && s.da_sello, sellos_usados: gratis?5:0, creado:new Date().toISOString()};
      saldo[cli] = (saldo[cli]||0) + (n.sello?1:0) - n.sellos_usados; cortes.push(n); };
    for (let i=0;i<190;i++){
      const suc = i<105 ? 'centro' : 'norte';
      let nac;
      if (i===3 || i===110) nac = new Date(1992+(i%7), T.getMonth(), T.getDate());
      else if ([8,15,120,141].includes(i)) { const f = addDays(T, 1+(i%6)); nac = new Date(1980+(i%25), f.getMonth(), f.getDate()); }
      else nac = new Date(1968+Math.floor(r()*40), Math.floor(r()*12), 1+Math.floor(r()*28));
      const id = uid(); const pel = peluqueros.filter(p=>p.sucursal_id===suc); const sv = servicios.filter(s=>s.sucursal_id===suc);
      const favP = pick(pel), favD = pick(descs), favS = r()<.55 ? sv[1] : pick(sv);
      let d = addDays(T, -Math.floor(r()*150));
      clientes.push({id, sucursal_id:suc, nombre:`${pick(nombres)} ${pick(apellidos)} ${pick(apellidos)}`, nacimiento:dkey(nac), telefono:(suc==='centro'?'55':'81')+String(Math.floor(10000000+r()*89999999)),
        notas: r()<.15 ? pick(['Piel sensible en la nuca','Siempre pide lavado','Remolino en la coronilla']) : '', creado:d.toISOString(), sellos_iniciales: 0});
      if (r()<.12){ clientes[clientes.length-1].sellos_iniciales = 1+Math.floor(r()*3); }
      saldo[id] = clientes[clientes.length-1].sellos_iniciales;
      while (d <= T){
        corte(id, r()<.75?favP:pick(pel), r()<.75?favS:pick(sv), dkey(d), `${pad(10+Math.floor(r()*9))}:${pick(['00','15','30','45'])}`, r()<.72?favD:pick(descs), r()<.55?'efectivo':r()<.7?'tarjeta':'transferencia', r()<.28?pick([20,30,50]):0);
        d = addDays(d, 14+Math.floor(r()*24)); if (r()<.06) break;
      }
    }
    clientes.slice(0,12).concat(clientes.slice(110,118)).forEach((c,k)=>{ if (cortes.some(x=>x.cliente_id===c.id && x.fecha===dkey(T))) return;
      const pel = peluqueros.filter(p=>p.sucursal_id===c.sucursal_id); const sv = servicios.filter(s=>s.sucursal_id===c.sucursal_id);
      corte(c.id, pel[k%pel.length], sv[k%4], dkey(T), `${pad(10+(k%9))}:30`, pick(descs), k%3===0?'tarjeta':'efectivo', k%4===0?50:0); });
    const dow = (T.getDay()+6)%7; const lunes = addDays(T,-dow); const wa = dkey(addDays(lunes,-7)), wb = dkey(addDays(lunes,-1));
    const pagos = peluqueros.map(p=>({id:uid(), sucursal_id:p.sucursal_id, peluquero_id:p.id, desde:wa, hasta:wb, fecha:dkey(lunes),
      monto: cortes.filter(c=>c.peluquero_id===p.id && c.fecha>=wa && c.fecha<=wb).reduce((s,c)=>s+c.comision+c.propina,0)}));
    const ajustes = [{id:uid(), sucursal_id:'centro', peluquero_id:'p2', tipo:'adelanto', monto:-300, concepto:'Adelanto de nómina', fecha:dkey(lunes)},
                     {id:uid(), sucursal_id:'norte', peluquero_id:'p6', tipo:'adelanto', monto:-200, concepto:'Adelanto', fecha:dkey(lunes)}];
    const ts = (d, h) => { const x = new Date(d); x.setHours(h, 12); return x.toISOString(); };
    const bitacora = [
      {id:1, sucursal_id:'centro', usuario_nombre:'Encargado Centro', tabla:'peluqueros', accion:'update', antes:{...peluqueros[0], valor:45}, despues:{...peluqueros[0]}, creado:ts(addDays(T,-12), 10)},
      {id:2, sucursal_id:'norte', usuario_nombre:'Encargado Norte', tabla:'servicios', accion:'update', antes:{...servicios[7], precio:190}, despues:{...servicios[7]}, creado:ts(addDays(T,-9), 12)},
      {id:3, sucursal_id:'centro', usuario_nombre:'Encargado Centro', tabla:'ajustes', accion:'insert', antes:null, despues:ajustes[0], creado:ts(lunes, 11)},
      {id:4, sucursal_id:'norte', usuario_nombre:'Encargado Norte', tabla:'ajustes', accion:'insert', antes:null, despues:ajustes[1], creado:ts(lunes, 13)},
      ...pagos.map((p,i)=>({id:5+i, sucursal_id:p.sucursal_id, usuario_nombre: p.sucursal_id==='centro'?'Encargado Centro':'Encargado Norte', tabla:'pagos', accion:'insert', antes:null, despues:p, creado:ts(lunes, 18)})),
    ];
    return { sucursales, config, peluqueros, servicios, clientes, cortes, mensajes:[], pagos, ajustes, bitacora };
  }
}

window.api = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) ? supabaseApi() : demoApi();
})();
