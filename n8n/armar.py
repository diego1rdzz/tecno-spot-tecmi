"""Arma n8n/tecno-spot-avisos.json, el flujo para importar en n8n.

Uso: python3 n8n/armar.py

El código del nodo "Revisar y redactar" vive en n8n/redactar.js para poder
leerlo y probarlo; este script lo mete en el flujo. El secreto y la dirección
del sitio se pegan después en n8n (nunca en este repositorio, que es público).
"""
import json
import pathlib
import uuid

AQUI = pathlib.Path(__file__).resolve().parent
ns = uuid.UUID("6f1d3c52-2a0b-4c7e-9d5e-1a2b3c4d5e6f")
uid = lambda nombre: str(uuid.uuid5(ns, nombre))

NOTA = """## Tecno-Spot · avisos

Supabase manda aquí cada aviso: citas nuevas, reprogramadas y canceladas; presupuestos; equipos listos y entregados; recordatorios (19:00) y el reporte del día (21:00).

1. En **Revisar y redactar** pega el secreto (`select secreto from privado.n8n;` en Supabase) y la dirección del sitio.
2. Cambia los tres nodos grises por tus canales: Telegram, WhatsApp o correo. El texto va en `{{ $json.texto }}` y el número del cliente en `{{ $json.whatsapp }}`.
3. Activa el flujo y copia la *Production URL* del primer nodo a Supabase:
   `update privado.n8n set url = '…';`"""

nodos = [
    {"parameters": {"content": NOTA, "height": 380, "width": 460}, "id": uid("nota"), "name": "Cómo se configura",
     "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-520, -160]},
    {"parameters": {"httpMethod": "POST", "path": "tecno-spot", "responseMode": "onReceived", "options": {}},
     "id": uid("webhook"), "name": "Avisos de Supabase", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
     "position": [0, 0], "webhookId": uid("webhook-id")},
    {"parameters": {"jsCode": (AQUI / "redactar.js").read_text(encoding="utf-8")}, "id": uid("code"),
     "name": "Revisar y redactar", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 0]},
    {"parameters": {"mode": "expression", "numberOutputs": 3, "output": "={{ { negocio: 0, cliente: 1, direccion: 2 }[$json.canal] }}"},
     "id": uid("switch"), "name": "¿A quién va?", "type": "n8n-nodes-base.switch", "typeVersion": 3, "position": [480, 0]},
]
salidas = ["Aviso al negocio (cambia por tu canal)", "Mensaje al cliente (cambia por WhatsApp)", "Reporte a dirección (cambia por correo)"]
for i, nombre in enumerate(salidas):
    nodos.append({"parameters": {}, "id": uid(nombre), "name": nombre, "type": "n8n-nodes-base.noOp", "typeVersion": 1, "position": [760, -160 + i * 160]})

flujo = {
    "name": "Tecno-Spot · avisos",
    "nodes": nodos,
    "connections": {
        "Avisos de Supabase": {"main": [[{"node": "Revisar y redactar", "type": "main", "index": 0}]]},
        "Revisar y redactar": {"main": [[{"node": "¿A quién va?", "type": "main", "index": 0}]]},
        "¿A quién va?": {"main": [[{"node": n, "type": "main", "index": 0}] for n in salidas]},
    },
    "settings": {"executionOrder": "v1", "timezone": "America/Monterrey"},
    "active": False,
    "pinData": {},
}
destino = AQUI / "tecno-spot-avisos.json"
destino.write_text(json.dumps(flujo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("escrito", destino)
