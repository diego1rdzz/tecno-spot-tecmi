"""Arma las herramientas de Tecno-Spot.

Uso:  python3 prototipo/build.py [carpeta_para_publicar]

Escribe en prototipo/dist/ tres archivos que se abren directo en el
navegador en modo local, con datos de demostración (comparten el mismo
almacenamiento del navegador, así que sus datos coinciden):

  sitio.html     sitio público: cotiza y agenda tu cita con turno
  portal.html    portal de clientes
  consola.html   consola interna

Escribe también web/sitio/, web/portal/ y web/consola/ (un index.html cada
una) para publicarlas en Vercel. Si existe supabase/config.json
({"url": ..., "key": ..., "enlaces": {"sitio": ..., "portal": ..., "consola": ...}}),
se conectan a esa base de Supabase y no llevan datos de demostración; si no,
trabajan en modo local con la demostración.

Con una carpeta como argumento escribe además las demostraciones para publicar
en Claude: tecno-spot-sitio.html, tecno-spot-consola.html y
tecno-spot-portal.html (cada herramienta por separado, con sus propios datos
de demostración) y sistema-tecno-spot.html (las tres juntas, #sitio, #portal,
#consola). La plataforma de publicación pone <!doctype>, <head> y <body>.
"""
import json
import pathlib
import sys

import catalogo

AQUI = pathlib.Path(__file__).resolve().parent
leer = lambda p: (AQUI / p).read_text(encoding="utf-8")

BASE = catalogo.base()
DEMO = catalogo.con_demo(BASE)
FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800'
           '&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">\n')
SUPABASE_JS = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js"></script>\n'
CONFIG = AQUI.parent / "supabase" / "config.json"
DESCRIPCION = "Reparación de celulares en la cafetería de Tecmilenio: cotiza en línea y agenda tu cita con turno."


def js(texto):
    return "<script>\n" + texto.replace("</script", "<\\/script") + "\n</script>\n"


def json_html(datos):
    return json.dumps(datos, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def fragmento(titulo, herramientas, enlaces, inicial, datos, portada=False, supa=None, artifact=False):
    css = leer("comun/base.css") + "".join(leer(f"{h}/{h}.css") for h in herramientas)
    guion = "window.TS_LINKS = %s;" % json.dumps(enlaces)
    if artifact:
        guion += "\nwindow.TS_ARTIFACT = true;"
    if supa:
        guion += "\nwindow.TS_SUPABASE = %s;" % json.dumps({"url": supa["url"], "key": supa["key"]})
    partes = [leer("comun/nucleo.js")]
    for h in herramientas:
        partes += [leer(f"{h}/{p.name}") for p in sorted((AQUI / h).glob("*.js"))]
    if portada:
        partes.append(leer("comun/inicio.js"))
    partes.append("window.TS.start(%s);" % json.dumps(inicial))
    return (f"<title>{titulo}</title>\n" + f'<meta name="description" content="{DESCRIPCION}">\n' + FUENTES
            + "<style>\n" + css + "</style>\n"
            + '<div id="app"></div>\n'
            + '<script type="application/json" id="datos">' + json_html(datos) + "</script>\n"
            + (SUPABASE_JS if supa else "") + js(guion) + "".join(js(p) for p in partes))


def documento(frag):
    cabeza, cuerpo = frag.split('<div id="app">', 1)
    return ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="theme-color" content="#0B1B2B">\n'
            + cabeza + '</head>\n<body>\n<div id="app">' + cuerpo + "</body>\n</html>\n")


dist = AQUI / "dist"
dist.mkdir(exist_ok=True)
sueltos = {
    "sitio": ("Tecno-Spot · Reparación de celulares", {"inicio": "sitio.html", "portal": "portal.html"}),
    "portal": ("Mi cuenta · Tecno-Spot", {"inicio": "portal.html", "sitio": "sitio.html"}),
    "consola": ("Consola · Tecno-Spot", {"inicio": "consola.html", "sitio": "sitio.html"}),
}
for nombre, (titulo, enlaces) in sueltos.items():
    (dist / f"{nombre}.html").write_text(documento(fragmento(titulo, [nombre], enlaces, nombre, DEMO)), encoding="utf-8")
    print("escrito", dist / f"{nombre}.html")

# Versión separada para Vercel: una carpeta por herramienta.
supa = json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else None
dominios = (supa or {}).get("enlaces", {})
web = AQUI.parent / "web"
for nombre, (titulo, _) in sueltos.items():
    enlaces = {"inicio": "/"}
    if dominios.get("portal") and nombre == "sitio":
        enlaces["portal"] = dominios["portal"]
    if dominios.get("sitio") and nombre != "sitio":
        enlaces["sitio"] = dominios["sitio"]
    carpeta = web / nombre
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / "index.html").write_text(documento(fragmento(titulo, [nombre], enlaces, nombre, BASE if supa else DEMO, supa=supa)), encoding="utf-8")
    print("escrito", carpeta / "index.html", "(Supabase)" if supa else "(modo local con demostración: falta supabase/config.json)")

# Demostraciones publicadas en Claude: cada herramienta en su propia página, y las tres juntas.
# Las direcciones ya publicadas (prototipo/artifacts.json) sirven para enlazarlas entre sí.
if len(sys.argv) > 1:
    salida = pathlib.Path(sys.argv[1])
    publicadas = json.loads(leer("artifacts.json")) if (AQUI / "artifacts.json").exists() else {}
    separadas = {"sitio": "Sitio Tecno-Spot", "consola": "Consola Tecno-Spot", "portal": "Portal Tecno-Spot"}
    for nombre, titulo in separadas.items():
        enlaces = {"inicio": "#"}
        # El sitio y el portal se enlazan entre sí; la consola no, porque el visor no pasa ?folio= a la página.
        if nombre in ("sitio", "portal"):
            enlaces.update({k: v for k, v in publicadas.items() if k in ("sitio", "portal") and k != nombre})
        destino = salida / f"tecno-spot-{nombre}.html"
        destino.write_text(fragmento(titulo, [nombre], enlaces, nombre, DEMO, artifact=True), encoding="utf-8")
        print("escrito", destino)
    destino = salida / "sistema-tecno-spot.html"
    destino.write_text(fragmento("Sistema Tecno-Spot", ["sitio", "portal", "consola"],
                                 {"inicio": "#inicio", "portal": "#portal", "sitio": "#sitio"}, "inicio", DEMO, portada=True, artifact=True),
                       encoding="utf-8")
    print("escrito", destino)
