/* Caja del día con corte, Ajustes del negocio y Accesos por rol. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip, PC = T.PC;

/* ---------- caja ---------- */
function vCaja(){
  const dia = U.cajaDia || T.hoyISO(), ms = T.caja(dia);
  const suma = f => ms.filter(f).reduce((a, m) => a + m.monto, 0);
  const porForma = T.ents(T.FORMAS_PAGO).map(([k, t]) => [t, suma(m => m.forma === k && m.monto > 0)]);
  const egresos = -suma(m => m.monto < 0);
  const efectivo = suma(m => m.forma === 'efectivo');
  const fondo = +U.caja.fondo || 0, esperado = fondo + efectivo, contado = U.caja.contado === '' ? null : +U.caja.contado;
  const cortes = T.vals(S.movimientos).filter(m => m.tipo === 'corte' && m.fecha === dia);
  const rep = suma(m => m.kind === 'orden'), ven = suma(m => m.kind === 'venta');
  const link = m => m.kind === 'orden' ? C.linkOrden(m.id) : esc(m.concepto);
  return '<div class="toolbar"><label class="f" for="cj-d">Día<input id="cj-d" type="date" data-bind="cajaDia" data-live value="' + esc(dia) + '"></label></div>'
    + '<div class="tiles">' + porForma.map(([t, v]) => C.tile(t, T.fmtMoney(v), 'Cobrado el ' + T.fmtD(dia))).join('') + C.tile('Salidas', T.fmtMoney(egresos), 'Compras de equipos usados') + '</div>'
    + '<div class="grid2"><section class="panel stack tight"><h3>Corte de efectivo</h3><div class="grid2">' + C.inp('caja.fondo', 'cj-f', 'Fondo inicial', U.caja.fondo, ' type="number" min="0" step="any" data-live') + C.inp('caja.contado', 'cj-c', 'Efectivo contado', U.caja.contado, ' type="number" min="0" step="any" data-live') + '</div>'
    + '<dl class="kv"><dt>Efectivo esperado</dt><dd class="num">' + T.fmtMoney(esperado) + '</dd>' + (contado != null ? '<dt>Diferencia</dt><dd class="num">' + (Math.abs(contado - esperado) < 0.5 ? chip('ok', 'Cuadra') : chip('crit', T.fmtMoney(contado - esperado))) + '</dd>' : '') + '</dl>'
    + '<div><button class="btn primary sm" type="button" data-act="caja-corte"' + (contado == null ? ' disabled' : '') + '>Registrar corte</button></div>'
    + (cortes.length ? '<ul class="log">' + cortes.map(c => '<li><span class="h">' + esc(c.hora || '') + ' · ' + esc(c.usuario || '') + '</span>Esperado ' + T.fmtMoney(c.esperado) + ' · contado ' + T.fmtMoney(c.contado) + ' · diferencia ' + T.fmtMoney(c.contado - c.esperado) + '</li>').join('') + '</ul>' : '') + '</section>'
    + '<section class="panel stack tight"><h3>Ingresos por origen</h3><dl class="kv"><dt>Reparaciones</dt><dd class="num">' + T.fmtMoney(rep) + '</dd><dt>Ventas</dt><dd class="num">' + T.fmtMoney(ven) + '</dd><dt>Neto del día</dt><dd class="num"><b>' + T.fmtMoney(rep + ven - egresos) + '</b></dd></dl></section></div>'
    + '<div class="tbl"><table class="t"><thead><tr><th>Hora</th><th>Concepto</th><th>Forma</th><th class="num">Monto</th></tr></thead><tbody>'
    + (ms.map(m => '<tr><td class="mono">' + esc(m.hora) + '</td><td>' + link(m) + (m.kind === 'orden' ? ' <span class="small muted">' + esc(m.concepto.split(' · ')[0]) + '</span>' : '') + '</td><td>' + esc(T.FORMAS_PAGO[m.forma] || m.forma) + '</td><td class="num">' + (m.monto < 0 ? '<span class="err">' + T.fmtMoney(m.monto) + '</span>' : T.fmtMoney(m.monto)) + '</td></tr>').join('') || '<tr><td colspan="4" class="muted">Sin movimientos este día.</td></tr>')
    + '</tbody></table></div>';
}
C.vistas.caja = vCaja;
C.estado.cajaDia = ''; C.estado.caja = { fondo:'', contado:'' };
C.acciones['caja-corte'] = () => {
  const dia = U.cajaDia || T.hoyISO(), ef = T.caja(dia).filter(m => m.forma === 'efectivo').reduce((a, m) => a + m.monto, 0);
  T.put('movimientos', T.uid('mv'), { tipo:'corte', ts:Date.now(), fecha:dia, hora:T.ahoraHM(), usuario:T.quien(), fondo:+U.caja.fondo || 0, esperado:(+U.caja.fondo || 0) + ef, contado:+U.caja.contado });
  U.caja = { fondo:'', contado:'' }; T.toast('Corte registrado.');
};

/* ---------- ajustes del negocio (solo dirección) ---------- */
const DIAS = [[1,'Lun'],[2,'Mar'],[3,'Mié'],[4,'Jue'],[5,'Vie'],[6,'Sáb'],[0,'Dom']];
const num = v => v === '' || v == null ? null : +v;
function formAjustes(){
  const c = T.cfg(), g = {};
  T.PROBLEMAS.forEach(p => { g[p.id] = c.garantias[p.id] == null ? '' : c.garantias[p.id]; });
  const dias = {}; DIAS.forEach(([d]) => { dias['d' + d] = (c.citas.dias || []).includes(d); });
  const v = x => x == null ? '' : x;
  return { empresa:Object.assign({}, c.empresa, { direccion:v(c.empresa.direccion), whatsapp:v(c.empresa.whatsapp), telefono:v(c.empresa.telefono), correo:v(c.empresa.correo), horario:v(c.empresa.horario) }),
    dias, citas:{ inicio:c.citas.inicio, fin:c.citas.fin, intervalo:c.citas.intervalo, cupo:c.citas.cupo, diasVisibles:c.citas.diasVisibles, confirmado:!!c.citas.confirmado },
    margenMinimo:c.margenMinimo, margenConfirmado:!!c.margenConfirmado, garantias:g, equipoNuevo:v(c.garantiaEquipo.nuevo), equipoSeminuevo:v(c.garantiaEquipo.seminuevo),
    diagnostico:v(c.diagnostico.precio), domicilio:{ activo:!!c.domicilio.activo, costo:v(c.domicilio.costo), zona:v(c.domicilio.zona) },
    tecnicos:(c.personal.tecnicos || []).join(', '), mostrador:(c.personal.mostrador || []).join(', '), terminos:{ recepcion:v(c.terminos.recepcion), garantia:v(c.terminos.garantia) } };
}
function vAjustes(){
  const A = U.aj || (U.aj = formAjustes()), c = T.cfg();
  const pc = (val, ok) => ok ? '' : ' ' + (val === '' || val == null ? PC : '<span class="tag est">valor inicial</span>');
  return '<form class="stack" data-form="ajustes">'
    + '<section class="panel stack tight"><h3>El negocio</h3><p class="small muted">Lo que quede vacío se muestra “por confirmar” en el sitio.</p><div class="grid2">' + ['nombre:Nombre','sucursal:Sucursal','lugar:Lugar de atención','lugarFrase:Cómo se dice “en …” (la cafetería de…)','direccion:Dirección','whatsapp:WhatsApp','telefono:Teléfono','correo:Correo','horario:Horario (texto)'].map(x => { const [k, t] = x.split(':'); return C.inp('aj.empresa.' + k, 'aj-' + k, t, A.empresa[k]); }).join('') + '</div></section>'
    + '<section class="panel stack tight"><h3>Citas y turnos ' + pc(null, c.citas.confirmado) + '</h3><div class="row">' + DIAS.map(([d, t]) => C.chk('aj.dias.d' + d, t, A.dias['d' + d])).join('') + '</div><div class="grid2">'
    + C.inp('aj.citas.inicio', 'aj-ci', 'Primera cita', A.citas.inicio, ' type="time"') + C.inp('aj.citas.fin', 'aj-cf', 'Cierre', A.citas.fin, ' type="time"') + C.inp('aj.citas.intervalo', 'aj-int', 'Minutos por cita', A.citas.intervalo, ' type="number" min="10" step="5"') + C.inp('aj.citas.cupo', 'aj-cupo', 'Clientes por horario', A.citas.cupo, ' type="number" min="1"') + C.inp('aj.citas.diasVisibles', 'aj-dv', 'Días que se pueden agendar', A.citas.diasVisibles, ' type="number" min="1" max="30"') + '</div>'
    + C.chk('aj.citas.confirmado', 'El horario de citas está confirmado (quita la marca “por confirmar” del sitio)', A.citas.confirmado) + '</section>'
    + '<section class="panel stack tight"><h3>Utilidad mínima ' + pc(1, c.margenConfirmado) + '</h3><div class="grid2">' + C.inp('aj.margenMinimo', 'aj-mm', 'Margen mínimo %', A.margenMinimo, ' type="number" min="0" max="100"') + '</div>' + C.chk('aj.margenConfirmado', 'Margen confirmado por dirección', A.margenConfirmado) + '<p class="small muted">Todo presupuesto o venta debajo de este margen se marca en rojo (regla 4).</p></section>'
    + '<section class="panel stack tight"><h3>Garantías (días)</h3><div class="grid3">' + T.PROBLEMAS.filter(p => p.id !== 'diagnostico').map(p => C.inp('aj.garantias.' + p.id, 'aj-g-' + p.id, p.t, A.garantias[p.id], ' type="number" min="0"')).join('')
    + C.inp('aj.equipoNuevo', 'aj-gn', 'Celular nuevo', A.equipoNuevo, ' type="number" min="0"') + C.inp('aj.equipoSeminuevo', 'aj-gs', 'Celular seminuevo', A.equipoSeminuevo, ' type="number" min="0"') + '</div>' + C.area('aj.terminos.garantia', 'aj-tg', 'Qué cubre la garantía (aparece en el sitio y en el comprobante)', A.terminos.garantia) + '</section>'
    + '<section class="panel stack tight"><h3>Recepción y diagnóstico</h3><div class="grid2">' + C.inp('aj.diagnostico', 'aj-diag', 'Precio del diagnóstico (vacío = por confirmar)', A.diagnostico, ' type="number" min="0" step="any"') + '</div>' + C.area('aj.terminos.recepcion', 'aj-tr', 'Términos de recepción (se imprimen en la hoja)', A.terminos.recepcion) + '</section>'
    + '<section class="panel stack tight"><h3>A domicilio</h3>' + C.chk('aj.domicilio.activo', 'Ofrecer recolección y entrega a domicilio', A.domicilio.activo) + '<div class="grid2">' + C.inp('aj.domicilio.costo', 'aj-dc', 'Costo', A.domicilio.costo, ' type="number" min="0" step="any"') + C.inp('aj.domicilio.zona', 'aj-dz', 'Zona que cubren', A.domicilio.zona) + '</div></section>'
    + '<section class="panel stack tight"><h3>Personal</h3><div class="grid2">' + C.inp('aj.tecnicos', 'aj-tec', 'Técnicos (separados por coma)', A.tecnicos) + C.inp('aj.mostrador', 'aj-mos', 'Mostrador (separados por coma)', A.mostrador) + '</div></section>'
    + '<div class="row"><button class="btn primary lg" type="submit">Guardar ajustes</button><button class="btn quiet" type="button" data-act="aj-reset">Descartar cambios</button></div></form>';
}
C.vistas.ajustes = vAjustes;
C.acciones['aj-reset'] = () => { U.aj = null; T.scheduleRender(); };
C.formularios.ajustes = () => {
  const A = U.aj, txt = v => (v || '').trim() || null, garantias = {};
  T.PROBLEMAS.forEach(p => { garantias[p.id] = num(A.garantias[p.id]); });
  const lista = s => s.split(',').map(x => x.trim()).filter(Boolean);
  const general = Object.assign({}, S.config.general || {}, {
    empresa:{ nombre:txt(A.empresa.nombre) || 'Tecno-Spot', sucursal:txt(A.empresa.sucursal), lugar:txt(A.empresa.lugar), lugarFrase:txt(A.empresa.lugarFrase), direccion:txt(A.empresa.direccion), whatsapp:txt(A.empresa.whatsapp), telefono:txt(A.empresa.telefono), correo:txt(A.empresa.correo), horario:txt(A.empresa.horario) },
    citas:{ dias:DIAS.map(([d]) => d).filter(d => A.dias['d' + d]), inicio:A.citas.inicio, fin:A.citas.fin, intervalo:Math.max(10, +A.citas.intervalo || 30), cupo:Math.max(1, +A.citas.cupo || 1), diasVisibles:Math.max(1, +A.citas.diasVisibles || 8), confirmado:!!A.citas.confirmado },
    margenMinimo:+A.margenMinimo || 0, margenConfirmado:!!A.margenConfirmado, garantias, garantiaEquipo:{ nuevo:num(A.equipoNuevo), seminuevo:num(A.equipoSeminuevo) },
    diagnostico:{ precio:num(A.diagnostico) }, domicilio:{ activo:!!A.domicilio.activo, costo:num(A.domicilio.costo), zona:txt(A.domicilio.zona) },
    personal:{ tecnicos:lista(A.tecnicos), mostrador:lista(A.mostrador) }, terminos:{ recepcion:txt(A.terminos.recepcion), garantia:txt(A.terminos.garantia) } });
  if (T.aMin(general.citas.fin) <= T.aMin(general.citas.inicio)) return T.toast('El cierre debe ser después de la primera cita.', 'warn');
  T.put('config', 'general', general); U.aj = null; T.toast('Ajustes guardados. El sitio ya los muestra.');
};

/* ---------- accesos (Supabase, solo dirección) ---------- */
function vAccesos(){
  const ps = T.vals(S.perfiles).sort((a, b) => (a.rol === 'pendiente' ? 0 : 1) - (b.rol === 'pendiente' ? 0 : 1) || (a.correo || '').localeCompare(b.correo || ''));
  const cls = T.ents(S.clientes).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es')).map(([id, c]) => [id, c.nombre + ' · ' + T.telTxt(c.tel)]);
  return '<p class="muted">Cada cuenta nace “pendiente”. Aquí le asignas su rol; a los clientes, su ficha. La base hace cumplir lo que cada rol puede ver.</p><div class="tbl"><table class="t"><thead><tr><th>Cuenta</th><th>Nombre</th><th>Rol</th><th>Ficha de cliente</th><th></th></tr></thead><tbody>'
    + (ps.map(p => { const A = (U.acc[p.user_id] = U.acc[p.user_id] || { rol:p.rol, nombre:p.nombre || '', cliente_id:p.cliente_id || '' });
      return '<tr><td>' + esc(p.correo) + (p.rol === 'pendiente' ? ' ' + chip('warn', 'Pendiente') : '') + '</td><td>' + C.inp('acc.' + p.user_id + '.nombre', 'ac-n-' + p.user_id, 'Nombre', A.nombre) + '</td><td>' + C.sel('acc.' + p.user_id + '.rol', 'ac-r-' + p.user_id, 'Rol', T.ents(T.ROLES_CUENTA), A.rol) + '</td>'
        + '<td>' + (A.rol === 'cliente' ? C.sel('acc.' + p.user_id + '.cliente_id', 'ac-c-' + p.user_id, 'Ficha', cls, A.cliente_id, 'Elige la ficha…') : '<span class="muted">—</span>') + '</td><td><button class="btn sm" type="button" data-act="acc-guardar" data-v="' + esc(p.user_id) + '">Guardar</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">Sin cuentas registradas.</td></tr>')
    + '</tbody></table></div>';
}
C.vistas.accesos = vAccesos;
C.estado.acc = {};
C.acciones['acc-guardar'] = d => {
  const A = U.acc[d.v];
  if (A.rol === 'cliente' && !A.cliente_id) return T.toast('Elige la ficha del cliente.', 'warn');
  T.guardarPerfil(d.v, { rol:A.rol, nombre:A.nombre.trim(), cliente_id:A.rol === 'cliente' ? A.cliente_id : null });
};
})();
