/* =========================================================
   Barbería · Interfaz
   Dueño: solo supervisa (lectura).  Encargado: opera su sucursal.
   ========================================================= */
// ---------- utilidades ----------
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(n)||0);
const pad = n => String(n).padStart(2,'0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y,m,d] = String(k).slice(0,10).split('-').map(Number); return new Date(y, m-1, d); };
const todayDate = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const hoyKey = () => dkey(todayDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
const fmtDate = k => { const d = parseKey(k); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = k => { const d = parseKey(k); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const fmtTs = ts => { const d = new Date(ts); return `${d.getDate()} ${MESES[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const firstName = n => String(n||'').trim().split(/\s+/)[0];
const initials = n => String(n).trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
const age = nac => { const b = parseKey(nac), r = todayDate(); let a = r.getFullYear()-b.getFullYear(); if (r.getMonth()<b.getMonth() || (r.getMonth()===b.getMonth() && r.getDate()<b.getDate())) a--; return a; };
const fmtPhone = t => t && t.length===10 ? `${t.slice(0,2)} ${t.slice(2,6)} ${t.slice(6)}` : t;
const waLink = (tel, text) => `https://wa.me/52${tel}${text?`?text=${encodeURIComponent(text)}`:''}`;
const METODOS = [['efectivo','Efectivo'],['tarjeta','Tarjeta'],['transferencia','Transferencia']];
const metName = k => (METODOS.find(m=>m[0]===k)||[,'Efectivo'])[1];
const CHIPS = ['Fade bajo','Fade medio','Fade alto','Taper','Casquete','#0','#1','#2','#3','Tijera arriba','Texturizado','Raya izquierda','Raya derecha','Nuca cuadrada','Nuca redonda','Barba perfilada','Contorno navaja','Cejas'];
const esqTxt = p => p.esquema==='fijo' ? `${money(p.valor)} por corte` : `${Number(p.valor)}% del corte`;
const comisionDe = (p, precio) => p.esquema==='fijo' ? Number(p.valor) : Math.round(precio*Number(p.valor)/100);

// ---------- estado ----------
const S = { perfil:null, db:null };
const ui = { view:'inicio', scope:'todas', clienteId:null, q:'', periodo:'semana', msgTab:'cumple', cortesPel:'', cortesPeriodo:'hoy', pagoAbierto:null, hist:{}, bitacora:null, bitFiltro:'todo' };

// ---------- permisos / alcance ----------
const isOwner = () => S.perfil?.rol === 'dueno';
const puedeOperar = () => S.perfil?.rol === 'encargado';
const scopeSuc = () => isOwner() ? (ui.scope==='todas' ? null : ui.scope) : S.perfil.sucursal_id;
const inScope = x => { const s = scopeSuc(); return !s || x.sucursal_id === s; };
const sucName = id => S.db.sucursales.find(s=>s.id===id)?.nombre || '';
const pelName = id => S.db.peluqueros.find(p=>p.id===id)?.nombre || '—';
const cliById = id => S.db.clientes.find(c=>c.id===id);
const cfgDe = s => S.db.config.find(c=>c.sucursal_id===s) || S.db.config[0] || {};
const negocio = () => cfgDe(S.perfil.sucursal_id || S.db.sucursales[0]?.id).negocio || 'Barbería';
const ordenCortes = (a,b) => (b.fecha+b.hora).localeCompare(a.fecha+a.hora);
const cortesDe = cid => (ui.hist[cid] || S.db.cortes.filter(c=>c.cliente_id===cid)).slice().sort(ordenCortes);
const ultimoCorte = (() => { let cache = null, src = null; return cid => { if (src !== S.db.cortes){ src = S.db.cortes; cache = {}; for (const c of src){ const u = cache[c.cliente_id]; if (!u || ordenCortes(c,u) < 0) cache[c.cliente_id] = c; } } return cache[cid]; }; })();

// ---------- periodos ----------
function rango(periodo){
  const T = todayDate(); const dow = (T.getDay()+6)%7;
  if (periodo==='hoy') return [dkey(T), dkey(T), 'Hoy'];
  if (periodo==='semana') { const a = addDays(T,-dow); return [dkey(a), dkey(addDays(a,6)), 'Esta semana']; }
  if (periodo==='semana_ant') { const a = addDays(T,-dow-7); return [dkey(a), dkey(addDays(a,6)), 'Semana pasada']; }
  if (periodo==='quincena') { const d = T.getDate(); const a = new Date(T.getFullYear(), T.getMonth(), d<=15?1:16); const b = d<=15 ? new Date(T.getFullYear(),T.getMonth(),15) : new Date(T.getFullYear(),T.getMonth()+1,0); return [dkey(a), dkey(b), 'Esta quincena']; }
  if (periodo==='mes') { const a = new Date(T.getFullYear(), T.getMonth(), 1); return [dkey(a), dkey(new Date(T.getFullYear(),T.getMonth()+1,0)), 'Este mes']; }
  if (periodo==='mes_ant') { const a = new Date(T.getFullYear(), T.getMonth()-1, 1); return [dkey(a), dkey(new Date(T.getFullYear(),T.getMonth(),0)), 'Mes pasado']; }
}
const enRango = (c, [a,b]) => c.fecha >= a && c.fecha <= b;

// ---------- WhatsApp: cumpleaños y recordatorios ----------
function fillTpl(tpl, cliente, extra={}){
  const vars = {nombre:firstName(cliente.nombre), nombre_completo:cliente.nombre, sucursal:sucName(cliente.sucursal_id), negocio:cfgDe(cliente.sucursal_id).negocio, ...extra};
  return String(tpl||'').replace(/\{(\w+)\}/g, (m,k)=> vars[k] ?? m);
}
function cumpleanos(filtro=inScope){
  const T = todayDate(); const out = [];
  S.db.clientes.filter(filtro).forEach(c=>{
    const n = parseKey(c.nacimiento);
    let next = new Date(T.getFullYear(), n.getMonth(), n.getDate());
    if (next < T) next = new Date(T.getFullYear()+1, n.getMonth(), n.getDate());
    const en = Math.round((next - T)/86400000);
    if (en <= 7){
      const enviado = S.db.mensajes.some(m=>m.cliente_id===c.id && m.tipo==='cumple' && m.fecha.slice(0,4)===String(next.getFullYear()));
      out.push({cliente:c, en, fecha:dkey(next), cumple:next.getFullYear()-n.getFullYear(), enviado, texto:fillTpl(cfgDe(c.sucursal_id).plantilla_cumple, c)});
    }
  });
  return out.sort((a,b)=>a.en-b.en);
}
function recordatorios(filtro=inScope){
  const hoy = hoyKey(); const out = [];
  S.db.clientes.filter(filtro).forEach(c=>{
    const ult = ultimoCorte(c.id); if (!ult) return;
    const dias = Number(cfgDe(c.sucursal_id).dias_recordatorio)||21;
    const d = diffDays(hoy, ult.fecha);
    if (d >= dias - 3){
      const enviado = S.db.mensajes.find(m=>m.cliente_id===c.id && m.tipo==='recordatorio' && m.fecha >= ult.fecha);
      out.push({cliente:c, ult, dias:d, proximo:d<dias, enviado, texto:fillTpl(cfgDe(c.sucursal_id).plantilla_recordatorio, c, {dias:d, peluquero:firstName(pelName(ult.peluquero_id)), ultimo_corte:ult.descripcion})});
    }
  });
  return out.sort((a,b)=>a.dias-b.dias);
}
const pendientesDe = filtro => cumpleanos(filtro).filter(x=>x.en===0 && !x.enviado).length + recordatorios(filtro).filter(x=>!x.proximo && !x.enviado && x.dias<120).length;

// ---------- íconos ----------
const I = {
  inicio:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  clientes:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/></svg>',
  cortes:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>',
  pagos:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  mensajes:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.3A8 8 0 1 1 21 12z"/></svg>',
  equipo:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.5 8z"/></svg>',
  bitacora:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
};
const vistas = () => isOwner()
  ? [['inicio','Resumen'],['cortes','Cortes'],['pagos','Pagos'],['clientes','Clientes'],['equipo','Equipo y precios'],['bitacora','Bitácora']]
  : [['inicio','Resumen'],['clientes','Clientes'],['cortes','Cortes'],['pagos','Pagos'],['mensajes','WhatsApp'],['equipo','Equipo y precios']];

// ---------- render principal ----------
const demoBar = () => api.demo ? `<div class="demo-bar">Modo demostración · datos ficticios. Para usar datos reales, llena config.js con los datos de Supabase.</div>` : '';
function render(){
  const root = $('#root');
  if (!S.perfil){ root.innerHTML = loginView(); return; }
  if (!S.db){ root.innerHTML = cargandoView('Cargando datos…'); return; }
  const pend = puedeOperar() ? pendientesDe(inScope) : 0;
  const V = vistas();
  const nav = V.map(([k,l])=>`<button class="${ui.view===k?'on':''}" data-go="${k}">${I[k]}${l}${k==='mensajes'&&pend?`<span class="badge">${pend}</span>`:''}</button>`).join('');
  const mnav = V.map(([k,l])=>`<button class="${ui.view===k?'on':''}" data-go="${k}">${I[k]}${l.split(' ')[0]}${k==='mensajes'&&pend?`<span class="dot">${pend}</span>`:''}</button>`).join('');
  const quien = isOwner() ? 'Dueño · supervisión' : `Encargado · Sucursal ${sucName(S.perfil.sucursal_id)}`;
  root.innerHTML = `${demoBar()}
  <div class="app">
    <aside class="side">
      <div class="pole"></div>
      <div class="brand"><h1>${esc(negocio())}</h1><div class="tiny">${isOwner()?'Panel del dueño':'Sucursal '+esc(sucName(S.perfil.sucursal_id))}</div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot"><div style="font-weight:700">${esc(S.perfil.nombre)}</div><div style="color:#b6ab9b">${quien}</div>
        <button data-act="recargar">Actualizar datos</button><button data-act="logout">Cerrar sesión</button></div>
    </aside>
    <div>
      <div class="mtop"><h1>${esc(negocio())}</h1><button data-act="logout">Salir</button></div>
      <main class="main">${viewHtml()}</main>
    </div>
  </div>
  <nav class="mnav">${mnav}</nav>`;
}
function viewHtml(){
  if (!vistas().some(v=>v[0]===ui.view)) ui.view = 'inicio';
  switch(ui.view){
    case 'inicio': return inicioView();
    case 'clientes': return ui.clienteId ? clienteView() : clientesView();
    case 'cortes': return cortesView();
    case 'pagos': return pagosView();
    case 'mensajes': return mensajesView();
    case 'equipo': return equipoView();
    case 'bitacora': return bitacoraView();
  }
}
const cargandoView = t => `<div class="loading"><div class="spin"></div><div>${esc(t)}</div></div>`;
function scopeSwitch(){
  if (!isOwner()) return `<span class="tag">Sucursal ${esc(sucName(S.perfil.sucursal_id))}</span>`;
  const opts = [['todas','Ambas'], ...S.db.sucursales.map(s=>[s.id, s.nombre])];
  return `<div class="seg">${opts.map(([k,l])=>`<button class="${ui.scope===k?'on':''}" data-scope="${k}">${esc(l)}</button>`).join('')}</div>`;
}
function header(title, sub, right=''){
  return `<div class="topbar"><div><h1>${title}</h1>${sub?`<div class="muted">${sub}</div>`:''}</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${scopeSwitch()}${puedeOperar()?right:''}</div></div>`;
}
const kpi = (l,v,s) => `<div class="card kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;

// ---------- login ----------
function loginView(){
  const demo = api.demo ? `
    <div class="info" style="margin-top:18px;max-width:520px"><b>Modo demostración.</b> Todavía no hay conexión a Supabase, así que se usan datos ficticios. Elige un usuario:</div>
    <div class="roles">${api.perfilesDemo.map(p=>`<button class="role" data-demo="${p.email}">${p.rol==='dueno'?'<span class="tag red">Dueño</span>':`<span class="tag">Sucursal ${p.sucursal_id==='centro'?'Centro':'Norte'}</span>`}
      <div class="who">${esc(p.nombre)}</div><div class="small muted">${p.rol==='dueno'?'Supervisa ambas sucursales. Solo consulta.':'Opera su sucursal: clientes, cortes, caja, pagos y WhatsApp.'}</div></button>`).join('')}</div>
    <p class="tiny" style="margin-top:16px"><button class="btn ghost sm" data-act="reset-demo">Restablecer datos de demostración</button></p>`
  : `<form class="login-form" id="login">
      <div class="field"><label>Correo</label><input type="text" id="l-email" autocomplete="username" inputmode="email" required></div>
      <div class="field"><label>Contraseña</label><input type="password" id="l-pass" autocomplete="current-password" required style="border:1px solid var(--line);border-radius:9px;padding:9px 11px;width:100%"></div>
      <div class="err" id="l-err"></div>
      <button class="btn primary" type="submit" id="l-btn">Entrar</button>
    </form>`;
  return `<div class="login"><div class="pole"></div><div class="login-main"><div class="login-box">
    <div class="tiny" style="text-transform:uppercase;letter-spacing:.1em;font-weight:700">Sistema de sucursales</div>
    <h1>${S.db ? esc(negocio()) : 'Barbería'}</h1>
    <p class="muted" style="max-width:520px">Entra con tu usuario. Cada encargado ve solo su sucursal; el dueño ve ambas.</p>
    ${demo}
  </div></div></div>`;
}

// ---------- resumen ----------
function stats(cortes){
  const ing = cortes.reduce((s,c)=>s+c.precio,0), com = cortes.reduce((s,c)=>s+c.comision,0);
  return {n:cortes.length, ing, com, neto:ing-com, ticket: cortes.length? ing/cortes.length : 0};
}
const COLORS = ['var(--accent)','var(--navy)','#a56a12','#2f6b3f'];
const colorSuc = id => COLORS[Math.max(0, S.db.sucursales.findIndex(s=>s.id===id)) % COLORS.length];
function inicioView(){
  const cs = S.db.cortes.filter(inScope);
  const hoy = stats(cs.filter(c=>enRango(c, rango('hoy'))));
  const sem = stats(cs.filter(c=>enRango(c, rango('semana'))));
  const mes = stats(cs.filter(c=>enRango(c, rango('mes'))));
  const nClientes = S.db.clientes.filter(inScope).length;

  const T = todayDate(); const dias = [...Array(14)].map((_,i)=>dkey(addDays(T, i-13)));
  const sucs = scopeSuc() ? [scopeSuc()] : S.db.sucursales.map(s=>s.id);
  const porDia = dias.map(k=>({k, v: sucs.map(s=>({s, ing: cs.filter(c=>c.fecha===k && c.sucursal_id===s).reduce((a,c)=>a+c.precio,0)}))}));
  const max = Math.max(1, ...porDia.map(d=>d.v.reduce((a,x)=>a+x.ing,0)));
  const chart = `<div class="bars">${porDia.map(d=>{ const tot = d.v.reduce((a,x)=>a+x.ing,0); const dd = parseKey(d.k);
      return `<div class="bar-col" title="${fmtShort(d.k)}: ${money(tot)}"><div class="tiny" style="font-size:10px">${tot?Math.round(tot/100)/10+'k':''}</div><div class="bar-stack" style="height:${Math.max(2, tot/max*110)}px">${d.v.map(x=>`<div style="height:${tot? x.ing/tot*100:0}%;background:${colorSuc(x.s)}"></div>`).join('')}</div><div class="bar-lbl"><span class="dw">${DIAS[dd.getDay()]} </span>${dd.getDate()}</div></div>`;}).join('')}</div>
    <div class="legend">${sucs.map(s=>`<span><i style="background:${colorSuc(s)}"></i>${esc(sucName(s))}</span>`).join('')}</div>`;

  let bloqueDerecho;
  if (isOwner()){
    const mesR = rango('mes');
    const filas = S.db.sucursales.filter(s=>!scopeSuc() || s.id===scopeSuc()).map(s=>{
      const f = x => x.sucursal_id===s.id;
      const env = S.db.mensajes.filter(m=>f(m) && m.fecha>=mesR[0]);
      return {s, hoy:S.db.cortes.filter(c=>f(c) && c.fecha===hoyKey()).length, nuevos:S.db.clientes.filter(c=>f(c) && String(c.creado).slice(0,10)>=mesR[0]).length,
              rec:env.filter(m=>m.tipo==='recordatorio').length, cum:env.filter(m=>m.tipo==='cumple').length, pend:pendientesDe(f)};
    });
    bloqueDerecho = `<div class="card"><h3>Seguimiento de encargados</h3>
      ${filas.map(f=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(f.s.nombre)}</b>${f.pend?`<span class="tag warn">${f.pend} WhatsApp pendientes hoy</span>`:'<span class="tag ok">WhatsApp al día</span>'}</div>
        <div class="small muted" style="margin-top:4px">${f.hoy} cortes hoy · ${f.nuevos} clientes nuevos este mes · ${f.rec} recordatorios y ${f.cum} felicitaciones enviadas este mes</div>
      </div>`).join('')}
      <p class="tiny" style="margin:8px 0 0">Los pendientes son recordatorios y felicitaciones de hoy que el encargado todavía no envía.</p></div>`;
  } else {
    const cumpleHoy = cumpleanos().filter(x=>x.en===0); const recs = recordatorios().filter(x=>!x.proximo && !x.enviado && x.dias<120);
    bloqueDerecho = `<div class="card"><h3>Pendientes de WhatsApp hoy</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span>🎂 Cumpleaños hoy</span><span><b>${cumpleHoy.length}</b> ${cumpleHoy.filter(x=>!x.enviado).length?`<span class="tag red">${cumpleHoy.filter(x=>!x.enviado).length} sin enviar</span>`:'<span class="tag ok">al día</span>'}</span></div>
        ${cumpleHoy.map(x=>`<div class="small muted" style="margin-top:-6px">· ${esc(x.cliente.nombre)} cumple ${x.cumple}</div>`).join('')}
        <div style="display:flex;justify-content:space-between;align-items:center"><span>💈 Recordatorios por enviar</span><span><b>${recs.length}</b></span></div>
        <button class="btn dark sm" data-go="mensajes" style="align-self:flex-start">Ir a WhatsApp</button>
      </div></div>`;
  }

  let comparativo = '';
  if (isOwner() && !scopeSuc()){
    const filas = S.db.sucursales.map(s=>({s, st: stats(S.db.cortes.filter(c=>c.sucursal_id===s.id && enRango(c, rango('mes')))), ant: stats(S.db.cortes.filter(c=>c.sucursal_id===s.id && enRango(c, rango('mes_ant'))))}));
    const maxIng = Math.max(1, ...filas.map(f=>f.st.ing));
    comparativo = `<div class="section card"><h3>Comparativo del mes por sucursal</h3><div class="tbl-wrap"><table><thead><tr><th>Sucursal</th><th class="num">Cortes</th><th class="num">Ingresos</th><th class="num">Mes pasado</th><th class="num">Pago peluqueros</th><th class="num">Queda a sucursal</th><th class="num">Ticket prom.</th></tr></thead><tbody>
      ${filas.map(f=>`<tr><td><b>${esc(f.s.nombre)}</b><div class="meter"><span style="width:${f.st.ing/maxIng*100}%;background:${colorSuc(f.s.id)}"></span></div></td><td class="num">${f.st.n}</td><td class="num">${money(f.st.ing)}</td><td class="num">${money(f.ant.ing)}</td><td class="num">${money(f.st.com)}</td><td class="num"><b>${money(f.st.neto)}</b></td><td class="num">${money(f.st.ticket)}</td></tr>`).join('')}
      </tbody></table></div><p class="tiny" style="margin:8px 0 0">"Mes pasado" es el mes completo anterior; el mes actual va en curso.</p></div>`;
  }

  const pels = S.db.peluqueros.filter(inScope).map(p=>{ const c = cs.filter(x=>x.peluquero_id===p.id && enRango(x, rango('mes'))); return {p, n:c.length, ing:c.reduce((a,x)=>a+x.precio,0)}; }).filter(x=>x.p.activo||x.n).sort((a,b)=>b.ing-a.ing);
  const maxP = Math.max(1, ...pels.map(x=>x.ing));
  const top = `<div class="card"><h3>Peluqueros · este mes</h3>${pels.length? pels.map(x=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px"><span><b>${esc(x.p.nombre)}</b> ${!scopeSuc()?`<span class="tiny">${esc(sucName(x.p.sucursal_id))}</span>`:''}</span><span class="small">${x.n} cortes · <b>${money(x.ing)}</b></span></div><div class="meter"><span style="width:${x.ing/maxP*100}%"></span></div></div>`).join('') : '<div class="empty">Aún no hay peluqueros registrados.</div>'}</div>`;

  return header('Resumen', `${fmtDate(hoyKey())} · ${nClientes} clientes registrados`, `<button class="btn primary" data-act="nuevo-corte">+ Registrar corte</button>`) + `
    <div class="grid g4">
      ${kpi('Hoy', money(hoy.ing), `${hoy.n} cortes`)}
      ${kpi('Esta semana', money(sem.ing), `${sem.n} cortes · ticket ${money(sem.ticket)}`)}
      ${kpi('Este mes', money(mes.ing), `${mes.n} cortes`)}
      ${kpi('Mes · queda tras pagar peluqueros', money(mes.neto), `Peluqueros: ${money(mes.com)}`)}
    </div>
    <div class="section grid g2"><div class="card"><h3>Ingresos · últimos 14 días</h3>${chart}</div>${bloqueDerecho}</div>
    ${comparativo}
    <div class="section grid g2">${top}${topClientes(cs)}</div>`;
}
function topClientes(cs){
  const mes = rango('mes'); const nuevos = S.db.clientes.filter(inScope).filter(c=>String(c.creado).slice(0,10)>=mes[0]).length;
  const visitas = {}; cs.filter(c=>c.fecha >= dkey(addDays(todayDate(),-90))).forEach(c=>{ visitas[c.cliente_id]=(visitas[c.cliente_id]||0)+1; });
  const top = Object.entries(visitas).sort((a,b)=>b[1]-a[1]).slice(0,6).filter(([id])=>cliById(id));
  return `<div class="card"><h3>Clientes más frecuentes · 90 días</h3>
    <p class="small muted" style="margin-top:-4px">${nuevos} clientes nuevos este mes</p>
    ${top.length? `<table><tbody>${top.map(([id,n])=>{ const c=cliById(id); return `<tr class="click" data-cliente="${id}"><td><b>${esc(c.nombre)}</b>${!scopeSuc()?` <span class="tiny">${esc(sucName(c.sucursal_id))}</span>`:''}</td><td class="num">${n} visitas</td></tr>`;}).join('')}</tbody></table>` : '<div class="empty">Sin visitas todavía.</div>'}</div>`;
}

// ---------- clientes ----------
function clientesView(){
  const q = ui.q.trim().toLowerCase(); const qd = q.replace(/\D/g,'');
  const lista = S.db.clientes.filter(inScope).map(c=>({c, ult:ultimoCorte(c.id)}))
    .filter(({c})=> !q || c.nombre.toLowerCase().includes(q) || (qd && c.telefono.includes(qd)))
    .sort((a,b)=> (b.ult?.fecha||'').localeCompare(a.ult?.fecha||'') || a.c.nombre.localeCompare(b.c.nombre));
  const hoy = hoyKey(); const vis = lista.slice(0, 300);
  return header('Clientes', `${lista.length} clientes`, `<button class="btn primary" data-act="nuevo-cliente">+ Nuevo cliente</button>`) + `
    <div class="card">
      <div class="section-h"><input type="search" class="search" id="q" placeholder="Buscar por nombre o teléfono…" value="${esc(ui.q)}"></div>
      <div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>WhatsApp</th>${!scopeSuc()?'<th>Sucursal</th>':''}<th>Último corte</th></tr></thead><tbody>
      ${vis.length ? vis.map(({c,ult})=>`<tr class="click" data-cliente="${c.id}">
        <td><b>${esc(c.nombre)}</b><div class="tiny">${age(c.nacimiento)} años · cumple ${fmtShort(c.nacimiento)}</div></td>
        <td class="small">${fmtPhone(c.telefono)}</td>
        ${!scopeSuc()?`<td><span class="tag gray">${esc(sucName(c.sucursal_id))}</span></td>`:''}
        <td class="small">${ult?`${esc(ult.descripcion).slice(0,52)}${ult.descripcion.length>52?'…':''}<div class="tiny">hace ${diffDays(hoy, ult.fecha)} días · ${esc(pelName(ult.peluquero_id))}</div>`:'<span class="tiny">Sin cortes recientes</span>'}</td></tr>`).join('') : `<tr><td colspan="4" class="empty">${S.db.clientes.filter(inScope).length?'No hay clientes que coincidan.':'Aún no hay clientes. Da de alta el primero.'}</td></tr>`}
      </tbody></table></div>
      ${lista.length>vis.length?`<p class="tiny">Mostrando ${vis.length} de ${lista.length}. Usa el buscador para encontrar a los demás.</p>`:''}
    </div>`;
}
function clienteView(){
  const c = cliById(ui.clienteId); if (!c){ ui.clienteId=null; return clientesView(); }
  const hist = cortesDe(c.id); const ult = hist[0]; const hoy = hoyKey(); const cargando = !ui.hist[c.id];
  const gasto = hist.reduce((a,x)=>a+x.precio,0);
  const op = puedeOperar();
  return `<div class="topbar"><button class="btn ghost" data-act="volver">← Clientes</button></div>
  <div class="card">
    <div class="cl-head">
      <div style="display:flex;gap:14px;align-items:center">
        <div class="avatar">${initials(c.nombre)}</div>
        <div><h2>${esc(c.nombre)}</h2>
          <div class="small muted">📱 ${fmtPhone(c.telefono)} · 🎂 ${fmtDate(c.nacimiento)} (${age(c.nacimiento)} años) · Sucursal ${esc(sucName(c.sucursal_id))}</div>
          ${c.notas?`<div class="small" style="margin-top:4px">📝 ${esc(c.notas)}</div>`:''}
        </div>
      </div>
      ${op?`<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="editar-cliente">Editar</button>
        <a class="btn wa" href="${waLink(c.telefono)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn primary" data-act="nuevo-corte" data-cid="${c.id}">+ Nuevo corte</button>
      </div>`:''}
    </div>
    ${ult ? `<div class="last-cut">
      <div class="tiny" style="color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Último corte · “lo mismo de siempre”</div>
      <div class="desc">${esc(ult.descripcion)}</div>
      <div class="small muted">${esc(ult.servicio)} · ${money(ult.precio)} · con ${esc(pelName(ult.peluquero_id))} · ${fmtDate(ult.fecha)} (hace ${diffDays(hoy, ult.fecha)} días)</div>
      ${op?`<button class="btn primary sm" style="margin-top:10px" data-act="repetir" data-cid="${c.id}">↻ Repetir este corte</button>`:''}
    </div>` : `<div class="info" style="margin-top:14px">${cargando?'Cargando historial…':'Este cliente aún no tiene cortes registrados.'}</div>`}
    <div class="grid g4" style="margin-top:14px">
      ${kpi('Visitas', hist.length, hist.length?`desde ${fmtShort(hist[hist.length-1].fecha)}`:'')}
      ${kpi('Total gastado', money(gasto), hist.length?`promedio ${money(gasto/hist.length)}`:'')}
      ${kpi('Frecuencia', hist.length>1? Math.round(diffDays(hist[0].fecha, hist[hist.length-1].fecha)/(hist.length-1))+' días':'—', 'entre visitas')}
    </div>
  </div>
  <div class="card section"><h3>Historial de cortes ${cargando?'<span class="tiny">(actualizando…)</span>':''}</h3>
    ${hist.length? `<ul class="timeline">${hist.map(h=>`<li>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${fmtDate(h.fecha)}</b><span class="small">${esc(h.servicio)} · ${money(h.precio)}</span></div>
      <div>${esc(h.descripcion)}</div>
      <div class="tiny">${esc(pelName(h.peluquero_id))} · ${h.hora} · ${metName(h.metodo)}${h.propina?' · propina '+money(h.propina):''} ${op?`<button class="btn ghost sm" data-act="borrar-corte" data-id="${h.id}" style="padding:0 6px;font-size:12px">eliminar</button>`:''}</div>
    </li>`).join('')}</ul>` : '<div class="empty">Sin historial.</div>'}
  </div>`;
}
async function abrirCliente(id){
  ui.view='clientes'; ui.clienteId=id; render(); window.scrollTo(0,0);
  try { ui.hist[id] = await api.historial(id); if (ui.clienteId===id) render(); } catch(e){ toast(api.traducirError(e)); }
}

// ---------- cortes ----------
function cortesView(){
  const rg = rango(ui.cortesPeriodo);
  let cs = S.db.cortes.filter(inScope).filter(c=>enRango(c, rg));
  if (ui.cortesPel) cs = cs.filter(c=>c.peluquero_id===ui.cortesPel);
  cs.sort(ordenCortes);
  const st = stats(cs);
  const pels = S.db.peluqueros.filter(inScope);
  return header('Cortes', `${rg[2]} · ${fmtShort(rg[0])} al ${fmtShort(rg[1])}`, `<button class="btn primary" data-act="nuevo-corte">+ Registrar corte</button>`) + `
  <div class="card">
    <div class="row" style="margin-bottom:12px">
      <div class="field" style="margin:0"><label>Periodo</label><select id="cortes-periodo">${[['hoy','Hoy'],['semana','Esta semana'],['semana_ant','Semana pasada'],['quincena','Esta quincena'],['mes','Este mes'],['mes_ant','Mes pasado']].map(([k,l])=>`<option value="${k}" ${ui.cortesPeriodo===k?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Peluquero</label><select id="cortes-pel"><option value="">Todos</option>${pels.map(p=>`<option value="${p.id}" ${ui.cortesPel===p.id?'selected':''}>${esc(p.nombre)}${!scopeSuc()?' · '+esc(sucName(p.sucursal_id)):''}</option>`).join('')}</select></div>
    </div>
    ${cajaCard(cs, ui.cortesPeriodo==='hoy' ? 'Corte de caja · hoy' : 'Cobrado por forma de pago')}
    <div class="grid g4" style="margin-bottom:12px">${kpi('Cortes', st.n, '')}${kpi('Ingresos (sin propinas)', money(st.ing), '')}${kpi('Ticket promedio', money(st.ticket), '')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio / corte</th><th>Peluquero</th><th class="num">Precio</th><th class="num">Al peluquero</th></tr></thead><tbody>
      ${cs.length? cs.map(c=>`<tr class="click" data-cliente="${c.cliente_id}"><td class="small">${fmtShort(c.fecha)}<div class="tiny">${c.hora}</div></td><td><b>${esc(cliById(c.cliente_id)?.nombre||'—')}</b></td><td class="small">${esc(c.servicio)}<div class="tiny">${esc(c.descripcion)}</div></td><td class="small">${esc(pelName(c.peluquero_id))}${!scopeSuc()?`<div class="tiny">${esc(sucName(c.sucursal_id))}</div>`:''}</td><td class="num">${money(c.precio)}<div class="tiny">${metName(c.metodo)}${c.propina?' · +'+money(c.propina)+' prop.':''}</div></td><td class="num">${money(c.comision+(c.propina||0))}<div class="tiny">${esc(c.esquema)}</div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No hay cortes en este periodo.</td></tr>'}
    </tbody></table></div>
  </div>`;
}
function cajaCard(cs, titulo){
  const por = METODOS.map(([k,l])=>{ const x = cs.filter(c=>(c.metodo||'efectivo')===k); return {l, n:x.length, monto:x.reduce((a,c)=>a+c.precio+(c.propina||0),0)}; });
  const prop = cs.reduce((a,c)=>a+(c.propina||0),0); const total = por.reduce((a,x)=>a+x.monto,0);
  return `<div class="card" style="margin-bottom:14px"><div class="section-h"><h3 style="margin:0">${titulo}</h3><span class="small muted">Incluye propinas: ${money(prop)}</span></div>
    <div class="grid g4">${por.map(x=>kpi(x.l, money(x.monto), `${x.n} cobro${x.n===1?'':'s'}`)).join('')}${kpi('Total cobrado', money(total), `${cs.length} cortes`)}</div>
    <p class="tiny" style="margin:10px 0 0">El efectivo es lo que debe haber en caja al cerrar, antes de entregar propinas.</p></div>`;
}

// ---------- pagos ----------
const tipoAj = t => ({adelanto:'Adelanto', descuento:'Descuento', bono:'Bono'})[t] || t;
function resumenPago(p, rg){
  const c = S.db.cortes.filter(x=>x.peluquero_id===p.id && enRango(x, rg));
  const ajustes = S.db.ajustes.filter(a=>a.peluquero_id===p.id && a.fecha>=rg[0] && a.fecha<=rg[1]);
  const com = c.reduce((a,x)=>a+x.comision,0), prop = c.reduce((a,x)=>a+(x.propina||0),0), aj = ajustes.reduce((a,x)=>a+x.monto,0);
  const pagado = S.db.pagos.find(x=>x.peluquero_id===p.id && x.desde===rg[0] && x.hasta===rg[1]);
  return {p, c, ajustes, n:c.length, ing:c.reduce((a,x)=>a+x.precio,0), com, prop, aj, total:com+prop+aj, pagado};
}
function pagosView(){
  const rg = rango(ui.periodo); const op = puedeOperar();
  const filas = S.db.peluqueros.filter(inScope).map(p=>resumenPago(p, rg)).filter(f=>f.p.activo || f.n || f.ajustes.length);
  const tot = filas.reduce((a,f)=>({n:a.n+f.n, ing:a.ing+f.ing, total:a.total+f.total, pendiente:a.pendiente+(f.pagado?Math.max(0,f.total-f.pagado.monto):f.total)}), {n:0,ing:0,total:0,pendiente:0});
  const periodos = [['semana','Esta semana'],['semana_ant','Semana pasada'],['quincena','Esta quincena'],['mes','Este mes'],['mes_ant','Mes pasado']];
  const estado = f => {
    if (!f.pagado) return f.total>0 ? (op ? `<button class="btn primary sm" data-act="pagar" data-id="${f.p.id}">Marcar pagado</button>` : '<span class="tag gray">Pendiente</span>') : '<span class="tiny">Nada que pagar</span>';
    const dif = f.total - f.pagado.monto;
    return `<span class="status-paid"><span class="tag ok">✓ Pagado ${fmtShort(f.pagado.fecha)}</span>${dif>0?`<span class="tag warn">Faltan ${money(dif)}</span>`:''}</span>`;
  };
  return header('Pagos a peluqueros', `${rg[2]} · ${fmtDate(rg[0])} al ${fmtDate(rg[1])}`) + `
  <div class="card">
    <div class="section-h"><div class="seg" style="flex-wrap:wrap">${periodos.map(([k,l])=>`<button class="${ui.periodo===k?'on':''}" data-periodo="${k}">${l}</button>`).join('')}</div>
      <button class="btn" data-act="copiar-pagos">Copiar resumen</button></div>
    <div class="grid g4" style="margin-bottom:14px">${kpi('Cortes', tot.n,'')}${kpi('Vendido', money(tot.ing),'sin propinas')}${kpi('Total a peluqueros', money(tot.total),'comisión + propinas + ajustes')}${kpi('Pendiente de pagar', money(tot.pendiente), tot.pendiente? 'falta liquidar':'todo pagado ✓')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Peluquero</th><th class="num">Cortes</th><th class="num">Comisión</th><th class="num">Propinas</th><th class="num">Ajustes</th><th class="num">Total</th><th class="num">Estado</th><th></th></tr></thead><tbody>
    ${filas.length ? filas.map(f=>`<tr><td><b>${esc(f.p.nombre)}</b><div class="tiny">${esqTxt(f.p)}${!scopeSuc()?' · '+esc(sucName(f.p.sucursal_id)):''}</div></td>
      <td class="num">${f.n}<div class="tiny">${money(f.ing)}</div></td><td class="num">${money(f.com)}</td><td class="num">${money(f.prop)}</td>
      <td class="num" style="color:${f.aj<0?'var(--accent)':'inherit'}">${f.aj?money(f.aj):'—'}</td><td class="num"><b>${money(f.total)}</b></td>
      <td class="num">${estado(f)}</td><td class="num"><button class="btn sm" data-act="detalle-pago" data-id="${f.p.id}">${ui.pagoAbierto===f.p.id?'Cerrar':'Detalle'}</button></td></tr>
      ${ui.pagoAbierto===f.p.id ? `<tr><td colspan="8" style="background:#faf5ec;padding:14px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${op?`<button class="btn sm" data-act="ajuste" data-id="${f.p.id}">+ Adelanto / descuento / bono</button>`:''}
          <button class="btn sm" data-act="recibo" data-id="${f.p.id}">Ver recibo</button>
          ${op && f.pagado?`<button class="btn ghost sm" data-act="despagar" data-id="${f.pagado.id}">Deshacer pago</button>`:''}
        </div>
        ${f.ajustes.length?`<div class="small" style="font-weight:700;margin-bottom:4px">Ajustes</div><table style="margin-bottom:10px"><tbody>${f.ajustes.map(a=>`<tr><td class="small">${fmtShort(a.fecha)}</td><td class="small">${esc(tipoAj(a.tipo))} · ${esc(a.concepto||'')}</td><td class="num small" style="color:${a.monto<0?'var(--accent)':'var(--ok)'}">${money(a.monto)}</td><td class="num">${op?`<button class="btn ghost sm" data-act="borrar-ajuste" data-id="${a.id}">quitar</button>`:''}</td></tr>`).join('')}</tbody></table>`:''}
        <div class="small" style="font-weight:700;margin-bottom:4px">Cortes (${f.n})</div>
        <table><tbody>${f.c.slice().sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).map(x=>`<tr><td class="small">${fmtShort(x.fecha)} ${x.hora}</td><td class="small">${esc(cliById(x.cliente_id)?.nombre||'')}</td><td class="small">${esc(x.servicio)}</td><td class="num small">${money(x.precio)}</td><td class="num small">${money(x.comision)} <span class="tiny">(${esc(x.esquema)})</span>${x.propina?`<div class="tiny">+ ${money(x.propina)} propina</div>`:''}</td></tr>`).join('') || '<tr><td class="empty">Sin cortes</td></tr>'}</tbody></table>
      </td></tr>`:''}`).join('') : '<tr><td colspan="8" class="empty">No hay peluqueros registrados.</td></tr>'}
    </tbody></table></div>
    <p class="tiny" style="margin-top:12px">La comisión de cada corte se calcula con el esquema que tenía el peluquero ese día. Las propinas van completas al peluquero. Adelantos y descuentos se restan; los bonos se suman.</p>
  </div>`;
}
function textoRecibo(f, rg){
  return `RECIBO DE PAGO · ${cfgDe(f.p.sucursal_id).negocio} ${sucName(f.p.sucursal_id)}
Peluquero: ${f.p.nombre}
Periodo: ${fmtDate(rg[0])} al ${fmtDate(rg[1])}
----------------------------------
Cortes realizados: ${f.n} (vendido ${money(f.ing)})
Comisión (${esqTxt(f.p)}): ${money(f.com)}
Propinas: ${money(f.prop)}
${f.ajustes.map(a=>`${tipoAj(a.tipo)} ${fmtShort(a.fecha)}${a.concepto?' ('+a.concepto+')':''}: ${money(a.monto)}`).join('\n')}${f.ajustes.length?'\n':''}----------------------------------
TOTAL A PAGAR: ${money(f.total)}
${f.pagado?`Pagado el ${fmtDate(f.pagado.fecha)}: ${money(f.pagado.monto)}`:'Pendiente de pago'}`;
}

// ---------- WhatsApp (solo encargados) ----------
function mensajesView(){
  const cs = cumpleanos(); const rs = recordatorios(); const cfg = cfgDe(S.perfil.sucursal_id);
  const recPend = rs.filter(x=>!x.proximo && !x.enviado && x.dias<120), recProx = rs.filter(x=>x.proximo && !x.enviado), recEnv = rs.filter(x=>x.enviado), inactivos = rs.filter(x=>!x.proximo && !x.enviado && x.dias>=120);
  const tabs = [['cumple',`🎂 Cumpleaños (${cs.length})`],['recordatorio',`💈 Recordatorios (${recPend.length})`],['plantillas','⚙️ Mensajes']];
  const item = (x, tipo, fecha) => `<div class="msg">
      <div><b>${esc(x.cliente.nombre)}</b> <span class="small muted">· ${fmtPhone(x.cliente.telefono)}</span>
        <div class="small">${tipo==='cumple' ? (x.en===0?'<span class="tag red">Hoy</span>':`<span class="tag gray">en ${x.en} día${x.en>1?'s':''} · ${fmtShort(x.fecha)}</span>`)+` cumple ${x.cumple} años` : `<span class="tag ${x.proximo?'gray':'warn'}">${x.dias} días sin venir</span> último: ${esc(x.ult.servicio)} con ${esc(pelName(x.ult.peluquero_id))}`}</div>
        <div class="bubble">${esc(x.texto)}</div></div>
      <div class="msg-actions">${x.enviado ? `<span class="tag ok">✓ Enviado</span>` : `<a class="btn wa sm" href="${waLink(x.cliente.telefono, x.texto)}" target="_blank" rel="noopener" data-send="${x.cliente.id}" data-tipo="${tipo}" data-fecha="${fecha||''}">Enviar por WhatsApp</a><button class="btn sm" data-mark="${x.cliente.id}" data-tipo="${tipo}" data-fecha="${fecha||''}">Marcar enviado</button>`}</div>
    </div>`;
  let body;
  if (ui.msgTab==='cumple'){
    body = `<div class="card">${cs.length? cs.map(x=>item(x,'cumple',x.fecha)).join('') : '<div class="empty">Nadie cumple años en los próximos 7 días.</div>'}</div>`;
  } else if (ui.msgTab==='recordatorio'){
    body = `<div class="card"><h3>Por enviar · ${cfg.dias_recordatorio}+ días sin corte</h3>${recPend.length? recPend.map(x=>item(x,'recordatorio')).join('') : '<div class="empty">Todo al día 👌</div>'}</div>
      ${recProx.length?`<div class="card section"><h3>Próximos (les toca en 1 a 3 días)</h3>${recProx.map(x=>item(x,'recordatorio')).join('')}</div>`:''}
      ${recEnv.length?`<div class="card section"><h3>Ya se les envió recordatorio (no han regresado)</h3>${recEnv.map(x=>`<div class="msg"><div><b>${esc(x.cliente.nombre)}</b> <span class="small muted">· ${x.dias} días sin venir · enviado ${fmtShort(x.enviado.fecha)}</span></div><div class="msg-actions"><span class="tag ok">✓ Enviado</span></div></div>`).join('')}</div>`:''}
      ${inactivos.length?`<div class="card section"><h3>Clientes inactivos (+120 días)</h3><p class="small muted">No aparecen como pendientes. Puedes escribirles a mano si quieres recuperarlos.</p>${inactivos.map(x=>`<div class="small" style="padding:4px 0">${esc(x.cliente.nombre)} · ${x.dias} días · <a href="${waLink(x.cliente.telefono)}" target="_blank" rel="noopener">WhatsApp</a></div>`).join('')}</div>`:''}`;
  } else {
    body = `<div class="card">
      <div class="field"><label>Nombre del negocio</label><input type="text" id="cfg-negocio" value="${esc(cfg.negocio)}"></div>
      <div class="field"><label>Mensaje de cumpleaños</label><textarea id="cfg-cumple" rows="4">${esc(cfg.plantilla_cumple)}</textarea></div>
      <div class="field"><label>Mensaje de recordatorio</label><textarea id="cfg-rec" rows="4">${esc(cfg.plantilla_recordatorio)}</textarea></div>
      <div class="field" style="max-width:280px"><label>Enviar recordatorio a los … días del último corte</label><input type="number" min="7" max="90" id="cfg-dias" value="${cfg.dias_recordatorio}"></div>
      <p class="tiny">Variables: {nombre} {nombre_completo} {sucursal} {negocio} {peluquero} {dias} {ultimo_corte}</p>
      <div class="err" id="cfg-err"></div>
      <div class="modal-f"><button class="btn primary" data-act="guardar-cfg">Guardar</button></div>
    </div>`;
  }
  return header('WhatsApp', 'Felicitaciones de cumpleaños y recordatorios para volver') + `
    <div class="info" style="margin-bottom:14px">Toca <b>Enviar por WhatsApp</b>: se abre WhatsApp con el mensaje ya escrito, solo das enviar. Queda marcado para no repetirlo.</div>
    <div class="seg" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k,l])=>`<button class="${ui.msgTab===k?'on':''}" data-msgtab="${k}">${l}</button>`).join('')}</div>
    ${body}`;
}

// ---------- equipo y precios ----------
function equipoView(){
  const sucs = scopeSuc() ? [scopeSuc()] : S.db.sucursales.map(s=>s.id); const op = puedeOperar(); const mes = rango('mes');
  return header('Equipo y precios', op ? 'Tus peluqueros, su forma de pago y la lista de precios' : 'Consulta. Los cambios los hace cada encargado y quedan en la bitácora.') + `
  ${op?'<div class="readonly-note">Los cambios de comisiones y precios quedan registrados y el dueño los puede consultar.</div>':''}
  <div class="grid g2">
    ${sucs.map(s=>`<div class="card"><div class="section-h"><h3 style="margin:0">Peluqueros · ${esc(sucName(s))}</h3>${op?`<button class="btn sm" data-act="nuevo-pel">+ Peluquero</button>`:''}</div>
      ${S.db.peluqueros.filter(p=>p.sucursal_id===s).length ? `<table><tbody>${S.db.peluqueros.filter(p=>p.sucursal_id===s).map(p=>{ const n = S.db.cortes.filter(c=>c.peluquero_id===p.id && enRango(c,mes)).length; return `<tr><td><b>${esc(p.nombre)}</b> ${p.activo?'':'<span class="tag gray">inactivo</span>'}<div class="tiny">${n} cortes este mes</div></td><td><span class="tag ${p.esquema==='fijo'?'warn':''}">${esqTxt(p)}</span></td><td class="num">${op?`<button class="btn sm" data-act="editar-pel" data-id="${p.id}">Editar</button>`:''}</td></tr>`;}).join('')}</tbody></table>` : '<div class="empty">Sin peluqueros todavía.</div>'}
    </div>
    <div class="card"><div class="section-h"><h3 style="margin:0">Precios · ${esc(sucName(s))}</h3>${op?'<button class="btn sm" data-act="nuevo-serv">+ Servicio</button>':''}</div>
      <table><tbody>${S.db.servicios.filter(x=>x.sucursal_id===s).map(x=>`<tr><td>${esc(x.nombre)} ${x.activo?'':'<span class="tag gray">oculto</span>'}</td><td class="num"><b>${money(x.precio)}</b></td><td class="num">${op?`<button class="btn sm" data-act="editar-serv" data-id="${x.id}">Editar</button>`:''}</td></tr>`).join('')}</tbody></table>
    </div>`).join('')}
  </div>`;
}

// ---------- bitácora (dueño) ----------
function describir(b){
  const A = b.antes || {}, D = b.despues || {}; const pel = id => esc(pelName(id));
  const esq = x => x.esquema==='fijo' ? `${money(x.valor)} fijo` : `${Number(x.valor)}%`;
  switch(b.tabla){
    case 'peluqueros':
      if (b.accion==='insert') return [`Agregó al peluquero <b>${esc(D.nombre)}</b> con ${esq(D)}`, ''];
      if (b.accion==='delete') return [`Eliminó al peluquero ${esc(A.nombre)}`, 'red'];
      if (A.esquema!==D.esquema || Number(A.valor)!==Number(D.valor)) return [`Cambió el pago de <b>${esc(D.nombre)}</b>: ${esq(A)} → <b>${esq(D)}</b>`, 'red'];
      if (A.activo!==D.activo) return [`${D.activo?'Reactivó':'Desactivó'} a ${esc(D.nombre)}`, 'warn'];
      return [`Editó los datos de ${esc(D.nombre)}`, ''];
    case 'servicios':
      if (b.accion==='insert') return [`Agregó el servicio <b>${esc(D.nombre)}</b> a ${money(D.precio)}`, ''];
      if (b.accion==='delete') return [`Eliminó el servicio ${esc(A.nombre)}`, 'warn'];
      if (Number(A.precio)!==Number(D.precio)) return [`Cambió el precio de <b>${esc(D.nombre)}</b>: ${money(A.precio)} → <b>${money(D.precio)}</b>`, 'warn'];
      return [`Editó el servicio ${esc(D.nombre)}${A.activo!==D.activo?(D.activo?' (visible)':' (oculto)'):''}`, ''];
    case 'pagos':
      if (b.accion==='insert') return [`Pagó <b>${money(D.monto)}</b> a ${pel(D.peluquero_id)} (${fmtShort(D.desde)} al ${fmtShort(D.hasta)})`, 'ok'];
      if (b.accion==='delete') return [`Deshizo el pago de ${money(A.monto)} a ${pel(A.peluquero_id)} (${fmtShort(A.desde)} al ${fmtShort(A.hasta)})`, 'red'];
      return ['Modificó un pago', 'warn'];
    case 'ajustes':
      if (b.accion==='insert') return [`${tipoAj(D.tipo)} de <b>${money(Math.abs(D.monto))}</b> a ${pel(D.peluquero_id)}${D.concepto?' · '+esc(D.concepto):''}`, D.tipo==='bono'?'warn':''];
      if (b.accion==='delete') return [`Quitó un ${tipoAj(A.tipo).toLowerCase()} de ${money(Math.abs(A.monto))} a ${pel(A.peluquero_id)}`, 'warn'];
      return ['Modificó un ajuste', 'warn'];
    case 'config': return [`Cambió ${Number(A.dias_recordatorio)!==Number(D.dias_recordatorio)?`los días del recordatorio (${A.dias_recordatorio} → ${D.dias_recordatorio})`:'los mensajes de WhatsApp'}`, ''];
    case 'cortes':
      if (b.accion==='delete') return [`Eliminó un corte de <b>${money(A.precio)}</b> del ${fmtShort(A.fecha)} · ${esc(cliById(A.cliente_id)?.nombre||'cliente')} con ${pel(A.peluquero_id)}`, 'red'];
      return [`Modificó un corte del ${fmtShort(D.fecha)} (${money(A.precio)} → ${money(D.precio)})`, 'red'];
  }
  return [`${b.accion} en ${b.tabla}`, ''];
}
function bitacoraView(){
  const head = header('Bitácora', 'Cambios hechos por los encargados: comisiones, precios, pagos, ajustes y cortes eliminados');
  if (!ui.bitacora) return head + `<div class="card">${cargandoView('Cargando bitácora…')}</div>`;
  let rows = ui.bitacora.filter(inScope).map(b=>({b, d:describir(b)}));
  if (ui.bitFiltro==='sensibles') rows = rows.filter(x=>x.d[1]==='red' || x.d[1]==='warn');
  return head + `<div class="card">
    <div class="section-h"><div class="seg">${[['todo','Todo'],['sensibles','Solo cambios sensibles']].map(([k,l])=>`<button class="${ui.bitFiltro===k?'on':''}" data-bitf="${k}">${l}</button>`).join('')}</div>
      <button class="btn sm" data-act="recargar-bitacora">Actualizar</button></div>
    ${rows.length? rows.map(({b,d})=>`<div class="log"><div class="when">${fmtTs(b.creado)}</div><div>${d[0]}<div class="tiny">${esc(b.usuario_nombre||'—')} · Sucursal ${esc(sucName(b.sucursal_id))}</div></div><div>${d[1]==='red'?'<span class="tag red">revisar</span>':d[1]==='warn'?'<span class="tag warn">cambio</span>':''}</div></div>`).join('') : '<div class="empty">Sin movimientos registrados.</div>'}
  </div>`;
}
async function cargarBitacora(){ try { ui.bitacora = await api.bitacora(); } catch(e){ ui.bitacora = []; toast(api.traducirError(e)); } if (ui.view==='bitacora') render(); }

// ---------- modales ----------
function openModal(title, body, onMount){
  $('#modal-root').innerHTML = `<div class="overlay" data-overlay><div class="modal" role="dialog" aria-modal="true"><div class="modal-h"><h2>${title}</h2><button class="btn ghost" data-act="cerrar">✕</button></div>${body}</div></div>`;
  onMount && onMount($('#modal-root .modal'));
  const f = $('#modal-root input:not([type=hidden]), #modal-root select, #modal-root textarea'); f && f.focus();
}
function closeModal(){ $('#modal-root').innerHTML=''; }
function toast(t){ const el = document.createElement('div'); el.className='toast'; el.textContent=t; document.body.appendChild(el); setTimeout(()=>el.remove(), 2800); }
function confirmar(html, onOk){
  openModal('¿Confirmas?', `<p>${html}</p><div class="err" id="cf-err"></div><div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="ok">Sí, continuar</button></div>`,
    m=>{ $('#ok',m).onclick = () => guardarCon($('#ok',m), $('#cf-err',m), async()=>{ await onOk(); closeModal(); }); });
}
// Ejecuta una acción que guarda en la base de datos, mostrando errores en el modal
async function guardarCon(btn, errEl, fn, okMsg){
  btn && btn.classList.add('busy'); errEl && (errEl.textContent = '');
  try { await fn(); okMsg && toast(okMsg); render(); }
  catch(e){ const m = api.traducirError(e); if (errEl) errEl.textContent = m; else toast(m); }
  finally { btn && btn.classList.remove('busy'); }
}
const reemplazar = (tabla, fila, llave='id') => { const i = S.db[tabla].findIndex(x=>x[llave]===fila[llave]); if (i>=0) S.db[tabla][i] = fila; else S.db[tabla].push(fila); };

function modalCliente(c){
  const edit = !!c; c = c || {nombre:'', nacimiento:'', telefono:'', notas:''};
  openModal(edit?'Editar cliente':'Nuevo cliente', `
    <div class="field"><label>Nombre completo</label><input type="text" id="f-nombre" value="${esc(c.nombre)}" placeholder="Ej. Juan Pérez López"></div>
    <div class="row"><div class="field"><label>Fecha de nacimiento</label><input type="date" id="f-nac" value="${c.nacimiento}" max="${hoyKey()}"></div>
    <div class="field"><label>WhatsApp (10 dígitos)</label><input type="tel" id="f-tel" value="${esc(c.telefono)}" placeholder="55 1234 5678" inputmode="numeric"></div></div>
    <div class="field"><label>Notas (opcional)</label><input type="text" id="f-notas" value="${esc(c.notas)}" placeholder="Alergias, preferencias, remolinos…"></div>
    <div class="err" id="f-err"></div>
    <div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="f-save">${edit?'Guardar':'Dar de alta'}</button></div>`,
  m=>{ $('#f-save',m).onclick=()=>{
      const nombre = $('#f-nombre').value.trim().replace(/\s+/g,' '); const nac = $('#f-nac').value; const tel = $('#f-tel').value.replace(/\D/g,'').replace(/^52(?=\d{10}$)/,'');
      const err = !nombre || nombre.split(' ').length<2 ? 'Escribe nombre y al menos un apellido.' : !nac ? 'Falta la fecha de nacimiento.' : nac>hoyKey() ? 'La fecha de nacimiento no puede ser futura.' : tel.length!==10 ? 'El WhatsApp debe tener 10 dígitos.' :
        S.db.clientes.some(x=>x.telefono===tel && x.id!==c.id) ? 'Ya hay un cliente con ese número.' : '';
      if (err){ $('#f-err').textContent = err; return; }
      const data = {nombre, nacimiento:nac, telefono:tel, notas:$('#f-notas').value.trim()};
      guardarCon($('#f-save'), $('#f-err'), async()=>{
        if (edit) reemplazar('clientes', await api.editar('clientes', c.id, data));
        else { const n = await api.crear('clientes', {...data, sucursal_id:S.perfil.sucursal_id}); S.db.clientes.push(n); ui.view='clientes'; ui.clienteId=n.id; ui.hist[n.id]=[]; }
        closeModal();
      }, edit?'Cliente actualizado':'Cliente dado de alta');
  }; });
}

function modalCorte(clienteId, repetir){
  let selected = clienteId ? cliById(clienteId) : null;
  const prev = repetir && selected ? cortesDe(selected.id)[0] : null;
  const misPel = S.db.peluqueros.filter(p=>p.activo && p.sucursal_id===S.perfil.sucursal_id);
  const misServ = S.db.servicios.filter(s=>s.activo && s.sucursal_id===S.perfil.sucursal_id);
  if (!misPel.length || !misServ.length){ toast('Primero da de alta peluqueros y precios en "Equipo y precios".'); ui.view='equipo'; render(); return; }
  const s0 = (prev && misServ.find(s=>s.id===prev.servicio_id)) || misServ[0];
  openModal(repetir?'Repetir corte':'Registrar corte', `
    <div class="field"><label>Cliente</label><div id="cli-box"></div></div>
    <div class="row"><div class="field"><label>Peluquero</label><select id="k-pel">${misPel.map(p=>`<option value="${p.id}" ${prev?.peluquero_id===p.id?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
      <div class="field"><label>Servicio</label><select id="k-serv">${misServ.map(s=>`<option value="${s.id}" ${s.id===s0.id?'selected':''}>${esc(s.nombre)} · ${money(s.precio)}</option>`).join('')}</select></div></div>
    <div class="field"><label>¿Qué corte se hizo? (para la próxima)</label>
      <div class="chips" id="k-chips">${CHIPS.map(c=>`<button type="button" class="chip">${esc(c)}</button>`).join('')}</div>
      <textarea id="k-desc" placeholder="Toca los botones de arriba o escribe. Ej. Fade bajo #0, tijera arriba 4 cm">${esc(prev?.descripcion||'')}</textarea></div>
    <div class="row"><div class="field"><label>Precio cobrado</label><input type="number" id="k-precio" min="0" value="${s0.precio}"></div>
      <div class="field"><label>Propina (completa al peluquero)</label><input type="number" id="k-prop" min="0" value="0"></div></div>
    <div class="row"><div class="field" style="flex:2"><label>Forma de pago</label><div class="seg" id="k-met" style="width:max-content;max-width:100%">${METODOS.map(([k,l],i)=>`<button type="button" data-m="${k}" class="${i===0?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Fecha</label><input type="date" id="k-fecha" value="${hoyKey()}" max="${hoyKey()}"></div></div>
    <div class="small muted" id="k-com"></div>
    <div class="err" id="k-err"></div>
    <div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="k-save">Guardar corte</button></div>`,
  m=>{
    const box = $('#cli-box', m); let metodo = 'efectivo';
    const updCom = () => { const p = misPel.find(x=>x.id===$('#k-pel').value); const pr = Number($('#k-precio').value)||0; const pp = Number($('#k-prop').value)||0;
      $('#k-com').innerHTML = p ? `Le toca a ${esc(firstName(p.nombre))}: <b>${money(comisionDe(p, pr)+pp)}</b> (${p.esquema==='fijo'? money(p.valor)+' fijo':Number(p.valor)+'%'}${pp?' + propina':''}) · Queda a la sucursal: <b>${money(pr-comisionDe(p,pr))}</b> · <b>Cobrar ${money(pr+pp)}</b>` : ''; };
    const drawCli = () => {
      if (selected){
        const u = cortesDe(selected.id)[0];
        box.innerHTML = `<div class="picked"><div><b>${esc(selected.nombre)}</b><div class="tiny">${u?'Último: '+esc(u.descripcion):'Cliente sin cortes previos'}</div></div><button type="button" class="btn ghost sm" id="cli-x">Cambiar</button></div>
          ${u && !repetir ? `<button type="button" class="btn sm" style="margin-top:6px" id="cli-same">↻ Lo mismo que la última vez</button>`:''}`;
        $('#cli-x',box).onclick = ()=>{ selected=null; drawCli(); };
        const same = $('#cli-same',box); if (same) same.onclick = ()=>{ $('#k-desc').value=u.descripcion; const sv = misServ.find(s=>s.id===u.servicio_id); if (sv){ $('#k-serv').value=sv.id; $('#k-precio').value=sv.precio; } if (misPel.some(p=>p.id===u.peluquero_id)) $('#k-pel').value=u.peluquero_id; updCom(); toast('Copiado del último corte'); };
      } else {
        box.innerHTML = `<input type="search" id="cli-q" placeholder="Busca por nombre o teléfono…"><div class="pick-list" id="cli-list"></div><button type="button" class="btn ghost sm" style="margin-top:4px" id="cli-new">+ Cliente nuevo</button>`;
        const list = $('#cli-list',box);
        const draw = q => { q=q.toLowerCase(); const qd = q.replace(/\D/g,''); const r = S.db.clientes.filter(inScope).filter(c=>!q || c.nombre.toLowerCase().includes(q) || (qd && c.telefono.includes(qd))).slice(0,30);
          list.innerHTML = r.map(c=>`<button type="button" data-pick="${c.id}"><span>${esc(c.nombre)}</span><span class="tiny">${fmtPhone(c.telefono)}</span></button>`).join('') || '<div class="empty small">Sin resultados</div>'; };
        draw(''); $('#cli-q',box).oninput = e=>draw(e.target.value);
        list.onclick = e=>{ const b=e.target.closest('[data-pick]'); if(!b) return; selected=cliById(b.dataset.pick); drawCli(); };
        $('#cli-new',box).onclick = ()=>{ closeModal(); modalCliente(); };
      }
    };
    $('#k-serv',m).onchange = e=>{ $('#k-precio').value = misServ.find(s=>s.id===e.target.value).precio; updCom(); };
    $('#k-pel',m).onchange = updCom; $('#k-precio',m).oninput = updCom; $('#k-prop',m).oninput = updCom;
    $('#k-met',m).onclick = e=>{ const b=e.target.closest('[data-m]'); if(!b) return; metodo=b.dataset.m; [...$('#k-met').children].forEach(x=>x.classList.toggle('on', x===b)); };
    $('#k-chips',m).onclick = e=>{ const b=e.target.closest('.chip'); if(!b) return; const ta=$('#k-desc'); const v=ta.value.trim(); ta.value = v ? `${v}${/^#/.test(b.textContent)?' ':', '}${b.textContent}` : b.textContent; ta.focus(); };
    drawCli(); updCom();
    $('#k-save',m).onclick = ()=>{
      const p = misPel.find(x=>x.id===$('#k-pel').value); const s = misServ.find(x=>x.id===$('#k-serv').value);
      const desc = $('#k-desc').value.trim(); const precio = Number($('#k-precio').value); const propina = Number($('#k-prop').value)||0; const fecha = $('#k-fecha').value;
      const err = !selected ? 'Selecciona al cliente.' : !p ? 'Selecciona al peluquero.' : !desc ? 'Describe el corte para que la próxima vez sepan qué hacer.' : !(precio>=0) || $('#k-precio').value==='' ? 'Revisa el precio.' : propina<0 ? 'Revisa la propina.' : !fecha || fecha>hoyKey() ? 'Revisa la fecha.' : '';
      if (err){ $('#k-err').textContent = err; return; }
      const now = new Date();
      guardarCon($('#k-save'), $('#k-err'), async()=>{
        const n = await api.crear('cortes', {sucursal_id:S.perfil.sucursal_id, cliente_id:selected.id, peluquero_id:p.id, servicio_id:s.id, servicio:s.nombre, descripcion:desc, precio, propina, metodo, fecha, hora:`${pad(now.getHours())}:${pad(now.getMinutes())}`});
        S.db.cortes.push(n); if (ui.hist[selected.id]) ui.hist[selected.id].unshift(n);
        closeModal();
      }, 'Corte registrado');
    };
  });
}

function modalPeluquero(p){
  const edit = !!p; p = p || {nombre:'', esquema:'porcentaje', valor:50, activo:true};
  openModal(edit?'Editar peluquero':'Nuevo peluquero', `
    <div class="field"><label>Nombre</label><input type="text" id="p-nombre" value="${esc(p.nombre)}"></div>
    <div class="row"><div class="field"><label>¿Cómo se le paga?</label><select id="p-esq"><option value="porcentaje" ${p.esquema==='porcentaje'?'selected':''}>Porcentaje de cada corte</option><option value="fijo" ${p.esquema==='fijo'?'selected':''}>Monto fijo por corte</option></select></div>
    <div class="field"><label id="p-vl">${p.esquema==='fijo'?'Monto por corte ($)':'Porcentaje (%)'}</label><input type="number" id="p-val" min="0" value="${Number(p.valor)}"></div></div>
    ${edit?`<div class="field"><label>Estado</label><select id="p-act"><option value="1" ${p.activo?'selected':''}>Activo</option><option value="0" ${!p.activo?'selected':''}>Inactivo (ya no trabaja aquí)</option></select></div>`:''}
    <p class="tiny">El cambio aplica a los cortes nuevos. Los cortes ya registrados conservan su comisión.</p>
    <div class="err" id="p-err"></div>
    <div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="p-save">Guardar</button></div>`,
  m=>{ $('#p-esq',m).onchange = e=>{ $('#p-vl').textContent = e.target.value==='fijo'?'Monto por corte ($)':'Porcentaje (%)'; };
    $('#p-save',m).onclick=()=>{ const nombre=$('#p-nombre').value.trim(); const esquema=$('#p-esq').value; const valor=Number($('#p-val').value);
      const err = !nombre ? 'Falta el nombre.' : !(valor>0) ? 'Indica el valor del pago.' : esquema==='porcentaje' && valor>100 ? 'El porcentaje no puede pasar de 100.' : '';
      if (err){ $('#p-err').textContent=err; return; }
      const data = {nombre, esquema, valor, activo: edit ? $('#p-act').value==='1' : true};
      guardarCon($('#p-save'), $('#p-err'), async()=>{
        if (edit) reemplazar('peluqueros', await api.editar('peluqueros', p.id, data)); else S.db.peluqueros.push(await api.crear('peluqueros', {...data, sucursal_id:S.perfil.sucursal_id}));
        closeModal();
      }, 'Peluquero guardado'); }; });
}
function modalServicio(s){
  const edit = !!s; s = s || {nombre:'', precio:'', activo:true};
  openModal(edit?'Editar servicio':'Nuevo servicio', `
    <div class="field"><label>Servicio</label><input type="text" id="s-nombre" value="${esc(s.nombre)}"></div>
    <div class="row"><div class="field"><label>Precio</label><input type="number" id="s-precio" min="0" value="${s.precio}"></div>
    ${edit?`<div class="field"><label>Mostrar al registrar cortes</label><select id="s-act"><option value="1" ${s.activo?'selected':''}>Sí</option><option value="0" ${!s.activo?'selected':''}>No (ocultar)</option></select></div>`:''}</div>
    <div class="err" id="s-err"></div>
    <div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="s-save">Guardar</button></div>`,
  m=>{ $('#s-save',m).onclick=()=>{ const nombre=$('#s-nombre').value.trim(), precio=Number($('#s-precio').value);
    if(!nombre||!(precio>0)){ $('#s-err').textContent='Completa nombre y precio.'; return; }
    const data = {nombre, precio, activo: edit ? $('#s-act').value==='1' : true};
    guardarCon($('#s-save'), $('#s-err'), async()=>{
      if (edit) reemplazar('servicios', await api.editar('servicios', s.id, data));
      else S.db.servicios.push(await api.crear('servicios', {...data, sucursal_id:S.perfil.sucursal_id, orden:S.db.servicios.length+1}));
      closeModal();
    }, 'Precio guardado'); }; });
}
function modalRecibo(p){
  const rg = rango(ui.periodo); const txt = textoRecibo(resumenPago(p, rg), rg);
  openModal('Recibo', `<div class="recibo">${esc(txt)}</div><div class="modal-f"><button class="btn" id="r-copy">Copiar</button><button class="btn primary" data-act="cerrar">Listo</button></div>`,
  m=>{ $('#r-copy',m).onclick=()=>navigator.clipboard.writeText(txt).then(()=>toast('Recibo copiado'),()=>toast('Selecciona el texto y cópialo')); });
}
function modalAjuste(p){
  const rg = rango(ui.periodo); const hoy = hoyKey(); const def = hoy>=rg[0] && hoy<=rg[1] ? hoy : rg[1];
  openModal(`Ajuste · ${esc(firstName(p.nombre))}`, `
    <div class="row"><div class="field"><label>Tipo</label><select id="a-tipo"><option value="adelanto">Adelanto (se resta)</option><option value="descuento">Descuento (se resta)</option><option value="bono">Bono (se suma)</option></select></div>
    <div class="field"><label>Monto</label><input type="number" id="a-monto" min="1" placeholder="0"></div></div>
    <div class="row"><div class="field"><label>Concepto</label><input type="text" id="a-con" placeholder="Ej. Adelanto de nómina"></div>
    <div class="field"><label>Fecha</label><input type="date" id="a-fecha" value="${def}" min="${rg[0]}" max="${rg[1] < hoy ? rg[1] : hoy}"></div></div>
    <div class="err" id="a-err"></div>
    <div class="modal-f"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="a-save">Guardar</button></div>`,
  m=>{ $('#a-save',m).onclick=()=>{ const tipo=$('#a-tipo').value, monto=Number($('#a-monto').value), fecha=$('#a-fecha').value;
      if(!(monto>0)){ $('#a-err').textContent='Indica el monto.'; return; }
      if(!fecha || fecha<rg[0] || fecha>rg[1]){ $('#a-err').textContent='La fecha debe estar dentro del periodo.'; return; }
      guardarCon($('#a-save'), $('#a-err'), async()=>{
        S.db.ajustes.push(await api.crear('ajustes', {sucursal_id:S.perfil.sucursal_id, peluquero_id:p.id, tipo, monto: tipo==='bono'? monto : -monto, concepto:$('#a-con').value.trim(), fecha}));
        closeModal();
      }, 'Ajuste guardado'); }; });
}

// ---------- arranque y sesión ----------
async function entrar(perfil){
  S.perfil = perfil; S.db = null; ui.view='inicio'; ui.scope='todas'; ui.clienteId=null; ui.hist={}; ui.bitacora=null; render();
  try { S.db = await api.cargar(); render(); }
  catch(e){ $('#root').innerHTML = `${demoBar()}<div class="loading"><b>No se pudieron cargar los datos.</b><div>${esc(api.traducirError(e))}</div><button class="btn" data-act="recargar">Reintentar</button> <button class="btn ghost" data-act="logout">Cerrar sesión</button></div>`; }
}
async function iniciar(){
  $('#root').innerHTML = cargandoView('Conectando…');
  try { const p = await api.sesion(); if (p) return entrar(p); }
  catch(e){ toast(api.traducirError(e)); }
  render();
}

// ---------- eventos ----------
document.addEventListener('submit', async e=>{
  if (e.target.id!=='login') return; e.preventDefault();
  const btn = $('#l-btn'); btn.classList.add('busy'); $('#l-err').textContent='';
  try { const p = await api.login($('#l-email').value.trim(), $('#l-pass').value); await entrar(p); }
  catch(err){ $('#l-err') && ($('#l-err').textContent = api.traducirError(err)); }
  finally { btn.classList.remove('busy'); }
});
document.addEventListener('click', async e=>{
  const t = e.target.closest('[data-go],[data-act],[data-demo],[data-scope],[data-cliente],[data-periodo],[data-msgtab],[data-mark],[data-send],[data-bitf],[data-overlay]');
  if (!t) return;
  if (t.hasAttribute('data-overlay')){ if (e.target===t) closeModal(); return; }
  if (t.dataset.demo){ entrar(await api.login(t.dataset.demo)); return; }
  if (t.dataset.go){ ui.view=t.dataset.go; ui.clienteId=null; if (ui.view==='bitacora') cargarBitacora(); render(); window.scrollTo(0,0); return; }
  if (t.dataset.scope){ ui.scope=t.dataset.scope; ui.cortesPel=''; render(); return; }
  if (t.dataset.cliente){ abrirCliente(t.dataset.cliente); return; }
  if (t.dataset.periodo){ ui.periodo=t.dataset.periodo; ui.pagoAbierto=null; render(); return; }
  if (t.dataset.msgtab){ ui.msgTab=t.dataset.msgtab; render(); return; }
  if (t.dataset.bitf){ ui.bitFiltro=t.dataset.bitf; render(); return; }
  if (t.dataset.send || t.dataset.mark){
    const cid = t.dataset.send || t.dataset.mark; const tipo = t.dataset.tipo;
    try { S.db.mensajes.push(await api.crear('mensajes', {sucursal_id:S.perfil.sucursal_id, cliente_id:cid, tipo, fecha: tipo==='cumple' && t.dataset.fecha ? t.dataset.fecha : hoyKey()})); if (t.dataset.mark) toast('Marcado como enviado'); render(); }
    catch(err){ toast(api.traducirError(err)); }
    return;
  }
  const a = t.dataset.act; const id = t.dataset.id;
  if (a==='cerrar') closeModal();
  else if (a==='logout'){ await api.logout(); S.perfil=null; S.db=null; render(); }
  else if (a==='recargar'){ entrar(S.perfil); }
  else if (a==='reset-demo') confirmar('Se borrarán los cambios hechos en la demostración.', async()=>{ api.reiniciar(); });
  else if (a==='nuevo-cliente') modalCliente();
  else if (a==='editar-cliente') modalCliente(cliById(ui.clienteId));
  else if (a==='nuevo-corte') modalCorte(t.dataset.cid || null, false);
  else if (a==='repetir') modalCorte(t.dataset.cid, true);
  else if (a==='volver'){ ui.clienteId=null; render(); }
  else if (a==='borrar-corte') confirmar('¿Eliminar este corte del historial? También se quita del cálculo de pagos. <b>El dueño verá en la bitácora que se eliminó.</b>', async()=>{
      await api.borrar('cortes', id); S.db.cortes = S.db.cortes.filter(c=>c.id!==id); for (const k in ui.hist) ui.hist[k] = ui.hist[k].filter(c=>c.id!==id); toast('Corte eliminado'); });
  else if (a==='detalle-pago'){ ui.pagoAbierto = ui.pagoAbierto===id ? null : id; render(); }
  else if (a==='pagar'){
    const p = S.db.peluqueros.find(x=>x.id===id); const rg = rango(ui.periodo); const f = resumenPago(p, rg);
    confirmar(`Registrar pago a <b>${esc(p.nombre)}</b> por <b>${money(f.total)}</b> (${fmtShort(rg[0])} al ${fmtShort(rg[1])}).`, async()=>{
      S.db.pagos.push(await api.crear('pagos', {sucursal_id:S.perfil.sucursal_id, peluquero_id:p.id, desde:rg[0], hasta:rg[1], monto:f.total, fecha:hoyKey()})); toast('Pago registrado'); });
  }
  else if (a==='despagar') confirmar('¿Deshacer este pago? Volverá a aparecer como pendiente.', async()=>{ await api.borrar('pagos', id); S.db.pagos = S.db.pagos.filter(x=>x.id!==id); });
  else if (a==='ajuste') modalAjuste(S.db.peluqueros.find(x=>x.id===id));
  else if (a==='recibo') modalRecibo(S.db.peluqueros.find(x=>x.id===id));
  else if (a==='borrar-ajuste') guardarCon(t, null, async()=>{ await api.borrar('ajustes', id); S.db.ajustes = S.db.ajustes.filter(x=>x.id!==id); }, 'Ajuste quitado');
  else if (a==='nuevo-pel') modalPeluquero();
  else if (a==='editar-pel') modalPeluquero(S.db.peluqueros.find(p=>p.id===id));
  else if (a==='nuevo-serv') modalServicio();
  else if (a==='editar-serv') modalServicio(S.db.servicios.find(s=>s.id===id));
  else if (a==='recargar-bitacora'){ ui.bitacora=null; render(); cargarBitacora(); }
  else if (a==='guardar-cfg'){
    const dias = Number($('#cfg-dias').value);
    if (!(dias>=7 && dias<=90)){ $('#cfg-err').textContent='Los días deben estar entre 7 y 90.'; return; }
    guardarCon(t, $('#cfg-err'), async()=>{ reemplazar('config', await api.editar('config', S.perfil.sucursal_id, {negocio:$('#cfg-negocio').value.trim()||'Barbería', plantilla_cumple:$('#cfg-cumple').value, plantilla_recordatorio:$('#cfg-rec').value, dias_recordatorio:dias}, 'sucursal_id'), 'sucursal_id'); }, 'Mensajes guardados');
  }
  else if (a==='copiar-pagos'){
    const rg = rango(ui.periodo);
    const txt = `Pagos ${rg[2].toLowerCase()} (${fmtShort(rg[0])} al ${fmtShort(rg[1])})${scopeSuc()?' · Sucursal '+sucName(scopeSuc()):''}\n` + S.db.peluqueros.filter(inScope).map(p=>resumenPago(p, rg)).filter(f=>f.n||f.ajustes.length).map(f=>`• ${f.p.nombre}: ${f.n} cortes → ${money(f.total)}${f.pagado?' ✓ pagado':' (pendiente)'}`).join('\n');
    navigator.clipboard.writeText(txt).then(()=>toast('Resumen copiado'), ()=>openModal('Resumen de pagos', `<textarea rows="8" readonly>${esc(txt)}</textarea>`));
  }
});
document.addEventListener('input', e=>{
  if (e.target.id==='q'){ ui.q=e.target.value; const pos=e.target.selectionStart; render(); const q=$('#q'); q.focus(); q.setSelectionRange(pos,pos); }
});
document.addEventListener('change', e=>{
  if (e.target.id==='cortes-periodo'){ ui.cortesPeriodo=e.target.value; render(); }
  if (e.target.id==='cortes-pel'){ ui.cortesPel=e.target.value; render(); }
});
document.addEventListener('keydown', e=>{ if (e.key==='Escape') closeModal(); });

iniciar();
