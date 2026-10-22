/* Compra y toma a cuenta de celulares usados. Regla 7: sin identificación,
   IMEI sin reporte y cuentas desvinculadas no se compra ni se toma a cuenta. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip;
const TIPOS = { compra:'Compra en efectivo', toma:'Toma a cuenta' };
const NO_CERRO = { oferta:'No aceptó la oferta', reporte:'IMEI con reporte', cuentas:'Cuentas sin desvincular', identificacion:'Sin identificación', otro:'Otro' };
const ESTADOS = { evaluacion:['Evaluando','warn'], aceptada:['Aceptada','ok'], rechazada:['No se cerró','muted'] };
const IDENT = ['INE','Pasaporte','Licencia de conducir','Credencial escolar'];

function vCompras(){
  const cs = T.ents(S.compras).sort((a, b) => (b[1].fecha || '').localeCompare(a[1].fecha || ''));
  return '<div class="toolbar"><p class="muted small" style="flex:1 1 300px">Cada equipo comprado o tomado a cuenta entra al inventario como “por reacondicionar”, con lo que se pagó como su costo.</p><button class="btn primary" type="button" data-act="ce-nueva">Evaluar un equipo</button></div>'
    + '<div class="tbl"><table class="t"><thead><tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Vendedor</th><th>Equipo</th><th>Verificado</th><th class="num">Precio</th><th>Estado</th></tr></thead><tbody>'
    + (cs.map(([id, c]) => { const e = ESTADOS[c.estado] || ['', 'muted']; return '<tr><td><button class="linkbtn mono" type="button" data-act="ce-open" data-v="' + esc(id) + '">' + esc(c.folio) + '</button></td><td>' + T.fmtD(c.fecha) + '</td><td>' + esc(TIPOS[c.tipo]) + '</td><td>' + esc(c.vendedor.nombre) + '</td><td>' + esc(c.equipo.marca + ' ' + c.equipo.modelo) + (c.equipo.capacidad ? ' · ' + esc(c.equipo.capacidad) : '') + '</td>'
      + '<td>' + (T.compraVerificada(c) ? chip('ok', 'Completo') : chip('crit', 'Incompleto')) + '</td><td class="num">' + T.precioTxt(c.precio == null ? c.oferta : c.precio) + '</td><td>' + chip(e[1], e[0]) + (c.tipo === 'toma' && c.estado === 'aceptada' ? '<div class="small muted">' + (c.aplicadaEn ? 'Aplicada en ' + esc(c.aplicadaEn) : 'Crédito sin usar') + '</div>' : '') + (c.motivo ? '<div class="small muted">' + esc(NO_CERRO[c.motivo] || c.motivo) + '</div>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="8" class="muted">Sin evaluaciones.</td></tr>')
    + '</tbody></table></div>';
}
C.vistas.compras = vCompras;

C.nuevaCompra = pre => {
  const c = pre.citaId ? S.citas[pre.citaId] : null, q = (c && c.cotizacion) || {};
  const m = q.modeloId && S.modelos[q.modeloId];
  U.ce = { id:'', citaId:pre.citaId || '', tipo:q.preferencia === 'toma' ? 'toma' : 'compra', vendedor:{ nombre:c ? c.contacto.nombre : '', tel:c ? c.contacto.tel : '', identificacion:'INE', idUltimos:'' },
    eq:{ marca:m ? m.marca : (q.marca || ''), modeloId:m ? q.modeloId : '', marcaTexto:'', modelo:m ? '' : (q.modeloTexto || ''), capacidad:q.capacidad && q.capacidad !== 'No sé' ? q.capacidad : '', color:'', imei:'', bateria:'', condicion:q.condicion || 'bueno', notas:'' },
    verificacion:{}, oferta:'', forma:'efectivo', motivo:'oferta', cerrando:false };
  U.drawer = { kind:'compra' }; T.scheduleRender();
};
function abrir(id){
  const c = S.compras[id];
  U.ce = { id, citaId:c.citaId || '', tipo:c.tipo, vendedor:T.clone(c.vendedor), eq:Object.assign({ marcaTexto:'' }, T.clone(c.equipo), { bateria:c.equipo.bateria == null ? '' : c.equipo.bateria }), verificacion:T.clone(c.verificacion || {}), oferta:c.precio != null ? c.precio : c.oferta != null ? c.oferta : '', forma:'efectivo', motivo:'oferta', cerrando:false };
  U.drawer = { kind:'compra', id }; T.scheduleRender();
}
C.drawers.compra = id => {
  const X = U.ce, c = id ? S.compras[id] : null, cerrada = c && c.estado !== 'evaluacion';
  const verif = T.VERIFICACIONES.map(([k, t]) => C.chk('ce.verificacion.' + k, t, X.verificacion[k])).join('');
  const listo = T.VERIFICACIONES.every(([k]) => X.verificacion[k]);
  if (cerrada){
    const e = ESTADOS[c.estado];
    return C.drawer(esc(c.equipo.marca + ' ' + c.equipo.modelo), '<span class="mono">' + esc(c.folio) + '</span>' + chip(e[1], e[0]) + '<span>' + esc(TIPOS[c.tipo]) + '</span>',
      '<dl class="kv"><dt>Vendedor</dt><dd>' + esc(c.vendedor.nombre) + ' · ' + esc(T.telTxt(c.vendedor.tel)) + '</dd><dt>Identificación</dt><dd>' + esc(c.vendedor.identificacion) + ' terminación ' + esc(c.vendedor.idUltimos || '—') + '</dd>'
      + '<dt>Equipo</dt><dd>' + esc([c.equipo.capacidad, c.equipo.color, c.equipo.bateria ? 'batería ' + c.equipo.bateria + '%' : '', T.CONDICION_USADO[c.equipo.condicion]].filter(Boolean).join(' · ')) + '</dd><dt>IMEI</dt><dd class="mono">' + esc(c.equipo.imei) + '</dd>'
      + '<dt>Verificaciones</dt><dd>' + T.VERIFICACIONES.map(([k, t]) => chip(c.verificacion && c.verificacion[k] ? 'ok' : 'crit', t)).join(' ') + '</dd>'
      + (c.estado === 'aceptada' ? '<dt>Precio</dt><dd>' + T.fmtMoney(c.precio) + (c.pago ? ' · pagado en ' + esc(T.FORMAS_PAGO[c.pago.forma]) : '') + '</dd><dt>Inventario</dt><dd>' + (c.equipoId && S.equipos[c.equipoId] ? esc(T.ESTADOS_EQUIPO[S.equipos[c.equipoId].estado]) : '—') + '</dd>' + (c.tipo === 'toma' ? '<dt>Crédito</dt><dd>' + (c.aplicadaEn ? 'Aplicado en la venta ' + esc(c.aplicadaEn) : 'Disponible en el punto de venta') + '</dd>' : '') : '<dt>Motivo</dt><dd>' + esc(NO_CERRO[c.motivo] || c.motivo || '') + '</dd>')
      + (c.equipo.notas ? '<dt>Notas</dt><dd>' + esc(c.equipo.notas) + '</dd>' : '') + '<dt>Atendió</dt><dd>' + esc(c.por || '') + '</dd></dl>');
  }
  return C.drawer(id ? 'Evaluación ' + esc(c.folio) : 'Evaluar equipo usado', X.citaId ? 'Desde la cita ' + esc((S.citas[X.citaId] || {}).folio || '') : '',
    '<form class="stack" data-form="compra"><section class="panel stack tight"><h3>Operación</h3>' + C.sel('ce.tipo', 'ce-tipo', 'Tipo', T.ents(TIPOS), X.tipo) + '</section>'
    + '<section class="panel stack tight"><h3>Quién vende</h3><div class="grid2">' + C.inp('ce.vendedor.nombre', 'ce-nom', 'Nombre completo', X.vendedor.nombre) + C.inp('ce.vendedor.tel', 'ce-tel', 'Celular', X.vendedor.tel, ' type="tel" inputmode="numeric"')
    + C.sel('ce.vendedor.identificacion', 'ce-id', 'Identificación', IDENT.map(i => [i, i]), X.vendedor.identificacion) + C.inp('ce.vendedor.idUltimos', 'ce-idu', 'Últimos 4 dígitos', X.vendedor.idUltimos, ' inputmode="numeric" maxlength="4"') + '</div></section>'
    + '<section class="panel stack tight"><h3>Equipo</h3>' + C.modeloCampos('ce.eq', X.eq) + '<div class="grid2">' + C.inp('ce.eq.capacidad', 'ce-cap', 'Capacidad', X.eq.capacidad, ' placeholder="128 GB"') + C.inp('ce.eq.color', 'ce-col', 'Color', X.eq.color)
    + C.inp('ce.eq.imei', 'ce-imei', 'IMEI (*#06#)', X.eq.imei, ' inputmode="numeric" autocomplete="off"') + C.inp('ce.eq.bateria', 'ce-bat', 'Salud de batería %', X.eq.bateria, ' type="number" min="0" max="100"') + C.sel('ce.eq.condicion', 'ce-cond', 'Condición', T.ents(T.CONDICION_USADO), X.eq.condicion) + '</div>'
    + C.area('ce.eq.notas', 'ce-notas', 'Detalles encontrados', X.eq.notas) + '</section>'
    + '<section class="panel stack tight"><h3>Verificaciones (obligatorias)</h3>' + verif + (listo ? '' : '<p class="small err">Sin estas cuatro verificaciones no se puede aceptar.</p>') + '</section>'
    + '<section class="panel stack tight"><h3>Oferta</h3><div class="grid2">' + C.inp('ce.oferta', 'ce-of', X.tipo === 'toma' ? 'Valor a cuenta' : 'Precio ofrecido', X.oferta, ' type="number" min="0" step="any" inputmode="decimal"') + (X.tipo === 'compra' ? C.sel('ce.forma', 'ce-fp', 'Forma de pago', C.formas(), X.forma) : '') + '</div>'
    + (C.puede.costos() ? '<p class="small muted">Lo que se pague queda como costo del equipo para calcular la utilidad cuando se venda.</p>' : '') + '</section>'
    + '<div class="row"><button class="btn" type="submit">Guardar evaluación</button><button class="btn primary" type="button" data-act="ce-aceptar"' + (listo ? '' : ' disabled') + '>' + (X.tipo === 'toma' ? 'Aceptar toma a cuenta' : 'Aceptar y pagar') + '</button><button class="btn quiet" type="button" data-act="ce-no">No se cerró</button></div>'
    + (X.cerrando ? '<div class="panel stack tight">' + C.sel('ce.motivo', 'ce-mot', '¿Por qué no se cerró?', T.ents(NO_CERRO), X.motivo) + '<div><button class="btn danger sm" type="button" data-act="ce-no-ok">Registrar</button></div></div>' : '') + '</form>');
};
/* Guarda la evaluación tal como está; regresa su id. */
function guardar(){
  const X = U.ce, m = C.modeloDe(X.eq);
  if (X.vendedor.nombre.trim().length < 2) { T.toast('Escribe el nombre de quien vende.', 'warn'); return null; }
  if (!m.marca || !(m.modeloId || m.modelo)) { T.toast('Elige marca y modelo.', 'warn'); return null; }
  const id = X.id || T.uid('ce'), prev = X.id ? S.compras[X.id] : null;
  const ya = T.clientePorTel(X.vendedor.tel);
  const c = Object.assign({}, prev || { folio:T.nuevoFolio('CE'), fecha:T.hoyISO(), estado:'evaluacion', citaId:X.citaId || null }, {
    tipo:X.tipo, vendedor:Object.assign({}, X.vendedor, { nombre:X.vendedor.nombre.trim(), tel:T.digitos(X.vendedor.tel), clienteId:ya ? ya[0] : null }),
    equipo:Object.assign(m, { capacidad:X.eq.capacidad.trim(), color:X.eq.color.trim(), imei:X.eq.imei.replace(/\s/g, ''), bateria:X.eq.bateria === '' ? null : +X.eq.bateria, condicion:X.eq.condicion, notas:X.eq.notas.trim() }),
    verificacion:Object.assign({}, X.verificacion), oferta:X.oferta === '' ? null : +X.oferta, por:T.quien() });
  T.put('compras', id, c); X.id = id;
  return id;
}
Object.assign(C.acciones, {
  'ce-nueva'(){ C.nuevaCompra({}); },
  'ce-open'(d){ abrir(d.v); },
  'ce-no'(){ U.ce.cerrando = !U.ce.cerrando; T.scheduleRender(); },
  'ce-no-ok'(){
    const id = guardar(); if (!id) return;
    const c = T.clone(S.compras[id]); c.estado = 'rechazada'; c.motivo = U.ce.motivo; c.cerrada = T.hoyISO(); T.put('compras', id, c);
    if (c.citaId) C.cerrarCita(c.citaId, 'atendida', { compraId:id }, 'Evaluación sin cierre · ' + NO_CERRO[c.motivo]);
    U.drawer = { kind:'compra', id }; T.toast('Registrado: ' + NO_CERRO[c.motivo] + '.');
  },
  'ce-aceptar'(){
    const id = guardar(); if (!id) return;
    const err = T.aceptarCompra(id, { precio:U.ce.oferta, forma:U.ce.forma });
    if (err) return T.toast(err, 'warn');
    const c = S.compras[id];
    if (c.citaId) C.cerrarCita(c.citaId, 'atendida', { compraId:id }, (c.tipo === 'toma' ? 'Toma a cuenta ' : 'Compra ') + c.folio);
    U.drawer = { kind:'compra', id };
    T.toast(c.tipo === 'toma' ? 'Toma aceptada: el crédito de ' + T.fmtMoney(c.precio) + ' ya aparece en el punto de venta.' : 'Compra registrada. El equipo entró al inventario por reacondicionar.');
  }
});
C.formularios.compra = () => { if (guardar()) { U.drawer = { kind:'compra', id:U.ce.id }; T.toast('Evaluación guardada.'); } };
})();
