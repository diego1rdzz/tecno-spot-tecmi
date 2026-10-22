/* Consola interna de Tecno-Spot: estructura común de todos los módulos.
   Cada archivo de esta carpeta agrega su vista, sus acciones y sus panel
   laterales a window.TSC; z-registro.js registra la herramienta al final. */
(function(){
'use strict';
const T = window.TS, U = T.U, S = T.S, esc = T.esc;
const C = window.TSC = { vistas:{}, drawers:{}, acciones:{}, formularios:{}, cambios:[] };

C.MODULOS = [
  ['hoy','Hoy en la cafetería','Atención'], ['citas','Citas','Atención'], ['ordenes','Órdenes de servicio','Atención'],
  ['ventas','Punto de venta','Ventas'], ['compras','Compra y toma a cuenta','Ventas'], ['caja','Caja','Ventas'],
  ['clientes','Clientes','Clientes'], ['garantias','Garantías','Clientes'],
  ['inventario','Inventario','Almacén'], ['precios','Precios y catálogo','Almacén'],
  ['ajustes','Ajustes','Administración'], ['accesos','Accesos','Administración']
];
const supa = () => T.Store.mode === 'supabase';
/* Lo que cada rol puede hacer en pantalla. Con Supabase, además lo hace cumplir la base. */
C.puede = {
  costos: () => T.verCostos(),
  vender: () => U.rol !== 'tecnico',
  precios: () => U.rol === 'direccion' || U.rol === 'administracion',
  ajustes: () => U.rol === 'direccion'
};
C.modulos = () => C.MODULOS.filter(([k]) => ({ ventas:C.puede.vender(), compras:C.puede.vender(), caja:C.puede.vender(), ajustes:C.puede.ajustes(), accesos:supa() && U.rol === 'direccion' })[k] !== false);

/* ---------- piezas de formulario ---------- */
C.opts = (pares, val, vacio) => (vacio != null ? '<option value="">' + esc(vacio) + '</option>' : '') + pares.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
C.sel = (bind, id, label, pares, val, vacio, extra) => '<label class="f" for="' + id + '">' + label + '<select id="' + id + '" data-bind="' + bind + '"' + (extra || '') + '>' + C.opts(pares, val, vacio) + '</select></label>';
C.inp = (bind, id, label, val, attrs) => '<label class="f" for="' + id + '">' + label + '<input id="' + id + '" data-bind="' + bind + '" value="' + esc(val == null ? '' : val) + '"' + (attrs || '') + '></label>';
C.area = (bind, id, label, val, ph) => '<label class="f" for="' + id + '">' + label + '<textarea id="' + id + '" data-bind="' + bind + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(val || '') + '</textarea></label>';
C.chk = (bind, label, on) => '<label class="check"><input type="checkbox" data-bind="' + bind + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
C.tile = (lbl, val, sub, lead) => '<div class="tile' + (lead ? ' lead' : '') + '"><div class="lbl">' + lbl + '</div><div class="val">' + val + '</div><div class="sub">' + sub + '</div></div>';
C.formas = () => T.ents(T.FORMAS_PAGO);
C.personal = () => { const p = T.cfg().personal; return [...new Set([].concat(p.tecnicos || [], p.mostrador || []))]; };
C.tecnicos = () => T.cfg().personal.tecnicos || [];
C.marcaOpts = () => T.marcasActivas().map(m => [m, m]).concat([['Otra','Otra marca']]);
C.modeloOpts = marca => T.modelosDe(marca).map(([id, m]) => [id, m.modelo]);
C.wa = (tel, texto, etiqueta) => { const l = T.waLink(tel, texto); return l ? '<a class="btn sm" href="' + esc(l) + '" target="_blank" rel="noopener">' + (etiqueta || 'WhatsApp') + '</a>' : ''; };
/* Enlace para que el cliente vea su folio; solo si el sitio ya tiene dirección pública. */
C.urlConsulta = folio => /^https?:/.test(T.LINKS.sitio || '') ? T.LINKS.sitio.replace(/\/?$/, '/') + '?folio=' + encodeURIComponent(folio) : '';
C.linkCliente = (id, txt) => id && S.clientes[id] ? '<button class="linkbtn" type="button" data-act="cli-open" data-v="' + esc(id) + '">' + esc(txt || S.clientes[id].nombre) + '</button>' : esc(txt || 'Sin cliente');
C.linkOrden = id => S.ordenes[id] ? '<button class="linkbtn mono" type="button" data-act="os-open" data-v="' + esc(id) + '">' + esc(S.ordenes[id].folio) + '</button>' : '';
C.diasTxt = n => n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n > 0 ? 'en ' + n + ' días' : 'hace ' + (-n) + ' días';

/* Marca + modelo del catálogo, o texto libre si no está. */
C.modeloCampos = (pref, x) => {
  const otra = x.marca === 'Otra' || (x.marca && !T.marcasActivas().includes(x.marca));
  return '<div class="grid2">' + C.sel(pref + '.marca', pref + '-marca', 'Marca', C.marcaOpts(), otra ? 'Otra' : x.marca, 'Elige…')
    + (x.marca && !otra ? C.sel(pref + '.modeloId', pref + '-modelo', 'Modelo', C.modeloOpts(x.marca).concat([['', '— No está en la lista —']]), x.modeloId, 'Elige…') : '')
    + (otra ? C.inp(pref + '.marcaTexto', pref + '-mt', 'Marca (texto)', x.marcaTexto) : '')
    + (otra || (x.marca && !x.modeloId) ? C.inp(pref + '.modelo', pref + '-mod', 'Modelo (texto)', x.modelo) : '') + '</div>';
};
/* Convierte lo capturado con modeloCampos en {modeloId, marca, modelo}. */
C.modeloDe = x => {
  if (x.modeloId && S.modelos[x.modeloId]) return { modeloId:x.modeloId, marca:S.modelos[x.modeloId].marca, modelo:S.modelos[x.modeloId].modelo };
  return { modeloId:null, marca:x.marca === 'Otra' ? (x.marcaTexto || '').trim() : x.marca, modelo:(x.modelo || '').trim() };
};

/* ---------- panel lateral ---------- */
C.drawer = (titulo, sub, cuerpo, extraHead) => '<div class="scrim" data-act="cerrar"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '"><div class="drawer-head"><div class="stack tight" style="flex:1;min-width:0"><h2>' + titulo + '</h2>' + (sub ? '<div class="row small muted">' + sub + '</div>' : '') + '</div>' + (extraHead || '') + '<button class="btn sm" type="button" data-act="cerrar" aria-label="Cerrar">Cerrar</button></div><div class="drawer-body">' + cuerpo + '</div></aside>';
function vDrawer(){ const d = U.drawer; if (!d || !C.drawers[d.kind]) return ''; return C.drawers[d.kind](d.id, d) || ''; }

/* ---------- marco de la consola ---------- */
function barra(){
  const who = supa() ? '<span class="pill solid">' + esc(T.quien()) + ' · ' + esc(T.ROLES[U.rol] || '') + '</span>'
    : '<label class="whoami" for="w-rol"><span>Ver como</span><select id="w-rol" data-bind="rol">' + C.opts(T.ents(T.ROLES), U.rol) + '</select></label>';
  return T.barra('Consola', '', who);
}
function vista(){
  const mods = C.modulos();
  if (!mods.some(m => m[0] === U.tab)) U.tab = 'hoy';
  const mod = mods.find(m => m[0] === U.tab);
  let grupo = '';
  const nav = mods.map(([k, t, g]) => (g !== grupo ? (grupo = g, '<span class="lado-g">' + esc(g) + '</span>') : '') + '<button type="button" data-act="tab" data-v="' + k + '"' + (U.tab === k ? ' aria-current="page"' : '') + '>' + esc(t) + C.contador(k) + '</button>').join('');
  return barra() + '<div class="consola"><nav class="lado" aria-label="Módulos">' + nav
    + (T.Store.mode === 'local' ? '<button class="btn sm quiet reset" type="button" data-act="reset-demo">Restablecer demostración</button>' : '') + '</nav>'
    + '<main class="contenido"><div class="stack"><div class="console-head"><div><div class="eyebrow">' + esc(mod[2]) + '</div><h1>' + esc(mod[1]) + '</h1></div>' + (C.cabeza[U.tab] ? C.cabeza[U.tab]() : '') + '</div>'
    + (supa() ? '' : '<p class="note">Prototipo: el rol se simula con «Ver como». Con Supabase lo decide la base de datos, y costos y utilidad solo llegan a dirección y administración.</p>')
    + C.vistas[U.tab]() + '</div></main></div>' + vDrawer();
}
C.cabeza = {};
/* Números junto al nombre del módulo: lo que pide atención. */
C.contador = k => {
  let n = 0;
  if (k === 'hoy') n = T.vals(S.citas).filter(c => c.fecha === T.hoyISO() && (c.estado === 'llego' || c.estado === 'atendiendo')).length;
  if (k === 'ordenes') n = T.vals(S.ordenes).filter(o => o.estado === 'listo').length;
  if (k === 'compras') n = T.vals(S.compras).filter(c => c.estado === 'evaluacion').length;
  return n ? ' <span class="badge">' + n + '</span>' : '';
};

C.vista = vista;
C.barra = barra;
C.acciones.tab = d => { U.tab = d.v; U.drawer = null; T.scheduleRender(); window.scrollTo(0, 0); };
C.acciones.cerrar = () => { U.drawer = null; T.scheduleRender(); };
C.acciones['reset-demo'] = () => T.confirmar('¿Borrar los cambios de este navegador y volver a los datos de demostración?', () => { T.resetDemo(); U.drawer = null; T.toast('Demostración restablecida.'); }, { ok:'Restablecer', peligro:true });
C.estado = { tab:'hoy' };
})();
