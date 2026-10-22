"""Datos de demostración de Tecno-Spot.

Todo lo que está aquí es inventado para probar el sistema: clientes, citas,
órdenes, precios, costos y existencias. Va marcado con "demo" en pantalla y
nunca entra a la base real (supabase/instalar.sql no lo carga).

Las fechas se escriben relativas a ANCLA; el navegador las recorre para que
"hoy" siempre tenga turnos en la cafetería.
"""
import datetime

ANCLA = datetime.date(2026, 10, 22)


def d(dias):
    return (ANCLA + datetime.timedelta(days=dias)).isoformat()


def h(fecha, hora, autor, nota, publico=True):
    return {"fecha": fecha, "hora": hora, "autor": autor, "nota": nota, "publico": publico}


CHECK_OK = {k: "si" for k in ["enciende", "pantalla", "carga", "bocina", "microfono", "camaras", "botones", "biometria", "senal", "tapa"]}


def check(**cambios):
    c = dict(CHECK_OK)
    c.update(cambios)
    return c


def datos(tarifa_id):
    """tarifa_id(modelo_id, problema, calidad) arma el id igual que el navegador."""
    t13p_o = tarifa_id("apple-iphone-13", "pantalla", "Original")
    t13p_g = tarifa_id("apple-iphone-13", "pantalla", "Genérica")
    t13b = tarifa_id("apple-iphone-13", "bateria", "")
    t11p = tarifa_id("apple-iphone-11", "pantalla", "")
    t11b = tarifa_id("apple-iphone-11", "bateria", "")
    ta54p = tarifa_id("samsung-galaxy-a54", "pantalla", "")
    ta54c = tarifa_id("samsung-galaxy-a54", "carga", "")
    tg84p = tarifa_id("motorola-moto-g84", "pantalla", "")
    tn13c = tarifa_id("xiaomi-redmi-note-13", "carga", "")

    def tarifa(modelo, problema, calidad, precio, tiempo, refaccion):
        return {"modeloId": modelo, "problema": problema, "calidad": calidad, "precio": precio, "tiempo": tiempo, "refaccionId": refaccion, "demo": True}

    tarifas = {
        t13p_o: tarifa("apple-iphone-13", "pantalla", "Original", 3200, "2 horas", "pr-pant-13-o"),
        t13p_g: tarifa("apple-iphone-13", "pantalla", "Genérica", 1850, "2 horas", "pr-pant-13-g"),
        t13b: tarifa("apple-iphone-13", "bateria", "", 950, "1 hora", "pr-bat-13"),
        t11p: tarifa("apple-iphone-11", "pantalla", "", 1450, "2 horas", "pr-pant-11"),
        t11b: tarifa("apple-iphone-11", "bateria", "", 850, "1 hora", "pr-bat-11"),
        ta54p: tarifa("samsung-galaxy-a54", "pantalla", "", 2300, "1 día", "pr-pant-a54"),
        ta54c: tarifa("samsung-galaxy-a54", "carga", "", 650, "3 horas", "pr-carga-a54"),
        tg84p: tarifa("motorola-moto-g84", "pantalla", "", 1600, "1 día", "pr-pant-g84"),
        tn13c: tarifa("xiaomi-redmi-note-13", "carga", "", 550, "3 horas", "pr-carga-n13"),
    }

    def prod(nombre, tipo, categoria, precio, compat="", marca=""):
        return {"nombre": nombre, "tipo": tipo, "categoria": categoria, "precio": precio, "compat": compat, "marca": marca, "demo": True}

    productos = {
        "pr-pant-13-o": prod("Pantalla iPhone 13 · original", "refaccion", "refacciones", None, "iPhone 13"),
        "pr-pant-13-g": prod("Pantalla iPhone 13 · genérica", "refaccion", "refacciones", None, "iPhone 13"),
        "pr-bat-13": prod("Batería iPhone 13", "refaccion", "refacciones", None, "iPhone 13"),
        "pr-pant-11": prod("Pantalla iPhone 11", "refaccion", "refacciones", None, "iPhone 11"),
        "pr-bat-11": prod("Batería iPhone 11", "refaccion", "refacciones", None, "iPhone 11"),
        "pr-pant-a54": prod("Pantalla Galaxy A54", "refaccion", "refacciones", None, "Galaxy A54"),
        "pr-carga-a54": prod("Centro de carga Galaxy A54", "refaccion", "refacciones", None, "Galaxy A54"),
        "pr-pant-g84": prod("Pantalla Moto G84", "refaccion", "refacciones", None, "Moto G84"),
        "pr-carga-n13": prod("Centro de carga Redmi Note 13", "refaccion", "refacciones", None, "Redmi Note 13"),
        "pr-mica-13": prod("Mica de vidrio templado", "accesorio", "micas", 150, "iPhone 13 / 13 Pro / 14"),
        "pr-mica-a54": prod("Mica de vidrio templado", "accesorio", "micas", 150, "Galaxy A54"),
        "pr-priv-15": prod("Mica de privacidad", "accesorio", "privacidad", 250, "iPhone 15 / 16"),
        "pr-hidro": prod("Mica de hidrogel (corte a la medida)", "accesorio", "hidrogel", 200, "Cualquier modelo"),
        "pr-funda-13": prod("Funda transparente antigolpes", "accesorio", "fundas", 180, "iPhone 13"),
        "pr-funda-a54": prod("Funda uso rudo", "accesorio", "fundas", 220, "Galaxy A54"),
        "pr-carg-20": prod("Cargador USB-C 20 W", "accesorio", "cargadores", 290),
        "pr-cable-l": prod("Cable USB-C a Lightning 1 m", "accesorio", "cargadores", 190),
        "pr-power-10": prod("Batería portátil 10,000 mAh", "accesorio", "baterias", 450),
        "pr-airpods": prod("AirPods Pro (2.ª generación)", "accesorio", "audio", 4600, "", "Apple"),
        "pr-watch": prod("Apple Watch SE (2.ª generación) 40 mm", "accesorio", "relojes", 5200, "", "Apple"),
    }
    existencias = {
        "pr-pant-13-o": {"disp": 1, "apart": 0, "min": 1}, "pr-pant-13-g": {"disp": 2, "apart": 0, "min": 2},
        "pr-bat-13": {"disp": 3, "apart": 0, "min": 2}, "pr-pant-11": {"disp": 1, "apart": 0, "min": 1},
        "pr-bat-11": {"disp": 2, "apart": 0, "min": 2}, "pr-pant-a54": {"disp": 0, "apart": 0, "min": 1},
        "pr-carga-a54": {"disp": 2, "apart": 0, "min": 1}, "pr-pant-g84": {"disp": 0, "apart": 1, "min": 1},
        "pr-carga-n13": {"disp": 0, "apart": 0, "min": 1},
        "pr-mica-13": {"disp": 14, "apart": 0, "min": 5}, "pr-mica-a54": {"disp": 6, "apart": 0, "min": 5},
        "pr-priv-15": {"disp": 4, "apart": 0, "min": 3}, "pr-hidro": {"disp": 30, "apart": 0, "min": 10},
        "pr-funda-13": {"disp": 5, "apart": 0, "min": 3}, "pr-funda-a54": {"disp": 2, "apart": 0, "min": 3},
        "pr-carg-20": {"disp": 7, "apart": 0, "min": 3}, "pr-cable-l": {"disp": 9, "apart": 0, "min": 4},
        "pr-power-10": {"disp": 3, "apart": 0, "min": 2}, "pr-airpods": {"disp": 1, "apart": 0, "min": 1},
        "pr-watch": {"disp": 0, "apart": 0, "min": 1},
    }
    costos = {
        "pr-pant-13-o": {"costo": 2300}, "pr-pant-13-g": {"costo": 900}, "pr-bat-13": {"costo": 420},
        "pr-pant-11": {"costo": 700}, "pr-bat-11": {"costo": 380}, "pr-pant-a54": {"costo": 1500},
        "pr-carga-a54": {"costo": 180}, "pr-pant-g84": {"costo": 1250}, "pr-carga-n13": {"costo": 150},
        "pr-mica-13": {"costo": 35}, "pr-mica-a54": {"costo": 35}, "pr-priv-15": {"costo": 80}, "pr-hidro": {"costo": 45},
        "pr-funda-13": {"costo": 60}, "pr-funda-a54": {"costo": 85}, "pr-carg-20": {"costo": 140}, "pr-cable-l": {"costo": 70},
        "pr-power-10": {"costo": 230}, "pr-airpods": {"costo": 3900}, "pr-watch": {"costo": 4400},
        "eq-12": {"costo": 4800}, "eq-a15": {"costo": 2900}, "eq-g24": {"costo": 1900}, "eq-13": {"costo": 5200},
    }
    equipos = {
        "eq-12": {"marca": "Apple", "modelo": "iPhone 12", "modeloId": "apple-iphone-12", "capacidad": "128 GB", "color": "Azul", "condicion": "seminuevo", "bateria": 86, "imei": "350000000000121", "precio": 6900, "estado": "disponible", "origen": "Compra a cliente", "alta": d(-15), "demo": True},
        "eq-a15": {"marca": "Samsung", "modelo": "Galaxy A15", "modeloId": "samsung-galaxy-a15", "capacidad": "128 GB", "color": "Negro", "condicion": "nuevo", "bateria": None, "imei": "350000000000152", "precio": 3999, "estado": "disponible", "origen": "Proveedor", "alta": d(-30), "demo": True},
        "eq-g24": {"marca": "Motorola", "modelo": "Moto G24", "modeloId": "motorola-moto-g24", "capacidad": "128 GB", "color": "Gris", "condicion": "nuevo", "bateria": None, "imei": "350000000000243", "precio": 2799, "estado": "disponible", "origen": "Proveedor", "alta": d(-30), "demo": True},
        "eq-13": {"marca": "Apple", "modelo": "iPhone 13", "modeloId": "apple-iphone-13", "capacidad": "128 GB", "color": "Blanco", "condicion": "seminuevo", "bateria": 81, "imei": "350000000000134", "precio": None, "estado": "reacondicionar", "origen": "Compra a cliente", "compraId": "ce-1", "alta": d(-1), "demo": True},
    }

    def cliente(nombre, tel, tecmi, alta, disps=None, bit=None):
        return {"nombre": nombre, "tel": tel, "correo": "", "tecmi": tecmi, "alta": alta, "dispositivos": disps or [], "bitacora": bit or []}

    clientes = {
        "cl-ana": cliente("Ana Martínez", "8100000001", True, d(-120), [
            {"id": "eq-ana-1", "marca": "Apple", "modelo": "iPhone 13", "modeloId": "apple-iphone-13", "imei": "350000000000301", "color": "Rosa", "origen": "Reparación", "ref": "OS-260624-K7PQ", "alta": d(-120), "garantiaHasta": d(-30)}],
            [{"fecha": d(-120), "autor": "Mostrador 1", "tipo": "Entrega", "nota": "Entregado reparado · OS-260624-K7PQ"}]),
        "cl-luis": cliente("Luis Hernández", "8100000002", True, d(-3)),
        "cl-sofia": cliente("Sofía Garza", "8100000003", False, d(-25), [
            {"id": "eq-sof-1", "marca": "Apple", "modelo": "iPhone 13", "modeloId": "apple-iphone-13", "imei": "350000000000302", "color": "Azul", "origen": "Reparación", "ref": "OS-261002-M3RT", "alta": d(-20), "garantiaHasta": d(70)}]),
        "cl-diego": cliente("Diego Treviño", "8100000004", True, d(-6)),
        "cl-mariana": cliente("Mariana López", "8100000005", False, d(-2)),
        "cl-jorge": cliente("Jorge Ramírez", "8100000006", False, d(-4)),
    }

    def cita(folio, fecha, hora, turno, motivo, contacto, cliente_id, estado, cot=None, origen="sitio", orden=None, nota=""):
        return {"folio": folio, "fecha": fecha, "hora": hora, "turno": turno, "motivo": motivo, "modalidad": "cafeteria", "lugar": "Cafetería de Tecmilenio",
                "clienteId": cliente_id, "contacto": contacto, "cotizacion": cot, "nota": nota, "estado": estado, "origen": origen, "creada": d(-2),
                "ordenId": orden, "historial": [{"fecha": d(-2), "hora": "18:40", "autor": "Equipo", "nota": "Cita agendada · desde el sitio"}]}

    def contacto(nombre, tel, tecmi=False):
        return {"nombre": nombre, "tel": tel, "correo": "", "tecmi": tecmi}

    def cot_rep(problema, modelo_id, equipo, tarifa=None, precio=None):
        return {"tipo": "reparacion", "problema": problema, "modeloId": modelo_id, "equipo": equipo, "tarifaId": tarifa, "precio": precio}

    citas = {
        "ct-1": cita("CT-261022-A1B2", d(0), "09:30", 1, "reparacion", contacto("Ana Martínez", "8100000001", True), "cl-ana", "atendida", cot_rep("pantalla", "apple-iphone-13", "Apple iPhone 13", t13p_g, 1850), orden="os-1"),
        "ct-2": cita("CT-261022-C3D4", d(0), "10:00", 2, "entrega", contacto("Luis Hernández", "8100000002", True), "cl-luis", "llego", {"tipo": "entrega", "ordenFolio": "OS-261020-L2WX"}),
        "ct-3": cita("CT-261022-E5F6", d(0), "10:30", 3, "reparacion", contacto("Valeria Cantú", "8100000007", True), None, "agendada", cot_rep("bateria", "apple-iphone-11", "Apple iPhone 11", t11b, 850), nota="Se apaga solo al 30%"),
        "ct-4": cita("CT-261022-G7H8", d(0), "11:00", 4, "duda", contacto("Sofía Garza", "8100000003"), "cl-sofia", "agendada"),
        "ct-5": cita("CT-261022-J9K2", d(0), "12:00", 5, "venta", contacto("Ricardo Elizondo", "8100000008"), None, "agendada", {"tipo": "venta", "modeloId": "apple-iphone-xr", "equipo": "Apple iPhone XR", "condicion": "bueno", "capacidad": "64 GB", "preferencia": "toma"}),
        "ct-6": cita("CT-261022-M3N4", d(0), "13:30", 6, "compra", contacto("Diego Treviño", "8100000004", True), "cl-diego", "agendada", {"tipo": "compra", "productoId": "pr-priv-15", "equipo": "Mica de privacidad"}),
        "ct-7": cita("CT-261023-P5Q6", d(1), "10:00", 1, "reparacion", contacto("Fernanda Ríos", "8100000009", True), None, "agendada", cot_rep("carga", "samsung-galaxy-a54", "Samsung Galaxy A54", ta54c, 650)),
        "ct-8": cita("CT-261023-R7S8", d(1), "12:30", 2, "reparacion", contacto("Héctor Villarreal", "8100000010"), None, "agendada", cot_rep("diagnostico", None, "Huawei P30 Lite")),
        "ct-9": cita("CT-261021-T9U2", d(-1), "11:30", 3, "reparacion", contacto("Paola Saldaña", "8100000011", True), None, "noasistio", cot_rep("pantalla", "motorola-moto-g84", "Motorola Moto G84", tg84p, 1600)),
        "ct-10": cita("CT-261021-V3W4", d(-1), "13:00", 4, "duda", contacto("Mariana López", "8100000005"), "cl-mariana", "cancelada"),
    }
    citas["ct-10"]["cierre"] = {"motivo": "reprogramo", "fecha": d(-1)}

    rec = lambda checklist, acc, por="Mostrador 1": {"checklist": checklist, "accesorios": acc, "notas": "", "aceptaTerminos": True, "por": por}

    def orden(folio, cliente_id, equipo, problema, falla, estado, creada, lineas=None, aut=None, tecnico="", promesa=None, pagos=None, historial=None, **extra):
        o = {"folio": folio, "clienteId": cliente_id, "citaId": None, "origen": "mostrador", "modalidad": "cafeteria", "equipo": equipo, "problema": problema, "falla": falla,
             "recepcion": rec(check(), []), "diagnostico": "", "lineas": lineas or [], "autorizacion": aut or {"estado": "pendiente"}, "estado": estado, "tecnico": tecnico,
             "promesa": promesa, "pagos": pagos or [], "historial": historial or [], "creada": creada, "actualizada": creada}
        o.update(extra)
        return o

    def eq(modelo_id, marca, modelo, imei, color, acceso="", tipo="pin"):
        return {"modeloId": modelo_id, "marca": marca, "modelo": modelo, "imei": imei, "color": color, "accesoTipo": tipo if acceso else "ninguno", "acceso": acceso}

    def linea(tarifa, producto, desc, precio, apartado=0):
        return {"tipo": "servicio", "tarifaId": tarifa, "productoId": producto, "desc": desc, "cant": 1, "precio": precio, "apartado": apartado}

    ordenes = {
        "os-1": orden("OS-261022-B8C9", "cl-ana", eq("apple-iphone-13", "Apple", "iPhone 13", "350000000000301", "Rosa", "1234"), "pantalla",
                      "Se cayó; cristal estrellado y manchas negras arriba.", "recibido", d(0),
                      [linea(t13p_g, "pr-pant-13-g", "Cambio de pantalla · genérica · iPhone 13", 1850)], tecnico="Técnico 1", promesa=d(0),
                      historial=[h(d(0), "09:42", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio")], citaId="ct-1",
                      recepcion=rec(check(pantalla="no", biometria="np"), ["Funda"])),
        "os-2": orden("OS-261020-L2WX", "cl-luis", eq("samsung-galaxy-a54", "Samsung", "Galaxy A54", "350000000000402", "Negro"), "carga",
                      "Solo carga si se mueve el cable.", "listo", d(-2),
                      [linea(ta54c, "pr-carga-a54", "Cambio de centro de carga · Galaxy A54", 650)],
                      {"estado": "autorizado", "medio": "mostrador", "fecha": d(-2), "hora": "12:10", "por": "Mostrador 1", "monto": 650}, "Técnico 2", d(-1),
                      [{"fecha": d(-2), "hora": "12:12", "monto": 200, "forma": "efectivo", "concepto": "Anticipo", "por": "Mostrador 1"}],
                      [h(d(-2), "12:00", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-2), "12:10", "Mostrador 1", "Presupuesto autorizado (En mostrador) por $650"),
                       h(d(-1), "16:20", "Técnico 2", "Reparación terminada · equipo probado")],
                      diagnostico="Pines del centro de carga dañados. Se reemplaza el puerto."),
        "os-3": orden("OS-261021-N4YZ", "cl-mariana", eq("apple-iphone-11", "Apple", "iPhone 11", "350000000000503", "Blanco", "0000"), "bateria",
                      "Se descarga en 3 horas.", "presupuesto", d(-1),
                      [linea(t11b, "pr-bat-11", "Cambio de batería · iPhone 11", 850)], tecnico="Técnico 1", promesa=d(1),
                      historial=[h(d(-1), "13:05", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-1), "17:30", "Técnico 1", "Presupuesto enviado al cliente")],
                      diagnostico="Estado de la batería al 71%. Se recomienda cambio."),
        "os-4": orden("OS-261018-Q6AB", "cl-jorge", eq("motorola-moto-g84", "Motorola", "Moto G84", "350000000000604", "Azul"), "pantalla",
                      "Líneas verdes en la pantalla.", "reparacion", d(-4),
                      [linea(tg84p, "pr-pant-g84", "Cambio de pantalla · Moto G84", 1600, 1)],
                      {"estado": "autorizado", "medio": "whatsapp", "fecha": d(-3), "hora": "10:15", "por": "Mostrador 1", "monto": 1600}, "Técnico 2", d(0),
                      [{"fecha": d(-3), "hora": "10:20", "monto": 800, "forma": "transferencia", "concepto": "Anticipo", "por": "Mostrador 1"}],
                      [h(d(-4), "16:00", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-3), "10:15", "Mostrador 1", "Presupuesto autorizado (Por WhatsApp) por $1,600")],
                      diagnostico="Display dañado por golpe."),
        "os-5": orden("OS-261019-S8CD", "cl-diego", eq("xiaomi-redmi-note-13", "Xiaomi", "Redmi Note 13", "350000000000705", "Verde"), "carga",
                      "No reconoce el cargador.", "espera", d(-3),
                      [linea(tn13c, "pr-carga-n13", "Cambio de centro de carga · Redmi Note 13", 550)],
                      {"estado": "autorizado", "medio": "mostrador", "fecha": d(-3), "hora": "11:00", "por": "Mostrador 1", "monto": 550}, "Técnico 1", d(2),
                      historial=[h(d(-3), "10:40", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-3), "11:00", "Mostrador 1", "Presupuesto autorizado (En mostrador) por $550 · esperando 1 refacción(es)")]),
        "os-6": orden("OS-261002-M3RT", "cl-sofia", eq("apple-iphone-13", "Apple", "iPhone 13", "350000000000302", "Azul"), "bateria",
                      "Batería inflada.", "entregado", d(-21),
                      [linea(t13b, "pr-bat-13", "Cambio de batería · iPhone 13", 950)],
                      {"estado": "autorizado", "medio": "mostrador", "fecha": d(-21), "hora": "10:00", "por": "Mostrador 1", "monto": 950}, "Técnico 1", d(-20),
                      [{"fecha": d(-20), "hora": "13:00", "monto": 950, "forma": "tarjeta", "concepto": "Liquidación", "por": "Mostrador 1"}],
                      [h(d(-21), "09:50", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-20), "13:00", "Mostrador 1", "Equipo entregado a Sofía Garza · garantía hasta " + d(70))],
                      entrega={"fecha": d(-20), "hora": "13:00", "por": "Mostrador 1", "recibio": "Sofía Garza", "pruebas": {}, "reparado": True, "garantiaDias": 90, "garantiaHasta": d(70)}),
        "os-7": orden("OS-261020-U2EF", "cl-jorge", eq("apple-iphone-11", "Apple", "iPhone 11", "350000000000806", "Negro"), "pantalla",
                      "Pantalla estrellada; el táctil funciona.", "rechazado", d(-2),
                      [linea(t11p, "pr-pant-11", "Cambio de pantalla · iPhone 11", 1450)],
                      {"estado": "rechazado", "medio": "telefono", "fecha": d(-1), "hora": "12:00", "por": "Mostrador 1", "motivo": "precio"}, "Técnico 2",
                      historial=[h(d(-2), "15:00", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-1), "12:00", "Mostrador 1", "Presupuesto no autorizado · Precio · el equipo se devuelve")]),
        "os-8": orden("OS-260624-K7PQ", "cl-ana", eq("apple-iphone-13", "Apple", "iPhone 13", "350000000000301", "Rosa"), "bateria",
                      "Se apaga solo.", "entregado", d(-121),
                      [linea(t13b, "pr-bat-13", "Cambio de batería · iPhone 13", 950)],
                      {"estado": "autorizado", "medio": "mostrador", "fecha": d(-121), "hora": "11:00", "por": "Mostrador 1", "monto": 950}, "Técnico 1", d(-120),
                      [{"fecha": d(-120), "hora": "12:00", "monto": 950, "forma": "efectivo", "concepto": "Liquidación", "por": "Mostrador 1"}],
                      [h(d(-121), "10:30", "Mostrador 1", "Equipo recibido en Cafetería de Tecmilenio"), h(d(-120), "12:00", "Mostrador 1", "Equipo entregado a Ana Martínez · garantía hasta " + d(-30))],
                      entrega={"fecha": d(-120), "hora": "12:00", "por": "Mostrador 1", "recibio": "Ana Martínez", "pruebas": {}, "reparado": True, "garantiaDias": 90, "garantiaHasta": d(-30)}),
    }

    ventas = {
        "vt-1": {"folio": "V-261022-X2Y3", "fecha": d(0), "hora": "09:15", "clienteId": None, "lineas": [
            {"productoId": "pr-mica-13", "desc": "Mica de vidrio templado · iPhone 13 / 13 Pro / 14", "cant": 1, "precio": 150},
            {"productoId": "pr-funda-13", "desc": "Funda transparente antigolpes · iPhone 13", "cant": 1, "precio": 180}],
            "total": 330, "tomaId": None, "credito": 0, "pagos": [{"forma": "efectivo", "monto": 500, "fecha": d(0)}], "cambio": 170, "vendedor": "Mostrador 1"},
        "vt-2": {"folio": "V-261021-Z4A5", "fecha": d(-1), "hora": "14:30", "clienteId": "cl-diego", "lineas": [
            {"productoId": "pr-carg-20", "desc": "Cargador USB-C 20 W", "cant": 1, "precio": 290},
            {"productoId": "pr-cable-l", "desc": "Cable USB-C a Lightning 1 m", "cant": 1, "precio": 190}],
            "total": 480, "tomaId": None, "credito": 0, "pagos": [{"forma": "tarjeta", "monto": 480, "fecha": d(-1)}], "cambio": 0, "vendedor": "Mostrador 1"},
    }

    verif = {"identificacion": True, "imei": True, "cuentas": True, "propiedad": True}
    compras = {
        "ce-1": {"folio": "CE-261021-B6C7", "fecha": d(-1), "tipo": "compra", "vendedor": {"nombre": "Alejandro Garza", "tel": "8100000012", "identificacion": "INE", "idUltimos": "4821"},
                 "equipo": {"modeloId": "apple-iphone-13", "marca": "Apple", "modelo": "iPhone 13", "capacidad": "128 GB", "color": "Blanco", "imei": "350000000000134", "bateria": 81, "condicion": "bueno", "notas": "Rayones leves en el marco."},
                 "verificacion": verif, "oferta": 5200, "precio": 5200, "estado": "aceptada", "equipoId": "eq-13", "cerrada": d(-1),
                 "pago": {"fecha": d(-1), "hora": "16:10", "forma": "efectivo", "monto": 5200, "por": "Mostrador 1"}, "por": "Mostrador 1"},
        "ce-2": {"folio": "CE-261020-D8E9", "fecha": d(-2), "tipo": "toma", "vendedor": {"nombre": "Mariana López", "tel": "8100000005", "identificacion": "INE", "idUltimos": "1937", "clienteId": "cl-mariana"},
                 "equipo": {"modeloId": "samsung-galaxy-a14", "marca": "Samsung", "modelo": "Galaxy A14", "capacidad": "64 GB", "color": "Negro", "imei": "350000000000909", "bateria": 88, "condicion": "bueno", "notas": ""},
                 "verificacion": verif, "oferta": 900, "precio": 900, "estado": "aceptada", "equipoId": "eq-a14", "cerrada": d(-2), "por": "Mostrador 1"},
    }
    equipos["eq-a14"] = {"marca": "Samsung", "modelo": "Galaxy A14", "modeloId": "samsung-galaxy-a14", "capacidad": "64 GB", "color": "Negro", "condicion": "seminuevo", "bateria": 88, "imei": "350000000000909", "precio": None, "estado": "reacondicionar", "origen": "Toma a cuenta", "compraId": "ce-2", "alta": d(-2), "demo": True}
    costos["eq-a14"] = {"costo": 900}

    config = {"general": {
        "garantias": {"pantalla": 90, "bateria": 90, "carga": 60, "bocina": 60, "microfono": 60, "camara": 60, "tapa": 30, "botones": 60, "software": 15, "liberacion": None, "mantenimiento": 15, "humedad": None},
        "garantiaEquipo": {"nuevo": 365, "seminuevo": 90},
        "domicilio": {"activo": True, "costo": None, "zona": None},
        "demo": True,
    }}

    return {"_ancla": ANCLA.isoformat(), "config": config, "tarifas": tarifas, "productos": productos, "existencias": existencias, "costos": costos,
            "equipos": equipos, "clientes": clientes, "citas": citas, "ordenes": ordenes, "ventas": ventas, "compras": compras, "movimientos": {}}
