/* Punto de venta: accesorios y celulares, con toma a cuenta y ticket. */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip, PC = T.PC;
const POS0 = { busca:'', cat:'', lineas:[], tel:'', nombre:'', clienteId:'', tomaId:'', pagos:[{ forma:'efectivo', monto:'' }], citaId:'' };
const tomasLibres = () => T.ents(S.compras).filter(([, c]) => c.tipo === 'toma' && c.estado === 'aceptada' && !c.aplicadaEn);
const equipoTxt = q => q.marca + ' ' + q.modelo + (q.capacidad ? ' ' + q.capacidad : '') + (q.color ? ' · ' + q.color : '') + ' · ' + (q.condicion === 'nuevo' ? 'nuevo' : 'seminuevo');

function vVentas(){
  const P = U.pos, q = P.busca.trim().toLowerCase(), vc = C.puede.costos();
  const prods = T.ents(S.productos).filter(([, p]) => p.tipo === 'accesorio' && !p.oculto && (!P.cat || p.categoria === P.cat) && (!q || (p.nombre + ' ' + (p.compat || '') + ' ' + (p.marca || '')).toLowerCase().includes(q)));
  const eqs = P.cat && P.cat !== 'celulares' ? [] : T.ents(S.equipos).filter(([, e]) => (e.estado === 'disponible' || e.estado === 'apartado') && (!q || (equipoTxt(e) + ' ' + e.imei).toLowerCase().includes(q)));
  const enCarrito = id => P.lineas.some(l => l.productoId === id || l.equipoId === id);
  const resultados = eqs.map(([id, e]) => '<li><div class="row"><div><b>' + esc(equipoTxt(e)) + '</b><div class="small muted">IMEI ' + esc(e.imei) + (e.bateria ? ' · batería ' + e.bateria + '%' : '') + (e.estado === 'apartado' ? ' · apartado' : '') + '</div></div><span class="spacer"></span><b>' + T.precioTxt(e.precio) + '</b><button class="btn sm" type="button" data-act="pos-add-e" data-v="' + esc(id) + '"' + (enCarrito(id) ? ' disabled' : '') + '>Agregar</button></div></li>').join('')
    + prods.map(([id, p]) => { const e = T.ex(id); return '<li><div class="row"><div><b>' + esc(p.nombre) + '</b><div class="small muted">' + esc(T.CATEGORIAS[p.categoria] || '') + (p.compat ? ' · ' + esc(p.compat) : '') + ' · ' + e.disp + ' en existencia</div></div><span class="spacer"></span><b>' + T.precioTxt(p.precio) + '</b><button class="btn sm" type="button" data-act="pos-add-p" data-v="' + esc(id) + '"' + (e.disp ? '' : ' disabled') + '>Agregar</button></div></li>'; }).join('');
  const total = T.montoLineas(P.lineas), toma = P.tomaId && S.compras[P.tomaId] ? +S.compras[P.tomaId].precio || 0 : 0, cobrar = Math.max(0, total - toma);
  const pagado = P.pagos.reduce((a, p) => a + (+p.monto || 0), 0), u = T.utilidad(P.lineas);
  const hayEquipo = P.lineas.some(l => l.equipoId);
  const clId = P.clienteId && S.clientes[P.clienteId] ? P.clienteId : (T.clientePorTel(P.tel) || [])[0], cl = clId && S.clientes[clId];
  const g = T.cfg().garantiaEquipo;
  const carrito = P.lineas.length ? '<ul class="log">' + P.lineas.map((l, i) => '<li><span>' + esc(l.desc) + '</span><div class="row"><span class="spacer"></span>'
      + (l.productoId ? '<input class="mini" type="number" min="1" step="1" aria-label="Cantidad" data-pos="' + i + '" data-campo="cant" value="' + esc(l.cant) + '">' : '')
      + '<input class="mini precio" type="number" min="0" step="any" aria-label="Precio" data-pos="' + i + '" data-campo="precio" value="' + esc(l.precio == null ? '' : l.precio) + '" placeholder="Precio">'
      + '<button class="btn sm quiet" type="button" data-act="pos-quitar" data-v="' + i + '">Quitar</button></div>'
      + (l.equipoId ? '<label class="row small">Garantía <input class="mini" type="number" min="0" step="1" data-pos="' + i + '" data-campo="garantiaDias" value="' + esc(l.garantiaDias == null ? '' : l.garantiaDias) + '" aria-label="Días de garantía"> días' + (g[S.equipos[l.equipoId].condicion === 'nuevo' ? 'nuevo' : 'seminuevo'] == null && l.garantiaDias == null ? ' ' + PC : '') + '</label>' : '') + '</li>').join('') + '</ul>'
    : '<p class="muted small">Agrega productos desde la lista.</p>';
  const hoy = T.hoyISO(), ventasHoy = T.ents(S.ventas).filter(([, v]) => v.fecha >= T.sumarDias(hoy, -6)).sort((a, b) => (b[1].fecha + b[1].hora).localeCompare(a[1].fecha + a[1].hora));
  return '<div class="pos"><section class="panel stack tight"><h3>Productos</h3><label class="f" for="pos-q">Buscar<input id="pos-q" type="search" data-bind="pos.busca" data-live value="' + esc(P.busca) + '" placeholder="Nombre, modelo o IMEI"></label>'
    + '<div class="filtros">' + [['', 'Todo'], ['celulares', 'Celulares']].concat(T.ents(T.CATEGORIAS).filter(([k]) => k !== 'refacciones')).map(([k, v]) => '<button type="button" class="filtro" data-act="pos-cat" data-v="' + k + '" aria-pressed="' + (P.cat === k) + '">' + esc(v) + '</button>').join('') + '</div>'
    + '<ul class="log resultados">' + (resultados || '<li class="muted">Nada que coincida.</li>') + '</ul></section>'
    + '<section class="panel stack tight carrito"><div class="row"><h3>Venta</h3><span class="spacer"></span>' + (P.lineas.length ? '<button class="btn sm quiet" type="button" data-act="pos-limpiar">Vaciar</button>' : '') + '</div>' + carrito
    + '<div class="grid2">' + C.inp('pos.tel', 'pos-tel', 'Celular del cliente' + (hayEquipo ? '' : ' (opcional)'), P.tel, ' type="tel" inputmode="numeric" data-live') + (cl ? '<p class="small">Cliente: ' + C.linkCliente(clId) + '</p>' : T.digitos(P.tel).length === 10 ? C.inp('pos.nombre', 'pos-nom', 'Nombre (cliente nuevo)', P.nombre) : '') + '</div>'
    + (tomasLibres().length ? C.sel('pos.tomaId', 'pos-toma', 'Toma a cuenta', tomasLibres().map(([id, c]) => [id, c.folio + ' · ' + c.vendedor.nombre + ' · ' + c.equipo.marca + ' ' + c.equipo.modelo + ' · ' + T.fmtMoney(c.precio)]), P.tomaId, 'Sin toma a cuenta') : '')
    + '<dl class="kv totales"><dt>Total</dt><dd class="num">' + T.fmtMoney(total) + '</dd>' + (toma ? '<dt>Toma a cuenta</dt><dd class="num">−' + T.fmtMoney(toma) + '</dd>' : '') + '<dt><b>A cobrar</b></dt><dd class="num"><b>' + T.fmtMoney(cobrar) + '</b></dd></dl>'
    + P.pagos.map((p, i) => '<div class="row">' + C.sel('pos.pagos.' + i + '.forma', 'pp-f' + i, 'Forma de pago', C.formas(), p.forma) + C.inp('pos.pagos.' + i + '.monto', 'pp-m' + i, 'Recibido', p.monto, ' type="number" min="0" step="any" inputmode="decimal" placeholder="' + cobrar + '" data-live') + '</div>').join('')
    + '<div class="row"><button class="btn sm quiet" type="button" data-act="pos-pago2">' + (P.pagos.length > 1 ? 'Un solo pago' : 'Pagar con dos formas') + '</button><span class="spacer"></span>' + (pagado > cobrar ? '<b>Cambio: ' + T.fmtMoney(pagado - cobrar) + '</b>' : '') + '</div>'
    + (C.puede.costos() && P.lineas.length ? '<p class="small">' + (u.pct != null ? (u.pct < T.cfg().margenMinimo ? chip('crit', 'Utilidad ' + T.pctTxt(u.pct) + ': debajo del mínimo') : chip('ok', 'Utilidad ' + T.pctTxt(u.pct))) : 'Utilidad: faltan precios') + (u.faltan ? ' <span class="muted">' + u.faltan + ' sin costo ' + PC + '</span>' : '') + '</p>' : '')
    + '<button class="btn primary lg" type="button" data-act="pos-cobrar"' + (P.lineas.length ? '' : ' disabled') + '>Cobrar ' + T.fmtMoney(cobrar) + '</button></section></div>'
    + '<section class="stack tight"><h2>Ventas de los últimos 7 días</h2><div class="tbl"><table class="t"><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th class="num">Total</th>' + (vc ? '<th class="num">Utilidad</th>' : '') + '<th></th></tr></thead><tbody>'
    + (ventasHoy.map(([id, v]) => { const uu = T.utilidad(v.lineas); return '<tr><td class="mono">' + esc(v.folio) + '</td><td>' + T.fmtD(v.fecha) + ' ' + esc(v.hora || '') + '</td><td>' + (v.clienteId ? C.linkCliente(v.clienteId) : '<span class="muted">Mostrador</span>') + '</td><td>' + esc(v.lineas.map(l => l.desc).join(', ')) + '</td><td class="num">' + T.fmtMoney(v.total) + (v.credito ? '<div class="small muted">toma ' + T.fmtMoney(v.credito) + '</div>' : '') + '</td>'
      + (vc ? '<td class="num">' + (uu.pct != null ? T.pctTxt(uu.pct) : '—') + '</td>' : '') + '<td>' + (T.puedeImprimir ? '<button class="btn sm quiet" type="button" data-act="pos-ticket" data-v="' + esc(id) + '">Ticket</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="muted">Sin ventas.</td></tr>')
    + '</tbody></table></div></section>';
}
C.vistas.ventas = vVentas;
C.estado.pos = T.clone(POS0);

/* Lo que el cliente apartó en el sitio llega al punto de venta desde su turno. */
C.posDesdeCita = citaId => {
  const c = S.citas[citaId], q = (c && c.cotizacion) || {};
  U.pos = Object.assign(T.clone(POS0), { citaId, tel:c.contacto.tel, nombre:c.contacto.nombre, clienteId:c.clienteId || ((T.clientePorTel(c.contacto.tel) || [])[0] || '') });
  if (q.productoId && S.productos[q.productoId]) C.acciones['pos-add-p']({ v:q.productoId });
  if (q.equipoId && S.equipos[q.equipoId]) C.acciones['pos-add-e']({ v:q.equipoId });
  U.tab = 'ventas'; U.drawer = null; T.scheduleRender();
};
Object.assign(C.acciones, {
  'pos-cat'(d){ U.pos.cat = d.v; T.scheduleRender(); },
  'pos-add-p'(d){ const p = S.productos[d.v], l = U.pos.lineas.find(x => x.productoId === d.v); if (l) l.cant++; else U.pos.lineas.push({ productoId:d.v, desc:p.nombre + (p.compat ? ' · ' + p.compat : ''), cant:1, precio:p.precio == null ? null : +p.precio }); T.scheduleRender(); },
  'pos-add-e'(d){ const e = S.equipos[d.v], g = T.cfg().garantiaEquipo[e.condicion === 'nuevo' ? 'nuevo' : 'seminuevo']; U.pos.lineas.push({ equipoId:d.v, desc:equipoTxt(e), cant:1, precio:e.precio == null ? null : +e.precio, garantiaDias:g }); T.scheduleRender(); },
  'pos-quitar'(d){ U.pos.lineas.splice(+d.v, 1); T.scheduleRender(); },
  'pos-limpiar'(){ U.pos = T.clone(POS0); T.scheduleRender(); },
  'pos-pago2'(){ const P = U.pos; P.pagos = P.pagos.length > 1 ? [P.pagos[0]] : P.pagos.concat([{ forma:'tarjeta', monto:'' }]); T.scheduleRender(); },
  'pos-ticket'(d){ C.imprimirVenta(d.v); },
  'pos-cobrar'(){
    const P = U.pos;
    let cid = P.clienteId && S.clientes[P.clienteId] ? P.clienteId : '';
    const hayEquipo = P.lineas.some(l => l.equipoId);
    if (!cid && T.digitos(P.tel).length === 10){ const ya = T.clientePorTel(P.tel); cid = ya ? ya[0] : ''; if (!cid){ if (P.nombre.trim().length < 2) return T.toast('Escribe el nombre del cliente nuevo.', 'warn'); cid = T.crearCliente({ nombre:P.nombre, tel:P.tel }); } }
    if (hayEquipo && !cid) return T.toast('Para vender un celular captura el celular y el nombre del cliente: el equipo queda en su ficha con su IMEI.', 'warn');
    if (P.lineas.some(l => l.equipoId && !(+l.garantiaDias > 0))) return T.toast('Escribe los días de garantía del celular.', 'warn');
    const total = T.montoLineas(P.lineas), toma = P.tomaId && S.compras[P.tomaId] ? +S.compras[P.tomaId].precio || 0 : 0, cobrar = Math.max(0, total - toma);
    const pagos = P.pagos.map((p, i) => ({ forma:p.forma, monto:p.monto === '' && i === 0 && P.pagos.length === 1 ? cobrar : +p.monto || 0 }));
    const r = T.registrarVenta({ clienteId:cid || null, lineas:P.lineas.map(l => Object.assign({}, l, { garantiaDias:l.garantiaDias == null || l.garantiaDias === '' ? null : +l.garantiaDias })), pagos, tomaId:P.tomaId || null, citaId:P.citaId || null });
    if (r.err) return T.toast(r.err, 'warn');
    if (P.citaId) C.cerrarCita(P.citaId, 'atendida', { ventaId:r.id, clienteId:cid || null }, 'Venta ' + r.v.folio);
    U.pos = T.clone(POS0);
    T.toast('Venta ' + r.v.folio + (r.v.cambio ? ' · cambio ' + T.fmtMoney(r.v.cambio) : '') + '.');
    if (T.puedeImprimir) T.confirmar('Venta ' + r.v.folio + ' registrada. ¿Imprimir el ticket?', () => C.imprimirVenta(r.id), { ok:'Imprimir ticket', no:'No' });
  }
});
C.cambios.push(t => {
  if (t.dataset.pos == null) return false;
  const l = U.pos.lineas[+t.dataset.pos]; if (!l) return true;
  const c = t.dataset.campo, v = t.value;
  l[c] = c === 'cant' ? Math.max(1, Math.min(T.ex(l.productoId).disp || 1, Math.round(+v || 1))) : v === '' ? null : +v;
  T.scheduleRender(); return true;
});

C.imprimirVenta = id => {
  const v = S.ventas[id], E = T.empresa();
  T.imprimir('<h1>' + esc(E.nombre) + '</h1><p>Sucursal ' + esc(E.sucursal) + ' · ' + esc(E.lugar) + '</p><p>Ticket ' + esc(v.folio) + ' · ' + T.fmtD(v.fecha) + ' ' + esc(v.hora || '') + (v.clienteId ? ' · ' + esc(T.nombreCliente(v.clienteId)) : '') + '</p>'
    + '<table><tr><th>Producto</th><th>Cant.</th><th>Importe</th></tr>' + v.lineas.map(l => '<tr><td>' + esc(l.desc) + (l.imei ? '<br>IMEI ' + esc(l.imei) : '') + (l.garantiaHasta ? '<br>Garantía hasta ' + T.fmtD(l.garantiaHasta) : '') + '</td><td>' + l.cant + '</td><td>' + T.fmtMoney(l.precio * l.cant) + '</td></tr>').join('')
    + (v.credito ? '<tr><td colspan="2">Toma a cuenta</td><td>−' + T.fmtMoney(v.credito) + '</td></tr>' : '') + '<tr><th colspan="2">Total</th><th>' + T.fmtMoney(v.total - (v.credito || 0)) + '</th></tr>'
    + v.pagos.map(p => '<tr><td colspan="2">' + esc(T.FORMAS_PAGO[p.forma] || p.forma) + '</td><td>' + T.fmtMoney(p.monto) + '</td></tr>').join('') + (v.cambio ? '<tr><td colspan="2">Cambio</td><td>' + T.fmtMoney(v.cambio) + '</td></tr>' : '') + '</table>'
    + '<p class="pie">Atendió: ' + esc(v.vendedor || '') + '. ' + (T.cfg().terminos.garantia ? esc(T.cfg().terminos.garantia) : 'Condiciones de garantía por confirmar.') + '</p>');
};
})();
