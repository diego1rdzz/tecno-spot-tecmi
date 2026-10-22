/* Núcleo compartido de Tecno-Spot.
   Una sola capa de datos y reglas que usan las tres herramientas: el sitio
   público (cotiza y agenda), el portal del cliente y la consola interna.
   Cada herramienta es una vista distinta sobre los mismos registros; por eso
   lo que agenda un cliente en el sitio aparece en los turnos de la consola. */
(function(){
'use strict';

const SEED = JSON.parse(document.getElementById('datos').textContent);
const COLS = ['config','modelos','tarifas','productos','costos','existencias','equipos','clientes','citas','ordenes','ventas','compras','movimientos'];
const S = { perfiles:{}, ocupacion:{} }; COLS.forEach(c => { S[c] = {}; });
const Store = { mode:'cargando', sb:null, loaded:{}, error:null, ultimaSync:null };
/* Sesión en Supabase: la base decide el rol, no la pantalla. */
const Auth = { session:null, perfil:null, vista:'entrar', error:'', aviso:'', form:{ correo:'', clave:'', nombre:'' }, ocupado:false };
const LS_KEY = 'tecnospot-v1';
const DAY = 86400000;

/* ---------- catálogos fijos ---------- */
const MARCAS = ['Apple','Samsung','Motorola','Xiaomi','Huawei','Honor','OPPO','Realme','ZTE'];
const DONDE_MODELO = {
  Apple:'En tu iPhone: Ajustes › General › Información › Nombre del modelo.',
  otra:'En Android: Ajustes › Acerca del teléfono › Modelo.'
};
/* Lo que el cliente reconoce, en sus palabras. El id es el tipo de reparación. */
const PROBLEMAS = [
  { id:'pantalla', t:'Pantalla rota o no se ve', d:'Cristal estrellado, manchas, líneas de colores o no responde al tacto.', tip:'Si el cristal está astillado, ponle cinta transparente encima para no cortarte mientras llegas.' },
  { id:'bateria', t:'La batería no me dura', d:'Se descarga rápido, se apaga solo o la batería se ve inflada.', tip:'En iPhone revisa Ajustes › Batería › Estado de la batería. Si la batería está inflada, deja de cargarlo.' },
  { id:'carga', t:'No carga o carga lento', d:'El cable no entra bien, carga solo de ladito o no reconoce el cargador.', tip:'Prueba con otro cable y otro cargador: a veces el problema es el cable y no el celular.' },
  { id:'bocina', t:'No se escucha', d:'La bocina o el auricular no suenan, hacen ruido o se oyen muy bajito.', tip:'Revisa que no esté en silencio ni conectado a audífonos Bluetooth.' },
  { id:'microfono', t:'No me escuchan', d:'En llamadas o notas de voz no se oye tu voz o se oye cortada.', tip:'Graba una nota de voz con y sin funda: a veces la funda tapa el micrófono.' },
  { id:'camara', t:'Falla la cámara', d:'Fotos borrosas, cámara en negro, no enfoca o el cristal de la cámara está roto.', tip:'Limpia el cristal de la cámara con un paño suave antes de traerlo.' },
  { id:'tapa', t:'Tapa trasera rota', d:'Cristal trasero estrellado o carcasa dañada.', tip:'Una funda evita que se sigan desprendiendo pedazos de vidrio.' },
  { id:'humedad', t:'Se mojó', d:'Se cayó al agua o se le derramó algo.', tip:'Apágalo, no lo cargues y no lo metas en arroz. Entre más pronto lo revisemos, mejor.', urgente:true },
  { id:'botones', t:'Los botones no funcionan', d:'Encendido, volumen o silencio no responden.', tip:'' },
  { id:'software', t:'Se traba o no prende bien', d:'Va lento, se reinicia solo, se quedó en el logo o necesitas respaldo o actualización.', tip:'Si puedes, respalda tus fotos antes de traerlo.' },
  { id:'liberacion', t:'Liberar de compañía', d:'Para usarlo con cualquier operador.', tip:'Trae tu identificación y el comprobante de que el equipo es tuyo. Solo liberamos equipos sin reporte de robo.' },
  { id:'mantenimiento', t:'Limpieza y mantenimiento', d:'Puerto de carga, bocinas y micrófono limpios, y revisión general.', tip:'' },
  { id:'diagnostico', t:'No sé qué tiene', d:'Lo revisamos y te decimos qué necesita antes de hacer cualquier reparación.', tip:'Anota cuándo empezó la falla y qué pasó antes: un golpe, una actualización o si se mojó.' }
];
const PROB = {}; PROBLEMAS.forEach(p => { PROB[p.id] = p; });
const GAMAS = { alta:'Gama alta', media:'Gama media', entrada:'Gama de entrada' };
const MOTIVOS_CITA = { reparacion:'Reparación', entrega:'Recoger mi equipo', duda:'Duda o revisión', compra:'Comprar accesorio o celular', venta:'Vender o cambiar mi celular', garantia:'Garantía' };
const ESTADOS_CITA = [['agendada','Agendada','info'],['llego','Llegó · en espera','warn'],['atendiendo','En atención','warn'],['atendida','Atendida','ok'],['noasistio','No asistió','muted'],['cancelada','Cancelada','muted']];
const CIERRES_CITA = { cliente:'El cliente canceló', reprogramo:'Reprogramó en otra cita', duplicada:'Cita duplicada', otro:'Otro motivo' };
const ESTADOS_ORDEN = [['recibido','Recibido','info'],['diagnostico','En diagnóstico','warn'],['presupuesto','Esperando autorización','warn'],['autorizado','Autorizado','info'],['reparacion','En reparación','warn'],['espera','Esperando refacción','warn'],['listo','Listo para entregar','ok'],['entregado','Entregado','muted'],['rechazado','No autorizado · por devolver','crit']];
const RECHAZOS = { precio:'Precio', tiempo:'Tiempo de reparación', noconviene:'Prefiere comprar otro equipo', sinarreglo:'No tiene arreglo', otro:'Otro' };
const MEDIOS = { mostrador:'En mostrador', whatsapp:'Por WhatsApp', telefono:'Por teléfono', sitio:'En el sitio (folio y celular)', portal:'En el portal del cliente' };
const FORMAS_PAGO = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia' };
const ROLES = { direccion:'Dirección', administracion:'Administración', mostrador:'Mostrador y ventas', tecnico:'Técnico' };
const ROLES_CUENTA = Object.assign({ pendiente:'Pendiente de asignar', cliente:'Cliente (portal)' }, ROLES);
const CATEGORIAS = { fundas:'Fundas', micas:'Micas de vidrio templado', privacidad:'Micas de privacidad', hidrogel:'Micas de hidrogel', cargadores:'Cargadores y cables', baterias:'Baterías portátiles', audio:'AirPods y audífonos', relojes:'Apple Watch y smartwatch', refacciones:'Refacciones' };
const CHECKLIST = [['enciende','Enciende'],['pantalla','Pantalla y táctil'],['carga','Carga'],['bocina','Bocina y auricular'],['microfono','Micrófono'],['camaras','Cámaras'],['botones','Botones'],['biometria','Face ID o huella'],['senal','Señal y Wi-Fi'],['tapa','Tapa y marco sin daño']];
const CHECK_VALS = { si:'Sí', no:'No', np:'No se pudo probar' };
const ACCESORIOS_REC = ['Chip SIM','Memoria','Funda','Cargador','Caja'];
const ESTADOS_EQUIPO = { reacondicionar:'Por reacondicionar', disponible:'Disponible', apartado:'Apartado', vendido:'Vendido' };
const CONDICION_USADO = { nuevo:'Como nuevo', bueno:'Buen estado', detalles:'Con detalles', danado:'Dañado' };

/* Valores de arranque. Lo que vale null se muestra "por confirmar" (regla 9). */
const CFG0 = {
  empresa:{ nombre:'Tecno-Spot', sucursal:'Tecmilenio', lugar:'Cafetería de Tecmilenio', lugarFrase:'la cafetería de Tecmilenio', direccion:null, whatsapp:null, telefono:null, correo:null, horario:null },
  citas:{ dias:[1,2,3,4,5], inicio:'09:00', fin:'15:00', intervalo:30, cupo:2, diasVisibles:8, confirmado:false },
  margenMinimo:30, margenConfirmado:false,
  garantias:{}, garantiaEquipo:{ nuevo:null, seminuevo:null }, garantiaAccesorio:null,
  diagnostico:{ precio:null },
  domicilio:{ activo:false, costo:null, zona:null },
  personal:{ tecnicos:['Técnico 1','Técnico 2'], mostrador:['Mostrador 1'] },
  terminos:{ recepcion:null, garantia:null }
};

/* Estado de pantalla compartido; cada herramienta agrega el suyo. */
const U = { app:'', rol:'direccion', persona:'', drawer:null, toast:null };

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = x => JSON.parse(JSON.stringify(x == null ? null : x));
const vals = o => Object.values(o || {});
const ents = o => Object.entries(o || {});
const pad = n => String(n).padStart(2, '0');
const fmtMoney = n => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0, maximumFractionDigits:2 }).format(n || 0);
const fmtInt = n => new Intl.NumberFormat('es-MX').format(n || 0);
const pctTxt = n => (Math.round(n * 10) / 10).toFixed(1) + '%';
const isoLocal = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hoyISO = () => isoLocal(new Date());
const fechaDe = iso => new Date(iso + 'T12:00:00');
function sumarDias(iso, n){ const d = fechaDe(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
const difDias = (a, b) => Math.round((fechaDe(a) - fechaDe(b)) / DAY);
function fmtD(iso){ if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return '—'; const p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDia = iso => cap(fechaDe(iso).toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' }));
const fmtDiaCorto = iso => cap(fechaDe(iso).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }).replace(/\./g, ''));
const ahoraHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const aMin = hm => { const p = String(hm || '0:0').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
const deMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const digitos = t => String(t || '').replace(/\D/g, '').slice(-10);
const telTxt = t => { const d = digitos(t); return d.length === 10 ? d.slice(0, 2) + ' ' + d.slice(2, 6) + ' ' + d.slice(6) : (t || ''); };
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function uid(p){ return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function nuevoFolio(pref){ const d = new Date(); let r = ''; for (let i = 0; i < 4; i++) r += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return pref + '-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + r; }
function setPath(o, path, v){ const k = path.split('.'); let t = o; for (let i = 0; i < k.length - 1; i++){ if (t[k[i]] == null) t[k[i]] = {}; t = t[k[i]]; } t[k[k.length - 1]] = v; }
function getPath(o, path){ return path.split('.').reduce((t, k) => (t == null ? undefined : t[k]), o); }
const PC = '<span class="tag pc">por confirmar</span>';
const DEMO_TAG = '<span class="tag demo">demo</span>';
const chip = (k, t) => '<span class="chip ' + k + '">' + esc(t) + '</span>';
const precioTxt = n => n == null || n === '' ? PC : fmtMoney(n);
function waLink(tel, texto){ const d = digitos(tel); return d.length === 10 ? 'https://wa.me/52' + d + '?text=' + encodeURIComponent(texto) : null; }
const estadoDe = (lista, k) => lista.find(e => e[0] === k) || [k, k, 'muted'];

/* ---------- configuración ---------- */
function mezclar(base, extra){
  const out = clone(base);
  ents(extra).forEach(([k, v]) => { out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? mezclar(out[k], v) : v; });
  return out;
}
function cfg(){ return mezclar(CFG0, S.config.general || {}); }
const empresa = () => cfg().empresa;
function garantiaDias(problema, tarifa){
  if (tarifa && tarifa.garantiaDias != null) return tarifa.garantiaDias;
  const g = cfg().garantias[problema]; return g == null ? null : g;
}

/* ---------- almacenamiento ---------- */
/* Los datos de demostración traen fechas fijas; se recorren para que "hoy" siempre tenga turnos. */
function anclar(data){
  const a = data._ancla; if (!a) return data;
  const n = difDias(hoyISO(), a); if (!n) return data;
  return JSON.parse(JSON.stringify(data).replace(/"(\d{4}-\d{2}-\d{2})"/g, (m, d) => '"' + sumarDias(d, n) + '"'));
}
function loadLocal(){
  let data = null;
  try { const raw = localStorage.getItem(LS_KEY); if (raw) data = JSON.parse(raw); } catch (e) { data = null; }
  if (!data) data = anclar(clone(SEED));
  COLS.forEach(c => { S[c] = data[c] || {}; Store.loaded[c] = true; });
  Store.ultimaSync = Date.now();
}
function saveLocal(){ const d = {}; COLS.forEach(c => { d[c] = S[c]; }); try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) {} }
/* Otra pestaña con otra herramienta abierta (modo local) escribe en el mismo almacenamiento. */
window.addEventListener('storage', e => { if (e.key === LS_KEY && Store.mode === 'local'){ loadLocal(); scheduleRender(); } });
function resetDemo(){ const d = anclar(clone(SEED)); COLS.forEach(c => { S[c] = d[c] || {}; }); saveLocal(); scheduleRender(); }

const chains = {};
function put(col, id, data){
  if (data === null) delete S[col][id]; else S[col][id] = data;
  scheduleRender();
  if (Store.sb){
    const k = col + '/' + id, t = Store.sb.from(col);
    const q = () => data === null ? t.delete().eq('id', id) : col === 'movimientos' ? t.insert({ id, data }) : t.upsert({ id, data });
    const p = (chains[k] || Promise.resolve()).then(q).then(r => { if (r && r.error) onWriteError(r.error); }).catch(onWriteError);
    chains[k] = p; return p;
  }
  saveLocal(); return Promise.resolve();
}
function onWriteError(e){
  const code = e && e.code;
  toast(code === '42501' ? 'Tu rol no puede hacer este cambio. Lo decide la base de datos.' : 'No se pudo guardar: ' + ((e && e.message) || 'revisa la conexión') + '.', 'crit');
}
function quien(){
  const base = U.persona || ROLES[U.rol] || 'Equipo';
  const p = Auth.perfil; return p && Store.mode === 'supabase' ? (p.nombre || p.correo || base) : base;
}
function logMov(m){ put('movimientos', uid('mv'), Object.assign({ ts:Date.now(), fecha:hoyISO(), usuario:quien() }, m)); }

/* ---------- Supabase ---------- */
const SBCFG = window.TS_SUPABASE || null;
function acceso(){ const a = actual(); return (a && a.acceso) || 'publico'; }
function rolCuenta(){ return Auth.perfil ? Auth.perfil.rol : null; }
const esInterno = () => !!ROLES[rolCuenta()];
/* ¿La cuenta que entró puede usar esta herramienta? */
function accesoOk(){
  if (Store.mode !== 'supabase' || acceso() === 'publico') return true;
  if (!Auth.session || !Auth.perfil) return false;
  return acceso() === 'interno' ? esInterno() : (rolCuenta() === 'cliente' && !!Auth.perfil.cliente_id);
}
/* Afuera (sitio y portal) solo se leen tablas públicas; lo del cliente llega por ts_mi_cuenta. */
const PUBLICAS = ['config','modelos','tarifas','productos','existencias'];
function colsPara(){ return acceso() === 'interno' && accesoOk() ? COLS.slice() : PUBLICAS.slice(); }
async function cargar(){
  const sb = Store.sb; COLS.forEach(c => { S[c] = {}; Store.loaded[c] = false; }); S.perfiles = {};
  const cols = colsPara();
  const tareas = cols.map(async c => {
    let q = sb.from(c).select('id,data');
    if (c === 'movimientos') q = q.order('actualizado', { ascending:false }).limit(400);
    const r = await q; if (r.error) throw r.error;
    const m = {}; (r.data || []).forEach(x => { m[x.id] = x.data; }); S[c] = m;
  });
  /* Afuera, los celulares a la venta llegan sin IMEI ni costo. */
  if (acceso() !== 'interno' || !accesoOk()) tareas.push(sb.rpc('ts_tienda').then(r => { if (r.error) throw r.error; const m = {}; (r.data || []).forEach(x => { m[x.id] = x.data; }); S.equipos = m; }));
  if (rolCuenta() === 'direccion' && acceso() === 'interno') tareas.push(sb.from('perfiles').select('*').then(r => { if (!r.error) (r.data || []).forEach(x => { S.perfiles[x.user_id] = x; }); }));
  try { await Promise.all(tareas); Store.error = null; } catch (e) { Store.error = (e && e.message) || 'sin conexión'; }
  COLS.forEach(c => { Store.loaded[c] = true; });
  Store.ultimaSync = Date.now();
  escuchar(cols);
  scheduleRender();
}
let canal = null;
function escuchar(cols){
  const sb = Store.sb; if (canal){ sb.removeChannel(canal); canal = null; }
  canal = sb.channel('ts-' + Math.random().toString(36).slice(2));
  const tablas = cols.filter(t => !(t === 'equipos' && acceso() !== 'interno')).concat(rolCuenta() === 'direccion' && acceso() === 'interno' && accesoOk() ? ['perfiles'] : []);
  tablas.forEach(t => canal.on('postgres_changes', { event:'*', schema:'public', table:t }, ev => {
    if (t === 'perfiles'){ const row = ev.new && ev.new.user_id ? ev.new : null; if (row) S.perfiles[row.user_id] = row; else if (ev.old) delete S.perfiles[ev.old.user_id]; }
    else if (ev.eventType === 'DELETE'){ if (ev.old) delete S[t][ev.old.id]; }
    else if (ev.new){ S[t][ev.new.id] = ev.new.data; }
    Store.ultimaSync = Date.now(); scheduleRender();
  }));
  canal.subscribe();
}
async function leerPerfil(){
  Auth.perfil = null;
  if (!Auth.session) return;
  const r = await Store.sb.from('perfiles').select('*').eq('user_id', Auth.session.user.id).maybeSingle();
  Auth.perfil = r.data || { rol:'pendiente', correo:Auth.session.user.email };
  if (esInterno()){ U.rol = Auth.perfil.rol; U.persona = Auth.perfil.nombre || ''; }
  if (Auth.perfil.rol === 'cliente') U.pCliente = Auth.perfil.cliente_id || '';
}
async function iniciarSupabase(){
  const sb = window.supabase.createClient(SBCFG.url, SBCFG.key);
  Store.sb = sb; Store.mode = 'supabase';
  const r = await sb.auth.getSession(); Auth.session = r.data ? r.data.session : null;
  await leerPerfil();
  await cargar();
  sb.auth.onAuthStateChange((ev, session) => {
    const antes = Auth.session && Auth.session.user.id, ahora = session && session.user.id;
    Auth.session = session;
    if (antes !== ahora) setTimeout(async () => { await leerPerfil(); await cargar(); }, 0);
  });
}
async function rpc(fn, args){ const r = await Store.sb.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; }

/* Pantalla de acceso común para portal y consola. */
function vAcceso(){
  const interno = acceso() === 'interno', F = Auth.form, E = empresa();
  const titulo = interno ? 'Consola interna' : 'Mi cuenta';
  if (Auth.session && Auth.perfil){
    const p = Auth.perfil;
    const msg = interno
      ? (p.rol === 'cliente' ? 'Esta cuenta es de cliente. Entra por “Mi cuenta” en el sitio.' : 'Tu cuenta existe, pero dirección todavía no le asigna un rol. En cuanto lo haga, esta pantalla se abre sola.')
      : (esInterno() ? 'Esta cuenta es del equipo de ' + E.nombre + '. Usa la consola interna.' : 'Recibimos tu registro. En tu próxima visita, en mostrador ligan tu cuenta con tu celular; en cuanto lo hagan, esta pantalla se abre sola.');
    return '<div class="login panel">' + logo('grande') + '<h1>' + titulo + '</h1><p><b>' + esc(p.correo || Auth.session.user.email) + '</b> · ' + esc(ROLES_CUENTA[p.rol] || p.rol) + '</p><p class="muted">' + msg + '</p><div><button class="btn" type="button" data-act="ts-salir">Salir</button></div></div>';
  }
  const reg = Auth.vista === 'registro';
  return '<div class="login panel">' + logo('grande') + '<h1>' + titulo + '</h1>'
    + '<p class="muted">' + (interno ? 'Acceso para el equipo de ' + esc(E.nombre) + '. Lo que ve cada quien depende de su rol: costos y utilidad solo dirección y administración.' : 'Tus reparaciones, tus citas, tus equipos con su garantía y tus compras.') + '</p>'
    + '<form class="stack" data-form="ts-' + (reg ? 'registro' : 'entrar') + '">'
    + (reg ? '<label class="f" for="ts-nom">Nombre completo<input id="ts-nom" autocomplete="name" data-bind="tsForm.nombre" value="' + esc(F.nombre) + '"></label>' : '')
    + '<label class="f" for="ts-mail">Correo<input id="ts-mail" type="email" autocomplete="email" data-bind="tsForm.correo" value="' + esc(F.correo) + '"></label>'
    + '<label class="f" for="ts-pass">Contraseña<input id="ts-pass" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" data-bind="tsForm.clave" value="' + esc(F.clave) + '"></label>'
    + (Auth.error ? '<p class="err" role="alert">' + esc(Auth.error) + '</p>' : '') + (Auth.aviso ? '<p class="small" role="status">' + esc(Auth.aviso) + '</p>' : '')
    + '<button class="btn primary" type="submit"' + (Auth.ocupado ? ' disabled' : '') + '>' + (reg ? 'Crear cuenta' : 'Entrar') + '</button></form>'
    + '<p class="small">' + (reg ? '¿Ya tienes cuenta? <button class="linkbtn" type="button" data-act="ts-vista" data-v="entrar">Entrar</button>' : '¿Primera vez? <button class="linkbtn" type="button" data-act="ts-vista" data-v="registro">Crear cuenta</button>') + '</p>'
    + '<p class="note">' + (interno ? 'Las cuentas nuevas quedan pendientes hasta que dirección les asigna un rol.' : 'Para ver tu equipo sin cuenta usa “Mi cita y mi equipo” con tu folio y tu celular.') + '</p></div>';
}
const TS_ACT = {
  'ts-vista'(d){ Auth.vista = d.v; Auth.error = ''; Auth.aviso = ''; scheduleRender(); },
  async 'ts-salir'(){ if (Store.sb) await Store.sb.auth.signOut(); Auth.session = null; Auth.perfil = null; Auth.form.clave = ''; await cargar(); }
};
const TS_FORM = {
  async 'ts-entrar'(){
    const F = Auth.form; if (!F.correo.trim() || !F.clave){ Auth.error = 'Escribe tu correo y tu contraseña.'; return scheduleRender(); }
    Auth.ocupado = true; Auth.error = ''; scheduleRender();
    const r = await Store.sb.auth.signInWithPassword({ email:F.correo.trim(), password:F.clave });
    Auth.ocupado = false;
    if (r.error){ Auth.error = /confirm/i.test(r.error.message) ? 'Confirma tu correo con el enlace que te enviamos y vuelve a entrar.' : 'Correo o contraseña incorrectos.'; return scheduleRender(); }
    F.clave = '';
  },
  async 'ts-registro'(){
    const F = Auth.form;
    if (!F.nombre.trim() || !F.correo.trim()){ Auth.error = 'Escribe tu nombre y tu correo.'; return scheduleRender(); }
    if ((F.clave || '').length < 8){ Auth.error = 'La contraseña necesita al menos 8 caracteres.'; return scheduleRender(); }
    Auth.ocupado = true; Auth.error = ''; scheduleRender();
    const r = await Store.sb.auth.signUp({ email:F.correo.trim(), password:F.clave, options:{ data:{ nombre:F.nombre.trim() }, emailRedirectTo: location.href.split('#')[0] } });
    Auth.ocupado = false;
    if (r.error){ Auth.error = 'No se pudo crear la cuenta: ' + r.error.message; return scheduleRender(); }
    F.clave = '';
    if (!r.data.session){ Auth.vista = 'entrar'; Auth.aviso = 'Te enviamos un correo para confirmar tu cuenta. Después entra con tu contraseña.'; }
    scheduleRender();
  }
};
function guardarPerfil(userId, cambios){
  S.perfiles[userId] = Object.assign({}, S.perfiles[userId], cambios); scheduleRender();
  return Store.sb.from('perfiles').update(cambios).eq('user_id', userId).then(r => { if (r.error) onWriteError(r.error); else toast('Acceso actualizado.'); });
}

/* ---------- catálogo: modelos y tarifas ---------- */
function modelosDe(marca){
  return ents(S.modelos).filter(([, m]) => m.marca === marca && !m.oculto).sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0) || a[1].modelo.localeCompare(b[1].modelo, 'es'));
}
const marcasActivas = () => MARCAS.concat([...new Set(vals(S.modelos).map(m => m.marca))].filter(m => !MARCAS.includes(m)));
function nombreModelo(id, texto){ const m = S.modelos[id]; return m ? m.marca + ' ' + m.modelo : (texto || 'Modelo por confirmar'); }
const tarifaId = (modeloId, problema, calidad) => modeloId + '|' + problema + '|' + (slug(calidad) || 'unica');
function tarifasDe(modeloId, problema){
  return ents(S.tarifas).filter(([, t]) => t.modeloId === modeloId && t.problema === problema && !t.oculta)
    .sort((a, b) => (a[1].precio == null ? 1e12 : a[1].precio) - (b[1].precio == null ? 1e12 : b[1].precio));
}
/* La cotización que ve el cliente: solo lo que la tienda ya cargó; lo demás, por confirmar. */
function cotizar(modeloId, problema){
  const ops = modeloId ? tarifasDe(modeloId, problema).map(([id, t]) => ({ tarifaId:id, calidad:t.calidad || '', precio:t.precio == null ? null : +t.precio, tiempo:t.tiempo || null, garantia:garantiaDias(problema, t), demo:!!t.demo })) : [];
  return { problema, opciones:ops, garantia:garantiaDias(problema), diagnostico:cfg().diagnostico.precio };
}

/* ---------- citas y turnos ---------- */
function horasDelDia(fecha){
  const c = cfg().citas;
  if (!(c.dias || []).includes(fechaDe(fecha).getDay())) return [];
  const out = []; const fin = aMin(c.fin), paso = Math.max(10, +c.intervalo || 30);
  for (let m = aMin(c.inicio); m + paso <= fin; m += paso) out.push(deMin(m));
  return out;
}
const citaActiva = c => c.estado !== 'cancelada';
function ocupacionDe(fecha){
  if (Store.mode === 'supabase' && acceso() !== 'interno') return S.ocupacion[fecha] || {};
  const m = {}; vals(S.citas).forEach(c => { if (c.fecha === fecha && citaActiva(c) && c.hora) m[c.hora] = (m[c.hora] || 0) + 1; }); return m;
}
/* Horarios del día con lugares libres; hoy no ofrece horas que ya pasaron. */
function horarios(fecha){
  const occ = ocupacionDe(fecha), cupo = +cfg().citas.cupo || 1, ahora = fecha === hoyISO() ? aMin(ahoraHM()) + 15 : -1;
  return horasDelDia(fecha).map(h => ({ hora:h, libres:Math.max(0, cupo - (occ[h] || 0)), pasada:aMin(h) < ahora }));
}
function diasAgenda(){
  const n = +cfg().citas.diasVisibles || 8, out = []; let d = hoyISO();
  for (let i = 0; out.length < n && i < 40; i++, d = sumarDias(d, 1)) if (horarios(d).some(h => !h.pasada)) out.push(d);
  return out;
}
async function cargarOcupacion(){
  if (!Store.sb || acceso() === 'interno') return;
  const dias = diasAgenda(); if (!dias.length) return;
  try {
    const r = await rpc('ts_horarios', { desde:dias[0], hasta:dias[dias.length - 1] });
    S.ocupacion = {}; (r || []).forEach(x => { (S.ocupacion[x.fecha] = S.ocupacion[x.fecha] || {})[x.hora] = x.n; });
    scheduleRender();
  } catch (e) { Store.error = e.message; }
}
const siguienteTurno = fecha => vals(S.citas).filter(c => c.fecha === fecha).reduce((a, c) => Math.max(a, +c.turno || 0), 0) + 1;
function historialCita(c, nota){ c.historial = (c.historial || []).concat([{ fecha:hoyISO(), hora:ahoraHM(), autor:quien(), nota }]); }
/* Agenda una cita y le da su turno del día. Afuera pasa por la base (ts_agendar). */
async function agendar(d){
  if (Store.sb) return rpc('ts_agendar', { p:d });
  const h = horarios(d.fecha).find(x => x.hora === d.hora);
  if (!h || h.pasada) throw new Error('Ese horario ya no está disponible. Elige otro.');
  if (!h.libres) throw new Error('Ese horario se acaba de llenar. Elige otro.');
  if ((d.contacto.nombre || '').trim().length < 2 || digitos(d.contacto.tel).length !== 10) throw new Error('Escribe tu nombre y un celular de 10 dígitos.');
  const c = crearCita(Object.assign({ origen:'sitio' }, d));
  return { folio:c.folio, fecha:c.fecha, hora:c.hora, turno:c.turno, lugar:c.lugar };
}
function crearCita(d){
  const id = uid('ct'), E = empresa();
  const c = Object.assign({ folio:nuevoFolio('CT'), motivo:'reparacion', modalidad:'cafeteria', lugar:E.lugar, clienteId:null, cotizacion:null, nota:'', estado:'agendada', origen:'mostrador', creada:hoyISO() }, d);
  c.turno = siguienteTurno(c.fecha);
  c.contacto = { nombre:(d.contacto.nombre || '').trim(), tel:digitos(d.contacto.tel), correo:(d.contacto.correo || '').trim(), tecmi:!!d.contacto.tecmi };
  if (!c.clienteId){ const cl = clientePorTel(c.contacto.tel); if (cl) c.clienteId = cl[0]; }
  historialCita(c, 'Cita agendada · ' + (c.origen === 'sitio' ? 'desde el sitio' : c.origen === 'portal' ? 'desde el portal' : 'en mostrador'));
  put('citas', id, c);
  return Object.assign({ id }, c);
}
function citaEdit(id, fn){ const c = clone(S.citas[id]); if (!c) return; if (fn(c) === false) return; put('citas', id, c); }
function nombreCita(c){ const cl = S.clientes[c.clienteId]; return cl ? cl.nombre : (c.contacto && c.contacto.nombre) || 'Sin nombre'; }

/* ---------- clientes ---------- */
function clientePorTel(tel){ const d = digitos(tel); return d.length === 10 ? ents(S.clientes).find(([, c]) => digitos(c.tel) === d) || null : null; }
function crearCliente(d){
  const id = uid('cl');
  put('clientes', id, { nombre:(d.nombre || '').trim(), tel:digitos(d.tel), correo:(d.correo || '').trim(), tecmi:!!d.tecmi, alta:hoyISO(), dispositivos:[], bitacora:[] });
  return id;
}
function bitacora(cid, entry){
  if (!S.clientes[cid]) return;
  const c = clone(S.clientes[cid]);
  c.bitacora = [Object.assign({ fecha:hoyISO(), autor:quien() }, entry)].concat(c.bitacora || []).slice(0, 150);
  put('clientes', cid, c);
}
/* Regla 6: el equipo entregado o vendido queda en la ficha del cliente con su IMEI. */
function registrarDispositivo(cid, disp){
  const c = clone(S.clientes[cid]); if (!c) return;
  c.dispositivos = c.dispositivos || [];
  const i = disp.imei ? c.dispositivos.findIndex(x => x.imei === disp.imei) : -1;
  const reg = Object.assign({ id:uid('eq'), alta:hoyISO() }, i >= 0 ? c.dispositivos[i] : {}, disp);
  if (i >= 0) c.dispositivos[i] = reg; else c.dispositivos.push(reg);
  put('clientes', cid, c);
}
const nombreCliente = id => (S.clientes[id] && S.clientes[id].nombre) || 'Cliente sin registro';

/* ---------- costos y utilidad (regla 4) ---------- */
const verCostos = () => U.rol === 'direccion' || U.rol === 'administracion';
function costo(id){ const c = S.costos[id]; return c && c.costo != null && c.costo !== '' ? +c.costo : null; }
const montoLineas = ls => (ls || []).reduce((a, l) => a + (+l.precio || 0) * (+l.cant || 0), 0);
const sinPrecio = ls => (ls || []).some(l => l.precio == null || l.precio === '');
/* Utilidad = venta − costo de refacciones y productos. La mano de obra no tiene costo de inventario. */
function utilidad(ls){
  let venta = 0, cst = 0, faltan = 0;
  for (const l of ls || []){
    if (l.precio == null || l.precio === '') { faltan++; continue; }
    venta += (+l.precio || 0) * (+l.cant || 0);
    const ref = l.equipoId || l.productoId;
    if (ref){ const c = costo(ref); if (c == null) faltan++; else cst += c * (+l.cant || 0); }
  }
  return venta ? { venta, util:venta - cst, pct:(venta - cst) / venta * 100, faltan } : { faltan, venta:0 };
}
function bajoMargen(ls){ const u = utilidad(ls); return u.pct != null && !u.faltan ? u.pct < cfg().margenMinimo : null; }

/* ---------- inventario (regla 5) ---------- */
function ex(pid){ const e = S.existencias[pid] || {}; return { disp:+e.disp || 0, apart:+e.apart || 0, min:e.min == null ? null : +e.min }; }
function setEx(pid, e){ put('existencias', pid, Object.assign({}, S.existencias[pid] || {}, e)); }
const prodNombre = pid => (S.productos[pid] && S.productos[pid].nombre) || 'Producto sin registro';
const lineasInventario = o => (o.lineas || []).filter(l => l.productoId && S.productos[l.productoId]);
/* Al autorizar se apartan las refacciones; regresa cuántas piezas faltan. */
function apartarOrden(o){
  let falt = 0;
  lineasInventario(o).forEach(l => {
    const need = (+l.cant || 0) - (+l.apartado || 0); if (need <= 0) return;
    const e = ex(l.productoId), take = Math.min(need, e.disp);
    if (take > 0){ setEx(l.productoId, { disp:e.disp - take, apart:e.apart + take }); logMov({ tipo:'apartado', productoId:l.productoId, cant:take, ref:o.folio, motivo:'Presupuesto autorizado' }); }
    l.apartado = (+l.apartado || 0) + take; falt += need - take;
  });
  return falt;
}
function liberarOrden(o, motivo){
  lineasInventario(o).forEach(l => {
    const a = +l.apartado || 0; if (!a) return;
    const e = ex(l.productoId); setEx(l.productoId, { disp:e.disp + a, apart:Math.max(0, e.apart - a) });
    l.apartado = 0; logMov({ tipo:'liberado', productoId:l.productoId, cant:a, ref:o.folio, motivo:motivo || 'Orden sin reparar' });
  });
}
/* Al terminar la reparación se descuentan; si el sistema no tiene la pieza, primero se registra su entrada. */
function descontarOrden(o){
  const faltan = [];
  lineasInventario(o).forEach(l => { const e = ex(l.productoId), need = +l.cant || 0, ap = Math.min(+l.apartado || 0, e.apart); if (ap + e.disp < need) faltan.push(prodNombre(l.productoId)); });
  if (faltan.length) return 'No hay existencia registrada de: ' + faltan.join(', ') + '. Registra su entrada en Inventario antes de terminar.';
  lineasInventario(o).forEach(l => {
    const e = ex(l.productoId), need = +l.cant || 0, ap = Math.min(+l.apartado || 0, e.apart, need);
    setEx(l.productoId, { apart:e.apart - ap, disp:e.disp - (need - ap) });
    l.apartado = 0; l.instalado = need;
    logMov({ tipo:'instalado', productoId:l.productoId, cant:need, ref:o.folio, motivo:'Reparación terminada' });
  });
  return null;
}

/* ---------- órdenes de servicio ---------- */
const totalOrden = o => montoLineas(o.lineas);
const pagadoOrden = o => (o.pagos || []).reduce((a, p) => a + (+p.monto || 0), 0);
const saldoOrden = o => Math.max(0, totalOrden(o) - pagadoOrden(o));
const ordenAbierta = o => o.estado !== 'entregado';
const equipoTxt = e => e ? nombreModelo(e.modeloId, (e.marca ? e.marca + ' ' : '') + (e.modelo || '')) : 'Equipo';
function hist(o, nota, publico){ o.historial = (o.historial || []).concat([{ fecha:hoyISO(), hora:ahoraHM(), autor:quien(), nota, publico:!!publico }]); }
function crearOrden(data){
  const id = uid('os');
  const o = Object.assign({ folio:nuevoFolio('OS'), clienteId:null, citaId:null, origen:'mostrador', modalidad:'cafeteria', equipo:{}, problema:'diagnostico', falla:'', recepcion:{}, diagnostico:'', lineas:[], autorizacion:{ estado:'pendiente' }, estado:'recibido', tecnico:'', promesa:null, pagos:[], historial:[], creada:hoyISO(), actualizada:hoyISO() }, data);
  hist(o, 'Equipo recibido en ' + (o.modalidad === 'domicilio' ? 'recolección a domicilio' : empresa().lugar), true);
  put('ordenes', id, o);
  if (o.clienteId) bitacora(o.clienteId, { tipo:'Orden de servicio', nota:'Recibimos ' + equipoTxt(o.equipo) + ' · ' + (PROB[o.problema] ? PROB[o.problema].t : o.problema) + ' · ' + o.folio });
  return { id, o };
}
function ordenEdit(id, fn){ const o = clone(S.ordenes[id]); if (!o) return false; if (fn(o) === false) return false; o.actualizada = hoyISO(); put('ordenes', id, o); return true; }
/* Regla 3: sin autorización no se repara. Queda quién, cuándo y por qué medio. */
function autorizar(o, decision, medio, motivo, autor){
  if (decision === 'si'){
    o.autorizacion = { estado:'autorizado', medio, fecha:hoyISO(), hora:ahoraHM(), por:autor || quien(), monto:totalOrden(o) };
    const falt = apartarOrden(o);
    o.estado = falt ? 'espera' : 'autorizado';
    hist(o, 'Presupuesto autorizado (' + (MEDIOS[medio] || medio) + ') por ' + fmtMoney(totalOrden(o)) + (falt ? ' · esperando ' + falt + ' refacción(es)' : ''), true);
  } else {
    o.autorizacion = { estado:'rechazado', medio, fecha:hoyISO(), hora:ahoraHM(), por:autor || quien(), motivo };
    liberarOrden(o, 'Presupuesto no autorizado');
    o.estado = 'rechazado';
    hist(o, 'Presupuesto no autorizado · ' + (RECHAZOS[motivo] || motivo || 'sin motivo') + ' · el equipo se devuelve', true);
  }
}
/* Regla 6: entregar cobra el saldo, fija la garantía, registra el equipo y borra el código de desbloqueo. */
function entregar(id, d){
  let err = null, oFinal = null;
  ordenEdit(id, o => {
    const reparado = o.estado === 'listo';
    if (!reparado && o.estado !== 'rechazado'){ err = 'Solo se entrega un equipo listo o uno que no se autorizó reparar.'; return false; }
    if (d.pago && +d.pago.monto > 0) o.pagos = (o.pagos || []).concat([{ fecha:hoyISO(), hora:ahoraHM(), monto:+d.pago.monto, forma:d.pago.forma, concepto:'Liquidación', por:quien() }]);
    if (reparado && saldoOrden(o) > 0){ err = 'Falta cobrar ' + fmtMoney(saldoOrden(o)) + ' antes de entregar.'; return false; }
    if (reparado && !(+d.garantiaDias > 0)){ err = 'Escribe los días de garantía de esta reparación.'; return false; }
    if (!(d.recibio || '').trim()){ err = 'Escribe quién recibe el equipo.'; return false; }
    const hasta = reparado ? sumarDias(hoyISO(), +d.garantiaDias) : null;
    o.entrega = { fecha:hoyISO(), hora:ahoraHM(), por:quien(), recibio:d.recibio.trim(), pruebas:d.pruebas || {}, reparado, garantiaDias:reparado ? +d.garantiaDias : 0, garantiaHasta:hasta };
    o.equipo = Object.assign({}, o.equipo, { acceso:'', accesoBorrado:!!(o.equipo && o.equipo.acceso) });
    o.estado = 'entregado';
    hist(o, reparado ? 'Equipo entregado a ' + d.recibio.trim() + ' · garantía hasta ' + fmtD(hasta) : 'Equipo devuelto sin reparar a ' + d.recibio.trim(), true);
    oFinal = o;
  });
  if (err) return err;
  if (oFinal.clienteId){
    if (oFinal.entrega.reparado) registrarDispositivo(oFinal.clienteId, { marca:oFinal.equipo.marca, modelo:oFinal.equipo.modelo, modeloId:oFinal.equipo.modeloId, imei:oFinal.equipo.imei, color:oFinal.equipo.color, origen:'Reparación', ref:oFinal.folio, garantiaHasta:oFinal.entrega.garantiaHasta });
    bitacora(oFinal.clienteId, { tipo:'Entrega', nota:(oFinal.entrega.reparado ? 'Entregado reparado · garantía hasta ' + fmtD(oFinal.entrega.garantiaHasta) : 'Devuelto sin reparar') + ' · ' + oFinal.folio });
  }
  return null;
}
function reclamoGarantia(id, nota){
  const o = S.ordenes[id]; if (!o) return null;
  const r = crearOrden({ clienteId:o.clienteId, equipo:Object.assign({}, o.equipo, { acceso:'' }), problema:o.problema, falla:'Reclamo de garantía de ' + o.folio + ': ' + (nota || ''), garantiaDe:id, origen:'garantia', recepcion:{ checklist:{}, accesorios:[], aceptaTerminos:true } });
  ordenEdit(r.id, x => { hist(x, 'Reclamo de garantía de la orden ' + o.folio, true); });
  return r;
}

/* ---------- garantías ---------- */
function garantias(){
  const out = [], hoy = hoyISO();
  ents(S.ordenes).forEach(([id, o]) => { if (o.entrega && o.entrega.garantiaHasta) out.push({ tipo:'Reparación', id, folio:o.folio, clienteId:o.clienteId, equipo:equipoTxt(o.equipo), imei:o.equipo.imei, desde:o.entrega.fecha, hasta:o.entrega.garantiaHasta, dias:difDias(o.entrega.garantiaHasta, hoy), problema:o.problema, reclamos:vals(S.ordenes).filter(x => x.garantiaDe === id) }); });
  ents(S.ventas).forEach(([id, v]) => (v.lineas || []).forEach(l => { if (l.garantiaHasta) out.push({ tipo:l.equipoId ? 'Equipo vendido' : 'Accesorio', id, folio:v.folio, clienteId:v.clienteId, equipo:l.desc, imei:l.imei || '', desde:v.fecha, hasta:l.garantiaHasta, dias:difDias(l.garantiaHasta, hoy), reclamos:[] }); }));
  return out.sort((a, b) => a.dias - b.dias);
}

/* ---------- ventas, compras y caja ---------- */
function registrarVenta(d){
  const lineas = d.lineas || [];
  if (!lineas.length) return { err:'Agrega al menos un producto.' };
  if (sinPrecio(lineas)) return { err:'Hay productos sin precio. Escribe el precio antes de cobrar.' };
  for (const l of lineas){
    if (l.productoId && ex(l.productoId).disp < (+l.cant || 0)) return { err:'No hay existencia suficiente de ' + prodNombre(l.productoId) + '.' };
    if (l.equipoId && (S.equipos[l.equipoId] || {}).estado !== 'disponible' && (S.equipos[l.equipoId] || {}).estado !== 'apartado') return { err:'Ese celular ya no está disponible.' };
  }
  const credito = d.tomaId ? +(S.compras[d.tomaId] || {}).precio || 0 : 0;
  const total = montoLineas(lineas), cobrar = Math.max(0, total - credito);
  const pagado = (d.pagos || []).reduce((a, p) => a + (+p.monto || 0), 0);
  if (pagado < cobrar) return { err:'Falta cobrar ' + fmtMoney(cobrar - pagado) + '.' };
  const id = uid('vt'), folio = nuevoFolio('V'), hoy = hoyISO();
  const ls = lineas.map(l => {
    const x = Object.assign({}, l);
    if (l.equipoId){ const q = S.equipos[l.equipoId]; const g = cfg().garantiaEquipo[q.condicion === 'nuevo' ? 'nuevo' : 'seminuevo']; const dias = l.garantiaDias != null && l.garantiaDias !== '' ? +l.garantiaDias : g; x.imei = q.imei; x.garantiaDias = dias; x.garantiaHasta = dias ? sumarDias(hoy, dias) : null; }
    return x;
  });
  const v = { folio, fecha:hoy, hora:ahoraHM(), clienteId:d.clienteId || null, lineas:ls, total, tomaId:d.tomaId || null, credito, pagos:(d.pagos || []).filter(p => +p.monto > 0).map(p => ({ forma:p.forma, monto:+p.monto, fecha:hoy })), cambio:Math.max(0, pagado - cobrar), vendedor:quien(), citaId:d.citaId || null };
  put('ventas', id, v);
  ls.forEach(l => {
    if (l.productoId){ const e = ex(l.productoId); setEx(l.productoId, { disp:e.disp - (+l.cant || 0) }); logMov({ tipo:'venta', productoId:l.productoId, cant:+l.cant, ref:folio, motivo:'Venta' }); }
    if (l.equipoId){
      const q = clone(S.equipos[l.equipoId]); q.estado = 'vendido'; q.ventaId = id; q.vendido = hoy; put('equipos', l.equipoId, q);
      if (v.clienteId) registrarDispositivo(v.clienteId, { marca:q.marca, modelo:q.modelo, modeloId:q.modeloId, imei:q.imei, color:q.color, origen:'Compra en tienda', ref:folio, garantiaHasta:l.garantiaHasta });
    }
  });
  if (d.tomaId){ const c = clone(S.compras[d.tomaId]); c.aplicadaEn = folio; put('compras', d.tomaId, c); }
  if (v.clienteId) bitacora(v.clienteId, { tipo:'Compra', nota:'Venta ' + folio + ' por ' + fmtMoney(total) + (credito ? ' (toma a cuenta ' + fmtMoney(credito) + ')' : '') });
  return { id, v };
}
/* Regla 7: sin identificación, IMEI sin reporte y cuentas desvinculadas no se compra ni se toma a cuenta. */
const VERIFICACIONES = [['identificacion','Identificación oficial del vendedor revisada'],['imei','IMEI consultado: sin reporte de robo o extravío'],['cuentas','Cuentas desvinculadas (iCloud / Google) y equipo restablecido'],['propiedad','Comprobante de propiedad o carta responsiva firmada']];
function compraVerificada(c){ return VERIFICACIONES.every(([k]) => c.verificacion && c.verificacion[k]); }
function aceptarCompra(id, d){
  const c = clone(S.compras[id]); if (!c) return 'No se encontró la evaluación.';
  if (!compraVerificada(c)) return 'Faltan verificaciones. Sin ellas no se compra ni se toma a cuenta.';
  if (!(+d.precio > 0)) return 'Escribe el precio acordado.';
  if (!c.equipo.imei) return 'Captura el IMEI del equipo.';
  const eqId = uid('eq');
  put('equipos', eqId, { marca:c.equipo.marca, modelo:c.equipo.modelo, modeloId:c.equipo.modeloId, capacidad:c.equipo.capacidad, color:c.equipo.color, condicion:'seminuevo', bateria:c.equipo.bateria || null, imei:c.equipo.imei, precio:null, estado:'reacondicionar', origen:c.tipo === 'toma' ? 'Toma a cuenta' : 'Compra a cliente', compraId:id, alta:hoyISO() });
  put('costos', eqId, { costo:+d.precio });
  c.estado = 'aceptada'; c.precio = +d.precio; c.equipoId = eqId; c.cerrada = hoyISO();
  if (c.tipo === 'compra') c.pago = { fecha:hoyISO(), hora:ahoraHM(), forma:d.forma || 'efectivo', monto:+d.precio, por:quien() };
  put('compras', id, c);
  return null;
}
/* Caja del día: lo que entró por reparaciones y ventas, y lo que salió por compras de equipos. */
function caja(fecha){
  const out = [];
  ents(S.ordenes).forEach(([id, o]) => (o.pagos || []).forEach(p => { if (p.fecha === fecha) out.push({ hora:p.hora || '', concepto:(p.concepto || 'Pago') + ' · ' + o.folio, forma:p.forma, monto:+p.monto, kind:'orden', id }); }));
  ents(S.ventas).forEach(([id, v]) => (v.pagos || []).forEach(p => { if ((p.fecha || v.fecha) === fecha) out.push({ hora:v.hora || '', concepto:'Venta · ' + v.folio, forma:p.forma, monto:+p.monto - (p.forma === 'efectivo' ? +v.cambio || 0 : 0), kind:'venta', id }); }));
  ents(S.compras).forEach(([id, c]) => { if (c.pago && c.pago.fecha === fecha) out.push({ hora:c.pago.hora || '', concepto:'Compra de equipo · ' + c.folio, forma:c.pago.forma, monto:-c.pago.monto, kind:'compra', id }); });
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}

/* ---------- lo que se consulta desde afuera (sitio y portal) ----------
   En Supabase pasan por funciones de la base que validan folio y celular;
   en modo local se resuelven aquí con la misma forma de respuesta. */
function vistaOrden(o){
  const pres = ['presupuesto','autorizado','reparacion','espera','listo','entregado','rechazado'].includes(o.estado);
  return { tipo:'orden', folio:o.folio, estado:o.estado, equipo:equipoTxt(o.equipo), problema:o.problema, creada:o.creada, promesa:o.promesa, modalidad:o.modalidad,
    lineas:pres ? (o.lineas || []).map(l => ({ desc:l.desc, cant:+l.cant || 1, precio:l.precio })) : [], total:pres ? totalOrden(o) : null, pagado:pagadoOrden(o),
    autorizacion:o.autorizacion || {}, garantiaHasta:o.entrega ? o.entrega.garantiaHasta : null, diagnostico:pres ? o.diagnostico || '' : '',
    historial:(o.historial || []).filter(h => h.publico).map(h => ({ fecha:h.fecha, hora:h.hora, nota:h.nota })) };
}
function vistaCita(c){
  const ord = c.ordenId && S.ordenes[c.ordenId];
  return { tipo:'cita', folio:c.folio, estado:c.estado, fecha:c.fecha, hora:c.hora, turno:c.turno, lugar:c.lugar, motivo:c.motivo, modalidad:c.modalidad, cotizacion:c.cotizacion, nombre:(c.contacto.nombre || '').split(' ')[0], orden:ord ? ord.folio : null };
}
/* Lo que el cliente ve de su cuenta en el portal: nunca notas internas, costos ni códigos. */
function vistaCuenta(cid){
  const c = S.clientes[cid]; if (!c) return null;
  const porFecha = (a, b) => (b.creada || b.fecha || '').localeCompare(a.creada || a.fecha || '');
  return { cliente:{ nombre:c.nombre, tel:c.tel, correo:c.correo || '', dispositivos:(c.dispositivos || []).map(d => ({ marca:d.marca, modelo:d.modelo, imei:d.imei, color:d.color, origen:d.origen, ref:d.ref, garantiaHasta:d.garantiaHasta || null })) },
    ordenes:vals(S.ordenes).filter(o => o.clienteId === cid).map(vistaOrden).sort(porFecha),
    citas:vals(S.citas).filter(x => x.clienteId === cid).map(vistaCita).sort(porFecha),
    ventas:vals(S.ventas).filter(v => v.clienteId === cid).map(v => ({ folio:v.folio, fecha:v.fecha, total:v.total, credito:v.credito || 0, lineas:(v.lineas || []).map(l => ({ desc:l.desc, cant:l.cant, precio:l.precio, garantiaHasta:l.garantiaHasta || null })) })).sort(porFecha) };
}
async function miCuenta(cid){ if (Store.sb) return rpc('ts_mi_cuenta', {}); return vistaCuenta(cid); }
/* Línea de tiempo de una reparación, igual en el sitio y en el portal. */
const PASOS_ORDEN = [['recibido','Recibimos tu equipo'],['diagnostico','Lo estamos revisando'],['presupuesto','Te enviamos el presupuesto'],['autorizado','Autorizaste la reparación'],['reparacion','Lo estamos reparando'],['listo','Listo para entregar'],['entregado','Entregado']];
function lineaTiempo(r){
  const actual = r.estado === 'espera' ? 'reparacion' : r.estado === 'rechazado' ? 'presupuesto' : r.estado;
  const i = PASOS_ORDEN.findIndex(p => p[0] === actual);
  return '<ol class="timeline">' + PASOS_ORDEN.map(([k, t], j) => '<li class="' + (j < i ? 'on' : j === i ? 'now' : '') + '"><div><b>' + esc(k === 'reparacion' && r.estado === 'espera' ? 'Esperando una refacción' : k === 'presupuesto' && r.estado === 'rechazado' ? 'No autorizaste la reparación' : t) + '</b>' + (j === i && r.promesa && r.estado !== 'entregado' ? '<span>Fecha estimada: ' + esc(fmtD(r.promesa)) + '</span>' : '') + '</div></li>').join('') + '</ol>';
}
function telDe(x){ const cl = S.clientes[x.clienteId]; return digitos((cl && cl.tel) || (x.contacto && x.contacto.tel)); }
function buscarFolio(folio, tel){
  const f = String(folio || '').trim().toUpperCase(), t = digitos(tel);
  const o = ents(S.ordenes).find(([, x]) => x.folio === f); if (o && telDe(o[1]) === t) return ['ordenes', o[0], o[1]];
  const c = ents(S.citas).find(([, x]) => x.folio === f); if (c && telDe(c[1]) === t) return ['citas', c[0], c[1]];
  return null;
}
async function consultar(folio, tel){
  if (Store.sb) return rpc('ts_consulta', { folio:String(folio || '').trim().toUpperCase(), tel:digitos(tel) });
  const r = buscarFolio(folio, tel); if (!r) return null;
  return r[0] === 'ordenes' ? vistaOrden(r[2]) : vistaCita(r[2]);
}
async function autorizarFuera(folio, tel, decision, motivo, medio){
  if (Store.sb) return rpc('ts_autorizar', { folio:String(folio).trim().toUpperCase(), tel:digitos(tel), decision, motivo:motivo || '', medio:medio || 'sitio' });
  const r = buscarFolio(folio, tel); if (!r || r[0] !== 'ordenes') throw new Error('No encontramos ese folio con ese celular.');
  if (r[2].estado !== 'presupuesto') throw new Error('Este presupuesto ya no está esperando autorización.');
  ordenEdit(r[1], o => { autorizar(o, decision, medio || 'sitio', motivo, 'Cliente'); });
  return vistaOrden(S.ordenes[r[1]]);
}
async function cancelarFuera(folio, tel, motivo){
  if (Store.sb) return rpc('ts_cancelar_cita', { folio:String(folio).trim().toUpperCase(), tel:digitos(tel), motivo:motivo || 'cliente' });
  const r = buscarFolio(folio, tel); if (!r || r[0] !== 'citas') throw new Error('No encontramos esa cita con ese celular.');
  if (r[2].estado !== 'agendada') throw new Error('Esta cita ya no se puede cancelar en línea.');
  citaEdit(r[1], c => { c.estado = 'cancelada'; c.cierre = { motivo:motivo || 'cliente', fecha:hoyISO() }; historialCita(c, 'Cancelada por el cliente'); });
  return vistaCita(S.citas[r[1]]);
}

/* ---------- archivo .ics para que el cliente guarde su cita ---------- */
function icsCita(c){
  const E = empresa(), ini = c.fecha.replace(/-/g, '') + 'T' + c.hora.replace(':', '') + '00';
  const fin = c.fecha.replace(/-/g, '') + 'T' + deMin(aMin(c.hora) + (+cfg().citas.intervalo || 30)).replace(':', '') + '00';
  const txt = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//' + E.nombre + '//Citas//ES','BEGIN:VEVENT','UID:' + c.folio + '@tecno-spot','DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    'DTSTART:' + ini, 'DTEND:' + fin, 'SUMMARY:' + E.nombre + ' · turno ' + c.turno + ' (' + c.folio + ')', 'LOCATION:' + (c.lugar || E.lugar), 'DESCRIPTION:Muestra tu folio ' + c.folio + ' al llegar.', 'END:VEVENT','END:VCALENDAR'].join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt);
}

/* ---------- marca ---------- */
function logo(tam){
  return '<span class="logo ' + (tam || '') + '"><svg class="isotipo" viewBox="0 0 32 32" aria-hidden="true"><rect x="6.5" y="2.5" width="17" height="27" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 25.5h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="23" cy="9" r="6" fill="var(--spot)"/></svg><span class="wordmark">Tecno<span>-Spot</span></span></span>';
}
/* Íconos de línea para los problemas; heredan el color del texto. */
const ICONOS = {
  pantalla:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 7l3 3-2 3 4 3"/>',
  bateria:'<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6 10v4"/>',
  carga:'<path d="M13 2.5 6 13.5h5l-1 8 7-11h-5z"/>',
  bocina:'<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  microfono:'<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4"/>',
  camara:'<path d="M3 8h4l2-2.5h6L17 8h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  tapa:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><rect x="8.5" y="5" width="4" height="5" rx="1.2"/><path d="M13 14l2.5 2.5-1.5 2"/>',
  humedad:'<path d="M12 3c3.5 4.5 6 7.7 6 10.5a6 6 0 0 1-12 0C6 10.7 8.5 7.5 12 3z"/>',
  botones:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M19.5 6v3M19.5 11v2M4.5 7v4"/>',
  software:'<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
  liberacion:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',
  mantenimiento:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  diagnostico:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  tienda:'<path d="M4 8h16l-1.2 12H5.2z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>',
  cambio:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  casa:'<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
  escudo:'<path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  folio:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  celular:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'
};
const icono = (k, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[k] || ICONOS.diagnostico) + '</svg>';

/* ---------- herramientas, render y eventos ---------- */
const APPS = {};
const LINKS = window.TS_LINKS || {};
function registrar(nombre, app){ APPS[nombre] = app; if (app.estado) Object.keys(app.estado).forEach(k => { if (!(k in U)) U[k] = clone(app.estado[k]); }); }
const actual = () => APPS[U.app] || APPS[Object.keys(APPS)[0]];

let queued = false, ultimoDrawer = '';
function scheduleRender(){ if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }
function render(){
  const app = actual(); if (!app) return;
  const a = document.activeElement, fid = a && a.id;
  let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) {}
  const db = document.querySelector('.drawer-body'); const dScroll = db ? db.scrollTop : 0;
  let body;
  if (SBCFG && !Store.sb && Store.mode !== 'cargando') body = app.barra() + '<main><div class="panel stack" role="alert"><h2>No se pudo conectar con la base de datos</h2><p class="muted">La página no pudo cargar la conexión con Supabase. Revisa tu internet y vuelve a cargar.</p></div></main>';
  else if (Store.mode === 'supabase' && !accesoOk()) body = app.barra() + '<main>' + vAcceso() + '</main>';
  else if (!Store.loaded.config) body = app.barra() + '<main><div class="loading">Cargando…</div></main>';
  else body = app.vista();
  $('#app').innerHTML = body + (U.toast ? '<div class="toast ' + (U.toast.k || '') + '" role="status">' + esc(U.toast.t) + '</div>' : '');
  if (fid){ const el = document.getElementById(fid); if (el){ try { el.focus({ preventScroll:true }); if (s0 != null && el.setSelectionRange) el.setSelectionRange(s0, s1); } catch (e) {} } }
  /* El panel lateral conserva su scroll solo si sigue mostrando lo mismo. */
  const dk = U.drawer ? U.drawer.kind + ':' + (U.drawer.id || '') : '';
  const db2 = document.querySelector('.drawer-body'); if (db2 && dScroll && dk === ultimoDrawer) db2.scrollTop = dScroll;
  ultimoDrawer = dk;
  if (app.despues) app.despues();
}
let toastTimer = null;
function toast(t, k){ U.toast = { t, k }; scheduleRender(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { U.toast = null; scheduleRender(); }, 4600); }
/* Hojas imprimibles (recepción, entrega, ticket): se arman aparte y se imprimen sin la interfaz. */
function imprimir(html){
  let el = document.getElementById('print'); if (!el){ el = document.createElement('div'); el.id = 'print'; document.body.appendChild(el); }
  el.innerHTML = html; window.print();
}

function barra(herramienta, nav, derecha){
  const modo = Store.mode === 'supabase' ? (Store.error ? '<span class="pill" title="' + esc(Store.error) + '">Sin conexión con la base</span>' : '<span class="pill live">En vivo</span>')
    : Store.mode === 'local' ? '<span class="pill">Modo local · este navegador</span>' : '<span class="pill">Conectando…</span>';
  const cuenta = Store.mode === 'supabase' && Auth.session ? '<button class="btn sm onbar" type="button" data-act="ts-salir" title="' + esc(Auth.session.user.email) + '">Salir</button>' : '';
  return '<header class="top"><div class="top-in"><a class="brand" href="' + esc(LINKS.inicio || '#') + '" aria-label="' + esc(empresa().nombre) + ' · inicio">' + logo() + (herramienta ? '<span class="tool">' + esc(herramienta) + '</span>' : '') + '</a>'
    + (nav ? '<nav class="topnav" aria-label="Secciones">' + nav + '</nav>' : '')
    + '<div class="mode">' + (derecha || '') + cuenta + (Store.mode === 'supabase' ? '' : '<span class="pill solid">Datos de demostración</span>') + modo + '</div></div></header>';
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (TS_ACT[b.dataset.act]){ e.preventDefault(); TS_ACT[b.dataset.act](b.dataset, b); return; }
  const app = actual(); const fn = app && app.acciones && app.acciones[b.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(b.dataset, b);
});
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.bind || t.type === 'checkbox' || t.type === 'radio') return;
  if (t.dataset.bind.indexOf('tsForm.') === 0){ Auth.form[t.dataset.bind.slice(7)] = t.value; return; }
  setPath(U, t.dataset.bind, t.value);
  if (t.dataset.live !== undefined) scheduleRender();
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.bind){
    setPath(U, t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
    if (t.tagName === 'SELECT' || t.type === 'radio' || t.type === 'checkbox' || t.dataset.live !== undefined) scheduleRender();
  }
  const app = actual(); if (app && app.cambio) app.cambio(t);
});
document.addEventListener('submit', e => {
  const f = e.target; if (!f.dataset || !f.dataset.form) return;
  e.preventDefault(); if (TS_FORM[f.dataset.form]) return TS_FORM[f.dataset.form](f);
  const app = actual(); const fn = app && app.formularios && app.formularios[f.dataset.form]; if (fn) fn(f);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.drawer){ U.drawer = null; scheduleRender(); } });

async function start(inicial){
  const porHash = () => { const h = (location.hash || '').slice(1); return APPS[h] ? h : null; };
  U.app = porHash() || inicial;
  if (Object.keys(APPS).length > 1) window.addEventListener('hashchange', () => { const h = porHash(); if (h && h !== U.app){ U.app = h; U.drawer = null; if (APPS[h].alEntrar) APPS[h].alEntrar(); scheduleRender(); window.scrollTo(0, 0); } });
  if (actual().alEntrar) actual().alEntrar();
  render();
  if (SBCFG){
    if (window.supabase){ try { await iniciarSupabase(); await cargarOcupacion(); } catch (e) { Store.error = (e && e.message) || 'sin conexión'; COLS.forEach(c => { Store.loaded[c] = true; }); } }
    else { Store.mode = 'supabase'; Store.error = 'No cargó la librería de Supabase'; }
    scheduleRender(); return;
  }
  Store.mode = 'local'; loadLocal();
  scheduleRender();
}

window.TS = {
  S, U, Store, Auth, SEED, DAY, PC, DEMO_TAG, LINKS,
  MARCAS, DONDE_MODELO, PROBLEMAS, PROB, GAMAS, MOTIVOS_CITA, ESTADOS_CITA, CIERRES_CITA, ESTADOS_ORDEN, RECHAZOS, MEDIOS, FORMAS_PAGO, ROLES, ROLES_CUENTA, CATEGORIAS,
  CHECKLIST, CHECK_VALS, ACCESORIOS_REC, ESTADOS_EQUIPO, CONDICION_USADO, VERIFICACIONES,
  $, esc, clone, vals, ents, pad, fmtMoney, fmtInt, pctTxt, hoyISO, sumarDias, difDias, fmtD, fmtDia, fmtDiaCorto, ahoraHM, aMin, digitos, telTxt, slug, uid, nuevoFolio,
  setPath, getPath, chip, precioTxt, waLink, estadoDe, cfg, empresa, garantiaDias, quien, put, logMov, resetDemo,
  modelosDe, marcasActivas, nombreModelo, tarifaId, tarifasDe, cotizar,
  horasDelDia, horarios, diasAgenda, cargarOcupacion, agendar, crearCita, citaEdit, historialCita, nombreCita,
  clientePorTel, crearCliente, bitacora, registrarDispositivo, nombreCliente,
  verCostos, costo, montoLineas, sinPrecio, utilidad, bajoMargen, ex, setEx, prodNombre,
  totalOrden, pagadoOrden, saldoOrden, ordenAbierta, equipoTxt, hist, crearOrden, ordenEdit, autorizar, apartarOrden, liberarOrden, descontarOrden, entregar, reclamoGarantia,
  garantias, registrarVenta, compraVerificada, aceptarCompra, caja,
  consultar, autorizarFuera, cancelarFuera, vistaCuenta, miCuenta, lineaTiempo, icsCita, logo, icono,
  registrar, scheduleRender, toast, imprimir, barra, start, guardarPerfil, esInterno, rpc
};
})();
