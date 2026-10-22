/* Inventario (refacciones, accesorios y celulares por IMEI) y Precios y catálogo
   (precio de cada reparación por modelo, productos y lista de modelos). */
(function(){
'use strict';
const T = window.TS, C = window.TSC, U = T.U, S = T.S, esc = T.esc, chip = T.chip, PC = T.PC;
const tabs = (bind, val, pares) => '<div class="filtros">' + pares.map(([k, t]) => '<button type="button" class="filtro" data-act="subtab" data-b="' + bind + '" data-v="' + k + '" aria-pressed="' + (val === k) + '">' + esc(t) + '</button>').join('') + '</div>';
C.acciones.subtab = d => { U[d.b] = d.v; T.scheduleRender(); };

/* ---------- inventario ---------- */
function vInventario(){
  const t = U.invTab || 'productos';
  return tabs('invTab', t, [['productos','Refacciones y accesorios'],['celulares','Celulares'],['movimientos','Movimientos']]) + ({ productos:invProductos, celulares:invCelulares, movimientos:invMovs }[t])();
}
function invProductos(){
  const I = U.inv, vc = C.puede.costos(), q = (I.busca || '').trim().toLowerCase();
  const ps = T.ents(S.productos).filter(([, p]) => !p.oculto && (!I.cat || p.categoria === I.cat) && (!q || (p.nombre + ' ' + (p.compat || '')).toLowerCase().includes(q)))
    .map(([id, p]) => [id, p, T.ex(id)]).sort((a, b) => ((a[2].min != null && a[2].disp < a[2].min) ? 0 : 1) - ((b[2].min != null && b[2].disp < b[2].min) ? 0 : 1) || a[1].nombre.localeCompare(b[1].nombre, 'es'));
  let capital = 0;
  const filas = ps.map(([id, p, e]) => {
    const cst = T.costo(id); if (cst != null) capital += cst * (e.disp + e.apart);
    const bajo = e.min != null && e.disp < e.min;
    const A = I.acc && I.acc.pid === id ? I.acc : null;
    return '<tr><td>' + esc(p.nombre) + (p.demo ? ' ' + T.DEMO_TAG : '') + '<div class="small muted">' + esc(T.CATEGORIAS[p.categoria] || '') + (p.compat ? ' · ' + esc(p.compat) : '') + '</div></td>'
      + '<td class="num">' + e.disp + '</td><td class="num">' + e.apart + '</td><td class="num"><input class="mini" type="number" min="0" step="1" aria-label="Mínimo" data-ex="' + esc(id) + '" value="' + esc(e.min == null ? '' : e.min) + '"></td>'
      + '<td>' + (bajo ? chip('crit', 'Bajo mínimo') : e.disp ? chip('ok', 'Con existencia') : chip('muted', 'Sin existencia')) + '</td>'
      + (vc ? '<td class="num">' + (cst == null ? PC : T.fmtMoney(cst)) + '</td>' : '')
      + '<td>' + (A ? '<div class="stack tight"><div class="row">' + C.inp('inv.acc.cant', 'ia-c', A.tipo === 'entrada' ? 'Piezas que llegaron' : 'Ajuste (+ o −)', A.cant, ' type="number" step="1"') + (A.tipo === 'entrada' && vc ? C.inp('inv.acc.costo', 'ia-k', 'Costo por pieza', A.costo, ' type="number" min="0" step="any"') : '') + (A.tipo === 'ajuste' ? C.inp('inv.acc.motivo', 'ia-m', 'Motivo', A.motivo) : '') + '</div><div class="row"><button class="btn sm primary" type="button" data-act="inv-ok">Guardar</button><button class="btn sm quiet" type="button" data-act="inv-acc">Cancelar</button></div></div>'
        : '<div class="row"><button class="btn sm" type="button" data-act="inv-acc" data-v="' + esc(id) + '" data-t="entrada">Entrada</button><button class="btn sm quiet" type="button" data-act="inv-acc" data-v="' + esc(id) + '" data-t="ajuste">Ajuste</button></div>') + '</td></tr>';
  }).join('');
  return '<div class="toolbar"><label class="f" for="inv-q" style="flex:1 1 240px;max-width:360px">Buscar<input id="inv-q" type="search" data-bind="inv.busca" data-live value="' + esc(I.busca || '') + '"></label>' + C.sel('inv.cat', 'inv-cat', 'Categoría', T.ents(T.CATEGORIAS), I.cat, 'Todas') + '</div>'
    + (vc ? '<p class="small">Capital en refacciones y accesorios: <b>' + T.fmtMoney(capital) + '</b> (solo lo que tiene costo capturado)</p>' : '')
    + '<div class="tbl"><table class="t"><thead><tr><th>Producto</th><th class="num">Disponible</th><th class="num">Apartado</th><th class="num">Mínimo</th><th>Estado</th>' + (vc ? '<th class="num">Costo</th>' : '') + '<th>Movimiento</th></tr></thead><tbody>' + (filas || '<tr><td colspan="7" class="muted">Sin productos. Dalos de alta en Precios y catálogo › Productos.</td></tr>') + '</tbody></table></div>'
    + '<p class="small muted">Apartado = refacciones reservadas para órdenes autorizadas. Se descuentan al terminar la reparación.</p>';
}
function invCelulares(){
  const vc = C.puede.costos(), N = U.eqN;
  const eqs = T.ents(S.equipos).filter(([, e]) => U.eqVer === 'todos' || e.estado !== 'vendido').sort((a, b) => (b[1].alta || '').localeCompare(a[1].alta || ''));
  const filas = eqs.map(([id, e]) => '<tr><td>' + esc(e.marca + ' ' + e.modelo) + (e.demo ? ' ' + T.DEMO_TAG : '') + '<div class="small muted">' + esc([e.capacidad, e.color, e.condicion === 'nuevo' ? 'nuevo' : 'seminuevo', e.bateria ? 'batería ' + e.bateria + '%' : ''].filter(Boolean).join(' · ')) + '</div></td><td class="mono">' + esc(e.imei) + '</td><td>' + esc(e.origen || '') + '</td>'
    + '<td class="num">' + (e.estado === 'vendido' ? T.precioTxt(e.precio) : '<input class="mini precio" type="number" min="0" step="any" aria-label="Precio de venta" data-eq="' + esc(id) + '" value="' + esc(e.precio == null ? '' : e.precio) + '" placeholder="Precio">') + '</td>'
    + (vc ? '<td class="num">' + T.precioTxt(T.costo(id)) + '</td>' : '')
    + '<td>' + chip({ disponible:'ok', reacondicionar:'warn', apartado:'info', vendido:'muted' }[e.estado] || 'muted', T.ESTADOS_EQUIPO[e.estado] || e.estado) + '</td>'
    + '<td>' + (e.estado === 'reacondicionar' ? '<button class="btn sm" type="button" data-act="eq-listo" data-v="' + esc(id) + '">Listo para venta</button>' : e.estado === 'disponible' ? '<button class="btn sm quiet" type="button" data-act="eq-estado" data-v="' + esc(id) + '" data-e="apartado">Apartar</button>' : e.estado === 'apartado' ? '<button class="btn sm quiet" type="button" data-act="eq-estado" data-v="' + esc(id) + '" data-e="disponible">Liberar</button>' : '') + '</td></tr>').join('');
  return '<div class="toolbar">' + C.sel('eqVer', 'eq-ver', 'Mostrar', [['activos','En existencia'],['todos','Todos, con vendidos']], U.eqVer) + '<span class="spacer"></span><button class="btn" type="button" data-act="eq-nuevo">' + (N.open ? 'Cancelar alta' : 'Alta de celular de proveedor') + '</button></div>'
    + (N.open ? '<form class="panel stack tight" data-form="eq-nuevo"><h3>Alta de celular</h3>' + C.modeloCampos('eqN', N) + '<div class="grid2">' + C.inp('eqN.capacidad', 'en-cap', 'Capacidad', N.capacidad) + C.inp('eqN.color', 'en-col', 'Color', N.color) + C.sel('eqN.condicion', 'en-cond', 'Condición', [['nuevo','Nuevo'],['seminuevo','Seminuevo']], N.condicion)
      + C.inp('eqN.imei', 'en-imei', 'IMEI', N.imei, ' inputmode="numeric"') + C.inp('eqN.precio', 'en-p', 'Precio de venta', N.precio, ' type="number" min="0" step="any"') + (vc ? C.inp('eqN.costo', 'en-k', 'Costo', N.costo, ' type="number" min="0" step="any"') : '') + '</div><div><button class="btn primary sm" type="submit">Dar de alta</button></div></form>' : '')
    + '<div class="tbl"><table class="t"><thead><tr><th>Equipo</th><th>IMEI</th><th>Origen</th><th class="num">Precio</th>' + (vc ? '<th class="num">Costo</th>' : '') + '<th>Estado</th><th></th></tr></thead><tbody>' + (filas || '<tr><td colspan="7" class="muted">Sin celulares en inventario.</td></tr>') + '</tbody></table></div>'
    + '<p class="small muted">Los celulares comprados o tomados a cuenta llegan “por reacondicionar”. Ponles precio y márcalos listos para que aparezcan en el sitio.</p>';
}
function invMovs(){
  const ms = T.vals(S.movimientos).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 150);
  return '<div class="tbl"><table class="t"><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th class="num">Cantidad</th><th>Referencia</th><th>Motivo</th><th>Quién</th></tr></thead><tbody>'
    + (ms.map(m => '<tr><td>' + T.fmtD(m.fecha) + '</td><td>' + esc(m.tipo) + '</td><td>' + esc(T.prodNombre(m.productoId)) + '</td><td class="num">' + esc(m.cant) + '</td><td class="mono">' + esc(m.ref || '') + '</td><td>' + esc(m.motivo || '') + '</td><td>' + esc(m.usuario || '') + '</td></tr>').join('') || '<tr><td colspan="7" class="muted">Sin movimientos todavía.</td></tr>') + '</tbody></table></div>';
}
C.vistas.inventario = vInventario;
C.estado.invTab = 'productos'; C.estado.inv = { busca:'', cat:'', acc:null }; C.estado.eqVer = 'activos';
const EQN0 = { open:false, marca:'', modeloId:'', marcaTexto:'', modelo:'', capacidad:'', color:'', condicion:'nuevo', imei:'', precio:'', costo:'' };
C.estado.eqN = T.clone(EQN0);
Object.assign(C.acciones, {
  'inv-acc'(d){ U.inv.acc = d.v ? { pid:d.v, tipo:d.t, cant:'', costo:'', motivo:'' } : null; T.scheduleRender(); },
  'inv-ok'(){
    const A = U.inv.acc, n = Math.round(+A.cant || 0), e = T.ex(A.pid);
    if (!n) return T.toast('Escribe la cantidad.', 'warn');
    if (A.tipo === 'entrada'){
      if (n < 0) return T.toast('Una entrada es positiva; usa Ajuste para restar.', 'warn');
      T.setEx(A.pid, { disp:e.disp + n }); if (A.costo !== '' && C.puede.costos()) T.put('costos', A.pid, { costo:+A.costo });
      T.logMov({ tipo:'entrada', productoId:A.pid, cant:n, motivo:'Entrada de mercancía' });
    } else {
      if (!A.motivo.trim()) return T.toast('Escribe el motivo del ajuste.', 'warn');
      T.setEx(A.pid, { disp:Math.max(0, e.disp + n) }); T.logMov({ tipo:'ajuste', productoId:A.pid, cant:n, motivo:A.motivo.trim() });
    }
    U.inv.acc = null; T.toast('Inventario actualizado.');
  },
  'eq-nuevo'(){ U.eqN = Object.assign(T.clone(EQN0), { open:!U.eqN.open }); T.scheduleRender(); },
  'eq-listo'(d){ const e = T.clone(S.equipos[d.v]); if (e.precio == null) return T.toast('Ponle precio de venta antes de publicarlo.', 'warn'); e.estado = 'disponible'; T.put('equipos', d.v, e); T.toast('Ya aparece en el sitio.'); },
  'eq-estado'(d){ const e = T.clone(S.equipos[d.v]); e.estado = d.e; T.put('equipos', d.v, e); }
});
C.formularios['eq-nuevo'] = () => {
  const N = U.eqN, m = C.modeloDe(N);
  if (!m.marca || !(m.modeloId || m.modelo)) return T.toast('Elige marca y modelo.', 'warn');
  if (N.imei.replace(/\s/g, '').length < 6) return T.toast('Captura el IMEI.', 'warn');
  const id = T.uid('eq');
  T.put('equipos', id, Object.assign(m, { capacidad:N.capacidad.trim(), color:N.color.trim(), condicion:N.condicion, bateria:null, imei:N.imei.replace(/\s/g, ''), precio:N.precio === '' ? null : +N.precio, estado:N.precio === '' ? 'reacondicionar' : 'disponible', origen:'Proveedor', alta:T.hoyISO() }));
  if (N.costo !== '' && C.puede.costos()) T.put('costos', id, { costo:+N.costo });
  U.eqN = T.clone(EQN0); T.toast('Celular dado de alta.');
};
C.cambios.push(t => {
  if (t.dataset.ex){ T.setEx(t.dataset.ex, { min:t.value === '' ? null : Math.max(0, Math.round(+t.value)) }); return true; }
  if (t.dataset.eq){ const e = T.clone(S.equipos[t.dataset.eq]); e.precio = t.value === '' ? null : +t.value; T.put('equipos', t.dataset.eq, e); return true; }
  return false;
});

/* ---------- precios y catálogo ---------- */
function vPrecios(){
  const t = U.prTab || 'reparaciones';
  return (C.puede.precios() ? '' : '<p class="callout info">Solo dirección y administración cambian precios. Aquí puedes consultarlos.</p>')
    + tabs('prTab', t, [['reparaciones','Precios de reparación'],['productos','Productos'],['modelos','Modelos']]) + ({ reparaciones:prReparaciones, productos:prProductos, modelos:prModelos }[t])();
}
function prReparaciones(){
  const P = U.pr, ed = C.puede.precios();
  if (!P.marca) P.marca = 'Apple';
  const ms = T.modelosDe(P.marca);
  if (!P.modeloId || !ms.some(([id]) => id === P.modeloId)) P.modeloId = ms.length ? ms[0][0] : '';
  const con = id => T.vals(S.tarifas).filter(x => x.modeloId === id && x.precio != null && !x.oculta).length;
  const refs = T.ents(S.productos).filter(([, p]) => p.tipo === 'refaccion').map(([id, p]) => [id, p.nombre]);
  const bloque = p => {
    const ts = T.tarifasDe(P.modeloId, p.id);
    return '<div class="prob-precio"><div class="row"><b>' + esc(p.t) + '</b><span class="small muted">Garantía ' + (T.cfg().garantias[p.id] ? T.cfg().garantias[p.id] + ' días' : PC) + '</span><span class="spacer"></span>' + (ed ? '<button class="btn sm quiet" type="button" data-act="tar-nueva" data-v="' + p.id + '">Agregar opción</button>' : '') + '</div>'
      + (ts.length ? '<div class="tarifas">' + ts.map(([id, x]) => ed
        ? '<div class="tarifa">' + campoT(id, 'calidad', x.calidad, 'Opción (original, genérica…)', 'text') + campoT(id, 'precio', x.precio, 'Precio', 'number') + campoT(id, 'tiempo', x.tiempo, 'Tiempo (2 horas)', 'text') + campoT(id, 'garantiaDias', x.garantiaDias, 'Garantía días', 'number')
          + '<label class="f">Refacción<select data-tarifa="' + esc(id) + '" data-campo="refaccionId">' + C.opts(refs, x.refaccionId, 'Sin ligar') + '</select></label><button class="btn sm quiet" type="button" data-act="tar-quitar" data-v="' + esc(id) + '">Quitar</button>' + (x.demo ? T.DEMO_TAG : '') + '</div>'
        : '<div class="row small"><span>' + esc(x.calidad || 'Única') + '</span><span class="spacer"></span><b>' + T.precioTxt(x.precio) + '</b><span class="muted">' + esc(x.tiempo || '') + '</span></div>').join('') + '</div>' : '<p class="small muted">Sin precio: el sitio dice “por confirmar”.</p>') + '</div>';
  };
  return '<div class="precios"><aside class="panel stack tight">' + C.sel('pr.marca', 'pr-marca', 'Marca', T.marcasActivas().map(m => [m, m]), P.marca)
    + '<div class="lista-modelos">' + ms.map(([id, m]) => '<button type="button" class="modelo-btn" data-act="pr-modelo" data-v="' + esc(id) + '" aria-pressed="' + (P.modeloId === id) + '"><span>' + esc(m.modelo) + '</span><span class="small muted">' + (con(id) ? con(id) + ' precios' : '—') + '</span></button>').join('') + '</div></aside>'
    + '<section class="stack tight">' + (P.modeloId ? '<h2>' + esc(T.nombreModelo(P.modeloId)) + ' <span class="small muted">' + esc(T.GAMAS[(S.modelos[P.modeloId] || {}).gama] || '') + '</span></h2>' + T.PROBLEMAS.map(bloque).join('') : '<p class="muted">Esta marca no tiene modelos.</p>')
    + '<p class="note">¿Tienes tu lista en Excel? Llena <span class="mono">datos/precios.csv</span> (marca, modelo, problema, calidad, precio, tiempo, garantía) y se carga completa. Los costos no van en ese archivo: se capturan en Inventario.</p></section></div>';
}
const campoT = (id, campo, v, label, tipo) => '<label class="f">' + label + '<input type="' + tipo + '"' + (tipo === 'number' ? ' min="0" step="any" inputmode="decimal"' : '') + ' data-tarifa="' + esc(id) + '" data-campo="' + campo + '" value="' + esc(v == null ? '' : v) + '"></label>';
function prProductos(){
  const ed = C.puede.precios(), vc = C.puede.costos(), P = U.prod;
  const ps = T.ents(S.productos).sort((a, b) => (a[1].categoria || '').localeCompare(b[1].categoria || '') || a[1].nombre.localeCompare(b[1].nombre, 'es'));
  return (ed ? '<div class="toolbar"><span class="spacer"></span><button class="btn" type="button" data-act="prod-nuevo">' + (P.open && !P.id ? 'Cancelar' : 'Nuevo producto') + '</button></div>' : '')
    + (P.open ? '<form class="panel stack tight" data-form="prod"><h3>' + (P.id ? 'Editar producto' : 'Nuevo producto') + '</h3><div class="grid2">' + C.inp('prod.nombre', 'pd-n', 'Nombre', P.nombre) + C.sel('prod.categoria', 'pd-c', 'Categoría', T.ents(T.CATEGORIAS), P.categoria) + C.inp('prod.compat', 'pd-co', 'Compatible con', P.compat, ' placeholder="iPhone 13 / 14"') + C.inp('prod.marca', 'pd-m', 'Marca', P.marca)
      + C.inp('prod.precio', 'pd-p', 'Precio al público', P.precio, ' type="number" min="0" step="any"') + C.inp('prod.sku', 'pd-s', 'Código o SKU', P.sku) + C.inp('prod.min', 'pd-min', 'Mínimo en inventario', P.min, ' type="number" min="0"') + (vc ? C.inp('prod.costo', 'pd-k', 'Costo', P.costo, ' type="number" min="0" step="any"') : '') + '</div>'
      + C.chk('prod.oculto', 'Ocultar (ya no se vende)', P.oculto) + '<div class="row"><button class="btn primary sm" type="submit">Guardar</button><button class="btn sm quiet" type="button" data-act="prod-cerrar">Cancelar</button></div></form>' : '')
    + '<div class="tbl"><table class="t"><thead><tr><th>Producto</th><th>Categoría</th><th>Compatible</th><th class="num">Precio</th>' + (vc ? '<th class="num">Costo</th><th class="num">Margen</th>' : '') + '<th></th></tr></thead><tbody>'
    + (ps.map(([id, p]) => { const k = T.costo(id); return '<tr' + (p.oculto ? ' class="muted"' : '') + '><td>' + esc(p.nombre) + (p.demo ? ' ' + T.DEMO_TAG : '') + (p.oculto ? ' <span class="tag pc">oculto</span>' : '') + '</td><td>' + esc(T.CATEGORIAS[p.categoria] || '') + '</td><td>' + esc(p.compat || '') + '</td><td class="num">' + (p.tipo === 'refaccion' && p.precio == null ? '<span class="small muted">en la tarifa</span>' : T.precioTxt(p.precio)) + '</td>'
      + (vc ? '<td class="num">' + T.precioTxt(k) + '</td><td class="num">' + (k != null && p.precio ? (((p.precio - k) / p.precio * 100) < T.cfg().margenMinimo ? chip('crit', T.pctTxt((p.precio - k) / p.precio * 100)) : T.pctTxt((p.precio - k) / p.precio * 100)) : '—') + '</td>' : '')
      + '<td>' + (ed ? '<button class="btn sm quiet" type="button" data-act="prod-editar" data-v="' + esc(id) + '">Editar</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="muted">Sin productos.</td></tr>')
    + '</tbody></table></div><p class="note">También se pueden cargar todos juntos en <span class="mono">datos/productos.csv</span>.</p>';
}
function prModelos(){
  const ed = C.puede.precios(), M = U.mod;
  return (ed ? '<form class="panel stack tight" data-form="modelo"><h3>Agregar modelo</h3><div class="grid2">' + C.sel('mod.marca', 'md-m', 'Marca', T.marcasActivas().map(m => [m, m]).concat([['Otra','Otra marca']]), M.marca) + (M.marca === 'Otra' ? C.inp('mod.marcaTexto', 'md-mt', 'Marca nueva', M.marcaTexto) : '')
    + C.inp('mod.modelo', 'md-n', 'Modelo', M.modelo, ' placeholder="Como lo ve el cliente en Ajustes"') + C.sel('mod.gama', 'md-g', 'Gama', T.ents(T.GAMAS), M.gama) + '</div><div><button class="btn primary sm" type="submit">Agregar</button></div></form>' : '')
    + T.marcasActivas().map(m => { const ms = T.ents(S.modelos).filter(([, x]) => x.marca === m).sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
      return ms.length ? '<details><summary>' + esc(m) + ' (' + ms.filter(([, x]) => !x.oculto).length + ')</summary><div class="chips-modelos">' + ms.map(([id, x]) => '<span class="chip ' + (x.oculto ? 'muted' : 'info') + '">' + esc(x.modelo) + (ed ? ' <button class="linkbtn small" type="button" data-act="mod-ocultar" data-v="' + esc(id) + '">' + (x.oculto ? 'mostrar' : 'ocultar') + '</button>' : '') + '</span>').join('') + '</div></details>' : ''; }).join('');
}
C.vistas.precios = vPrecios;
C.estado.prTab = 'reparaciones'; C.estado.pr = { marca:'Apple', modeloId:'' };
const PROD0 = { open:false, id:'', nombre:'', categoria:'fundas', compat:'', marca:'', precio:'', sku:'', min:'', costo:'', oculto:false };
C.estado.prod = T.clone(PROD0); C.estado.mod = { marca:'Apple', marcaTexto:'', modelo:'', gama:'media' };
Object.assign(C.acciones, {
  'pr-modelo'(d){ U.pr.modeloId = d.v; T.scheduleRender(); },
  'tar-nueva'(d){
    const P = U.pr, ya = T.tarifasDe(P.modeloId, d.v).length;
    const calidad = ya ? 'Opción ' + (ya + 1) : '';
    T.put('tarifas', T.tarifaId(P.modeloId, d.v, calidad), { modeloId:P.modeloId, problema:d.v, calidad, precio:null, tiempo:null, garantiaDias:null, refaccionId:null });
  },
  'tar-quitar'(d){ T.confirmar('¿Quitar este precio? El sitio volverá a decir “por confirmar” para esta opción.', () => T.put('tarifas', d.v, null), { ok:'Quitar precio', peligro:true }); },
  'prod-nuevo'(){ U.prod = Object.assign(T.clone(PROD0), { open:!(U.prod.open && !U.prod.id) }); T.scheduleRender(); },
  'prod-cerrar'(){ U.prod = T.clone(PROD0); T.scheduleRender(); },
  'prod-editar'(d){ const p = S.productos[d.v], e = T.ex(d.v), k = T.costo(d.v); U.prod = { open:true, id:d.v, nombre:p.nombre, categoria:p.categoria, compat:p.compat || '', marca:p.marca || '', precio:p.precio == null ? '' : p.precio, sku:p.sku || '', min:e.min == null ? '' : e.min, costo:k == null ? '' : k, oculto:!!p.oculto }; T.scheduleRender(); window.scrollTo(0, 0); },
  'mod-ocultar'(d){ const m = T.clone(S.modelos[d.v]); m.oculto = !m.oculto; T.put('modelos', d.v, m); }
});
C.formularios.prod = () => {
  const P = U.prod; if (P.nombre.trim().length < 2) return T.toast('Escribe el nombre.', 'warn');
  const id = P.id || 'pr-' + T.slug(P.nombre + ' ' + P.compat) + '-' + Math.random().toString(36).slice(2, 5);
  const prev = S.productos[id] || {};
  T.put('productos', id, Object.assign({}, prev, { nombre:P.nombre.trim(), tipo:P.categoria === 'refacciones' ? 'refaccion' : 'accesorio', categoria:P.categoria, compat:P.compat.trim(), marca:P.marca.trim(), precio:P.precio === '' ? null : +P.precio, sku:P.sku.trim(), oculto:!!P.oculto }));
  T.setEx(id, { disp:T.ex(id).disp, apart:T.ex(id).apart, min:P.min === '' ? null : +P.min });
  if (C.puede.costos() && P.costo !== '') T.put('costos', id, { costo:+P.costo });
  U.prod = T.clone(PROD0); T.toast('Producto guardado.');
};
C.formularios.modelo = () => {
  const M = U.mod, marca = M.marca === 'Otra' ? M.marcaTexto.trim() : M.marca;
  if (!marca || M.modelo.trim().length < 1) return T.toast('Escribe marca y modelo.', 'warn');
  const id = T.slug(marca + ' ' + M.modelo); if (S.modelos[id]) return T.toast('Ese modelo ya existe.', 'warn');
  T.put('modelos', id, { marca, modelo:M.modelo.trim(), gama:M.gama, orden:-1 });
  U.mod = { marca, marcaTexto:'', modelo:'', gama:M.gama }; T.toast('Modelo agregado: ya aparece en el sitio.');
};
C.cambios.push(t => {
  if (!t.dataset.tarifa) return false;
  const x = T.clone(S.tarifas[t.dataset.tarifa]); if (!x) return true;
  const c = t.dataset.campo, v = t.value;
  x[c] = c === 'precio' || c === 'garantiaDias' ? (v === '' ? null : +v) : (v.trim() || (c === 'refaccionId' ? null : ''));
  delete x.demo; T.put('tarifas', t.dataset.tarifa, x); return true;
});
})();
