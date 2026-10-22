"""Catálogo real de Tecno-Spot, leído de los archivos de datos/.

  datos/modelos.csv    marca,modelo,gama                  (lista inicial; se edita en la consola)
  datos/precios.csv    marca,modelo,problema,calidad,precio,tiempo,garantia_dias
  datos/productos.csv  categoria,nombre,marca,compatible,precio,sku,minimo
  datos/empresa.json   datos confirmados del negocio (dirección, WhatsApp, horario…)

Lo que está vacío se muestra "por confirmar". Los costos nunca se escriben
aquí: el repositorio es público; se capturan en la consola.
"""
import csv
import json
import pathlib
import unicodedata

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"
PROBLEMAS = ["pantalla", "bateria", "carga", "bocina", "microfono", "camara", "tapa", "humedad", "botones", "software", "liberacion", "mantenimiento", "diagnostico"]
CATEGORIAS = ["fundas", "micas", "privacidad", "hidrogel", "cargadores", "baterias", "audio", "relojes", "refacciones"]


def slug(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    out, guion = [], False
    for c in s:
        if c.isascii() and c.isalnum():
            out.append(c)
            guion = False
        elif not guion:
            out.append("-")
            guion = True
    return "".join(out).strip("-")


def modelo_id(marca, modelo):
    return slug(marca + " " + modelo)


def tarifa_id(modelo, problema, calidad):
    return f"{modelo}|{problema}|{slug(calidad) or 'unica'}"


def _filas(nombre):
    ruta = DATOS / nombre
    if not ruta.exists():
        return []
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return [{k.strip(): (v or "").strip() for k, v in fila.items() if k} for fila in csv.DictReader(f)]


def _numero(v, campo, fila):
    if v == "":
        return None
    try:
        n = float(v.replace("$", "").replace(",", ""))
    except ValueError:
        raise SystemExit(f"{campo} no es un número en {fila}")
    return int(n) if n.is_integer() else n


def base():
    """Colecciones con datos reales: config, modelos, tarifas, productos y existencias."""
    modelos = {}
    for i, f in enumerate(_filas("modelos.csv")):
        mid = modelo_id(f["marca"], f["modelo"])
        modelos[mid] = {"marca": f["marca"], "modelo": f["modelo"], "gama": f.get("gama") or "media", "orden": i}

    tarifas = {}
    for f in _filas("precios.csv"):
        mid = modelo_id(f["marca"], f["modelo"])
        if mid not in modelos:
            raise SystemExit(f"precios.csv: el modelo {f['marca']} {f['modelo']} no está en modelos.csv")
        if f["problema"] not in PROBLEMAS:
            raise SystemExit(f"precios.csv: problema '{f['problema']}' no existe. Usa uno de: {', '.join(PROBLEMAS)}")
        tarifas[tarifa_id(mid, f["problema"], f.get("calidad", ""))] = {
            "modeloId": mid, "problema": f["problema"], "calidad": f.get("calidad", ""),
            "precio": _numero(f.get("precio", ""), "precio", f), "tiempo": f.get("tiempo") or None,
            "garantiaDias": _numero(f.get("garantia_dias", ""), "garantia_dias", f), "refaccionId": None}

    productos, existencias = {}, {}
    for f in _filas("productos.csv"):
        if f["categoria"] not in CATEGORIAS:
            raise SystemExit(f"productos.csv: categoría '{f['categoria']}' no existe. Usa una de: {', '.join(CATEGORIAS)}")
        pid = "pr-" + (slug(f.get("sku")) or slug(f["nombre"] + " " + f.get("compatible", "")))
        productos[pid] = {"nombre": f["nombre"], "tipo": "refaccion" if f["categoria"] == "refacciones" else "accesorio", "categoria": f["categoria"],
                          "marca": f.get("marca", ""), "compat": f.get("compatible", ""), "precio": _numero(f.get("precio", ""), "precio", f), "sku": f.get("sku", "")}
        existencias[pid] = {"disp": 0, "apart": 0, "min": _numero(f.get("minimo", ""), "minimo", f)}

    empresa = json.loads((DATOS / "empresa.json").read_text(encoding="utf-8")) if (DATOS / "empresa.json").exists() else {}
    return {"config": {"general": empresa}, "modelos": modelos, "tarifas": tarifas, "productos": productos, "existencias": existencias}


def con_demo(b):
    """Base real + datos de demostración (solo para probar en el navegador)."""
    import demo
    d = demo.datos(tarifa_id)
    out = {k: dict(v) for k, v in b.items()}
    for col, docs in d.items():
        if col == "_ancla":
            out[col] = docs
        elif col == "config":
            g = dict(out.get("config", {}).get("general", {}))
            for k, v in docs["general"].items():
                g.setdefault(k, v)
            out["config"] = {"general": g}
        else:
            out.setdefault(col, {}).update(docs)
    return out
