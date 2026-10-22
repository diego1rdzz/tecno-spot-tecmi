/* Clientes (con sus equipos registrados por IMEI) y garantías. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip;

function vClientes(){
  const q = (U.cliBusca || '').trim().toLowerCase();
  const ultima = id => [].concat(T.vals(S.ordenes).filter(o => o.clienteId === id).map(o => o.actualizada || o.creada), T.vals(S.ventas).filter(v => v.clienteId === id).map(v => v.fecha), T.vals(S.citas).filter(c => c.clienteId === id).map(c => c.fecha)).sort().pop();
  const hay = c => (c.nombre + ' ' + c.tel + ' ' + (c.correo || '') + ' ' + (c.dispositivos || []).map(x => x.imei + ' ' + x.modelo).join(' ')).toLowerCase();
  const cls = T.ents(S.clientes).filter(([, c]) => !q || hay(c).includes(q) || hay(c).replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    .map(([id, c]) => [id, c, ultima(id) || c.alta]).sort((a, b) => (b[2] || '').localeCompare(a[2] || ''));
  return '<div class="toolbar"><label class="f" for="cl-q" style="flex:1 1 280px;max-width:420px">Buscar por nombre, celular o IMEI<input id="cl-q" type="search" data-bind="cliBusca" data-live value="' + esc(U.cliBusca || '') + '"></label><span class="spacer"></span><span class="small muted">' + T.vals(S.clientes).filter(c => c.tecmi).length + ' de ' + T.vals(S.clientes).length + ' son de la comunidad Tecmilenio</span></div>'
    + '<div class="tbl"><table class="t"><thead><tr><th>Cliente</th><th>Celular</th><th class="num">Equipos</th><th class="num">Órdenes abiertas</th><th class="num">Compras</th><th>Última visita</th></tr></thead><tbody>'
    + (cls.map(([id, c, u]) => '<tr><td>' + C.linkCliente(id) + (c.tecmi ? ' <span class="tag demo">Tecmilenio</span>' : '') + '</td><td class="mono">' + esc(T.telTxt(c.tel)) + '</td><td class="num">' + (c.dispositivos || []).length + '</td><td class="num">' + T.vals(S.ordenes).filter(o => o.clienteId === id && T.ordenAbierta(o)).length + '</td><td class="num">' + T.vals(S.ventas).filter(v => v.clienteId === id).length + '</td><td>' + T.fmtD(u) + '</td></tr>').join('') || '<tr><td colspan="6" class="muted">Sin clientes.</td></tr>')
    + '</tbody></table></div>';
}
C.vistas.clientes = vClientes;
C.estado.cliBusca = '';

C.drawers.cli = id => {
  const c = S.clientes[id]; if (!c) return '';
  const E = U.ce2 && U.ce2.id === id ? U.ce2 : (U.ce2 = { id, nombre:c.nombre, tel:c.tel, correo:c.correo || '', tecmi:!!c.tecmi, nota:'', editando:false });
  const ords = T.ents(S.ordenes).filter(([, o]) => o.clienteId === id).sort((a, b) => b[1].creada.localeCompare(a[1].creada));
  const citas = T.ents(S.citas).filter(([, x]) => x.clienteId === id).sort((a, b) => b[1].fecha.localeCompare(a[1].fecha));
  const ventas = T.ents(S.ventas).filter(([, v]) => v.clienteId === id);
  const hoy = T.hoyISO();
  return C.drawer(esc(c.nombre), esc(T.telTxt(c.tel)) + (c.tecmi ? ' · comunidad Tecmilenio' : '') + ' · cliente desde ' + T.fmtD(c.alta),
    '<div class="row"><button class="btn primary sm" type="button" data-act="cli-orden" data-v="' + esc(id) + '">Recibir un equipo</button>' + C.wa(c.tel, 'Hola ' + c.nombre.split(' ')[0] + ', te escribimos de ' + T.empresa().nombre + '.', 'WhatsApp') + '<button class="btn sm quiet" type="button" data-act="cli-editar">' + (E.editando ? 'Cancelar' : 'Editar datos') + '</button></div>'
    + (E.editando ? '<form class="panel stack tight" data-form="cli-editar"><div class="grid2">' + C.inp('ce2.nombre', 'ce2-n', 'Nombre', E.nombre) + C.inp('ce2.tel', 'ce2-t', 'Celular', E.tel, ' type="tel"') + C.inp('ce2.correo', 'ce2-c', 'Correo', E.correo, ' type="email"') + '</div>' + C.chk('ce2.tecmi', 'Comunidad Tecmilenio', E.tecmi) + '<div><button class="btn primary sm" type="submit">Guardar</button></div></form>' : '')
    + '<section class="stack tight"><h3>Sus equipos</h3>' + ((c.dispositivos || []).length ? '<div class="tbl"><table class="t"><thead><tr><th>Equipo</th><th>IMEI</th><th>Origen</th><th>Garantía</th></tr></thead><tbody>' + c.dispositivos.map(x => '<tr><td>' + esc(x.marca + ' ' + x.modelo) + (x.color ? ' · ' + esc(x.color) : '') + '</td><td class="mono">' + esc(x.imei || '—') + '</td><td>' + esc(x.origen || '') + ' <span class="mono small">' + esc(x.ref || '') + '</span></td><td>' + (x.garantiaHasta ? (x.garantiaHasta >= hoy ? chip('ok', 'Hasta ' + T.fmtD(x.garantiaHasta)) : chip('muted', 'Venció ' + T.fmtD(x.garantiaHasta))) : '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted small">Todavía no hay equipos registrados: se registran al entregar una reparación o vender un celular.</p>') + '</section>'
    + '<section class="stack tight"><h3>Órdenes</h3>' + (ords.length ? '<ul class="log">' + ords.map(([oid, o]) => { const e = T.estadoDe(T.ESTADOS_ORDEN, o.estado); return '<li><div class="row">' + C.linkOrden(oid) + '<span>' + esc(T.equipoTxt(o.equipo)) + ' · ' + esc(T.PROB[o.problema] ? T.PROB[o.problema].t : '') + '</span><span class="spacer"></span>' + chip(e[2], e[1]) + '</div><span class="h">' + T.fmtD(o.creada) + ' · ' + T.fmtMoney(T.totalOrden(o)) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted small">Sin órdenes.</p>') + '</section>'
    + '<section class="stack tight"><h3>Citas</h3>' + (citas.length ? '<ul class="log">' + citas.map(([cid, x]) => { const e = T.estadoDe(T.ESTADOS_CITA, x.estado); return '<li><div class="row"><button class="linkbtn mono" type="button" data-act="ct-open" data-v="' + esc(cid) + '">' + esc(x.folio) + '</button><span>' + esc(T.MOTIVOS_CITA[x.motivo] || '') + '</span><span class="spacer"></span>' + chip(e[2], e[1]) + '</div><span class="h">' + T.fmtD(x.fecha) + ' ' + esc(x.hora) + ' · turno ' + esc(x.turno) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted small">Sin citas.</p>') + '</section>'
    + (ventas.length ? '<section class="stack tight"><h3>Compras</h3><ul class="log">' + ventas.map(([, v]) => '<li><div class="row"><span class="mono">' + esc(v.folio) + '</span><span>' + esc(v.lineas.map(l => l.desc).join(', ')) + '</span><span class="spacer"></span><b>' + T.fmtMoney(v.total) + '</b></div><span class="h">' + T.fmtD(v.fecha) + '</span></li>').join('') + '</ul></section>' : '')
    + '<section class="stack tight"><h3>Bitácora</h3><div class="row">' + C.inp('ce2.nota', 'ce2-nota', 'Nota', E.nota) + '<button class="btn sm" type="button" data-act="cli-nota" data-v="' + esc(id) + '">Agregar</button></div><ul class="log">' + (c.bitacora || []).map(b => '<li><span class="h">' + T.fmtD(b.fecha) + ' · ' + esc(b.tipo || 'Nota') + ' · ' + esc(b.autor || '') + '</span>' + esc(b.nota) + '</li>').join('') + '</ul></section>');
};
Object.assign(C.acciones, {
  'cli-open'(d){ U.drawer = { kind:'cli', id:d.v }; U.ce2 = null; T.scheduleRender(); },
  'cli-editar'(){ U.ce2.editando = !U.ce2.editando; T.scheduleRender(); },
  'cli-orden'(d){ C.nuevaOrden({ clienteId:d.v }); },
  'cli-nota'(d){ const n = (U.ce2.nota || '').trim(); if (!n) return; T.bitacora(d.v, { tipo:'Nota', nota:n }); U.ce2.nota = ''; }
});
C.formularios['cli-editar'] = () => {
  const E = U.ce2, c = T.clone(S.clientes[E.id]);
  if (E.nombre.trim().length < 2 || T.digitos(E.tel).length !== 10) return T.toast('Nombre y celular de 10 dígitos.', 'warn');
  const otro = T.clientePorTel(E.tel); if (otro && otro[0] !== E.id) return T.toast('Ese celular ya es de ' + otro[1].nombre + '.', 'warn');
  Object.assign(c, { nombre:E.nombre.trim(), tel:T.digitos(E.tel), correo:E.correo.trim(), tecmi:E.tecmi }); T.put('clientes', E.id, c); E.editando = false; T.toast('Datos guardados.');
};

/* ---------- garantías ---------- */
function vGarantias(){
  const f = U.garFiltro || 'vigentes', gs = T.garantias().filter(g => f === 'todas' || (f === 'vigentes' ? g.dias >= 0 : g.dias < 0));
  const reclamos = T.ents(S.ordenes).filter(([, o]) => o.garantiaDe);
  const porVencer = T.garantias().filter(g => g.dias >= 0 && g.dias <= 15).length;
  return '<div class="tiles">' + C.tile('Garantías vigentes', T.garantias().filter(g => g.dias >= 0).length, porVencer + ' vencen en 15 días o menos', true) + C.tile('Reclamos', reclamos.length, reclamos.filter(([, o]) => T.ordenAbierta(o)).length + ' abiertos')
    + C.tile('Reparaciones con reclamo', (() => { const rep = T.vals(S.ordenes).filter(o => o.entrega && o.entrega.reparado).length; return rep ? T.pctTxt(reclamos.length / rep * 100) : '—'; })(), 'De las reparaciones entregadas') + '</div>'
    + '<div class="filtros">' + [['vigentes','Vigentes'],['vencidas','Vencidas'],['todas','Todas']].map(([k, t]) => '<button type="button" class="filtro" data-act="gar-f" data-v="' + k + '" aria-pressed="' + (f === k) + '">' + t + '</button>').join('') + '</div>'
    + '<div class="tbl"><table class="t"><thead><tr><th>Tipo</th><th>Folio</th><th>Cliente</th><th>Equipo</th><th>IMEI</th><th>Vence</th><th>Reclamos</th></tr></thead><tbody>'
    + (gs.map(g => '<tr><td>' + esc(g.tipo) + '</td><td>' + (g.tipo === 'Reparación' ? C.linkOrden(g.id) : '<span class="mono">' + esc(g.folio) + '</span>') + '</td><td>' + C.linkCliente(g.clienteId) + '</td><td>' + esc(g.equipo) + '</td><td class="mono">' + esc(g.imei || '—') + '</td>'
      + '<td>' + chip(g.dias < 0 ? 'muted' : g.dias <= 15 ? 'warn' : 'ok', T.fmtD(g.hasta) + ' · ' + C.diasTxt(g.dias)) + '</td><td>' + (g.reclamos.length ? g.reclamos.map(r => esc(r.folio)).join(', ') : '—') + '</td></tr>').join('') || '<tr><td colspan="7" class="muted">Sin garantías en este filtro.</td></tr>')
    + '</tbody></table></div><p class="small muted">El reclamo se abre desde la orden original (botón “Abrir reclamo de garantía”) y crea una orden ligada a ella.</p>';
}
C.vistas.garantias = vGarantias;
C.acciones['gar-f'] = d => { U.garFiltro = d.v; T.scheduleRender(); };
C.estado.garFiltro = 'vigentes';
})();
