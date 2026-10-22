/* Citas: agenda por día, citas nuevas desde mostrador, reprogramar y cancelar con motivo. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip;

function vCitas(){
  const dia = U.citasDia || T.hoyISO();
  const del = T.ents(S.citas).filter(([, c]) => c.fecha === dia);
  const cupo = +T.cfg().citas.cupo || 1;
  const horas = T.horasDelDia(dia);
  const enHora = h => del.filter(([, c]) => c.hora === h && c.estado !== 'cancelada');
  const fuera = del.filter(([, c]) => c.estado === 'cancelada' || !horas.includes(c.hora));
  const prox = [];
  for (let i = 0, d = T.hoyISO(); i < 8; i++, d = T.sumarDias(d, 1)){ const n = T.vals(S.citas).filter(c => c.fecha === d && c.estado !== 'cancelada').length; prox.push([d, n]); }
  const fila = ([id, c]) => { const e = T.estadoDe(T.ESTADOS_CITA, c.estado); return '<button type="button" class="cita-mini ' + c.estado + '" data-act="ct-open" data-v="' + esc(id) + '"><b>' + esc(c.turno) + '</b><span>' + esc(T.nombreCita(c)) + '</span><span class="small muted">' + esc(T.MOTIVOS_CITA[c.motivo] || '') + '</span>' + chip(e[2], e[1]) + '</button>'; };
  return '<div class="toolbar"><button class="btn sm" type="button" data-act="ct-dia" data-v="-1" aria-label="Día anterior">←</button><button class="btn sm" type="button" data-act="ct-dia" data-v="0">Hoy</button><button class="btn sm" type="button" data-act="ct-dia" data-v="1" aria-label="Día siguiente">→</button>'
    + '<label class="f" for="ct-fecha">Día<input id="ct-fecha" type="date" data-bind="citasDia" data-live value="' + esc(dia) + '"></label><span class="spacer"></span><button class="btn primary" type="button" data-act="ct-nueva">Nueva cita</button></div>'
    + '<div class="semana">' + prox.map(([d, n]) => '<button type="button" class="dia-mini" data-act="ct-ir" data-v="' + d + '"' + (d === dia ? ' aria-current="date"' : '') + '><b>' + esc(T.fmtDiaCorto(d)) + '</b><span>' + (T.horasDelDia(d).length ? n + ' citas' : 'Cerrado') + '</span></button>').join('') + '</div>'
    + '<h2>' + esc(T.fmtDia(dia)) + '</h2>'
    + (horas.length ? '<div class="agenda">' + horas.map(h => { const cs = enHora(h); return '<div class="slot"><div class="slot-h">' + h + '<span>' + cs.length + '/' + cupo + '</span></div><div class="slot-c">' + cs.map(fila).join('') + (cs.length < cupo ? '<span class="libre">Libre</span>' : '') + '</div></div>'; }).join('') + '</div>'
      : '<div class="card muted">Este día no hay horario de citas.</div>')
    + (fuera.length ? '<section class="stack tight"><h3>Sin cita, fuera de horario o canceladas</h3><div class="slot-c">' + fuera.map(fila).join('') + '</div></section>' : '')
    + (T.cfg().citas.confirmado ? '' : '<p class="small muted">Horario de citas ' + T.PC + ': se ajusta en Ajustes.</p>');
}
C.vistas.citas = vCitas;

/* Panel de una cita. */
C.drawers.cita = id => {
  const c = S.citas[id]; if (!c) return '';
  const e = T.estadoDe(T.ESTADOS_CITA, c.estado), x = U.ctx || {};
  const q = c.cotizacion || {};
  const abierta = ['agendada','llego','atendiendo'].includes(c.estado);
  let rep = '';
  if (x.reprogramar){
    const dias = T.diasAgenda(); const f = x.fecha || dias[0];
    const hs = f ? T.horarios(f).filter(h => !h.pasada && (h.libres > 0 || (f === c.fecha && h.hora === c.hora))) : [];
    rep = '<div class="panel stack tight"><h3>Reprogramar</h3><div class="grid2">' + C.sel('ctx.fecha', 'rp-f', 'Día', dias.map(d => [d, T.fmtDia(d)]), f) + C.sel('ctx.hora', 'rp-h', 'Hora', hs.map(h => [h.hora, h.hora + ' · ' + h.libres + ' libres']), x.hora, 'Elige…') + '</div>'
      + '<div class="row"><button class="btn primary sm" type="button" data-act="ct-reprog-ok" data-v="' + esc(id) + '">Guardar nueva fecha</button><button class="btn quiet sm" type="button" data-act="ct-reprog">Cancelar</button></div></div>';
  }
  const can = x.cancelar ? '<div class="panel stack tight"><h3>Cancelar cita</h3>' + C.sel('ctx.motivo', 'cn-m', 'Motivo', T.ents(T.CIERRES_CITA), x.motivo) + '<div class="row"><button class="btn danger sm" type="button" data-act="ct-cancelar-ok" data-v="' + esc(id) + '">Cancelar la cita</button><button class="btn quiet sm" type="button" data-act="ct-cancelar">Volver</button></div></div>' : '';
  const sub = '<span class="mono">' + esc(c.folio) + '</span>' + chip(e[2], e[1]) + '<span>Turno ' + esc(c.turno) + ' · ' + esc(T.fmtDia(c.fecha)) + ' · ' + esc(c.hora) + '</span>';
  return C.drawer(esc(T.nombreCita(c)), sub,
    '<div class="row acciones">' + C.accionesCita(id, c) + '</div>'
    + '<dl class="kv"><dt>Motivo</dt><dd>' + esc(T.MOTIVOS_CITA[c.motivo] || c.motivo) + '</dd>'
    + '<dt>Celular</dt><dd>' + esc(T.telTxt(c.contacto.tel)) + ' ' + C.wa(c.contacto.tel, C.recordatorio(c), 'Recordar por WhatsApp') + '</dd>'
    + (c.contacto.correo ? '<dt>Correo</dt><dd>' + esc(c.contacto.correo) + '</dd>' : '')
    + '<dt>Comunidad Tecmilenio</dt><dd>' + (c.contacto.tecmi ? 'Sí' : 'No') + '</dd>'
    + '<dt>Dónde</dt><dd>' + esc(c.modalidad === 'domicilio' ? 'A domicilio · ' + (c.direccion || 'sin dirección') : c.lugar) + '</dd>'
    + (c.cotizacion ? '<dt>Cotización</dt><dd>' + C.cotTxt(c) + '</dd>' : '')
    + '<dt>Cliente</dt><dd>' + (c.clienteId ? C.linkCliente(c.clienteId) : '<span class="muted">Sin ficha todavía</span> <button class="btn sm quiet" type="button" data-act="ct-ligar" data-v="' + esc(id) + '">Crear o ligar ficha</button>') + '</dd>'
    + '<dt>Origen</dt><dd>' + esc({ sitio:'Sitio web', portal:'Portal del cliente', mostrador:'Mostrador' }[c.origen] || c.origen) + '</dd></dl>'
    + (c.nota ? '<p class="note">“' + esc(c.nota) + '”</p>' : '')
    + (abierta ? '<div class="row">' + (x.reprogramar || x.cancelar ? '' : '<button class="btn sm" type="button" data-act="ct-reprog">Reprogramar</button><button class="btn sm danger" type="button" data-act="ct-cancelar">Cancelar cita</button>') + '</div>' + rep + can : '')
    + '<section class="stack tight"><h3>Historial</h3><ul class="log">' + (c.historial || []).slice().reverse().map(h => '<li><span class="h">' + esc(T.fmtD(h.fecha)) + ' ' + esc(h.hora || '') + ' · ' + esc(h.autor || '') + '</span>' + esc(h.nota) + '</li>').join('') + '</ul></section>');
};

/* Cita nueva desde mostrador o por teléfono. */
C.drawers['nueva-cita'] = () => {
  const N = U.nc, dias = T.diasAgenda();
  if (!N.fecha || !dias.includes(N.fecha)) N.fecha = dias[0] || '';
  const hs = N.fecha ? T.horarios(N.fecha).filter(h => !h.pasada && h.libres > 0) : [];
  return C.drawer('Nueva cita', 'Para clientes que llaman o escriben por WhatsApp',
    '<form class="stack" data-form="nueva-cita"><div class="grid2">' + C.inp('nc.nombre', 'nc-nom', 'Nombre', N.nombre) + C.inp('nc.tel', 'nc-tel', 'Celular', N.tel, ' type="tel" inputmode="numeric"')
    + C.sel('nc.motivo', 'nc-mot', 'Motivo', T.ents(T.MOTIVOS_CITA), N.motivo) + C.sel('nc.problema', 'nc-prob', 'Problema (si es reparación)', T.PROBLEMAS.map(p => [p.id, p.t]), N.problema, '—')
    + C.sel('nc.fecha', 'nc-f', 'Día', dias.map(d => [d, T.fmtDia(d)]), N.fecha) + C.sel('nc.hora', 'nc-h', 'Hora', hs.map(h => [h.hora, h.hora + ' · ' + h.libres + ' libres']), N.hora, 'Elige…') + '</div>'
    + C.inp('nc.equipo', 'nc-eq', 'Equipo (marca y modelo)', N.equipo, ' placeholder="Por ejemplo: iPhone 12"')
    + C.area('nc.nota', 'nc-nota', 'Nota', N.nota) + C.chk('nc.tecmi', 'Es de la comunidad Tecmilenio', N.tecmi)
    + '<div class="row"><button class="btn primary" type="submit">Agendar</button></div></form>');
};
C.estado.nc = { nombre:'', tel:'', motivo:'reparacion', problema:'', fecha:'', hora:'', equipo:'', nota:'', tecmi:false };
C.estado.citasDia = '';
C.estado.ctx = {};

Object.assign(C.acciones, {
  'ct-dia'(d){ const base = U.citasDia || T.hoyISO(); U.citasDia = +d.v === 0 ? T.hoyISO() : T.sumarDias(base, +d.v); T.scheduleRender(); },
  'ct-ir'(d){ U.citasDia = d.v; T.scheduleRender(); },
  'ct-nueva'(){ U.nc = T.clone(C.estado.nc); U.drawer = { kind:'nueva-cita' }; T.scheduleRender(); },
  'ct-ligar'(d){ const cid = C.clienteDeCita(d.v); T.toast('Ficha ligada: ' + T.nombreCliente(cid) + '.'); },
  'ct-reprog'(){ U.ctx.reprogramar = !U.ctx.reprogramar; U.ctx.cancelar = false; U.ctx.fecha = ''; U.ctx.hora = ''; T.scheduleRender(); },
  'ct-cancelar'(){ U.ctx.cancelar = !U.ctx.cancelar; U.ctx.reprogramar = false; U.ctx.motivo = 'cliente'; T.scheduleRender(); },
  'ct-reprog-ok'(d){
    const x = U.ctx, f = x.fecha || T.diasAgenda()[0];
    if (!x.hora){ T.toast('Elige la nueva hora.', 'warn'); return; }
    T.citaEdit(d.v, c => { const antes = T.fmtD(c.fecha) + ' ' + c.hora; if (c.fecha !== f) c.turno = T.vals(S.citas).filter(z => z.fecha === f).reduce((a, z) => Math.max(a, +z.turno || 0), 0) + 1; c.fecha = f; c.hora = x.hora; c.estado = 'agendada'; T.historialCita(c, 'Reprogramada de ' + antes + ' a ' + T.fmtD(f) + ' ' + x.hora); });
    U.ctx.reprogramar = false; T.toast('Cita reprogramada. Avísale al cliente por WhatsApp.');
  },
  'ct-cancelar-ok'(d){ C.cerrarCita(d.v, 'cancelada', { cierre:{ motivo:U.ctx.motivo, fecha:T.hoyISO() } }, 'Cancelada · ' + (T.CIERRES_CITA[U.ctx.motivo] || '')); U.ctx.cancelar = false; }
});
C.formularios['nueva-cita'] = () => {
  const N = U.nc;
  if (N.nombre.trim().length < 2 || T.digitos(N.tel).length !== 10){ T.toast('Escribe nombre y celular de 10 dígitos.', 'warn'); return; }
  if (!N.fecha || !N.hora){ T.toast('Elige día y hora.', 'warn'); return; }
  const h = T.horarios(N.fecha).find(z => z.hora === N.hora); if (!h || !h.libres){ T.toast('Ese horario ya se llenó.', 'warn'); return; }
  const c = T.crearCita({ fecha:N.fecha, hora:N.hora, motivo:N.motivo, origen:'mostrador', nota:N.nota.trim(), contacto:{ nombre:N.nombre, tel:N.tel, tecmi:N.tecmi },
    cotizacion:N.problema || N.equipo ? { tipo:N.motivo === 'venta' ? 'venta' : 'reparacion', problema:N.problema || null, equipo:N.equipo.trim() } : null });
  U.drawer = null; U.citasDia = N.fecha;
  T.toast('Cita ' + c.folio + ' · turno ' + c.turno + ' el ' + T.fmtDia(N.fecha).toLowerCase() + ' a las ' + N.hora + '.');
};
})();
