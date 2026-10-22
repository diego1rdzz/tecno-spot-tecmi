(function(){ const T = window.TS; T.registrar('consola', { barra(){ return T.barra('consola'); }, vista(){ return T.barra('consola') + '<main>En construcción</main>'; }, acceso:'publico' }); })();
