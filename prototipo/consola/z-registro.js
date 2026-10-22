/* Registra la consola con todos sus módulos. Va al final: los demás archivos ya agregaron lo suyo. */
(function(){
'use strict';
const T = window.TS, C = window.TSC;
T.registrar('consola', {
  barra:C.barra, vista:C.vista, acceso:'interno',
  estado:C.estado, acciones:C.acciones, formularios:C.formularios,
  cambio(t){ for (const f of C.cambios) if (f(t)) return; }
});
})();
