/* Portal de clientes de Tecno-Spot: sus reparaciones (con autorización del
   presupuesto), sus citas, sus equipos con garantía y sus compras. Lee una
   vista resumida de su cuenta: nunca notas internas, costos ni códigos. */
(function(){
'use strict';
const T = window.TS, U = T.U, S = T.S, esc = T.esc, chip = T.chip, PC = T.PC;
const local = () => T.Store.mode !== 'supabase';

function barra(){
  const salir = local() && U.pCliente ? '<button class="btn sm onbar" type="button" data-act="p-salir">Salir</button>' : '';
  return T.barra('Mi cuenta', T.LINKS.sitio ? '<a href="' + esc(T.LINKS.sitio) + '">Ir al sitio</a>' : '', salir);
}
function vEntrar(){
  const cls = T.ents(S.clientes).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'));
  return '<div class="login panel">' + T.logo('grande') + '<h1>Mi cuenta</h1><p class="muted">Tus reparaciones, tus citas, tus equipos con su garantía y tus compras.</p>'
    + '<form class="stack" data-form="p-entrar"><label class="f" for="p-cli">Cuenta<select id="p-cli" data-bind="pElegido"><option value="">Elige un cliente de la demostración…</option>' + cls.map(([id, c]) => '<option value="' + esc(id) + '"' + (U.pElegido === id ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('') + '</select></label>'
    + '<button class="btn primary" type="submit"' + (U.pElegido ? '' : ' disabled') + '>Entrar</button></form>'
    + '<p class="note">Demostración: aquí se elige la cuenta. Con la base real cada cliente entra con su correo y solo ve lo suyo.</p></div>';
}
function tarjetaOrden(r){
  const e = T.estadoDe(T.ESTADOS_ORDEN, r.estado), q = U.pq;
  const saldo = r.total != null ? Math.max(0, r.total - (r.pagado || 0)) : null;
  const decidiendo = q.folio === r.folio;
  return '<article class="card' + (r.estado === 'presupuesto' ? ' attn' : '') + '"><div class="row"><h3>' + esc(r.equipo) + '</h3><span class="spacer"></span>' + chip(e[2], e[1]) + '</div>'
    + '<p class="small muted">' + esc(T.PROB[r.problema] ? T.PROB[r.problema].t : '') + ' · folio <span class="mono">' + esc(r.folio) + '</span> · recibido el ' + T.fmtD(r.creada) + '</p>'
    + (T.ordenAbierta(r) ? T.lineaTiempo(r) : '')
    + (r.diagnostico ? '<p><b>Diagnóstico:</b> ' + esc(r.diagnostico) + '</p>' : '')
    + (r.lineas.length ? '<ul class="log">' + r.lineas.map(l => '<li><div class="row"><span>' + esc(l.desc) + (l.cant > 1 ? ' × ' + l.cant : '') + '</span><span class="spacer"></span><b>' + T.precioTxt(l.precio == null ? null : l.precio * l.cant) + '</b></div></li>').join('') + '<li><div class="row"><b>Total</b><span class="spacer"></span><b>' + T.fmtMoney(r.total) + '</b></div>' + (r.pagado ? '<span class="small muted">Pagado ' + T.fmtMoney(r.pagado) + ' · saldo ' + T.fmtMoney(saldo) + '</span>' : '') + '</li></ul>' : '')
    + (r.estado === 'presupuesto' ? (decidiendo ? '<div class="stack tight"><label class="f" for="pq-m">¿Por qué no lo autorizas?<select id="pq-m" data-bind="pq.motivo">' + T.ents(T.RECHAZOS).map(([k, v]) => '<option value="' + k + '"' + (q.motivo === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label><div class="row"><button class="btn danger" type="button" data-act="p-autorizar" data-f="' + esc(r.folio) + '" data-v="no">No autorizo</button><button class="btn quiet" type="button" data-act="p-rechazo" data-f="">Volver</button></div></div>'
      : '<div class="callout spot"><strong>Necesitamos tu autorización</strong>No reparamos nada sin tu visto bueno.</div><div class="row"><button class="btn primary" type="button" data-act="p-autorizar" data-f="' + esc(r.folio) + '" data-v="si">Autorizo la reparación</button><button class="btn" type="button" data-act="p-rechazo" data-f="' + esc(r.folio) + '">No autorizo</button></div>') : '')
    + (r.garantiaHasta ? '<p>' + (r.garantiaHasta >= T.hoyISO() ? chip('ok', 'Garantía hasta ' + T.fmtD(r.garantiaHasta)) : chip('muted', 'Garantía vencida el ' + T.fmtD(r.garantiaHasta))) + '</p>' : '')
    + '</article>';
}
function tarjetaCita(r){
  const e = T.estadoDe(T.ESTADOS_CITA, r.estado);
  return '<article class="card"><div class="row"><h3>Turno ' + esc(r.turno) + ' · ' + esc(T.fmtDia(r.fecha)) + ' · ' + esc(r.hora) + '</h3><span class="spacer"></span>' + chip(e[2], e[1]) + '</div>'
    + '<p class="small muted">' + esc(T.MOTIVOS_CITA[r.motivo] || '') + ' · ' + esc(r.modalidad === 'domicilio' ? 'a domicilio' : r.lugar) + ' · folio <span class="mono">' + esc(r.folio) + '</span></p>'
    + (r.estado === 'agendada' ? '<div class="row"><a class="btn sm" href="' + T.icsCita(r) + '" download="cita-' + esc(r.folio) + '.ics">Guardar en mi calendario</a><button class="btn sm quiet" type="button" data-act="p-cancelar" data-f="' + esc(r.folio) + '">Cancelar cita</button></div>' : '') + '</article>';
}
function formCita(){
  const F = U.pf, dias = T.diasAgenda(), cta = U.pCuenta;
  if (!F.fecha || !dias.includes(F.fecha)) F.fecha = dias[0] || '';
  const hs = F.fecha ? T.horarios(F.fecha).filter(h => !h.pasada && h.libres > 0) : [];
  const disp = (cta.cliente.dispositivos || []).map(d => d.marca + ' ' + d.modelo);
  return '<form class="card stack tight" data-form="p-cita"><h3>Agendar una cita</h3><div class="grid2">'
    + '<label class="f" for="pf-m">Motivo<select id="pf-m" data-bind="pf.motivo">' + T.ents(T.MOTIVOS_CITA).map(([k, v]) => '<option value="' + k + '"' + (F.motivo === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>'
    + (F.motivo === 'reparacion' ? '<label class="f" for="pf-p">¿Qué le pasa?<select id="pf-p" data-bind="pf.problema"><option value="">Elige…</option>' + T.PROBLEMAS.map(p => '<option value="' + p.id + '"' + (F.problema === p.id ? ' selected' : '') + '>' + esc(p.t) + '</option>').join('') + '</select></label>' : '')
    + '<label class="f" for="pf-e">Equipo<input id="pf-e" list="pf-disp" data-bind="pf.equipo" value="' + esc(F.equipo) + '" placeholder="Marca y modelo"><datalist id="pf-disp">' + disp.map(d => '<option value="' + esc(d) + '">').join('') + '</datalist></label>'
    + '<label class="f" for="pf-f">Día<select id="pf-f" data-bind="pf.fecha">' + dias.map(d => '<option value="' + d + '"' + (F.fecha === d ? ' selected' : '') + '>' + esc(T.fmtDia(d)) + '</option>').join('') + '</select></label>'
    + '<label class="f" for="pf-h">Hora<select id="pf-h" data-bind="pf.hora"><option value="">Elige…</option>' + hs.map(h => '<option value="' + h.hora + '"' + (F.hora === h.hora ? ' selected' : '') + '>' + h.hora + ' · ' + h.libres + ' libres</option>').join('') + '</select></label></div>'
    + '<label class="f" for="pf-n">Nota (opcional)<textarea id="pf-n" data-bind="pf.nota">' + esc(F.nota) + '</textarea></label>'
    + (T.cfg().citas.confirmado ? '' : '<p class="small muted">Horario de citas ' + PC + '.</p>')
    + '<div class="row"><button class="btn primary" type="submit"' + (F.enviando ? ' disabled' : '') + '>Agendar</button><button class="btn quiet" type="button" data-act="p-nueva">Cancelar</button></div></form>';
}
function vista(){
  if (local() && !U.pCliente) return barra() + '<main>' + vEntrar() + '</main>';
  const cta = U.pCuenta;
  if (!cta || U.pCuentaDe !== U.pCliente){ cargarCuenta(); return barra() + '<main><div class="loading">Cargando tu cuenta…</div></main>'; }
  const t = (v, txt, n) => '<button type="button" data-act="ptab" data-v="' + v + '"' + (U.pTab === v ? ' aria-current="page"' : '') + '>' + txt + (n ? ' <span class="badge">' + n + '</span>' : '') + '</button>';
  const abiertas = cta.ordenes.filter(T.ordenAbierta), porAut = cta.ordenes.filter(o => o.estado === 'presupuesto').length;
  const prox = cta.citas.filter(c => c.estado === 'agendada' && c.fecha >= T.hoyISO());
  let body = '';
  if (U.pTab === 'reparaciones') body = cta.ordenes.length ? abiertas.map(tarjetaOrden).join('') + (cta.ordenes.length > abiertas.length ? '<details><summary>Reparaciones entregadas (' + (cta.ordenes.length - abiertas.length) + ')</summary><div class="stack tight" style="margin-top:10px">' + cta.ordenes.filter(o => !T.ordenAbierta(o)).map(tarjetaOrden).join('') + '</div></details>' : '') : '<div class="card muted">Todavía no tienes reparaciones con nosotros.</div>';
  if (U.pTab === 'citas') body = (U.pf ? formCita() : '<div><button class="btn primary" type="button" data-act="p-nueva">Agendar una cita</button></div>') + (cta.citas.length ? cta.citas.map(tarjetaCita).join('') : '<div class="card muted">Sin citas.</div>');
  if (U.pTab === 'equipos'){
    const ds = cta.cliente.dispositivos || [];
    body = ds.length ? ds.map(d => '<article class="card"><div class="row"><h3>' + esc(d.marca + ' ' + d.modelo) + '</h3><span class="spacer"></span>' + (d.garantiaHasta ? (d.garantiaHasta >= T.hoyISO() ? chip('ok', 'Garantía hasta ' + T.fmtD(d.garantiaHasta)) : chip('muted', 'Garantía vencida')) : '') + '</div><dl class="kv"><dt>IMEI</dt><dd class="mono">' + esc(d.imei || '—') + '</dd>' + (d.color ? '<dt>Color</dt><dd>' + esc(d.color) + '</dd>' : '') + '<dt>Origen</dt><dd>' + esc(d.origen || '') + ' <span class="mono small">' + esc(d.ref || '') + '</span></dd></dl></article>').join('')
      : '<div class="card muted">Tus equipos aparecen aquí cuando te entregamos una reparación o te vendemos un celular.</div>';
  }
  if (U.pTab === 'compras') body = cta.ventas.length ? cta.ventas.map(v => '<article class="card"><div class="row"><h3 class="mono" style="font-size:15px">' + esc(v.folio) + '</h3><span class="spacer"></span><b>' + T.fmtMoney(v.total) + '</b></div><p class="small muted">' + T.fmtD(v.fecha) + (v.credito ? ' · toma a cuenta ' + T.fmtMoney(v.credito) : '') + '</p><ul class="log">' + v.lineas.map(l => '<li><div class="row"><span>' + esc(l.desc) + (l.cant > 1 ? ' × ' + l.cant : '') + '</span><span class="spacer"></span>' + (l.garantiaHasta ? chip(l.garantiaHasta >= T.hoyISO() ? 'ok' : 'muted', 'Garantía ' + T.fmtD(l.garantiaHasta)) : '') + '</div></li>').join('') + '</ul></article>').join('') : '<div class="card muted">Sin compras.</div>';
  return barra() + '<main><div class="portal"><div class="panel row"><div><div class="eyebrow">Hola</div><h2>' + esc(cta.cliente.nombre) + '</h2><p class="small muted">' + esc(T.telTxt(cta.cliente.tel)) + (prox.length ? ' · tu próxima cita: ' + esc(T.fmtDia(prox[prox.length - 1].fecha)) + ' a las ' + esc(prox[prox.length - 1].hora) : '') + '</p></div><span class="spacer"></span><button class="btn sm quiet" type="button" data-act="p-actualizar">Actualizar</button></div>'
    + '<nav class="bigtabs" aria-label="Secciones">' + t('reparaciones', 'Mis reparaciones', porAut) + t('citas', 'Mis citas', prox.length) + t('equipos', 'Mis equipos') + t('compras', 'Mis compras') + '</nav>'
    + body + '</div></main>';
}
let cargando = false;
async function cargarCuenta(){
  if (cargando) return; cargando = true;
  try { U.pCuenta = await T.miCuenta(U.pCliente); U.pCuentaDe = U.pCliente; if (!U.pCuenta) T.toast('No encontramos tu cuenta.', 'crit'); }
  catch (e) { T.toast('No se pudo cargar tu cuenta: ' + e.message, 'crit'); }
  cargando = false; T.scheduleRender();
}
const refrescar = () => { U.pCuentaDe = null; cargarCuenta(); };

T.registrar('portal', {
  barra, vista, acceso:'cliente',
  estado:{ pCliente:'', pElegido:'', pTab:'reparaciones', pCuenta:null, pCuentaDe:null, pq:{ folio:'', motivo:'precio' }, pf:null },
  acciones:{
    ptab(d){ U.pTab = d.v; T.scheduleRender(); },
    'p-salir'(){ U.pCliente = ''; U.pElegido = ''; U.pCuenta = null; T.scheduleRender(); },
    'p-actualizar'(){ refrescar(); },
    'p-rechazo'(d){ U.pq = { folio:d.f || '', motivo:'precio' }; T.scheduleRender(); },
    async 'p-autorizar'(d){
      try { await T.autorizarFuera(d.f, U.pCuenta.cliente.tel, d.v, d.v === 'no' ? U.pq.motivo : '', 'portal'); U.pq = { folio:'', motivo:'precio' }; T.toast(d.v === 'si' ? 'Gracias. Ya tenemos tu autorización.' : 'Registramos que no autorizas; te devolvemos tu equipo.'); }
      catch (e) { T.toast(e.message, 'crit'); }
      refrescar();
    },
    async 'p-cancelar'(d){
      if (!confirm('¿Cancelar esta cita?')) return;
      try { await T.cancelarFuera(d.f, U.pCuenta.cliente.tel, 'cliente'); T.toast('Cita cancelada.'); await T.cargarOcupacion(); }
      catch (e) { T.toast(e.message, 'crit'); }
      refrescar();
    },
    'p-nueva'(){ U.pf = U.pf ? null : { motivo:'reparacion', problema:'', equipo:'', fecha:'', hora:'', nota:'', enviando:false }; T.scheduleRender(); }
  },
  formularios:{
    'p-entrar'(){ if (!S.clientes[U.pElegido]) return; U.pCliente = U.pElegido; U.pTab = 'reparaciones'; U.pCuenta = null; T.scheduleRender(); },
    async 'p-cita'(){
      const F = U.pf, c = U.pCuenta.cliente;
      if (!F.hora){ T.toast('Elige la hora.', 'warn'); return; }
      F.enviando = true; T.scheduleRender();
      try {
        const r = await T.agendar({ fecha:F.fecha, hora:F.hora, motivo:F.motivo, modalidad:'cafeteria', nota:F.nota.trim(), origen:'portal', clienteId:local() ? U.pCliente : null,
          cotizacion:F.problema || F.equipo ? { tipo:F.motivo === 'venta' ? 'venta' : 'reparacion', problema:F.problema || null, equipo:F.equipo.trim() } : null,
          contacto:{ nombre:c.nombre, tel:c.tel, correo:c.correo } });
        U.pf = null; T.toast('Cita agendada: turno ' + r.turno + ', ' + T.fmtDia(r.fecha).toLowerCase() + ' a las ' + r.hora + '.');
        await T.cargarOcupacion();
      } catch (e) { F.enviando = false; T.toast(e.message, 'crit'); }
      refrescar();
    }
  }
});
})();
