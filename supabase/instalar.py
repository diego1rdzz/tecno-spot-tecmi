"""Genera los archivos SQL para pegar en Supabase > SQL Editor.

  supabase/instalar.sql  esquema, reglas por rol, funciones, ajustes iniciales y
                         lista de modelos. Sin datos de demostración. Se puede
                         correr varias veces: no borra ni pisa lo que ya existe.
  supabase/precios.sql   precios de reparación y productos de datos/precios.csv y
                         datos/productos.csv (solo si tienen filas). Al correrlo
                         se actualizan esos precios con los del archivo.

Uso: python3 supabase/instalar.py
"""
import json
import pathlib
import sys

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / "prototipo"))
import catalogo  # noqa: E402


def lit(texto):
    return "'" + texto.replace("'", "''") + "'"


def filas(tabla, docs, al_chocar):
    if not docs:
        return ""
    valores = ",\n".join(f"  ({lit(i)}, {lit(json.dumps(d, ensure_ascii=False, separators=(',', ':')))}::jsonb)" for i, d in docs.items())
    return f"insert into public.{tabla} (id, data) values\n{valores}\non conflict (id) do {al_chocar};\n\n"


base = catalogo.base()
esquema = (AQUI / "migrations" / "0001_esquema_y_reglas.sql").read_text(encoding="utf-8")
cabeza = ("-- Tecno-Spot · instalación (esquema, reglas, ajustes iniciales y modelos). Sin datos de demostración.\n"
          "-- Pegar completo en Supabase > SQL Editor > New query > Run. Si se corre otra vez no pasa nada:\n"
          "-- lo que ya existe se deja como está.\n\n")
datos = ("-- ---------- Datos iniciales ----------\n"
         + filas("config", base["config"], "nothing")
         + filas("modelos", base["modelos"], "nothing")
         + "select (select count(*) from public.modelos) as modelos, (select count(*) from public.config) as ajustes;\n")
(AQUI / "instalar.sql").write_text(cabeza + esquema.rstrip("\n") + "\n\n" + datos, encoding="utf-8")
print("escrito", AQUI / "instalar.sql", f"({len(base['modelos'])} modelos)")

precios = base["tarifas"], base["productos"]
destino = AQUI / "precios.sql"
if any(precios):
    texto = ("-- Tecno-Spot · precios de reparación y productos desde datos/*.csv. Actualiza los que ya existan.\n\n"
             + filas("tarifas", base["tarifas"], "update set data = excluded.data")
             + filas("productos", base["productos"], "update set data = public.productos.data || excluded.data")
             + filas("existencias", base["existencias"], "nothing"))
    destino.write_text(texto, encoding="utf-8")
    print("escrito", destino, f"({len(base['tarifas'])} precios, {len(base['productos'])} productos)")
elif destino.exists():
    destino.unlink()
