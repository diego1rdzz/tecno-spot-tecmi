/* Sitio público de Tecno-Spot.
   Un asistente paso a paso: ¿qué le pasa a tu celular? → marca → modelo →
   cotización → cita con turno en la cafetería. Lo que agenda el cliente llega
   en vivo a los turnos de la consola. Nunca muestra costos. */
(function(){
'use strict';
const T = window.TS, U = T.U, S = T.S, esc = T.esc, PC = T.PC, chip = T.chip, icono = T.icono;

const FLUJOS = {
  reparar:['problema','marca','modelo','cotizacion','cita','listo'],
  vender:['marca','modelo','estado','cita','listo'],
  cita:['motivo','cita','listo']
};
const ETQ = { problema:'Problema', marca:'Marca', modelo:'Modelo', cotizacion:'Cotización', estado:'Estado', motivo:'Motivo', cita:'Cita', listo:'Turno' };
const VISTAS = [['inicio','Reparar'],['accesorios','Accesorios'],['celulares','Celulares'],['vender','Vende o cambia'],['domicilio','A domicilio'],['garantia','Garantía'],['consulta','Mi cita y mi equipo']];
const CAPACIDADES = ['64 GB','128 GB','256 GB','512 GB','1 TB','No sé'];
const W0 = { flujo:'reparar', paso:'problema', problema:'', marca:'', marcaTexto:'', modeloId:'', modeloTexto:'', sinModelo:false, busca:'', opcion:'',
  motivo:'', condicion:'', capacidad:'', preferencia:'efectivo', productoId:'', equipoId:'', ordenFolio:'',
  fecha:'', hora:'', modalidad:'cafeteria', direccion:'', nombre:'', tel:'', correo:'', tecmi:false, nota:'', privacidad:false, enviando:false, err:'', hecho:null };

const E = () => T.empresa();
/* "la cafetería de Tecmilenio": para escribir "en …" sin adivinar el artículo. */
const enLugar = () => E().lugarFrase || E().lugar;
const equipoElegido = () => { const w = U.w; return w.modeloId ? T.nombreModelo(w.modeloId) : ((w.marca === 'Otra' ? (w.marcaTexto || 'Otra marca') : w.marca) + ' ' + (w.modeloTexto || '')).trim(); };
const ir = paso => { U.w.paso = paso; U.w.err = ''; U.wScroll = true; T.scheduleRender(); };
const sel = on => on ? ' aria-pressed="true"' : ' aria-pressed="false"';

/* ---------- barra y pie ---------- */
function barra(){
  const nav = VISTAS.map(([v, t]) => '<button type="button" data-act="sv" data-v="' + v + '"' + (U.sv === v ? ' aria-current="page"' : '') + '>' + t + '</button>').join('')
    + (T.LINKS.portal ? '<a href="' + esc(T.LINKS.portal) + '">Mi cuenta</a>' : '');
  return T.barra('', nav, '');
}
function pie(){
  const e = E(), dato = (k, t) => '<dt>' + t + '</dt><dd>' + (e[k] ? esc(e[k]) : PC) + '</dd>';
  return '<footer class="pie"><div class="pie-in"><div class="stack tight">' + T.logo() + '<p class="small muted">Reparación, accesorios, venta y compra de celulares de todas las gamas. Sucursal ' + esc(e.sucursal) + '.</p></div>'
    + '<dl class="kv small">' + '<dt>Dónde</dt><dd>' + esc(e.lugar) + '</dd>' + dato('direccion', 'Dirección') + dato('horario', 'Horario') + dato('whatsapp', 'WhatsApp') + dato('telefono', 'Teléfono') + dato('correo', 'Correo') + '<dt>Privacidad</dt><dd>Aviso de privacidad ' + PC + '</dd></dl></div></footer>';
}

/* ---------- asistente ---------- */
function stepper(){
  const w = U.w, pasos = FLUJOS[w.flujo], i = pasos.indexOf(w.paso);
  return '<ol class="stepper" aria-label="Pasos">' + pasos.map((p, k) => {
    const cls = k < i ? 'hecho' : k === i ? 'actual' : '';
    const inner = '<b>' + (k + 1) + '</b><span>' + ETQ[p] + '</span>';
    return '<li class="' + cls + '"' + (k === i ? ' aria-current="step"' : '') + '>' + (k < i && w.paso !== 'listo' ? '<button type="button" data-act="w-ir" data-v="' + p + '">' + inner + '</button>' : '<div>' + inner + '</div>') + '</li>';
  }).join('') + '</ol>';
}
function resumen(){
  const w = U.w, partes = [];
  const r = (i, t) => '<span class="r">' + icono(i) + esc(t) + '</span>';
  if (w.flujo === 'reparar' && w.problema) partes.push(r(w.problema, T.PROB[w.problema].t));
  if (w.flujo === 'cita' && w.motivo) partes.push(r('folio', T.MOTIVOS_CITA[w.motivo]));
  if (w.marca && w.flujo !== 'cita') partes.push(r('celular', equipoElegido() || w.marca));
  return partes.length && w.paso !== 'listo' ? '<div class="resumen">' + partes.join('') + '</div>' : '';
}
function pProblema(){
  return '<div class="opciones prob">' + T.PROBLEMAS.map(p => '<button type="button" class="opcion' + (p.urgente ? ' urgente' : '') + '" data-act="w-problema" data-v="' + p.id + '"' + sel(U.w.problema === p.id) + '>' + icono(p.id) + '<b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></button>').join('') + '</div>';
}
function pMarca(){
  const ms = T.marcasActivas();
  return '<div class="opciones marcas">' + ms.map(m => '<button type="button" class="opcion marca" data-act="w-marca" data-v="' + esc(m) + '"' + sel(U.w.marca === m) + '><b>' + esc(m) + '</b><span>' + T.modelosDe(m).length + ' modelos</span></button>').join('')
    + '<button type="button" class="opcion marca" data-act="w-marca" data-v="Otra"' + sel(U.w.marca === 'Otra') + '><b>Otra marca</b><span>La escribes tú</span></button></div>';
}
function pModelo(){
  const w = U.w, otra = w.marca === 'Otra';
  const q = (w.busca || '').trim().toLowerCase();
  const ms = otra ? [] : T.modelosDe(w.marca).filter(([, m]) => !q || m.modelo.toLowerCase().includes(q));
  const donde = '<p class="tip">' + icono('diagnostico') + '<span><b>¿No sabes tu modelo?</b> ' + esc(w.marca === 'Apple' ? T.DONDE_MODELO.Apple : T.DONDE_MODELO.otra) + '</span></p>';
  const manual = '<form class="stack tight manual" data-form="w-modelo-texto">' + (otra ? '<label class="f" for="w-marca-t">Marca<input id="w-marca-t" data-bind="w.marcaTexto" value="' + esc(w.marcaTexto) + '" placeholder="Por ejemplo: Nokia"></label>' : '')
    + '<label class="f" for="w-mod-t">Escribe tu modelo<input id="w-mod-t" data-bind="w.modeloTexto" value="' + esc(w.modeloTexto) + '" placeholder="Como aparece en Ajustes"></label>'
    + '<div><button class="btn primary" type="submit">Continuar</button></div></form>';
  if (otra || w.sinModelo) return donde + manual + (otra ? '' : '<div><button class="btn quiet" type="button" data-act="w-sin-modelo">Volver a la lista</button></div>');
  return '<div class="row"><label class="f buscar" for="w-busca">Busca tu modelo<input id="w-busca" type="search" data-bind="w.busca" data-live value="' + esc(w.busca) + '" placeholder="Por ejemplo: 13, A54, G84" autocomplete="off"></label></div>'
    + '<div class="opciones modelos">' + (ms.map(([id, m]) => '<button type="button" class="opcion modelo" data-act="w-modelo" data-v="' + esc(id) + '"' + sel(w.modeloId === id) + '><b>' + esc(m.modelo) + '</b><span>' + esc(T.GAMAS[m.gama] || '') + '</span></button>').join('') || '<p class="muted">Ningún modelo coincide con tu búsqueda.</p>') + '</div>'
    + donde + '<div><button class="btn" type="button" data-act="w-sin-modelo">No encuentro mi modelo</button></div>';
}
function pCotizacion(){
  const w = U.w, p = T.PROB[w.problema], cot = T.cotizar(w.modeloId, w.problema);
  const ops = cot.opciones;
  if (ops.length && !ops.some(o => o.tarifaId === w.opcion)) w.opcion = ops[0].tarifaId;
  const gar = d => d ? d + ' días de garantía' : 'Garantía ' + PC;
  const lista = ops.length ? '<fieldset class="ops"><legend>Elige la opción que prefieres</legend>' + ops.map(o => '<label class="op"><input type="radio" name="w-op" value="' + esc(o.tarifaId) + '" data-bind="w.opcion"' + (w.opcion === o.tarifaId ? ' checked' : '') + '>'
      + '<span class="op-t"><b>' + esc(o.calidad || p.t) + '</b><span class="small muted">' + (o.tiempo ? 'Tiempo estimado: ' + esc(o.tiempo) : 'Tiempo ' + PC) + ' · ' + (o.garantia ? gar(o.garantia) : gar(cot.garantia)) + '</span></span>'
      + '<span class="op-p">' + T.precioTxt(o.precio) + (o.demo ? ' ' + T.DEMO_TAG : '') + '</span></label>').join('') + '</fieldset>'
    : '<div class="callout spot"><strong>Precio por confirmar</strong>Todavía no publicamos el precio de esta reparación para ' + esc(equipoElegido()) + '. En tu cita revisamos el equipo frente a ti y te damos el precio exacto. No reparamos nada sin tu autorización.</div>';
  return '<article class="cotiz"><div class="cotiz-h">' + icono(w.problema, 'grande') + '<div><div class="eyebrow">Tu cotización</div><h3>' + esc(p.t) + '</h3><p class="muted">' + esc(equipoElegido()) + '</p></div></div>'
    + lista
    + (w.problema === 'diagnostico' ? '<p><b>Revisión del equipo:</b> ' + T.precioTxt(cot.diagnostico) + '</p>' : '')
    + (!ops.length ? '<p class="small">' + gar(cot.garantia) + '.</p>' : '')
    + (p.tip ? '<p class="tip' + (p.urgente ? ' urgente' : '') + '">' + icono(p.urgente ? 'humedad' : 'mantenimiento') + '<span><b>' + (p.urgente ? 'Importante' : 'Consejo') + ':</b> ' + esc(p.tip) + '</span></p>' : '')
    + '<div class="sigue"><h4>¿Qué sigue?</h4><ol><li>Agenda tu cita y recibe tu turno.</li><li>Ese día, en ' + esc(enLugar()) + ', revisamos tu celular contigo y confirmamos el precio.</li><li>Si estás de acuerdo, lo reparamos y te avisamos cuando esté listo.</li></ol></div>'
    + '<div class="row"><button class="btn primary lg" type="button" data-act="w-ir" data-v="cita">Agendar mi cita</button><button class="btn quiet" type="button" data-act="w-ir" data-v="modelo">Cambiar el modelo</button></div></article>';
}
function pEstado(){
  const w = U.w;
  return '<div class="stack"><fieldset class="ops"><legend>¿Cómo está tu ' + esc(equipoElegido()) + '?</legend>' + T.ents(T.CONDICION_USADO).map(([k, v]) => '<label class="op"><input type="radio" name="w-cond" value="' + k + '" data-bind="w.condicion"' + (w.condicion === k ? ' checked' : '') + '><span class="op-t"><b>' + v + '</b><span class="small muted">' + ({ nuevo:'Sin rayones ni golpes, todo funciona.', bueno:'Rayones leves de uso, todo funciona.', detalles:'Golpes o rayones visibles, o algo no funciona bien.', danado:'Pantalla o tapa rota, o no enciende.' })[k] + '</span></span></label>').join('') + '</fieldset>'
    + '<div class="grid2"><label class="f" for="w-cap">Capacidad<select id="w-cap" data-bind="w.capacidad"><option value="">Elige…</option>' + CAPACIDADES.map(c => '<option' + (w.capacidad === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label></div>'
    + '<fieldset class="ops"><legend>¿Qué prefieres?</legend>'
    + '<label class="op"><input type="radio" name="w-pref" value="efectivo" data-bind="w.preferencia"' + (w.preferencia === 'efectivo' ? ' checked' : '') + '><span class="op-t"><b>Venderlo</b><span class="small muted">Te pagamos por tu equipo.</span></span></label>'
    + '<label class="op"><input type="radio" name="w-pref" value="toma" data-bind="w.preferencia"' + (w.preferencia === 'toma' ? ' checked' : '') + '><span class="op-t"><b>Cambiarlo (toma a cuenta)</b><span class="small muted">Lo tomamos como parte del pago de otro celular o accesorios.</span></span></label></fieldset>'
    + requisitosVenta()
    + '<div class="callout info"><strong>¿Cuánto me dan?</strong>Te hacemos una oferta en tu cita, después de revisar el equipo contigo.</div>'
    + (w.err ? '<p class="err" role="alert">' + esc(w.err) + '</p>' : '')
    + '<div><button class="btn primary lg" type="button" data-act="w-estado-ok">Agendar mi cita</button></div></div>';
}
function requisitosVenta(){
  return '<div class="req"><h4>Lleva esto a tu cita</h4><ul><li>Tu identificación oficial.</li><li>Tu equipo sin reporte de robo o extravío (revisamos el IMEI).</li><li>Tu cuenta de iCloud o Google cerrada y el equipo sin contraseña de activación.</li><li>Caja, factura o comprobante, si los tienes.</li></ul></div>';
}
function pMotivo(){
  const w = U.w, opts = ['entrega','duda','compra','garantia'];
  return '<div class="stack"><div class="opciones motivos">' + opts.map(k => '<button type="button" class="opcion" data-act="w-motivo" data-v="' + k + '"' + sel(w.motivo === k) + '>' + icono({ entrega:'folio', duda:'diagnostico', compra:'tienda', garantia:'escudo' }[k]) + '<b>' + esc(T.MOTIVOS_CITA[k]) + '</b><span>' + ({ entrega:'Tu equipo ya está listo y pasas por él.', duda:'Una pregunta, una revisión rápida o una opinión.', compra:'Ver, probar o recoger un accesorio o un celular.', garantia:'Algo falló después de una reparación o compra.' })[k] + '</span></button>').join('') + '</div>'
    + (w.productoId || w.equipoId ? '<p class="callout info"><strong>Apartado para tu cita</strong>' + esc(w.productoId ? T.prodNombre(w.productoId) : equipoVenta(S.equipos[w.equipoId])) + '</p>' : '') + '</div>';
}
function pCita(){
  const w = U.w, c = T.cfg(), dias = T.diasAgenda();
  if (!w.fecha || !dias.includes(w.fecha)) w.fecha = dias[0] || '';
  const hs = w.fecha ? T.horarios(w.fecha) : [];
  const dom = c.domicilio.activo;
  return '<form class="stack" data-form="w-agendar" novalidate>'
    + '<fieldset class="ops"><legend>¿Qué día pasas?</legend><div class="dias">' + (dias.map(d => { const libres = T.horarios(d).filter(h => !h.pasada).reduce((a, h) => a + h.libres, 0); return '<button type="button" class="dia" data-act="w-dia" data-v="' + d + '"' + sel(w.fecha === d) + (libres ? '' : ' disabled') + '><b>' + esc(T.fmtDiaCorto(d)) + '</b><span>' + (d === T.hoyISO() ? 'Hoy · ' : '') + (libres ? libres + ' lugares' : 'Lleno') + '</span></button>'; }).join('') || '<p class="muted">No hay días con citas disponibles.</p>') + '</div></fieldset>'
    + (w.fecha ? '<fieldset class="ops"><legend>¿A qué hora? <span class="small muted">' + esc(T.fmtDia(w.fecha)) + '</span></legend><div class="horas">' + hs.map(h => '<button type="button" class="hora" data-act="w-hora" data-v="' + h.hora + '"' + sel(w.hora === h.hora) + (h.libres && !h.pasada ? '' : ' disabled') + '>' + h.hora + (h.pasada ? '' : h.libres ? '' : '<span>lleno</span>') + '</button>').join('') + '</div>'
      + (c.citas.confirmado ? '' : '<p class="small muted">Horario de citas ' + PC + '.</p>') + '</fieldset>' : '')
    + (w.flujo !== 'cita' || w.motivo === 'entrega' ? '<fieldset class="ops"><legend>¿Cómo lo prefieres?</legend>'
      + '<label class="op"><input type="radio" name="w-mod" value="cafeteria" data-bind="w.modalidad"' + (w.modalidad !== 'domicilio' ? ' checked' : '') + '><span class="op-t"><b>Voy a ' + esc(enLugar()) + '</b><span class="small muted">Con tu turno te atendemos al llegar.</span></span></label>'
      + (dom ? '<label class="op"><input type="radio" name="w-mod" value="domicilio" data-bind="w.modalidad"' + (w.modalidad === 'domicilio' ? ' checked' : '') + '><span class="op-t"><b>' + (w.motivo === 'entrega' ? 'Llévenmelo a domicilio' : 'Recójanlo en mi domicilio') + '</b><span class="small muted">Costo ' + (c.domicilio.costo != null ? T.fmtMoney(c.domicilio.costo) : PC) + ' · zona ' + (c.domicilio.zona ? esc(c.domicilio.zona) : PC) + '</span></span></label>' : '')
      + '</fieldset>' : '')
    + (w.modalidad === 'domicilio' ? '<label class="f" for="w-dir">Dirección completa<textarea id="w-dir" data-bind="w.direccion" placeholder="Calle, número, colonia y alguna referencia">' + esc(w.direccion) + '</textarea></label>' : '')
    + '<fieldset class="ops"><legend>Tus datos</legend><div class="grid2">'
    + '<label class="f" for="w-nom">Nombre<input id="w-nom" autocomplete="name" data-bind="w.nombre" value="' + esc(w.nombre) + '"></label>'
    + '<label class="f" for="w-tel">Celular con WhatsApp<input id="w-tel" type="tel" inputmode="numeric" autocomplete="tel" data-bind="w.tel" value="' + esc(w.tel) + '" placeholder="10 dígitos"></label>'
    + '<label class="f" for="w-mail">Correo (opcional)<input id="w-mail" type="email" autocomplete="email" data-bind="w.correo" value="' + esc(w.correo) + '"></label></div>'
    + (w.motivo === 'entrega' ? '<label class="f" for="w-of">Folio de tu orden (si lo tienes)<input id="w-of" data-bind="w.ordenFolio" value="' + esc(w.ordenFolio) + '" placeholder="OS-…"></label>' : '')
    + '<label class="f" for="w-nota">¿Algo más que debamos saber? (opcional)<textarea id="w-nota" data-bind="w.nota" placeholder="Por ejemplo: se cayó ayer y la pantalla quedó en negro">' + esc(w.nota) + '</textarea></label>'
    + '<label class="check"><input type="checkbox" data-bind="w.tecmi"' + (w.tecmi ? ' checked' : '') + '><span>Soy de la comunidad Tecmilenio (alumno, maestro o colaborador)</span></label>'
    + '<label class="check"><input type="checkbox" data-bind="w.privacidad"' + (w.privacidad ? ' checked' : '') + '><span>Acepto que usen mis datos solo para atender mi cita y mi equipo. Aviso de privacidad ' + PC + '</span></label></fieldset>'
    + (w.err ? '<p class="err" role="alert">' + esc(w.err) + '</p>' : '')
    + '<div><button class="btn primary lg" type="submit"' + (w.enviando ? ' disabled' : '') + '>' + (w.enviando ? 'Agendando…' : 'Confirmar mi cita') + '</button></div></form>';
}
function queLlevar(w){
  const l = ['Tu celular y, si puedes, su cargador.'];
  if (w.flujo === 'reparar') l.push('El código o patrón de desbloqueo para probarlo contigo (lo borramos al entregarlo).');
  if (w.problema === 'liberacion' || w.flujo === 'vender') l.push('Tu identificación oficial.');
  if (w.flujo === 'vender') l.push('Tu cuenta de iCloud o Google cerrada en el equipo.');
  if (w.motivo === 'entrega') l.push('Tu folio de orden y una identificación.');
  if (w.motivo === 'garantia') l.push('Tu folio de la reparación o de la compra.');
  return l;
}
function pListo(){
  const w = U.w, h = w.hecho; if (!h) return '';
  const c = { folio:h.folio, fecha:h.fecha, hora:h.hora, turno:h.turno, lugar:h.lugar };
  const share = 'Mi cita en ' + E().nombre + ': ' + T.fmtDia(h.fecha) + ' a las ' + h.hora + ', turno ' + h.turno + ', en ' + h.lugar + '. Folio ' + h.folio + '.';
  const wa = E().whatsapp ? T.waLink(E().whatsapp, 'Hola, agendé mi cita. Folio ' + h.folio + ' · ' + T.fmtDia(h.fecha) + ' ' + h.hora + '.') : null;
  return '<article class="ticket"><div class="ticket-turno"><span>Tu turno</span><b>' + esc(h.turno) + '</b></div>'
    + '<div class="ticket-info"><h3>¡Listo, ' + esc((w.nombre || '').split(' ')[0]) + '!</h3><p class="grande">' + esc(T.fmtDia(h.fecha)) + ' · <b>' + esc(h.hora) + '</b></p><p>' + icono(w.modalidad === 'domicilio' ? 'casa' : 'tienda') + ' ' + esc(w.modalidad === 'domicilio' ? 'En tu domicilio' : h.lugar) + '</p>'
    + '<p>Folio <span class="mono folio">' + esc(h.folio) + '</span></p></div></article>'
    + '<div class="grid2"><div class="card"><h4>Ese día</h4><p>Al llegar, di tu folio o tu número de turno. Tu turno sirve para lo que necesites: dudas, entregar tu equipo para reparar o recogerlo.</p></div>'
    + '<div class="card"><h4>Qué llevar</h4><ul class="lista">' + queLlevar(w).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>'
    + '<div class="row"><a class="btn primary" href="' + T.icsCita(c) + '" download="cita-' + esc(h.folio) + '.ics">Guardar en mi calendario</a>'
    + '<a class="btn" href="https://wa.me/?text=' + encodeURIComponent(share) + '" target="_blank" rel="noopener">Compartir por WhatsApp</a>'
    + (wa ? '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Avisar a ' + esc(E().nombre) + '</a>' : '')
    + '<button class="btn" type="button" data-act="ver-cita">Ver o cancelar mi cita</button><button class="btn quiet" type="button" data-act="w-nuevo">Agendar otra</button></div>';
}
const TITULOS = {
  problema:['¿Qué le pasa a tu celular?','Elige lo que más se parezca. Si no estás seguro, elige “No sé qué tiene”.'],
  marca:['¿De qué marca es?',''],
  modelo:['¿Qué modelo es?',''],
  cotizacion:['Esta es tu cotización',''],
  estado:['Cuéntanos cómo está','Así preparamos tu oferta.'],
  motivo:['¿Para qué es tu cita?',''],
  cita:['Elige tu cita','Te damos un turno para ese día.'],
  listo:['Tu cita quedó agendada','']
};
function asistente(nivel){
  const w = U.w, t = TITULOS[w.paso], h = nivel || 'h2';
  const cuerpo = { problema:pProblema, marca:pMarca, modelo:pModelo, cotizacion:pCotizacion, estado:pEstado, motivo:pMotivo, cita:pCita, listo:pListo }[w.paso]();
  const titulo = w.paso === 'modelo' ? '¿Qué modelo es tu ' + (w.marca === 'Otra' ? 'celular' : w.marca) + '?' : t[0];
  return '<section class="asistente" id="asistente" aria-labelledby="w-titulo">' + stepper() + resumen()
    + '<div class="paso-h"><' + h + ' id="w-titulo">' + esc(titulo) + '</' + h + '>' + (t[1] ? '<p class="muted">' + esc(t[1]) + '</p>' : '') + '</div>'
    + cuerpo
    + (w.paso !== 'listo' && w.paso !== FLUJOS[w.flujo][0] ? '<div class="volver"><button class="btn quiet" type="button" data-act="w-atras">← Paso anterior</button></div>' : '')
    + '</section>';
}

/* ---------- secciones ---------- */
function comoFunciona(){
  const pasos = [['diagnostico','Cotiza','Elige el problema, tu marca y tu modelo.'],['folio','Agenda','Escoge día y hora; recibes folio y turno.'],['tienda','Llega con tu turno','En ' + enLugar() + ' revisamos tu equipo contigo.'],['escudo','Recíbelo con garantía','Te avisamos por WhatsApp cuando esté listo.']];
  return '<section class="seccion"><h2>Así de fácil</h2><ol class="como">' + pasos.map(([i, t, d], k) => '<li>' + icono(i) + '<b>' + (k + 1) + '. ' + t + '</b><span>' + esc(d) + '</span></li>').join('') + '</ol></section>';
}
function tambien(){
  const items = [['accesorios','tienda','Accesorios','Fundas, micas de vidrio, de privacidad e hidrogel, cargadores, baterías portátiles, AirPods y Apple Watch.'],
    ['celulares','celular','Celulares','Nuevos y seminuevos de todas las gamas, con garantía.'],
    ['vender','cambio','Vende o cambia tu celular','Te lo compramos o lo tomamos a cuenta de otro.'],
    ['domicilio','casa','A domicilio','Recolección y entrega en tu domicilio.'],
    ['garantia','escudo','Garantía','Toda reparación y todo equipo se entregan con garantía por escrito.'],
    ['consulta','folio','Mi cita y mi equipo','Con tu folio y tu celular ves el estado y autorizas tu presupuesto.']];
  return '<section class="seccion"><h2>También en ' + esc(E().nombre) + '</h2><div class="servicios">' + items.map(([v, i, t, d]) => '<button type="button" class="servicio" data-act="sv" data-v="' + v + '">' + icono(i) + '<b>' + esc(t) + '</b><span>' + esc(d) + '</span></button>').join('') + '</div></section>';
}
function vInicio(){
  const w = U.w, inicio = w.paso === FLUJOS[w.flujo][0] && w.flujo === 'reparar';
  return '<div class="hero' + (inicio ? '' : ' corto') + '"><div class="hero-in"><div class="eyebrow">Reparación de celulares en ' + esc(enLugar()) + '</div>'
    + (inicio ? '<p class="lede">Elige el problema, tu marca y tu modelo. Te damos tu cotización y tu cita con turno: ese día resolvemos tus dudas, recibimos tu equipo o te lo entregamos.</p>' : '') + '</div></div>'
    + '<main class="sitio">' + asistente('h1') + (inicio ? comoFunciona() + tambien() : '') + '</main>';
}
function disponibilidad(pid){ const e = T.ex(pid); return e.disp > 3 ? chip('ok','Disponible') : e.disp > 0 ? chip('warn','Últimas ' + e.disp) : chip('muted','Agotado'); }
function vAccesorios(){
  const cats = T.ents(T.CATEGORIAS).filter(([k]) => k !== 'refacciones');
  const ps = T.ents(S.productos).filter(([, p]) => p.tipo === 'accesorio' && !p.oculto && (!U.cat || p.categoria === U.cat)).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'));
  return '<main class="sitio"><section class="seccion"><div class="eyebrow">Accesorios</div><h1>Protege y carga tu celular</h1><p class="muted">Apártalo aquí y recógelo en tu turno de la cafetería.</p>'
    + '<div class="filtros"><button type="button" class="filtro" data-act="cat" data-v=""' + sel(!U.cat) + '>Todo</button>' + cats.map(([k, v]) => '<button type="button" class="filtro" data-act="cat" data-v="' + k + '"' + sel(U.cat === k) + '>' + esc(v) + '</button>').join('') + '</div>'
    + (ps.length ? '<div class="productos">' + ps.map(([id, p]) => '<article class="producto"><div class="row"><span class="small muted">' + esc(T.CATEGORIAS[p.categoria] || '') + '</span><span class="spacer"></span>' + disponibilidad(id) + '</div><h3>' + esc(p.nombre) + '</h3>' + (p.compat ? '<p class="small muted">Para ' + esc(p.compat) + '</p>' : '')
        + '<p class="precio">' + T.precioTxt(p.precio) + (p.demo ? ' ' + T.DEMO_TAG : '') + '</p><button class="btn sm" type="button" data-act="apartar" data-p="' + esc(id) + '"' + (T.ex(id).disp ? '' : ' disabled') + '>Apartar y recoger en mi turno</button></article>').join('') + '</div>'
      : '<div class="card"><h3>Estamos cargando el catálogo</h3><p class="muted">Muy pronto verás aquí precios y existencias. Mientras, agenda un turno y te mostramos lo que hay.</p><div><button class="btn primary" type="button" data-act="flujo-cita" data-v="compra">Agendar un turno</button></div></div>')
    + '</section></main>';
}
function equipoVenta(q){ return q ? (q.marca + ' ' + q.modelo + (q.capacidad ? ' · ' + q.capacidad : '')) : 'Celular'; }
function vCelulares(){
  const f = U.celCond || '';
  const qs = T.ents(S.equipos).filter(([, q]) => q.estado === 'disponible' && (!f || q.condicion === f)).sort((a, b) => (+a[1].precio || 0) - (+b[1].precio || 0));
  const g = T.cfg().garantiaEquipo;
  return '<main class="sitio"><section class="seccion"><div class="eyebrow">Celulares</div><h1>Nuevos y seminuevos de todas las gamas</h1><p class="muted">Todos se revisan antes de venderse y se entregan con garantía. ¿Tienes un celular que ya no usas? Te lo tomamos a cuenta.</p>'
    + '<div class="filtros"><button type="button" class="filtro" data-act="cel" data-v=""' + sel(!f) + '>Todos</button><button type="button" class="filtro" data-act="cel" data-v="nuevo"' + sel(f === 'nuevo') + '>Nuevos</button><button type="button" class="filtro" data-act="cel" data-v="seminuevo"' + sel(f === 'seminuevo') + '>Seminuevos</button></div>'
    + (qs.length ? '<div class="productos">' + qs.map(([id, q]) => { const m = S.modelos[q.modeloId]; const gd = g[q.condicion === 'nuevo' ? 'nuevo' : 'seminuevo'];
        return '<article class="producto">' + '<div class="row">' + chip(q.condicion === 'nuevo' ? 'info' : 'ok', q.condicion === 'nuevo' ? 'Nuevo' : 'Seminuevo') + (m ? '<span class="small muted">' + esc(T.GAMAS[m.gama] || '') + '</span>' : '') + '</div><h3>' + esc(q.marca + ' ' + q.modelo) + '</h3>'
          + '<p class="small muted">' + [q.capacidad, q.color, q.bateria ? 'batería al ' + q.bateria + '%' : ''].filter(Boolean).map(esc).join(' · ') + '</p>'
          + '<p class="precio">' + T.precioTxt(q.precio) + (q.demo ? ' ' + T.DEMO_TAG : '') + '</p><p class="small">' + (gd ? gd + ' días de garantía' : 'Garantía ' + PC) + '</p>'
          + '<button class="btn sm" type="button" data-act="apartar" data-e="' + esc(id) + '">Apartar y verlo en mi turno</button></article>'; }).join('') + '</div>'
      : '<div class="card"><h3>Pronto publicamos los equipos disponibles</h3><p class="muted">Agenda un turno y te mostramos lo que tenemos.</p><div><button class="btn primary" type="button" data-act="flujo-cita" data-v="compra">Agendar un turno</button></div></div>')
    + '</section></main>';
}
function vVender(){
  const w = U.w, enFlujo = w.flujo === 'vender';
  return '<main class="sitio"><section class="seccion"><div class="eyebrow">Vende o cambia tu celular</div><h1>Tu celular de antes vale</h1><p class="muted">Te lo compramos o lo tomamos a cuenta de un celular o accesorios. Por seguridad, solo recibimos equipos propios y sin reporte.</p></section>'
    + (enFlujo ? asistente() : '<div class="grid2"><div class="card">' + requisitosVenta() + '</div><div class="card"><h3>¿Cómo funciona?</h3><ol class="lista"><li>Elige tu marca y tu modelo.</li><li>Cuéntanos cómo está.</li><li>Agenda tu cita: revisamos el equipo contigo y te hacemos una oferta.</li></ol><div><button class="btn primary lg" type="button" data-act="flujo-vender">Empezar</button></div></div></div>')
    + '</main>';
}
function vDomicilio(){
  const c = T.cfg().domicilio;
  return '<main class="sitio"><section class="seccion"><div class="eyebrow">A domicilio</div><h1>Recolección y entrega a domicilio</h1><p class="muted">Si no puedes venir, pasamos por tu celular y te lo regresamos reparado.</p>'
    + '<dl class="kv"><dt>Disponible</dt><dd>' + (c.activo ? 'Sí' : PC) + '</dd><dt>Costo</dt><dd>' + (c.costo != null ? T.fmtMoney(c.costo) : PC) + '</dd><dt>Zona</dt><dd>' + (c.zona ? esc(c.zona) : PC) + '</dd></dl>'
    + '<div class="row"><button class="btn primary lg" type="button" data-act="flujo-domicilio">Cotizar y pedir recolección</button></div>'
    + '<p class="small muted">Primero cotizas como siempre; en el paso de la cita eliges “Recójanlo en mi domicilio”.</p></section></main>';
}
function vGarantia(){
  const c = T.cfg();
  return '<main class="sitio"><section class="seccion"><div class="eyebrow">Garantía</div><h1>Toda reparación se entrega con garantía</h1><p class="muted">Al entregarte tu equipo te damos un comprobante con la fecha hasta la que cubre la garantía. Con tu folio la consultas cuando quieras.</p>'
    + '<div class="tbl"><table class="t"><thead><tr><th>Servicio</th><th class="num">Garantía</th></tr></thead><tbody>' + T.PROBLEMAS.filter(p => p.id !== 'diagnostico').map(p => '<tr><td>' + esc(p.t) + '</td><td class="num">' + (c.garantias[p.id] ? c.garantias[p.id] + ' días' : PC) + '</td></tr>').join('')
    + '<tr><td>Celulares nuevos</td><td class="num">' + (c.garantiaEquipo.nuevo ? c.garantiaEquipo.nuevo + ' días' : PC) + '</td></tr><tr><td>Celulares seminuevos</td><td class="num">' + (c.garantiaEquipo.seminuevo ? c.garantiaEquipo.seminuevo + ' días' : PC) + '</td></tr></tbody></table></div>'
    + '<div class="grid2"><div class="card"><h3>Qué cubre</h3><p>' + (c.terminos.garantia ? esc(c.terminos.garantia) : 'Las condiciones de la garantía están ' + PC + '.') + '</p></div>'
    + '<div class="card"><h3>¿Algo falló?</h3><p>Agenda un turno con el motivo “Garantía” y trae tu folio.</p><div class="row"><button class="btn primary" type="button" data-act="flujo-cita" data-v="garantia">Agendar por garantía</button><button class="btn" type="button" data-act="sv" data-v="consulta">Consultar mi garantía</button></div></div></div></section></main>';
}

/* ---------- consulta por folio y celular ---------- */
const PASOS_ORDEN = [['recibido','Recibimos tu equipo'],['diagnostico','Lo estamos revisando'],['presupuesto','Te enviamos el presupuesto'],['autorizado','Autorizaste la reparación'],['reparacion','Lo estamos reparando'],['listo','Listo para entregar'],['entregado','Entregado']];
function lineaTiempo(r){
  const orden = PASOS_ORDEN.map(p => p[0]);
  const actual = r.estado === 'espera' ? 'reparacion' : r.estado === 'rechazado' ? 'presupuesto' : r.estado;
  const i = orden.indexOf(actual);
  return '<ol class="timeline">' + PASOS_ORDEN.map(([k, t], j) => '<li class="' + (j < i ? 'on' : j === i ? 'now' : '') + '"><div><b>' + esc(k === 'reparacion' && r.estado === 'espera' ? 'Esperando una refacción' : k === 'presupuesto' && r.estado === 'rechazado' ? 'No autorizaste la reparación' : t) + '</b>' + (j === i && r.promesa && r.estado !== 'entregado' ? '<span>Fecha estimada: ' + esc(T.fmtD(r.promesa)) + '</span>' : '') + '</div></li>').join('') + '</ol>';
}
function vResultado(){
  const q = U.q, r = q.res; if (!r) return '';
  if (r.tipo === 'cita'){
    const e = T.estadoDe(T.ESTADOS_CITA, r.estado);
    return '<article class="card"><div class="row"><h3>Cita <span class="mono">' + esc(r.folio) + '</span></h3><span class="spacer"></span>' + chip(e[2], e[1]) + '</div>'
      + '<dl class="kv"><dt>Turno</dt><dd><b>' + esc(r.turno) + '</b></dd><dt>Cuándo</dt><dd>' + esc(T.fmtDia(r.fecha)) + ' · ' + esc(r.hora) + '</dd><dt>Dónde</dt><dd>' + esc(r.modalidad === 'domicilio' ? 'En tu domicilio' : r.lugar) + '</dd><dt>Motivo</dt><dd>' + esc(T.MOTIVOS_CITA[r.motivo] || r.motivo) + '</dd>'
      + (r.cotizacion && r.cotizacion.problema ? '<dt>Cotización</dt><dd>' + esc(T.PROB[r.cotizacion.problema] ? T.PROB[r.cotizacion.problema].t : '') + ' · ' + esc(r.cotizacion.equipo || '') + '</dd>' : '') + '</dl>'
      + (r.orden ? '<p class="callout info"><strong>Tu equipo quedó registrado</strong>Su orden es <span class="mono">' + esc(r.orden) + '</span>. <button class="linkbtn" type="button" data-act="q-orden" data-v="' + esc(r.orden) + '">Ver cómo va</button></p>' : '')
      + (r.estado === 'agendada' ? (q.cancelando ? '<div class="stack tight"><label class="f" for="q-mot">¿Por qué cancelas?<select id="q-mot" data-bind="q.motivo"><option value="cliente">Ya no la necesito</option><option value="reprogramo">Voy a agendar otro día</option><option value="otro">Otro motivo</option></select></label><div class="row"><button class="btn danger" type="button" data-act="q-cancelar-ok">Cancelar mi cita</button><button class="btn quiet" type="button" data-act="q-cancelar">No, conservarla</button></div></div>' : '<div><button class="btn" type="button" data-act="q-cancelar">Cancelar esta cita</button></div>') : '')
      + '</article>';
  }
  const e = T.estadoDe(T.ESTADOS_ORDEN, r.estado);
  const saldo = r.total != null ? Math.max(0, r.total - (r.pagado || 0)) : null;
  return '<article class="card"><div class="row"><h3>Orden <span class="mono">' + esc(r.folio) + '</span></h3><span class="spacer"></span>' + chip(e[2], e[1]) + '</div>'
    + '<p class="muted">' + esc(r.equipo) + ' · ' + esc(T.PROB[r.problema] ? T.PROB[r.problema].t : '') + '</p>'
    + '<div class="grid2"><div>' + lineaTiempo(r) + '</div><div class="stack tight">'
    + (r.diagnostico ? '<div><h4>Diagnóstico</h4><p>' + esc(r.diagnostico) + '</p></div>' : '')
    + (r.lineas.length ? '<div class="tbl"><table class="t"><thead><tr><th>Concepto</th><th class="num">Importe</th></tr></thead><tbody>' + r.lineas.map(l => '<tr><td>' + esc(l.desc) + (l.cant > 1 ? ' × ' + l.cant : '') + '</td><td class="num">' + T.precioTxt(l.precio == null ? null : l.precio * l.cant) + '</td></tr>').join('') + '</tbody><tfoot><tr><td>Total</td><td class="num">' + T.fmtMoney(r.total) + '</td></tr>' + (r.pagado ? '<tr><td>Pagado</td><td class="num">' + T.fmtMoney(r.pagado) + '</td></tr><tr><td>Saldo</td><td class="num">' + T.fmtMoney(saldo) + '</td></tr>' : '') + '</tfoot></table></div>' : '')
    + (r.estado === 'presupuesto' ? (q.rechazando
        ? '<div class="stack tight"><label class="f" for="q-rech">¿Por qué no lo autorizas?<select id="q-rech" data-bind="q.motivo">' + T.ents(T.RECHAZOS).map(([k, v]) => '<option value="' + k + '"' + (q.motivo === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label><div class="row"><button class="btn danger" type="button" data-act="q-autorizar" data-v="no">No autorizo</button><button class="btn quiet" type="button" data-act="q-rechazar">Volver</button></div></div>'
        : '<div class="callout spot"><strong>Necesitamos tu autorización</strong>No reparamos nada sin tu visto bueno.</div><div class="row"><button class="btn primary" type="button" data-act="q-autorizar" data-v="si">Autorizo la reparación</button><button class="btn" type="button" data-act="q-rechazar">No autorizo</button></div>') : '')
    + (r.garantiaHasta ? '<p class="callout info"><strong>Garantía</strong>Vigente hasta el ' + esc(T.fmtD(r.garantiaHasta)) + '.</p>' : '')
    + '</div></div>'
    + (r.historial.length ? '<details><summary>Historial</summary><ul class="log">' + r.historial.slice().reverse().map(h => '<li><span class="h">' + esc(T.fmtD(h.fecha)) + (h.hora ? ' · ' + esc(h.hora) : '') + '</span>' + esc(h.nota) + '</li>').join('') + '</ul></details>' : '')
    + '</article>';
}
function vConsulta(){
  const q = U.q;
  return '<main class="sitio"><section class="seccion consulta"><div class="eyebrow">Mi cita y mi equipo</div><h1>Consulta tu cita o tu reparación</h1><p class="muted">Escribe el folio que te dimos (empieza con CT si es una cita u OS si es una orden) y tu celular.</p>'
    + '<form class="panel consulta-f" data-form="consultar"><label class="f" for="q-folio">Folio<input id="q-folio" data-bind="q.folio" value="' + esc(q.folio) + '" placeholder="CT-… u OS-…" autocapitalize="characters" autocomplete="off"></label>'
    + '<label class="f" for="q-tel">Celular<input id="q-tel" type="tel" inputmode="numeric" data-bind="q.tel" value="' + esc(q.tel) + '" placeholder="10 dígitos"></label>'
    + '<button class="btn primary" type="submit"' + (q.buscando ? ' disabled' : '') + '>' + (q.buscando ? 'Buscando…' : 'Consultar') + '</button></form>'
    + (q.err ? '<p class="err" role="alert">' + esc(q.err) + '</p>' : '') + vResultado() + '</section></main>';
}

function vista(){
  const v = { inicio:vInicio, accesorios:vAccesorios, celulares:vCelulares, vender:vVender, domicilio:vDomicilio, garantia:vGarantia, consulta:vConsulta }[U.sv] || vInicio;
  return barra() + v() + pie();
}
function despues(){
  if (U.wScroll){ U.wScroll = false; const el = document.getElementById('asistente'); if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block:'start' }); }
}
function nuevoAsistente(flujo, extra){ U.w = Object.assign(T.clone(W0), { flujo, paso:FLUJOS[flujo][0] }, extra || {}); }
async function buscar(){
  const q = U.q;
  if (!q.folio.trim() || T.digitos(q.tel).length !== 10){ q.err = 'Escribe tu folio y tu celular de 10 dígitos.'; return T.scheduleRender(); }
  q.buscando = true; q.err = ''; q.res = null; T.scheduleRender();
  try { q.res = await T.consultar(q.folio, q.tel); if (!q.res) q.err = 'No encontramos ese folio con ese celular. Revisa que estén bien escritos.'; }
  catch (e) { q.err = 'No se pudo consultar: ' + e.message; }
  q.buscando = false; q.rechazando = false; q.cancelando = false; T.scheduleRender();
}

T.registrar('sitio', {
  barra, vista, despues, acceso:'publico',
  estado:{ sv:'inicio', w:T.clone(W0), q:{ folio:'', tel:'', res:null, err:'', buscando:false, motivo:'precio', rechazando:false, cancelando:false }, cat:'', celCond:'', wScroll:false },
  alEntrar(){
    const p = new URLSearchParams(location.search);
    if (p.get('folio')){ U.sv = 'consulta'; U.q.folio = p.get('folio').toUpperCase(); }
  },
  acciones:{
    sv(d){ U.sv = d.v; if (d.v === 'inicio' && U.w.flujo !== 'reparar') nuevoAsistente('reparar'); T.scheduleRender(); window.scrollTo(0, 0); },
    cat(d){ U.cat = d.v; T.scheduleRender(); },
    cel(d){ U.celCond = d.v; T.scheduleRender(); },
    'w-ir'(d){ ir(d.v); },
    'w-atras'(){ const p = FLUJOS[U.w.flujo], i = p.indexOf(U.w.paso); if (i > 0) ir(p[i - 1]); },
    'w-problema'(d){ U.w.problema = d.v; ir('marca'); },
    'w-marca'(d){ const w = U.w; if (w.marca !== d.v){ w.modeloId = ''; w.modeloTexto = ''; w.busca = ''; } w.marca = d.v; w.sinModelo = d.v === 'Otra'; ir('modelo'); },
    'w-modelo'(d){ const w = U.w; w.modeloId = d.v; w.modeloTexto = ''; w.opcion = ''; ir(w.flujo === 'vender' ? 'estado' : 'cotizacion'); },
    'w-sin-modelo'(){ U.w.sinModelo = !U.w.sinModelo; U.w.modeloId = ''; T.scheduleRender(); },
    'w-motivo'(d){ U.w.motivo = d.v; ir('cita'); },
    'w-dia'(d){ U.w.fecha = d.v; U.w.hora = ''; T.scheduleRender(); },
    'w-hora'(d){ U.w.hora = d.v; U.w.err = ''; T.scheduleRender(); },
    'w-estado-ok'(){ const w = U.w; if (!w.condicion){ w.err = 'Elige cómo está tu equipo.'; return T.scheduleRender(); } ir('cita'); },
    'w-nuevo'(){ nuevoAsistente('reparar'); U.sv = 'inicio'; T.scheduleRender(); window.scrollTo(0, 0); },
    'flujo-vender'(){ nuevoAsistente('vender'); U.sv = 'vender'; T.scheduleRender(); },
    'flujo-cita'(d){ nuevoAsistente('cita', { motivo:d.v, paso:'cita' }); U.sv = 'inicio'; T.scheduleRender(); window.scrollTo(0, 0); },
    'flujo-domicilio'(){ nuevoAsistente('reparar', { modalidad:'domicilio' }); U.sv = 'inicio'; T.scheduleRender(); window.scrollTo(0, 0); },
    apartar(d){ nuevoAsistente('cita', { motivo:'compra', paso:'cita', productoId:d.p || '', equipoId:d.e || '' }); U.sv = 'inicio'; T.scheduleRender(); window.scrollTo(0, 0); },
    'ver-cita'(){ const h = U.w.hecho; U.q.folio = h.folio; U.q.tel = U.w.tel; U.sv = 'consulta'; buscar(); window.scrollTo(0, 0); },
    'q-orden'(d){ U.q.folio = d.v; buscar(); },
    'q-rechazar'(){ U.q.rechazando = !U.q.rechazando; T.scheduleRender(); },
    'q-cancelar'(){ U.q.cancelando = !U.q.cancelando; U.q.motivo = 'cliente'; T.scheduleRender(); },
    async 'q-autorizar'(d){
      const q = U.q;
      try { q.res = await T.autorizarFuera(q.folio, q.tel, d.v, d.v === 'no' ? q.motivo : '', 'sitio'); q.rechazando = false; T.toast(d.v === 'si' ? 'Gracias. Autorizaste la reparación; te avisamos cuando esté lista.' : 'Listo. Registramos que no autorizas; tu equipo se devuelve sin reparar.'); }
      catch (e) { T.toast(e.message, 'crit'); }
      T.scheduleRender();
    },
    async 'q-cancelar-ok'(){
      const q = U.q;
      try { q.res = await T.cancelarFuera(q.folio, q.tel, q.motivo); q.cancelando = false; T.toast('Cancelamos tu cita.'); await T.cargarOcupacion(); }
      catch (e) { T.toast(e.message, 'crit'); }
      T.scheduleRender();
    }
  },
  formularios:{
    consultar:buscar,
    'w-modelo-texto'(){
      const w = U.w;
      if (w.marca === 'Otra' && !w.marcaTexto.trim()){ T.toast('Escribe la marca de tu celular.', 'warn'); return; }
      if (!w.modeloTexto.trim()){ T.toast('Escribe el modelo de tu celular.', 'warn'); return; }
      w.modeloId = ''; ir(w.flujo === 'vender' ? 'estado' : 'cotizacion');
    },
    async 'w-agendar'(){
      const w = U.w;
      if (!w.fecha || !w.hora){ w.err = 'Elige el día y la hora de tu cita.'; return T.scheduleRender(); }
      if (w.nombre.trim().length < 2){ w.err = 'Escribe tu nombre.'; return T.scheduleRender(); }
      if (T.digitos(w.tel).length !== 10){ w.err = 'Escribe tu celular a 10 dígitos para avisarte por WhatsApp.'; return T.scheduleRender(); }
      if (w.modalidad === 'domicilio' && w.direccion.trim().length < 8){ w.err = 'Escribe tu dirección completa para la recolección.'; return T.scheduleRender(); }
      if (!w.privacidad){ w.err = 'Necesitamos tu permiso para usar tus datos en tu cita.'; return T.scheduleRender(); }
      const motivo = w.flujo === 'reparar' ? 'reparacion' : w.flujo === 'vender' ? 'venta' : w.motivo;
      const cot = w.flujo === 'cita' ? (w.productoId || w.equipoId ? { tipo:'compra', productoId:w.productoId || null, equipoId:w.equipoId || null, equipo:w.productoId ? T.prodNombre(w.productoId) : equipoVenta(S.equipos[w.equipoId]) } : w.ordenFolio ? { tipo:'entrega', ordenFolio:w.ordenFolio.trim().toUpperCase() } : null)
        : { tipo:w.flujo === 'vender' ? 'venta' : 'reparacion', problema:w.problema || null, modeloId:w.modeloId || null, marca:w.marca === 'Otra' ? w.marcaTexto.trim() : w.marca, modeloTexto:w.modeloTexto.trim(), equipo:equipoElegido(),
            tarifaId:w.opcion || null, precio:w.opcion && S.tarifas[w.opcion] ? S.tarifas[w.opcion].precio : null, condicion:w.condicion || null, capacidad:w.capacidad || null, preferencia:w.flujo === 'vender' ? w.preferencia : null };
      w.enviando = true; w.err = ''; T.scheduleRender();
      try {
        w.hecho = await T.agendar({ fecha:w.fecha, hora:w.hora, motivo, modalidad:w.modalidad, direccion:w.modalidad === 'domicilio' ? w.direccion.trim() : '', nota:w.nota.trim(), origen:'sitio', cotizacion:cot, contacto:{ nombre:w.nombre.trim(), tel:w.tel, correo:w.correo.trim(), tecmi:w.tecmi } });
        w.paso = 'listo'; U.wScroll = true;
        T.cargarOcupacion();
      } catch (e) { w.err = e.message; }
      w.enviando = false; T.scheduleRender();
    }
  }
});
})();
