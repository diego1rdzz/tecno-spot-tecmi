/* Órdenes de servicio: recepción con checklist, diagnóstico, presupuesto,
   autorización, reparación, entrega con garantía y hojas imprimibles. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip, PC = T.PC;

const COLUMNAS = [['Por diagnosticar',['recibido','diagnostico']],['Esperando autorización',['presupuesto']],['En reparación',['autorizado','reparacion','espera']],['Listos para entregar',['listo']],['Por devolver sin reparar',['rechazado']]];
const EDITABLE = ['recibido','diagnostico','presupuesto'];
const ACCESO = { ninguno:'Sin bloqueo', pin:'PIN o contraseña', patron:'Patrón', nolodejo:'No lo dejó' };
const probTxt = k => T.PROB[k] ? T.PROB[k].t : (k || '');

/* ---------- tablero de órdenes ---------- */
function tarjeta(id, o){
  const hoy = T.hoyISO(), e = T.estadoDe(T.ESTADOS_ORDEN, o.estado);
  const venc = o.promesa && T.ordenAbierta(o) && o.estado !== 'listo' && o.estado !== 'rechazado' && o.promesa < hoy;
  const bm = C.puede.costos() && T.bajoMargen(o.lineas);
  return '<button class="opp" type="button" data-act="os-open" data-v="' + esc(id) + '"><span class="row"><span class="mono">' + esc(o.folio) + '</span><span class="spacer"></span>' + chip(e[2], e[1]) + '</span>'
    + '<span class="nm">' + esc(T.nombreCliente(o.clienteId)) + '</span><span class="small">' + esc(T.equipoTxt(o.equipo)) + ' · ' + esc(probTxt(o.problema)) + '</span>'
    + '<span class="meta">' + (o.garantiaDe ? chip('info', 'Garantía') : '') + (venc ? chip('crit', 'Prometido ' + T.fmtD(o.promesa)) : o.promesa && o.estado !== 'entregado' ? chip('muted', 'Para ' + T.fmtD(o.promesa)) : '')
    + (bm ? chip('crit', 'Utilidad bajo ' + T.cfg().margenMinimo + '%') : '') + (T.sinPrecio(o.lineas) && EDITABLE.includes(o.estado) ? chip('warn', 'Sin precio') : '') + '</span>'
    + '<span class="row small muted"><span class="amt">' + (o.lineas.length ? T.fmtMoney(T.totalOrden(o)) : 'Sin presupuesto') + '</span><span class="spacer"></span>' + esc(o.tecnico || 'Sin técnico') + '</span></button>';
}
function vOrdenes(){
  const q = (U.osBusca || '').trim().toLowerCase(), tec = U.osTec || '';
  const todas = T.ents(S.ordenes).filter(([, o]) => (!tec || o.tecnico === tec) && (!q || [o.folio, T.nombreCliente(o.clienteId), T.equipoTxt(o.equipo), o.equipo.imei, (S.clientes[o.clienteId] || {}).tel].join(' ').toLowerCase().includes(q)));
  const cols = COLUMNAS.map(([t, est]) => { const os = todas.filter(([, o]) => est.includes(o.estado)).sort((a, b) => (a[1].promesa || '9').localeCompare(b[1].promesa || '9'));
    return '<section class="col" aria-label="' + esc(t) + '"><div class="col-h">' + esc(t) + '<span>' + os.length + '</span></div>' + os.map(([id, o]) => tarjeta(id, o)).join('') + '</section>'; }).join('');
  const entregadas = todas.filter(([, o]) => o.estado === 'entregado').sort((a, b) => (b[1].entrega || {}).fecha > (a[1].entrega || {}).fecha ? 1 : -1).slice(0, 12);
  return '<div class="toolbar"><label class="f" for="os-q" style="flex:1 1 260px;max-width:380px">Buscar por folio, cliente, celular, equipo o IMEI<input id="os-q" type="search" data-bind="osBusca" data-live value="' + esc(U.osBusca || '') + '"></label>'
    + C.sel('osTec', 'os-tec', 'Técnico', C.tecnicos().map(t => [t, t]), tec, 'Todos') + '<span class="spacer"></span><button class="btn primary" type="button" data-act="os-nueva">Recibir equipo</button></div>'
    + '<div class="kanban">' + cols + '</div>'
    + '<details><summary>Entregadas recientemente (' + entregadas.length + ')</summary><div class="tbl" style="margin-top:10px"><table class="t"><thead><tr><th>Folio</th><th>Cliente</th><th>Equipo</th><th>Entregada</th><th>Garantía</th></tr></thead><tbody>'
    + entregadas.map(([id, o]) => '<tr><td>' + C.linkOrden(id) + '</td><td>' + esc(T.nombreCliente(o.clienteId)) + '</td><td>' + esc(T.equipoTxt(o.equipo)) + '</td><td>' + T.fmtD(o.entrega.fecha) + '</td><td>' + (o.entrega.garantiaHasta ? (o.entrega.garantiaHasta >= T.hoyISO() ? chip('ok', 'Hasta ' + T.fmtD(o.entrega.garantiaHasta)) : chip('muted', 'Venció ' + T.fmtD(o.entrega.garantiaHasta))) : chip('muted', 'Sin reparar')) + '</td></tr>').join('')
    + '</tbody></table></div></details>';
}
C.vistas.ordenes = vOrdenes;
C.estado.osBusca = ''; C.estado.osTec = '';

/* ---------- recepción: orden nueva ---------- */
C.nuevaOrden = pre => {
  const c = pre.citaId ? S.citas[pre.citaId] : null, q = (c && c.cotizacion) || {};
  const cl = pre.clienteId ? S.clientes[pre.clienteId] : c && c.clienteId ? S.clientes[c.clienteId] : null;
  const m = q.modeloId && S.modelos[q.modeloId];
  const checklist = {}; T.CHECKLIST.forEach(([k]) => { checklist[k] = 'si'; });
  const t = q.tarifaId && S.tarifas[q.tarifaId];
  U.no = { citaId:pre.citaId || '', clienteId:(pre.clienteId || (c && c.clienteId)) || '', nombre:cl ? cl.nombre : c ? c.contacto.nombre : '', tel:cl ? cl.tel : c ? c.contacto.tel : '', correo:cl ? cl.correo || '' : c ? c.contacto.correo || '' : '', tecmi:cl ? !!cl.tecmi : c ? !!c.contacto.tecmi : false,
    eq:{ marca:m ? m.marca : (q.marca || ''), modeloId:m ? q.modeloId : '', marcaTexto:'', modelo:m ? '' : (q.modeloTexto || ''), color:'', imei:'', accesoTipo:'pin', acceso:'' },
    problema:q.problema || '', falla:c && c.nota ? c.nota : '', checklist, acc:{}, notas:'', lineas:t ? [lineaTarifa(q.tarifaId)] : [], tarifaSel:'',
    autoriza:false, anticipo:'', forma:'efectivo', tecnico:'', promesa:T.hoyISO(), modalidad:c ? c.modalidad || 'cafeteria' : 'cafeteria', direccion:c ? c.direccion || '' : '', terminos:false };
  U.drawer = { kind:'nueva-orden' }; T.scheduleRender();
};
function lineaTarifa(tid){
  const t = S.tarifas[tid] || {};
  return { tipo:'servicio', tarifaId:tid, productoId:t.refaccionId || null, desc:probTxt(t.problema) + (t.calidad ? ' · ' + t.calidad : '') + ' · ' + T.nombreModelo(t.modeloId), cant:1, precio:t.precio == null ? null : +t.precio, apartado:0 };
}
C.lineaTarifa = lineaTarifa;
C.drawers['nueva-orden'] = () => {
  const N = U.no, m = C.modeloDe(N.eq);
  const tarifas = m.modeloId && N.problema ? T.tarifasDe(m.modeloId, N.problema) : [];
  const ck = T.CHECKLIST.map(([k, t]) => '<div class="ck"><span>' + t + '</span><div class="seg">' + T.ents(T.CHECK_VALS).map(([v, vt]) => '<label><input type="radio" name="ck-' + k + '" value="' + v + '" data-bind="no.checklist.' + k + '"' + (N.checklist[k] === v ? ' checked' : '') + '><span>' + vt + '</span></label>').join('') + '</div></div>').join('');
  return C.drawer('Recibir equipo', N.citaId ? 'Desde la cita ' + esc((S.citas[N.citaId] || {}).folio || '') : 'Orden de servicio nueva',
    '<form class="stack" data-form="nueva-orden">'
    + '<section class="panel stack tight"><h3>1. Cliente</h3><div class="grid2">' + C.inp('no.nombre', 'no-nom', 'Nombre', N.nombre) + C.inp('no.tel', 'no-tel', 'Celular (WhatsApp)', N.tel, ' type="tel" inputmode="numeric"') + C.inp('no.correo', 'no-mail', 'Correo (opcional)', N.correo, ' type="email"') + '</div>'
    + C.chk('no.tecmi', 'Es de la comunidad Tecmilenio', N.tecmi) + (T.clientePorTel(N.tel) && !N.clienteId ? '<p class="small muted">Ya existe la ficha de ' + esc(T.clientePorTel(N.tel)[1].nombre) + ' con ese celular; la orden se liga a ella.</p>' : '') + '</section>'
    + '<section class="panel stack tight"><h3>2. Equipo</h3>' + C.modeloCampos('no.eq', N.eq) + '<div class="grid2">' + C.inp('no.eq.color', 'no-col', 'Color', N.eq.color) + C.inp('no.eq.imei', 'no-imei', 'IMEI o número de serie', N.eq.imei, ' inputmode="numeric" autocomplete="off"')
    + C.sel('no.eq.accesoTipo', 'no-at', 'Desbloqueo', T.ents(ACCESO), N.eq.accesoTipo) + (N.eq.accesoTipo === 'pin' || N.eq.accesoTipo === 'patron' ? C.inp('no.eq.acceso', 'no-acc', N.eq.accesoTipo === 'patron' ? 'Patrón (números del 1 al 9)' : 'PIN o contraseña', N.eq.acceso, ' autocomplete="off"') : '') + '</div>'
    + '<p class="small muted">El IMEI aparece marcando *#06#. El código de desbloqueo se borra solo al entregar el equipo.</p></section>'
    + '<section class="panel stack tight"><h3>3. Falla</h3>' + C.sel('no.problema', 'no-prob', 'Problema', T.PROBLEMAS.map(p => [p.id, p.t]), N.problema, 'Elige…') + C.area('no.falla', 'no-falla', 'Lo que cuenta el cliente', N.falla, 'Cuándo empezó y qué pasó antes') + '</section>'
    + '<section class="panel stack tight"><h3>4. Estado al recibir</h3><div class="checklist">' + ck + '</div><div class="row">' + T.ACCESORIOS_REC.map(a => C.chk('no.acc.' + a, a, N.acc[a])).join('') + '</div>' + C.area('no.notas', 'no-notas', 'Observaciones (golpes, rayones, detalles)', N.notas) + '</section>'
    + '<section class="panel stack tight"><h3>5. Presupuesto</h3>' + (N.lineas.length ? '<ul class="log">' + N.lineas.map((l, i) => '<li><div class="row"><span>' + esc(l.desc) + '</span><span class="spacer"></span><b>' + T.precioTxt(l.precio) + '</b><button class="btn sm quiet" type="button" data-act="no-quitar" data-v="' + i + '">Quitar</button></div></li>').join('') + '</ul>' : '<p class="muted small">Sin presupuesto: se arma después del diagnóstico.</p>')
    + (tarifas.length ? '<div class="row">' + C.sel('no.tarifaSel', 'no-tar', 'Agregar del catálogo', tarifas.map(([id, t]) => [id, (t.calidad || probTxt(t.problema)) + ' · ' + (t.precio == null ? 'precio por confirmar' : T.fmtMoney(t.precio))]), N.tarifaSel, 'Elige…') + '<button class="btn sm" type="button" data-act="no-agregar">Agregar</button></div>' : '')
    + (N.lineas.length && !T.sinPrecio(N.lineas) ? C.chk('no.autoriza', 'El cliente autoriza este presupuesto ahora (' + T.fmtMoney(T.montoLineas(N.lineas)) + ')', N.autoriza) : '') + '</section>'
    + '<section class="panel stack tight"><h3>6. Anticipo, técnico y fecha</h3><div class="grid2">' + C.inp('no.anticipo', 'no-ant', 'Anticipo', N.anticipo, ' type="number" min="0" step="any" inputmode="decimal"') + C.sel('no.forma', 'no-fp', 'Forma de pago', C.formas(), N.forma)
    + C.sel('no.tecnico', 'no-tec', 'Técnico', C.tecnicos().map(t => [t, t]), N.tecnico, 'Sin asignar') + C.inp('no.promesa', 'no-prom', 'Fecha prometida', N.promesa, ' type="date"') + '</div>'
    + (N.modalidad === 'domicilio' ? '<p class="small">Recolección a domicilio: ' + esc(N.direccion || 'sin dirección') + '</p>' : '') + '</section>'
    + '<section class="panel stack tight"><h3>7. Términos</h3><p class="small">' + (T.cfg().terminos.recepcion ? esc(T.cfg().terminos.recepcion) : 'Términos de recepción ' + PC + '.') + '</p>' + C.chk('no.terminos', 'El cliente revisó el estado del equipo y acepta los términos de recepción', N.terminos) + '</section>'
    + '<div class="row"><button class="btn primary lg" type="submit">Crear orden</button></div></form>');
};
Object.assign(C.acciones, {
  'os-nueva'(){ C.nuevaOrden({}); },
  'no-agregar'(){ const N = U.no; if (!N.tarifaSel) return; N.lineas.push(lineaTarifa(N.tarifaSel)); N.tarifaSel = ''; T.scheduleRender(); },
  'no-quitar'(d){ U.no.lineas.splice(+d.v, 1); U.no.autoriza = false; T.scheduleRender(); }
});
C.formularios['nueva-orden'] = () => {
  const N = U.no, m = C.modeloDe(N.eq);
  const err = N.nombre.trim().length < 2 ? 'Escribe el nombre del cliente.' : T.digitos(N.tel).length !== 10 ? 'Escribe el celular a 10 dígitos.'
    : !m.marca || !(m.modeloId || m.modelo) ? 'Elige la marca y el modelo del equipo.' : (N.eq.imei || '').replace(/\s/g, '').length < 6 ? 'Captura el IMEI o el número de serie (regla 2).'
    : !N.problema ? 'Elige el problema.' : N.falla.trim().length < 3 ? 'Escribe la falla que cuenta el cliente.' : !N.terminos ? 'El cliente debe aceptar los términos de recepción.' : '';
  if (err){ T.toast(err, 'warn'); return; }
  let cid = N.clienteId && S.clientes[N.clienteId] ? N.clienteId : (T.clientePorTel(N.tel) || [])[0];
  if (!cid) cid = T.crearCliente({ nombre:N.nombre, tel:N.tel, correo:N.correo, tecmi:N.tecmi });
  const acc = Object.keys(N.acc).filter(k => N.acc[k]);
  const r = T.crearOrden({ clienteId:cid, citaId:N.citaId || null, origen:N.citaId ? 'cita' : 'mostrador', modalidad:N.modalidad, direccion:N.direccion,
    equipo:Object.assign(m, { color:N.eq.color.trim(), imei:N.eq.imei.replace(/\s/g, ''), accesoTipo:N.eq.accesoTipo, acceso:N.eq.acceso }),
    problema:N.problema, falla:N.falla.trim(), recepcion:{ checklist:N.checklist, accesorios:acc, notas:N.notas.trim(), aceptaTerminos:true, por:T.quien(), fecha:T.hoyISO() },
    lineas:N.lineas.map(l => Object.assign({}, l)), tecnico:N.tecnico, promesa:N.promesa || null });
  T.ordenEdit(r.id, o => {
    if (+N.anticipo > 0) o.pagos.push({ fecha:T.hoyISO(), hora:T.ahoraHM(), monto:+N.anticipo, forma:N.forma, concepto:'Anticipo', por:T.quien() });
    if (N.autoriza && o.lineas.length && !T.sinPrecio(o.lineas)) T.autorizar(o, 'si', 'mostrador', '', N.nombre.trim());
  });
  if (N.citaId) C.cerrarCita(N.citaId, 'atendida', { ordenId:r.id, clienteId:cid }, 'Equipo recibido · orden ' + r.o.folio);
  C.abrirOrden(r.id); U.drawer = { kind:'orden', id:r.id };
  T.toast('Orden ' + r.o.folio + ' creada. Imprime la hoja de recepción para que el cliente la firme.');
};

/* ---------- panel de una orden ---------- */
C.abrirOrden = id => {
  const o = S.ordenes[id] || {}, cl = S.clientes[o.clienteId] || {};
  const t = (o.lineas || []).map(l => S.tarifas[l.tarifaId]).find(Boolean);
  const g = T.garantiaDias(o.problema, t);
  U.od = { linea:{ tipo:'tarifa', tarifaId:'', productoId:'', desc:'', precio:'' }, pago:{ monto:'', forma:'efectivo', concepto:'Abono' }, medio:'mostrador', motivo:'precio', rechazando:false,
    ent:{ recibio:cl.nombre || '', garantia:g == null ? '' : g, monto:'', forma:'efectivo', pruebas:{} }, nota:'', publica:false, verCodigo:false, diag:o.diagnostico || '', reclamo:'' };
};
C.acciones['os-open'] = d => { C.abrirOrden(d.v); U.drawer = { kind:'orden', id:d.v }; T.scheduleRender(); };

function accionPrincipal(id, o){
  const X = U.od, cl = S.clientes[o.clienteId] || {}, b = (act, t, k) => '<button class="btn' + (k ? ' ' + k : '') + '" type="button" data-act="' + act + '" data-v="' + esc(id) + '">' + t + '</button>';
  const url = C.urlConsulta(o.folio);
  switch (o.estado){
    case 'recibido': return '<p>Empieza por revisar el equipo.</p><div class="row">' + b('os-estado-diagnostico', 'Iniciar diagnóstico', 'primary') + '</div>';
    case 'diagnostico': return '<p>Escribe el diagnóstico y arma el presupuesto. Después envíalo al cliente: <b>no se repara sin su autorización</b>.</p><div class="row">' + b('os-enviar', 'Enviar presupuesto al cliente', 'primary') + b('os-aut-mostrador', 'Autorizó aquí en mostrador') + '</div>';
    case 'presupuesto': return '<p>Esperando que ' + esc(cl.nombre || 'el cliente') + ' autorice ' + T.fmtMoney(T.totalOrden(o)) + '.' + (url ? '' : ' También puede autorizarlo en el sitio con su folio y su celular.') + '</p>'
      + '<div class="row">' + C.wa(cl.tel, 'Hola ' + (cl.nombre || '').split(' ')[0] + ', revisamos tu ' + T.equipoTxt(o.equipo) + '. ' + (o.diagnostico ? 'Diagnóstico: ' + o.diagnostico + ' ' : '') + 'El presupuesto es de ' + T.fmtMoney(T.totalOrden(o)) + '. ¿Lo autorizas? Folio ' + o.folio + '.' + (url ? ' Puedes autorizarlo aquí: ' + url : ''), 'Enviar por WhatsApp') + '</div>'
      + (X.rechazando ? '<div class="grid2">' + C.sel('od.motivo', 'od-mot', 'Motivo', T.ents(T.RECHAZOS), X.motivo) + C.sel('od.medio', 'od-med', 'Cómo avisó', T.ents(T.MEDIOS).filter(([k]) => k !== 'sitio' && k !== 'portal'), X.medio) + '</div><div class="row">' + b('os-rechazar-ok', 'Registrar que no autorizó', 'danger') + '<button class="btn quiet" type="button" data-act="os-rechazar">Volver</button></div>'
        : '<div class="row">' + C.sel('od.medio', 'od-med', 'Cómo autorizó', T.ents(T.MEDIOS).filter(([k]) => k !== 'sitio' && k !== 'portal'), X.medio) + '</div><div class="row">' + b('os-autorizar', 'Autorizó', 'primary') + '<button class="btn danger" type="button" data-act="os-rechazar">No autorizó</button></div>');
    case 'autorizado': return '<p>Autorizado ' + esc(T.MEDIOS[o.autorizacion.medio] || '') + ' el ' + T.fmtD(o.autorizacion.fecha) + '. Las refacciones ya están apartadas.</p><div class="row">' + b('os-estado-reparacion', 'Iniciar reparación', 'primary') + '</div>';
    case 'espera': {
      const falt = (o.lineas || []).filter(l => l.productoId && (+l.apartado || 0) < (+l.cant || 0)).map(l => T.prodNombre(l.productoId));
      return '<div class="callout warn"><strong>Esperando refacción</strong>' + esc(falt.join(', ') || 'Refacción por llegar') + '. Cuando llegue, regístrala en Inventario y vuelve a revisar.</div><div class="row">' + b('os-reapartar', 'Revisar existencias otra vez', 'primary') + '</div>';
    }
    case 'reparacion': return '<p>Al terminar se descuentan las refacciones del inventario y se avisa al cliente.</p><div class="row">' + b('os-terminar', 'Reparación terminada', 'primary') + b('os-estado-espera', 'Falta una refacción') + '</div>';
    case 'listo': {
      const saldo = T.saldoOrden(o), E = X.ent;
      return '<div class="row">' + C.wa(cl.tel, 'Hola ' + (cl.nombre || '').split(' ')[0] + ', tu ' + T.equipoTxt(o.equipo) + ' ya está listo. Pasa por él a ' + (T.empresa().lugarFrase || T.empresa().lugar) + ' con tu folio ' + o.folio + '.' + (saldo ? ' Saldo: ' + T.fmtMoney(saldo) + '.' : ''), 'Avisar que está listo') + '</div>'
        + '<h4>Entrega</h4><div class="checklist">' + T.CHECKLIST.slice(0, 9).map(([k, t]) => C.chk('od.ent.pruebas.' + k, t + ' probado con el cliente', E.pruebas[k])).join('') + '</div>'
        + '<div class="grid2">' + C.inp('od.ent.recibio', 'od-rec', 'Recibe', E.recibio) + C.inp('od.ent.garantia', 'od-gar', 'Días de garantía', E.garantia, ' type="number" min="1" inputmode="numeric"')
        + (saldo ? C.inp('od.ent.monto', 'od-mon', 'Cobro (saldo ' + T.fmtMoney(saldo) + ')', E.monto === '' ? saldo : E.monto, ' type="number" min="0" step="any" inputmode="decimal"') + C.sel('od.ent.forma', 'od-fp', 'Forma de pago', C.formas(), E.forma) : '') + '</div>'
        + (E.garantia === '' ? '<p class="small muted">Garantía de este servicio ' + PC + ': escríbela para entregar.</p>' : '')
        + '<div class="row">' + b('os-entregar', 'Entregar y generar garantía', 'primary') + '</div>';
    }
    case 'rechazado': return '<p>No autorizó (' + esc(T.RECHAZOS[o.autorizacion.motivo] || o.autorizacion.motivo || 'sin motivo') + '). Devuelve el equipo como se recibió.</p><div class="grid2">' + C.inp('od.ent.recibio', 'od-rec', 'Recibe', X.ent.recibio)
      + (T.cfg().diagnostico.precio ? C.inp('od.ent.monto', 'od-mon', 'Cobro de diagnóstico (opcional)', X.ent.monto, ' type="number" min="0" step="any"') + C.sel('od.ent.forma', 'od-fp', 'Forma de pago', C.formas(), X.ent.forma) : '') + '</div><div class="row">' + b('os-devolver', 'Devolver equipo', 'primary') + '</div>';
    case 'entregado': {
      const en = o.entrega || {}, vig = en.garantiaHasta && en.garantiaHasta >= T.hoyISO();
      return '<p>' + (en.reparado ? 'Entregado el ' + T.fmtD(en.fecha) + ' a ' + esc(en.recibio) + '. ' : 'Devuelto sin reparar el ' + T.fmtD(en.fecha) + '. ') + (en.garantiaHasta ? (vig ? chip('ok', 'Garantía hasta ' + T.fmtD(en.garantiaHasta)) : chip('muted', 'Garantía vencida ' + T.fmtD(en.garantiaHasta))) : '') + '</p>'
        + (vig ? '<div class="stack tight">' + C.area('od.reclamo', 'od-recl', 'Reclamo de garantía: ¿qué falló?', X.reclamo) + '<div class="row">' + b('os-reclamo', 'Abrir reclamo de garantía') + '</div></div>' : '');
    }
  }
  return '';
}
function presupuesto(id, o){
  const X = U.od, edit = EDITABLE.includes(o.estado), vc = C.puede.costos(), m = o.equipo.modeloId;
  const tarifas = m ? T.ents(S.tarifas).filter(([, t]) => t.modeloId === m && !t.oculta) : [];
  const refs = T.ents(S.productos).filter(([, p]) => p.tipo === 'refaccion' && !p.oculto);
  const u = T.utilidad(o.lineas), min = T.cfg().margenMinimo;
  const filas = (o.lineas || []).map((l, i) => {
    const cst = l.productoId ? T.costo(l.productoId) : null;
    return '<tr><td>' + esc(l.desc) + (l.productoId ? '<div class="small muted">Refacción: ' + esc(T.prodNombre(l.productoId)) + (o.estado === 'espera' || o.estado === 'autorizado' || o.estado === 'reparacion' ? ' · apartada ' + (+l.apartado || 0) + ' de ' + l.cant : '') + '</div>' : '') + '</td>'
      + '<td class="num">' + (edit ? '<input class="mini" type="number" min="1" step="1" aria-label="Cantidad" data-orden="' + esc(id) + '" data-linea="' + i + '" data-campo="cant" value="' + esc(l.cant) + '">' : esc(l.cant)) + '</td>'
      + '<td class="num">' + (edit ? '<input class="mini" type="number" min="0" step="any" aria-label="Precio" data-orden="' + esc(id) + '" data-linea="' + i + '" data-campo="precio" value="' + esc(l.precio == null ? '' : l.precio) + '" placeholder="Precio">' : T.precioTxt(l.precio)) + '</td>'
      + '<td class="num">' + T.precioTxt(l.precio == null ? null : l.precio * l.cant) + '</td>'
      + (vc ? '<td class="num">' + (l.productoId ? (cst == null ? PC : T.fmtMoney(cst * l.cant)) : '—') + '</td>' : '')
      + (edit ? '<td><button class="btn sm quiet" type="button" data-act="os-linea-quitar" data-v="' + esc(id) + '" data-i="' + i + '">Quitar</button></td>' : '') + '</tr>';
  }).join('');
  const L = X.linea;
  const agregar = edit ? '<div class="panel stack tight"><div class="grid2">' + C.sel('od.linea.tipo', 'ln-t', 'Agregar', [['tarifa','Servicio del catálogo'],['refaccion','Refacción del inventario'],['mano','Mano de obra u otro']], L.tipo)
    + (L.tipo === 'tarifa' ? C.sel('od.linea.tarifaId', 'ln-tar', 'Servicio', tarifas.map(([tid, t]) => [tid, probTxt(t.problema) + (t.calidad ? ' · ' + t.calidad : '') + ' · ' + (t.precio == null ? 'por confirmar' : T.fmtMoney(t.precio))]), L.tarifaId, tarifas.length ? 'Elige…' : 'Sin precios cargados para este modelo')
      : L.tipo === 'refaccion' ? C.sel('od.linea.productoId', 'ln-ref', 'Refacción', refs.map(([pid, p]) => [pid, p.nombre + ' · ' + T.ex(pid).disp + ' en existencia']), L.productoId, 'Elige…')
      : C.inp('od.linea.desc', 'ln-d', 'Concepto', L.desc))
    + (L.tipo !== 'tarifa' ? C.inp('od.linea.precio', 'ln-p', 'Precio', L.precio, ' type="number" min="0" step="any" inputmode="decimal"') : '') + '</div><div><button class="btn sm" type="button" data-act="os-linea" data-v="' + esc(id) + '">Agregar al presupuesto</button></div></div>' : '';
  return '<section class="stack tight"><div class="row"><h3>Presupuesto</h3><span class="spacer"></span>' + (!edit && o.estado !== 'entregado' && o.estado !== 'rechazado' && C.puede.vender() ? '<button class="btn sm quiet" type="button" data-act="os-reabrir" data-v="' + esc(id) + '">Reabrir presupuesto</button>' : '') + '</div>'
    + (o.lineas.length ? '<div class="tbl"><table class="t"><thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th>' + (vc ? '<th class="num">Costo</th>' : '') + (edit ? '<th></th>' : '') + '</tr></thead><tbody>' + filas + '</tbody>'
      + '<tfoot><tr><td colspan="3">Total</td><td class="num">' + T.fmtMoney(T.totalOrden(o)) + '</td>' + (vc ? '<td></td>' : '') + (edit ? '<td></td>' : '') + '</tr>'
      + '<tr><td colspan="3">Pagado</td><td class="num">' + T.fmtMoney(T.pagadoOrden(o)) + '</td>' + (vc ? '<td></td>' : '') + (edit ? '<td></td>' : '') + '</tr><tr><td colspan="3">Saldo</td><td class="num">' + T.fmtMoney(T.saldoOrden(o)) + '</td>' + (vc ? '<td></td>' : '') + (edit ? '<td></td>' : '') + '</tr></tfoot></table></div>' : '<p class="muted small">Sin conceptos todavía.</p>')
    + (vc && o.lineas.length ? (u.pct != null ? '<p class="small">' + (u.pct < min ? chip('crit', 'Utilidad ' + T.pctTxt(u.pct) + ': debajo del mínimo de ' + min + '%') : chip('ok', 'Utilidad ' + T.pctTxt(u.pct) + ' · ' + T.fmtMoney(u.util))) + (u.faltan ? ' <span class="muted">' + u.faltan + ' concepto(s) sin precio o sin costo ' + PC + '</span>' : '') + '</p>' : '<p class="small muted">Utilidad: faltan precios.</p>') : '')
    + agregar + '</section>';
}
C.drawers.orden = id => {
  const o = S.ordenes[id]; if (!o) return '';
  const X = U.od || (C.abrirOrden(id), U.od), cl = S.clientes[o.clienteId] || {}, e = T.estadoDe(T.ESTADOS_ORDEN, o.estado), r = o.recepcion || {};
  const pasos = ['recibido','diagnostico','presupuesto','autorizado','reparacion','listo','entregado'];
  const i = pasos.indexOf(o.estado === 'espera' ? 'reparacion' : o.estado === 'rechazado' ? 'presupuesto' : o.estado);
  const stage = '<div class="stagebar">' + pasos.map((p, k) => '<span class="' + (o.estado === 'rechazado' && p === 'presupuesto' ? 'lost' : k <= i ? 'on' : '') + '">' + esc(T.estadoDe(T.ESTADOS_ORDEN, p)[1]) + '</span>').join('') + '</div>';
  const malos = T.CHECKLIST.filter(([k]) => r.checklist && r.checklist[k] && r.checklist[k] !== 'si');
  const sub = '<span class="mono">' + esc(o.folio) + '</span>' + chip(e[2], e[1]) + (o.garantiaDe && S.ordenes[o.garantiaDe] ? chip('info', 'Garantía de ' + S.ordenes[o.garantiaDe].folio) : '') + '<span>' + C.linkCliente(o.clienteId) + ' · ' + esc(T.telTxt(cl.tel)) + '</span>';
  return C.drawer(esc(T.equipoTxt(o.equipo)) + ' <span class="muted" style="font-weight:500">· ' + esc(probTxt(o.problema)) + '</span>', sub,
    stage + '<section class="panel stack tight accion">' + accionPrincipal(id, o) + '</section>'
    + '<section class="stack tight"><h3>Diagnóstico</h3>' + (EDITABLE.includes(o.estado) ? C.area('od.diag', 'od-diag', 'Lo que encontró el técnico (lo ve el cliente)', X.diag) + '<div><button class="btn sm" type="button" data-act="os-diag" data-v="' + esc(id) + '">Guardar diagnóstico</button></div>' : '<p>' + (o.diagnostico ? esc(o.diagnostico) : '<span class="muted">Sin diagnóstico escrito.</span>') + '</p>') + '</section>'
    + presupuesto(id, o)
    + '<section class="grid2"><label class="f" for="od-tec">Técnico<select id="od-tec" data-orden="' + esc(id) + '" data-campo="tecnico">' + C.opts(C.tecnicos().map(t => [t, t]), o.tecnico, 'Sin asignar') + '</select></label>'
    + '<label class="f" for="od-prom">Fecha prometida<input id="od-prom" type="date" data-orden="' + esc(id) + '" data-campo="promesa" value="' + esc(o.promesa || '') + '"></label></section>'
    + (o.estado !== 'entregado' && C.puede.vender() ? '<section class="stack tight"><h3>Pagos</h3>' + ((o.pagos || []).length ? '<ul class="log">' + o.pagos.map(p => '<li><div class="row"><span>' + esc(p.concepto || 'Pago') + ' · ' + esc(T.FORMAS_PAGO[p.forma] || p.forma) + '</span><span class="spacer"></span><b>' + T.fmtMoney(p.monto) + '</b></div><span class="h">' + T.fmtD(p.fecha) + ' ' + esc(p.hora || '') + ' · ' + esc(p.por || '') + '</span></li>').join('') + '</ul>' : '<p class="muted small">Sin pagos.</p>')
      + '<div class="row">' + C.inp('od.pago.monto', 'pg-m', 'Monto', X.pago.monto, ' type="number" min="0" step="any" inputmode="decimal"') + C.sel('od.pago.forma', 'pg-f', 'Forma', C.formas(), X.pago.forma) + C.sel('od.pago.concepto', 'pg-c', 'Concepto', [['Anticipo','Anticipo'],['Abono','Abono']], X.pago.concepto) + '<button class="btn sm" type="button" data-act="os-pago" data-v="' + esc(id) + '">Registrar pago</button></div></section>' : '')
    + '<section class="stack tight"><h3>Recepción</h3><dl class="kv"><dt>Falla</dt><dd>' + esc(o.falla) + '</dd><dt>IMEI o serie</dt><dd class="mono">' + esc(o.equipo.imei || '—') + '</dd><dt>Color</dt><dd>' + esc(o.equipo.color || '—') + '</dd>'
    + '<dt>Desbloqueo</dt><dd>' + (o.equipo.accesoBorrado ? 'Borrado al entregar' : o.equipo.acceso ? (X.verCodigo ? '<span class="mono">' + esc(o.equipo.acceso) + '</span>' : '••••') + ' <button class="btn sm quiet" type="button" data-act="os-codigo">' + (X.verCodigo ? 'Ocultar' : 'Mostrar') + '</button>' : esc(ACCESO[o.equipo.accesoTipo] || 'Sin dato')) + '</dd>'
    + '<dt>Al recibir</dt><dd>' + (malos.length ? malos.map(([k, t]) => chip(r.checklist[k] === 'no' ? 'crit' : 'muted', t + ': ' + T.CHECK_VALS[r.checklist[k]])).join(' ') : 'Todo funcionaba al recibir') + '</dd>'
    + '<dt>Accesorios</dt><dd>' + esc((r.accesorios || []).join(', ') || 'Ninguno') + '</dd>' + (r.notas ? '<dt>Observaciones</dt><dd>' + esc(r.notas) + '</dd>' : '')
    + '<dt>Recibió</dt><dd>' + esc(r.por || '—') + ' · ' + T.fmtD(o.creada) + (o.modalidad === 'domicilio' ? ' · recolección a domicilio' : '') + '</dd></dl>'
    + '<div class="row"><button class="btn sm" type="button" data-act="os-print" data-v="' + esc(id) + '" data-t="recepcion">Imprimir hoja de recepción</button>' + (o.entrega ? '<button class="btn sm" type="button" data-act="os-print" data-v="' + esc(id) + '" data-t="entrega">Imprimir comprobante de entrega</button>' : '') + '</div></section>'
    + '<section class="stack tight"><h3>Historial</h3><div class="stack tight">' + C.area('od.nota', 'od-nota', 'Agregar nota', X.nota) + '<div class="row">' + C.chk('od.publica', 'El cliente la ve al consultar su folio', X.publica) + '<button class="btn sm" type="button" data-act="os-nota" data-v="' + esc(id) + '">Guardar nota</button></div></div>'
    + '<ul class="log">' + (o.historial || []).slice().reverse().map(h => '<li><span class="h">' + T.fmtD(h.fecha) + ' ' + esc(h.hora || '') + ' · ' + esc(h.autor || '') + (h.publico ? ' · lo ve el cliente' : ' · interna') + '</span>' + esc(h.nota) + '</li>').join('') + '</ul></section>');
};

/* ---------- acciones de la orden ---------- */
const editar = (id, fn) => T.ordenEdit(id, fn);
const estado = (id, nuevo, nota, publico) => editar(id, o => { o.estado = nuevo; if (nuevo === 'diagnostico' && !o.tecnico) o.tecnico = U.rol === 'tecnico' ? T.quien() : o.tecnico; T.hist(o, nota, publico); });
Object.assign(C.acciones, {
  'os-estado-diagnostico'(d){ estado(d.v, 'diagnostico', 'En diagnóstico', true); },
  'os-estado-reparacion'(d){ estado(d.v, 'reparacion', 'En reparación', true); },
  'os-estado-espera'(d){ estado(d.v, 'espera', 'Esperando una refacción', true); },
  'os-diag'(d){ editar(d.v, o => { o.diagnostico = U.od.diag.trim(); T.hist(o, 'Diagnóstico actualizado', false); }); T.toast('Diagnóstico guardado.'); },
  'os-enviar'(d){
    const o = S.ordenes[d.v];
    if (!o.lineas.length || T.sinPrecio(o.lineas)){ T.toast('Arma el presupuesto con precio antes de enviarlo.', 'warn'); return; }
    editar(d.v, x => { x.diagnostico = U.od.diag.trim() || x.diagnostico; x.estado = 'presupuesto'; T.hist(x, 'Presupuesto enviado al cliente por ' + T.fmtMoney(T.totalOrden(x)), true); });
    T.toast('Presupuesto listo. Mándalo por WhatsApp desde el botón verde.');
  },
  'os-aut-mostrador'(d){
    const o = S.ordenes[d.v];
    if (!o.lineas.length || T.sinPrecio(o.lineas)){ T.toast('Arma el presupuesto con precio antes de autorizar.', 'warn'); return; }
    editar(d.v, x => { x.diagnostico = U.od.diag.trim() || x.diagnostico; T.autorizar(x, 'si', 'mostrador', '', T.nombreCliente(x.clienteId)); });
  },
  'os-autorizar'(d){ editar(d.v, o => { T.autorizar(o, 'si', U.od.medio, '', T.nombreCliente(o.clienteId)); }); T.toast('Autorizado. Refacciones apartadas.'); },
  'os-rechazar'(){ U.od.rechazando = !U.od.rechazando; T.scheduleRender(); },
  'os-rechazar-ok'(d){ editar(d.v, o => { T.autorizar(o, 'no', U.od.medio, U.od.motivo, T.nombreCliente(o.clienteId)); }); U.od.rechazando = false; },
  'os-reapartar'(d){ let f = 0; editar(d.v, o => { f = T.apartarOrden(o); if (!f){ o.estado = 'autorizado'; T.hist(o, 'Llegó la refacción', true); } }); T.toast(f ? 'Todavía faltan ' + f + ' pieza(s).' : 'Refacciones apartadas. Ya se puede reparar.', f ? 'warn' : ''); },
  'os-terminar'(d){
    let err = null;
    editar(d.v, o => { err = T.descontarOrden(o); if (err) return false; o.estado = 'listo'; T.hist(o, 'Reparación terminada · listo para entregar', true); });
    if (err) T.toast(err, 'crit'); else T.toast('Listo para entregar. Avísale al cliente por WhatsApp.');
  },
  'os-reabrir'(d){ if (!confirm('Reabrir el presupuesto libera las refacciones apartadas y pide una nueva autorización. ¿Continuar?')) return; editar(d.v, o => { T.liberarOrden(o, 'Presupuesto reabierto'); o.autorizacion = { estado:'pendiente' }; o.estado = 'diagnostico'; T.hist(o, 'Presupuesto reabierto: necesita nueva autorización', true); }); },
  'os-linea'(d){
    const L = U.od.linea; let l = null;
    if (L.tipo === 'tarifa'){ if (!L.tarifaId) return T.toast('Elige un servicio.', 'warn'); l = C.lineaTarifa(L.tarifaId); }
    else if (L.tipo === 'refaccion'){ if (!L.productoId) return T.toast('Elige la refacción.', 'warn'); const p = S.productos[L.productoId]; l = { tipo:'refaccion', productoId:L.productoId, desc:p.nombre, cant:1, precio:L.precio === '' ? (p.precio == null ? null : +p.precio) : +L.precio, apartado:0 }; }
    else { if (!L.desc.trim()) return T.toast('Escribe el concepto.', 'warn'); l = { tipo:'mano', desc:L.desc.trim(), cant:1, precio:L.precio === '' ? null : +L.precio }; }
    editar(d.v, o => { o.lineas.push(l); if (o.estado === 'recibido') o.estado = 'diagnostico'; });
    U.od.linea = { tipo:L.tipo, tarifaId:'', productoId:'', desc:'', precio:'' };
  },
  'os-linea-quitar'(d){ editar(d.v, o => { o.lineas.splice(+d.i, 1); }); },
  'os-pago'(d){
    const P = U.od.pago; if (!(+P.monto > 0)) return T.toast('Escribe el monto.', 'warn');
    editar(d.v, o => { o.pagos = (o.pagos || []).concat([{ fecha:T.hoyISO(), hora:T.ahoraHM(), monto:+P.monto, forma:P.forma, concepto:P.concepto, por:T.quien() }]); T.hist(o, P.concepto + ' de ' + T.fmtMoney(+P.monto), true); });
    U.od.pago = { monto:'', forma:'efectivo', concepto:'Abono' };
  },
  'os-entregar'(d){
    const o = S.ordenes[d.v], E = U.od.ent, saldo = T.saldoOrden(o);
    const monto = saldo ? (E.monto === '' ? saldo : +E.monto) : 0;
    const err = T.entregar(d.v, { recibio:E.recibio, garantiaDias:E.garantia, pago:monto ? { monto, forma:E.forma } : null, pruebas:E.pruebas });
    if (err) return T.toast(err, 'warn');
    if (U.drawer && U.drawer.citaId) C.cerrarCita(U.drawer.citaId, 'atendida', { ordenId:d.v }, 'Equipo entregado · ' + o.folio);
    T.toast('Entregado. La garantía y el equipo quedaron en la ficha del cliente.');
  },
  'os-devolver'(d){
    const E = U.od.ent;
    const err = T.entregar(d.v, { recibio:E.recibio, pago:+E.monto > 0 ? { monto:+E.monto, forma:E.forma } : null });
    if (err) return T.toast(err, 'warn');
    if (U.drawer && U.drawer.citaId) C.cerrarCita(U.drawer.citaId, 'atendida', { ordenId:d.v }, 'Equipo devuelto sin reparar');
    T.toast('Equipo devuelto sin reparar.');
  },
  'os-reclamo'(d){
    if (U.od.reclamo.trim().length < 3) return T.toast('Describe qué falló.', 'warn');
    const r = T.reclamoGarantia(d.v, U.od.reclamo.trim()); C.abrirOrden(r.id); U.drawer = { kind:'orden', id:r.id };
    T.toast('Reclamo abierto: orden ' + r.o.folio + ' sin costo para el cliente hasta revisar.');
  },
  'os-codigo'(){ U.od.verCodigo = !U.od.verCodigo; T.scheduleRender(); },
  'os-nota'(d){ if (!U.od.nota.trim()) return; editar(d.v, o => { T.hist(o, U.od.nota.trim(), U.od.publica); }); U.od.nota = ''; U.od.publica = false; },
  'os-print'(d){ C.imprimirOrden(d.v, d.t); }
});
/* Cambios en línea dentro de la orden (precio, cantidad, técnico, fecha). */
C.cambios.push(t => {
  const id = t.dataset.orden; if (!id || !S.ordenes[id]) return false;
  const campo = t.dataset.campo, v = t.value;
  if (t.dataset.linea != null) editar(id, o => { const l = o.lineas[+t.dataset.linea]; if (!l) return false; l[campo] = campo === 'cant' ? Math.max(1, Math.round(+v || 1)) : v === '' ? null : +v; });
  else editar(id, o => { o[campo] = v || null; if (campo === 'tecnico') T.hist(o, 'Técnico: ' + (v || 'sin asignar'), false); if (campo === 'promesa') T.hist(o, 'Fecha prometida: ' + T.fmtD(v), true); });
  return true;
});

/* ---------- hojas imprimibles ---------- */
C.imprimirOrden = (id, tipo) => {
  const o = S.ordenes[id], cl = S.clientes[o.clienteId] || {}, E = T.empresa(), cfg = T.cfg(), r = o.recepcion || {};
  const cab = '<h1>' + esc(E.nombre) + ' · ' + (tipo === 'entrega' ? 'Comprobante de entrega y garantía' : 'Hoja de recepción') + '</h1><p>Sucursal ' + esc(E.sucursal) + ' · ' + esc(E.lugar) + (E.telefono ? ' · Tel. ' + esc(E.telefono) : '') + (E.whatsapp ? ' · WhatsApp ' + esc(E.whatsapp) : '') + '</p>';
  const datos = '<table><tr><th>Folio</th><td>' + esc(o.folio) + '</td><th>Fecha</th><td>' + T.fmtD(tipo === 'entrega' && o.entrega ? o.entrega.fecha : o.creada) + '</td></tr><tr><th>Cliente</th><td>' + esc(cl.nombre || '') + '</td><th>Celular</th><td>' + esc(T.telTxt(cl.tel)) + '</td></tr>'
    + '<tr><th>Equipo</th><td>' + esc(T.equipoTxt(o.equipo)) + (o.equipo.color ? ' · ' + esc(o.equipo.color) : '') + '</td><th>IMEI o serie</th><td>' + esc(o.equipo.imei || '') + '</td></tr></table>';
  const conceptos = o.lineas.length ? '<table><tr><th>Concepto</th><th>Importe</th></tr>' + o.lineas.map(l => '<tr><td>' + esc(l.desc) + (l.cant > 1 ? ' × ' + l.cant : '') + '</td><td>' + (l.precio == null ? 'Por confirmar' : T.fmtMoney(l.precio * l.cant)) + '</td></tr>').join('') + '<tr><th>Total</th><th>' + T.fmtMoney(T.totalOrden(o)) + '</th></tr><tr><td>Pagado</td><td>' + T.fmtMoney(T.pagadoOrden(o)) + '</td></tr></table>' : '<p>El precio se confirma después del diagnóstico. No se repara sin autorización del cliente.</p>';
  let html = cab + datos;
  if (tipo === 'entrega'){
    const en = o.entrega || {};
    html += '<h2>Trabajo realizado</h2>' + conceptos + (o.diagnostico ? '<p>' + esc(o.diagnostico) + '</p>' : '')
      + '<h2>Garantía</h2><p>' + (en.reparado ? 'Vigente del ' + T.fmtD(en.fecha) + ' al <b>' + T.fmtD(en.garantiaHasta) + '</b> (' + en.garantiaDias + ' días).' : 'Equipo devuelto sin reparar: no aplica garantía.') + '</p>'
      + '<p>' + (cfg.terminos.garantia ? esc(cfg.terminos.garantia) : 'Condiciones de garantía por confirmar.') + '</p>'
      + '<p>Recibió: ' + esc(en.recibio || '') + '. El código de desbloqueo se borró del sistema al entregar.</p>'
      + '<div class="firma"><div>Firma del cliente</div><div>Entregó: ' + esc(en.por || '') + '</div></div>';
  } else {
    html += '<h2>Falla reportada</h2><p>' + esc(o.falla) + '</p><h2>Estado del equipo al recibir</h2><table>' + T.CHECKLIST.map(([k, t]) => '<tr><td>' + t + '</td><td>' + esc(T.CHECK_VALS[(r.checklist || {})[k]] || '—') + '</td></tr>').join('') + '</table>'
      + '<p>Accesorios recibidos: ' + esc((r.accesorios || []).join(', ') || 'ninguno') + '. ' + (r.notas ? 'Observaciones: ' + esc(r.notas) + '.' : '') + ' Código de desbloqueo: ' + (o.equipo.acceso ? 'lo dejó (no se imprime)' : 'no lo dejó') + '.</p>'
      + '<h2>Presupuesto</h2>' + conceptos + (o.promesa ? '<p>Fecha estimada: ' + T.fmtD(o.promesa) + '.</p>' : '')
      + '<h2>Términos</h2><p>' + (cfg.terminos.recepcion ? esc(cfg.terminos.recepcion) : 'Términos de recepción por confirmar.') + '</p>'
      + '<div class="firma"><div>Firma del cliente</div><div>Recibió: ' + esc(r.por || '') + '</div></div>';
  }
  html += '<p class="pie">Consulta el estado de tu equipo con tu folio ' + esc(o.folio) + ' y tu celular en “Mi cita y mi equipo”.</p>';
  T.imprimir(html);
};
})();
