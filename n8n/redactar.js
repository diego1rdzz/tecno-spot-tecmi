// Tecno-Spot · nodo "Revisar y redactar" del flujo de n8n.
// Revisa que el aviso venga de Supabase y redacta el mensaje para cada quien:
//   canal "negocio"   → aviso al equipo de Tecno-Spot
//   canal "cliente"   → mensaje al cliente por WhatsApp (lleva su número con 52)
//   canal "direccion" → reporte del día
// Cambia estas dos líneas:
const SECRETO = 'PEGA_AQUI_EL_SECRETO';   // en Supabase: select secreto from privado.n8n;
const SITIO = '';                          // dirección del sitio, p. ej. https://tecno-spot.vercel.app (vacío = por confirmar)
const LUGAR = 'la cafetería de Tecmilenio'; // cómo se dice "en …" en los mensajes

const entrada = $input.first().json;
const cabeceras = entrada.headers || {};
if (cabeceras['x-tecno-spot'] !== SECRETO) {
  throw new Error('Aviso rechazado: el secreto no coincide. Copia el de Supabase (select secreto from privado.n8n).');
}
const { evento, datos = {} } = entrada.body || {};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha = iso => { if (!iso) return ''; const [a, m, d] = iso.split('-').map(Number); return DIAS[new Date(a, m - 1, d).getDay()] + ' ' + d + ' de ' + MESES[m - 1]; };
const dinero = n => '$' + Number(n || 0).toFixed(Number(n) % 1 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nombre1 = n => String(n || '').trim().split(/\s+/)[0] || '';
const PROBLEMAS = { pantalla: 'pantalla', bateria: 'batería', carga: 'carga', bocina: 'bocina', microfono: 'micrófono', camara: 'cámara', tapa: 'tapa trasera', humedad: 'se mojó', botones: 'botones', software: 'software', liberacion: 'liberación', mantenimiento: 'mantenimiento', diagnostico: 'diagnóstico' };
const MOTIVOS = { reparacion: 'Reparación', entrega: 'Recoger equipo', duda: 'Duda o revisión', compra: 'Comprar', venta: 'Vender o cambiar celular', garantia: 'Garantía' };
const RECHAZOS = { precio: 'precio', tiempo: 'tiempo de reparación', noconviene: 'prefiere comprar otro equipo', sinarreglo: 'no tiene arreglo', otro: 'otro motivo' };
const enlace = folio => SITIO ? ' Puedes verlo aquí: ' + SITIO.replace(/\/?$/, '/') + '?folio=' + encodeURIComponent(folio) : '';
const donde = d => d.modalidad === 'domicilio' ? 'en tu domicilio' : 'en ' + LUGAR;

const salida = [];
const negocio = texto => salida.push({ canal: 'negocio', evento, folio: datos.folio || '', texto });
const cliente = (d, texto) => { const tel = String(d.tel || '').replace(/\D/g, '').slice(-10); if (tel.length === 10) salida.push({ canal: 'cliente', evento, folio: d.folio || '', nombre: d.nombre || '', tel, whatsapp: '52' + tel, texto }); };

switch (evento) {
  case 'cita_nueva': {
    const q = datos.cotizacion || {};
    const que = [PROBLEMAS[q.problema], q.equipo].filter(Boolean).join(' · ');
    negocio('Nueva cita ' + datos.folio + ' · turno ' + datos.turno + ', ' + fecha(datos.fecha) + ' a las ' + datos.hora + '\n'
      + datos.nombre + ' (' + datos.tel + ')' + (datos.tecmi ? ' · comunidad Tecmilenio' : '') + '\n'
      + (MOTIVOS[datos.motivo] || datos.motivo) + (que ? ': ' + que : '') + (q.precio != null ? ' · cotizado en ' + dinero(q.precio) : '')
      + (datos.modalidad === 'domicilio' ? '\nA domicilio: ' + (datos.direccion || 'sin dirección') : '') + (datos.nota ? '\nNota: ' + datos.nota : ''));
    cliente(datos, 'Hola ' + nombre1(datos.nombre) + ', tu cita en Tecno-Spot quedó para el ' + fecha(datos.fecha) + ' a las ' + datos.hora + ' (turno ' + datos.turno + ') ' + donde(datos) + '. Tu folio es ' + datos.folio + '.');
    break;
  }
  case 'cita_reprogramada':
    negocio('Cita ' + datos.folio + ' de ' + datos.nombre + ' cambió de ' + datos.antes + ' a ' + fecha(datos.fecha) + ' ' + datos.hora + ' (turno ' + datos.turno + ').');
    cliente(datos, 'Hola ' + nombre1(datos.nombre) + ', tu cita en Tecno-Spot ahora es el ' + fecha(datos.fecha) + ' a las ' + datos.hora + ' (turno ' + datos.turno + '). Folio ' + datos.folio + '.');
    break;
  case 'cita_cancelada':
    negocio('Se canceló la cita ' + datos.folio + ' de ' + datos.nombre + ' (' + fecha(datos.fecha) + ' ' + datos.hora + ').');
    break;
  case 'presupuesto_listo':
    cliente(datos, 'Hola ' + nombre1(datos.nombre) + ', ya revisamos tu ' + datos.equipo + '.' + (datos.diagnostico ? ' ' + datos.diagnostico : '') + ' El presupuesto es de ' + dinero(datos.total) + '. ¿Lo autorizas? Tu folio es ' + datos.folio + '.' + enlace(datos.folio));
    break;
  case 'presupuesto_autorizado':
    negocio(datos.nombre + ' autorizó el presupuesto de ' + datos.folio + ' (' + datos.equipo + ') por ' + dinero(datos.total) + '.' + (datos.estado === 'espera' ? ' Falta una refacción.' : ' Ya se puede reparar.'));
    break;
  case 'presupuesto_rechazado':
    negocio(datos.nombre + ' no autorizó ' + datos.folio + ' (' + datos.equipo + '): ' + (RECHAZOS[datos.motivo_rechazo] || 'sin motivo') + '. Hay que devolver el equipo.');
    break;
  case 'equipo_listo':
    cliente(datos, 'Hola ' + nombre1(datos.nombre) + ', tu ' + datos.equipo + ' ya está listo. Pasa por él a ' + LUGAR + ' con tu folio ' + datos.folio + '.' + (Number(datos.saldo) > 0 ? ' Saldo: ' + dinero(datos.saldo) + '.' : ''));
    break;
  case 'equipo_entregado':
    if (datos.garantiaHasta) cliente(datos, 'Gracias por confiar en Tecno-Spot, ' + nombre1(datos.nombre) + '. La garantía de tu ' + datos.equipo + ' cubre hasta el ' + fecha(datos.garantiaHasta) + '. Folio ' + datos.folio + '.');
    break;
  case 'recordatorios':
    (datos.citas || []).forEach(c => cliente(c, 'Hola ' + nombre1(c.nombre) + ', te recordamos tu cita de mañana en Tecno-Spot a las ' + c.hora + ' (turno ' + c.turno + ') ' + donde(c) + '. Folio ' + c.folio + '.'));
    break;
  case 'reporte_diario': {
    const c = datos.citas || {}, t = datos.taller || {}, k = datos.caja || {}, v = datos.ventas || {};
    const formas = Object.entries(k.por_forma || {}).map(([f, m]) => f + ' ' + dinero(m)).join(', ') || 'sin movimientos';
    salida.push({ canal: 'direccion', evento, texto: 'Tecno-Spot · reporte del ' + fecha(datos.fecha) + '\n\n'
      + 'Citas: ' + (c.total || 0) + ' (' + (c.atendidas || 0) + ' atendidas, ' + (c.no_asistieron || 0) + ' no asistieron, ' + (c.canceladas || 0) + ' canceladas' + (c.sin_cerrar ? ', ' + c.sin_cerrar + ' sin cerrar' : '') + '). Mañana: ' + (c.manana || 0) + '.\n'
      + 'Taller: ' + (t.recibidas || 0) + ' recibidos, ' + (t.entregadas || 0) + ' entregados, ' + (t.en_taller || 0) + ' en reparación, ' + (t.esperando_autorizacion || 0) + ' esperando autorización.\n'
      + 'Listos sin recoger: ' + ((t.listas_sin_recoger || []).map(x => x.folio).join(', ') || 'ninguno') + '.\n'
      + 'Atrasados: ' + ((t.atrasadas || []).map(x => x.folio + ' (prometido ' + x.promesa + ')').join(', ') || 'ninguno') + '.\n'
      + 'Caja: reparaciones ' + dinero(k.reparaciones) + ', ventas ' + dinero(k.ventas) + ', compras de usados ' + dinero(k.compras_de_usados) + '. Por forma de pago: ' + formas + '.\n'
      + 'Ventas: ' + (v.n || 0) + ' por ' + dinero(v.total) + '.' });
    break;
  }
  default:
    negocio('Aviso de prueba de Tecno-Spot: ' + JSON.stringify(datos));
}
return salida.map(json => ({ json }));
