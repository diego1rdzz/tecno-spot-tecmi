/* Portada de la versión publicada: las tres herramientas comparten la misma base. */
(function(){
'use strict';
const T = window.TS, esc = T.esc;
const HERR = [
  ['sitio','Sitio público','El cliente elige el problema, su marca y su modelo, recibe su cotización y agenda su cita con turno en la cafetería.','diagnostico'],
  ['consola','Consola interna','Turnos del día, órdenes de servicio, punto de venta, compra y toma a cuenta, inventario, precios, caja y garantías.','folio'],
  ['portal','Mi cuenta (portal)','El cliente ve sus reparaciones, autoriza su presupuesto, agenda citas y consulta sus garantías.','celular']
];
T.registrar('inicio', {
  barra(){ return T.barra('Sistema', '', ''); },
  vista(){
    return T.barra('Sistema', '', '') + '<main><div class="stack" style="max-width:900px;margin:0 auto"><div class="stack tight"><div class="eyebrow">' + esc(T.empresa().sucursal ? 'Sucursal ' + T.empresa().sucursal : '') + '</div><h1 style="font-size:32px">Sistema ' + esc(T.empresa().nombre) + '</h1>'
      + '<p class="muted">Tres herramientas sobre los mismos datos: lo que agenda un cliente en el sitio aparece en los turnos de la consola, y lo que hace el taller lo ve el cliente con su folio.</p></div>'
      + '<div class="grid2">' + HERR.map(([k, t, d, i]) => '<a class="card" href="#' + k + '" style="text-decoration:none;color:inherit">' + T.icono(i) + '<h3>' + esc(t) + '</h3><p class="muted">' + esc(d) + '</p><span class="btn sm primary" style="justify-self:start">Abrir</span></a>').join('') + '</div>'
      + '<p class="note">Datos de demostración. Todo lo que dice “por confirmar” espera el dato real del negocio.</p></div></main>';
  },
  acceso:'publico'
});
})();
