/* Hoy en la cafetería: los turnos del día y lo que pide atención en el taller. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip;

/* Resumen de la cotización con la que llegó la cita. */
C.cotTxt = c => {
  const q = c.cotizacion; if (!q) return '';
  const p = q.problema && T.PROB[q.problema] ? T.PROB[q.problema].t : '';
  const extra = q.tipo === 'venta' ? [T.CONDICION_USADO[q.condicion] || '', q.capacidad || '', q.preferencia === 'toma' ? 'quiere cambiarlo' : 'quiere venderlo'] : [];
  return [p, q.equipo || '', q.ordenFolio ? 'orden ' + q.ordenFolio : ''].concat(extra).filter(Boolean).map(esc).join(' · ') + (q.precio != null ? ' · ' + T.fmtMoney(q.precio) : q.tipo === 'reparacion' ? ' · precio ' + T.PC : '');
};
/* Liga la cita con un cliente: el que ya tiene ese celular o uno nuevo con sus datos. */
C.clienteDeCita = id => {
  const c = S.citas[id]; if (!c) return null;
  if (c.clienteId && S.clientes[c.clienteId]) return c.clienteId;
  const ya = T.clientePorTel(c.contacto.tel);
  const cid = ya ? ya[0] : T.crearCliente(c.contacto);
  T.citaEdit(id, x => { x.clienteId = cid; });
  return cid;
};
C.cerrarCita = (id, estado, cambios, nota) => T.citaEdit(id, c => { c.estado = estado; Object.assign(c, cambios || {}); T.historialCita(c, nota || T.estadoDe(T.ESTADOS_CITA, estado)[1]); });
const recordatorio = c => 'Hola ' + (c.contacto.nombre || '').split(' ')[0] + ', te esperamos en ' + T.empresa().nombre + ' el ' + T.fmtDia(c.fecha).toLowerCase() + ' a las ' + c.hora + ' (turno ' + c.turno + ') en ' + (c.modalidad === 'domicilio' ? 'tu domicilio' : (T.empresa().lugarFrase || c.lugar)) + '. Tu folio es ' + c.folio + '.';
C.recordatorio = recordatorio;

/* Botones según el momento de la cita. */
C.accionesCita = (id, c) => {
  const b = (act, t, k) => '<button class="btn sm' + (k ? ' ' + k : '') + '" type="button" data-act="' + act + '" data-v="' + esc(id) + '">' + t + '</button>';
  if (c.estado === 'agendada') return b('ct-llego', 'Llegó', 'primary') + b('ct-noasistio', 'No asistió', 'quiet') + C.wa(c.contacto.tel, recordatorio(c), 'Recordar');
  if (c.estado === 'llego') return b('ct-atender', 'Atender', 'primary') + b('ct-noasistio', 'Se fue sin atender', 'quiet');
  if (c.estado === 'atendiendo'){
    const principal = { reparacion:'ct-recibir', entrega:'ct-entregar', compra:'ct-vender', venta:'ct-evaluar', garantia:'ct-garantia', duda:'ct-resuelto' }[c.motivo] || 'ct-resuelto';
    const todas = [['ct-recibir','Recibir equipo'],['ct-entregar','Entregar equipo'],['ct-vender','Vender'],['ct-evaluar','Evaluar equipo usado'],['ct-garantia','Garantía'],['ct-resuelto','Resuelto sin orden']];
    return todas.filter(([a]) => C.puede.vender() || (a !== 'ct-vender' && a !== 'ct-evaluar')).sort((x, y) => (x[0] === principal ? -1 : y[0] === principal ? 1 : 0)).map(([a, t]) => b(a, t, a === principal ? 'primary' : '')).join('');
  }
  const r = c.ordenId && S.ordenes[c.ordenId] ? 'Orden ' + C.linkOrden(c.ordenId) : c.ventaId && S.ventas[c.ventaId] ? 'Venta <span class="mono">' + esc(S.ventas[c.ventaId].folio) + '</span>' : c.compraId && S.compras[c.compraId] ? 'Evaluación <span class="mono">' + esc(S.compras[c.compraId].folio) + '</span>' : c.cierre && c.cierre.motivo ? esc(T.CIERRES_CITA[c.cierre.motivo] || c.cierre.motivo) : c.cierre && c.cierre.nota ? esc(c.cierre.nota) : '';
  return r ? '<span class="small muted">' + r + '</span>' : '';
};
function turno(id, c){
  const e = T.estadoDe(T.ESTADOS_CITA, c.estado), q = c.cotizacion;
  const cerrada = ['atendida','noasistio','cancelada'].includes(c.estado);
  return '<article class="turno ' + c.estado + (cerrada ? ' cerrada' : '') + '"><div class="t-num"><span>Turno</span><b>' + esc(c.turno) + '</b><span>' + esc(c.hora || '') + '</span></div><div class="t-info">'
    + '<div class="row"><button class="linkbtn" type="button" data-act="ct-open" data-v="' + esc(id) + '">' + esc(T.nombreCita(c)) + '</button>' + (c.contacto.tecmi ? '<span class="tag demo">Tecmilenio</span>' : '') + (c.modalidad === 'domicilio' ? chip('warn', 'A domicilio') : '') + '<span class="spacer"></span>' + chip(e[2], e[1]) + '</div>'
    + '<div class="small"><b>' + esc(T.MOTIVOS_CITA[c.motivo] || c.motivo) + '</b>' + (q ? ' · ' + C.cotTxt(c) : '') + (q && q.precio != null && S.tarifas[q.tarifaId] && S.tarifas[q.tarifaId].demo ? ' ' + T.DEMO_TAG : '') + '</div>'
    + (c.nota ? '<div class="small muted">“' + esc(c.nota) + '”</div>' : '')
    + '<div class="row acciones">' + C.accionesCita(id, c) + '</div></div></article>';
}
C.turno = turno;

function vHoy(){
  const hoy = T.hoyISO();
  const citas = T.ents(S.citas).filter(([, c]) => c.fecha === hoy && c.estado !== 'cancelada').sort((a, b) => (a[1].hora || '99').localeCompare(b[1].hora || '99') || a[1].turno - b[1].turno);
  const pend = citas.filter(([, c]) => !['atendida','noasistio'].includes(c.estado));
  const hechas = citas.filter(([, c]) => ['atendida','noasistio'].includes(c.estado));
  const ords = T.ents(S.ordenes);
  const listos = ords.filter(([, o]) => o.estado === 'listo');
  const porAut = ords.filter(([, o]) => o.estado === 'presupuesto');
  const taller = ords.filter(([, o]) => ['recibido','diagnostico','autorizado','reparacion','espera'].includes(o.estado));
  const vencidas = taller.filter(([, o]) => o.promesa && o.promesa <= hoy);
  const bajos = T.ents(S.productos).filter(([id]) => { const e = T.ex(id); return e.min != null && e.disp < e.min; });
  const ventasHoy = T.vals(S.ventas).filter(v => v.fecha === hoy).reduce((a, v) => a + (+v.total || 0), 0);
  const W = U.walk;
  const walk = W.open ? '<form class="panel stack tight" data-form="walk"><h3>Turno sin cita</h3><div class="grid2">' + C.inp('walk.nombre', 'wk-nom', 'Nombre', W.nombre) + C.inp('walk.tel', 'wk-tel', 'Celular', W.tel, ' type="tel" inputmode="numeric"')
    + C.sel('walk.motivo', 'wk-mot', 'Motivo', T.ents(T.MOTIVOS_CITA), W.motivo) + '</div>' + C.chk('walk.tecmi', 'Es de la comunidad Tecmilenio', W.tecmi)
    + '<div class="row"><button class="btn primary" type="submit">Dar turno ' + (T.vals(S.citas).filter(c => c.fecha === hoy).reduce((a, c) => Math.max(a, +c.turno || 0), 0) + 1) + '</button><button class="btn quiet" type="button" data-act="walk">Cancelar</button></div></form>' : '';
  const lista = (titulo, items, fila, vacio) => '<section class="panel stack tight"><h3>' + titulo + ' <span class="muted">(' + items.length + ')</span></h3>' + (items.length ? '<ul class="log">' + items.map(fila).join('') + '</ul>' : '<p class="muted small">' + vacio + '</p>') + '</section>';
  const filaO = extra => ([id, o]) => '<li><div class="row">' + C.linkOrden(id) + '<span>' + esc(T.nombreCliente(o.clienteId)) + '</span><span class="spacer"></span>' + extra(id, o) + '</div><span class="small muted">' + esc(T.equipoTxt(o.equipo)) + ' · ' + esc(T.PROB[o.problema] ? T.PROB[o.problema].t : '') + '</span></li>';
  const tel = o => (S.clientes[o.clienteId] || {}).tel;
  return '<div class="tiles">'
    + C.tile('Turnos de hoy', citas.length, pend.filter(([, c]) => c.estado === 'llego').length + ' esperando · ' + hechas.filter(([, c]) => c.estado === 'atendida').length + ' atendidos · ' + hechas.filter(([, c]) => c.estado === 'noasistio').length + ' no asistieron', true)
    + C.tile('Equipos en el taller', taller.length, vencidas.length ? vencidas.length + ' con fecha prometida hoy o vencida' : 'Ninguno con fecha vencida')
    + C.tile('Listos para entregar', listos.length, T.fmtMoney(listos.reduce((a, [, o]) => a + T.saldoOrden(o), 0)) + ' por cobrar')
    + C.tile('Esperando autorización', porAut.length, 'No se repara sin el sí del cliente')
    + (C.puede.vender() ? C.tile('Ventas de hoy', T.fmtMoney(ventasHoy), 'Accesorios y celulares') : '')
    + '</div><div class="hoy"><section class="stack"><div class="row"><h2>Turnos · ' + esc(T.fmtDia(hoy)) + '</h2><span class="spacer"></span>' + (W.open ? '' : '<button class="btn" type="button" data-act="walk">Turno sin cita</button>') + '</div>' + walk
    + (pend.length ? pend.map(([id, c]) => turno(id, c)).join('') : '<div class="card muted">No hay turnos pendientes por ahora.</div>')
    + (hechas.length ? '<details><summary>Ya atendidos o no asistieron (' + hechas.length + ')</summary><div class="stack tight" style="margin-top:10px">' + hechas.map(([id, c]) => turno(id, c)).join('') + '</div></details>' : '')
    + '</section><aside class="stack">'
    + lista('Listos para entregar', listos, filaO((id, o) => (T.saldoOrden(o) ? chip('warn', 'Saldo ' + T.fmtMoney(T.saldoOrden(o))) : chip('ok', 'Pagado')) + C.wa(tel(o), 'Hola ' + T.nombreCliente(o.clienteId).split(' ')[0] + ', tu ' + T.equipoTxt(o.equipo) + ' ya está listo. Pasa por él a ' + (T.empresa().lugarFrase || T.empresa().lugar) + ' con tu folio ' + o.folio + '.' + (T.saldoOrden(o) ? ' Saldo: ' + T.fmtMoney(T.saldoOrden(o)) + '.' : ''), 'Avisar')), 'Nada listo por ahora.')
    + lista('Esperando autorización', porAut, filaO((id, o) => { const h = (o.historial || []).filter(x => /presupuesto enviado/i.test(x.nota)).pop(); const d = h ? T.difDias(hoy, h.fecha) : 0; return (d >= 1 ? chip('warn', 'Hace ' + d + ' d') : chip('info', 'Hoy')) + C.wa(tel(o), 'Hola, el presupuesto de tu ' + T.equipoTxt(o.equipo) + ' es de ' + T.fmtMoney(T.totalOrden(o)) + '. ¿Lo autorizas? Folio ' + o.folio + '.' + (C.urlConsulta(o.folio) ? ' Puedes verlo y autorizarlo aquí: ' + C.urlConsulta(o.folio) : ''), 'Recordar'); }), 'Ningún presupuesto pendiente.')
    + lista('Fecha prometida hoy o vencida', vencidas, filaO((id, o) => chip(o.promesa < hoy ? 'crit' : 'warn', o.promesa < hoy ? 'Vencida ' + T.fmtD(o.promesa) : 'Hoy')), 'Todo en tiempo.')
    + lista('Bajo el mínimo de inventario', bajos, ([id, p]) => '<li><div class="row"><span>' + esc(p.nombre) + '</span><span class="spacer"></span>' + chip('crit', T.ex(id).disp + ' de ' + T.ex(id).min) + '</div>' + (p.compat ? '<span class="small muted">' + esc(p.compat) + '</span>' : '') + '</li>', 'Existencias en orden.')
    + '</aside></div>';
}
C.vistas.hoy = vHoy;
C.estado.walk = { open:false, nombre:'', tel:'', motivo:'reparacion', tecmi:false };

Object.assign(C.acciones, {
  walk(){ U.walk.open = !U.walk.open; T.scheduleRender(); },
  'ct-open'(d){ U.drawer = { kind:'cita', id:d.v }; U.ctx = { reprogramar:false, cancelar:false, fecha:'', hora:'', motivo:'cliente' }; T.scheduleRender(); },
  'ct-llego'(d){ C.cerrarCita(d.v, 'llego', { llego:T.ahoraHM() }, 'Llegó a la cafetería'); },
  'ct-atender'(d){ C.cerrarCita(d.v, 'atendiendo', { atendio:T.quien() }, 'En atención con ' + T.quien()); },
  'ct-noasistio'(d){ C.cerrarCita(d.v, 'noasistio', {}, 'No asistió'); },
  'ct-resuelto'(d){
    const nota = prompt('¿Cómo se resolvió? (por ejemplo: duda de garantía aclarada)', '');
    if (nota === null) return;
    C.cerrarCita(d.v, 'atendida', { cierre:{ resultado:'resuelta', nota:nota.trim() || 'Resuelto sin orden', fecha:T.hoyISO() } }, 'Atendida: ' + (nota.trim() || 'resuelto sin orden'));
    const cid = C.clienteDeCita(d.v); if (cid && nota.trim()) T.bitacora(cid, { tipo:'Cita', nota:nota.trim() });
  },
  'ct-recibir'(d){ C.nuevaOrden({ citaId:d.v }); },
  'ct-entregar'(d){
    const c = S.citas[d.v]; const f = c.cotizacion && c.cotizacion.ordenFolio;
    const cid = C.clienteDeCita(d.v);
    const o = T.ents(S.ordenes).find(([, x]) => (f && x.folio === f) || (x.clienteId === cid && (x.estado === 'listo' || x.estado === 'rechazado')));
    if (!o){ T.toast('No hay un equipo listo para este cliente. Revisa su ficha.', 'warn'); U.drawer = { kind:'cli', id:cid }; return T.scheduleRender(); }
    T.citaEdit(d.v, x => { x.ordenId = o[0]; });
    U.drawer = { kind:'orden', id:o[0], citaId:d.v }; C.abrirOrden(o[0]); T.scheduleRender();
  },
  'ct-vender'(d){ C.posDesdeCita(d.v); },
  'ct-evaluar'(d){ C.nuevaCompra({ citaId:d.v }); },
  'ct-garantia'(d){ const cid = C.clienteDeCita(d.v); U.drawer = { kind:'cli', id:cid }; T.toast('Revisa sus garantías y abre el reclamo desde la orden original.'); T.scheduleRender(); }
});
C.formularios.walk = () => {
  const W = U.walk;
  if (W.nombre.trim().length < 2 || T.digitos(W.tel).length !== 10){ T.toast('Escribe nombre y celular de 10 dígitos.', 'warn'); return; }
  const c = T.crearCita({ fecha:T.hoyISO(), hora:T.ahoraHM(), motivo:W.motivo, origen:'mostrador', estado:'llego', contacto:{ nombre:W.nombre, tel:W.tel, tecmi:W.tecmi } });
  U.walk = { open:false, nombre:'', tel:'', motivo:'reparacion', tecmi:false };
  T.toast('Turno ' + c.turno + ' para ' + c.contacto.nombre + '.');
};
})();
