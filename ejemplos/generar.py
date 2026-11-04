"""Genera los archivos de prueba de los demos (Excel, CSV, XML CFDI y ZIP).

Uso: python ejemplos/generar.py
Todos los negocios, personas y montos son ficticios. RFC de prueba publicados por el SAT.
"""
import csv, datetime as dt, random, uuid, zipfile
from pathlib import Path
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

OUT = Path(__file__).parent / "archivos-de-prueba"
HOY = dt.date(2026, 11, 4)
random.seed(7)

# ---------------- Cobranza ----------------
CLIENTES = [
    ("Constructora Itzimná (ejemplo)", "Ing. Raúl Dzib", 48720, -18),
    ("Ferretería El Henequén (ejemplo)", "Sra. Lucy May", 12350, -6),
    ("Desarrollos Costa Progreso (ejemplo)", "Lic. Andrea Cetina", 136900, -47),
    ("Acabados Montejo (ejemplo)", "Sr. Jorge Uc", 9800, 4),
    ("Grupo Hotelero Paseo (ejemplo)", "C.P. Mario Pool", 61400, -92),
    ("Herrería Los Chalchis (ejemplo)", "Sr. Manuel Chi", 7450, -3),
    ("Remodelaciones García Ginerés (ejemplo)", "Arq. Paola Novelo", 23100, -26),
    ("Inmobiliaria Chicxulub Sol (ejemplo)", "Lic. Fernando Baeza", 88500, -64),
    ("Plomería y Gas Kanasín (ejemplo)", "Sr. Luis Canul", 5600, 12),
    ("Vidrios y Aluminio Umán (ejemplo)", "Sra. Rosa Tun", 14980, -38),
    ("Hospital Veterinario Norte (ejemplo)", "Dra. Karla Medina", 3200, 20),
    ("Constructora Temozón (ejemplo)", "Ing. Javier Pacheco", 205300, -15),
    ("Restaurante La Ceiba (ejemplo)", "Sr. Óscar Ek", 6900, -71),
    ("Hotel Boutique Santa Lucía (ejemplo)", "Lic. Sofía Cámara", 18700, -9),
    ("Pinturas del Mayab (ejemplo)", "Sr. Gerardo Cauich", 31250, 2),
    ("Taller Mecánico Xcumpich (ejemplo)", "Sr. Pedro Ku", 4100, -120),
    ("Escuela Montessori Altabrisa (ejemplo)", "Mtra. Elena Ruz", 11600, -33),
    ("Condominio Montebello (ejemplo)", "Adm. Víctor Lara", 27400, -55),
    ("Arquitectura Sisal Estudio (ejemplo)", "Arq. Ana Peniche", 9300, 7),
    ("Club Deportivo Francisco de Montejo (ejemplo)", "C.P. Hugo Rivas", 42800, -21),
    ("Panadería La Mejor de Itzimná (ejemplo)", "Sra. Leticia Pech", 2650, -2),
    ("Desarrolladora Conkal (ejemplo)", "Ing. Ricardo Alonzo", 157000, -88),
    ("Mantenimiento Industrial Periférico (ejemplo)", "Ing. Carla Sosa", 19900, 15),
    ("Granja Avícola Tixkokob (ejemplo)", "Sr. Ramiro Couoh", 36750, -41),
    ("Cancelería Moderna Caucel (ejemplo)", "Sr. Iván Puc", 8800, -12),
]
def fila(i, c):
    nombre, contacto, saldo, dias = c
    return {"Cliente": nombre, "Contacto": contacto, "Folio": f"A-{1100 + i}", "Saldo": saldo, "Vence": HOY + dt.timedelta(days=dias)}

def xlsx(path, headers, rows, date_cols=(), money_cols=()):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Cartera"
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0D5C61"); c.alignment = Alignment(vertical="center")
    for r in rows: ws.append(r)
    for col in date_cols:
        for cell in ws[col][1:]: cell.number_format = "dd/mm/yyyy"
    for col in money_cols:
        for cell in ws[col][1:]: cell.number_format = '"$"#,##0.00'
    for i, w in enumerate([44, 24, 12, 14, 14][:len(headers)]):
        ws.column_dimensions["ABCDE"[i]].width = w
    ws.freeze_panes = "A2"
    path.parent.mkdir(parents=True, exist_ok=True); wb.save(path)

cob = OUT / "cobranza"
rows = [fila(i, c) for i, c in enumerate(CLIENTES)]
xlsx(cob / "1-cartera-distribuidora.xlsx", ["Cliente", "Contacto", "Folio", "Saldo", "Vence"],
     [[r["Cliente"], r["Contacto"], r["Folio"], r["Saldo"], r["Vence"]] for r in rows], date_cols="E", money_cols="D")
# Otro formato: otros nombres de columna, montos como texto con $, fechas como texto dd/mm/aaaa
xlsx(cob / "2-cartera-otro-formato.xlsx", ["Razón social", "Atención", "No. factura", "Importe pendiente", "Fecha de vencimiento"],
     [[r["Cliente"], r["Contacto"], r["Folio"], f"${r['Saldo']:,.2f}", r["Vence"].strftime("%d/%m/%Y")] for r in rows[:12]])
with open(cob / "3-cartera.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["Cliente", "Contacto", "Folio", "Saldo", "Vence"])
    for r in rows[12:]: w.writerow([r["Cliente"], r["Contacto"], r["Folio"], r["Saldo"], r["Vence"].isoformat()])
# Filas con problemas: 3 buenas, 1 sin saldo, 1 sin fecha, 1 sin cliente
xlsx(cob / "4-cartera-filas-incompletas.xlsx", ["Cliente", "Contacto", "Folio", "Saldo", "Vence"], [
    [rows[0]["Cliente"], rows[0]["Contacto"], "A-1", 48720, rows[0]["Vence"]],
    [rows[2]["Cliente"], "", "A-2", 136900, rows[2]["Vence"]],
    [rows[4]["Cliente"], rows[4]["Contacto"], "A-3", 61400, rows[4]["Vence"]],
    ["Cliente sin saldo (ejemplo)", "x", "A-4", 0, HOY],
    ["Cliente sin fecha (ejemplo)", "x", "A-5", 5000, None],
    ["", "Fila sin cliente", "A-6", 3000, HOY]], date_cols="E", money_cols="D")
# Sin columnas necesarias
xlsx(cob / "5-archivo-equivocado.xlsx", ["Nombre", "Teléfono", "Correo"], [["Persona de ejemplo", "999 000 0000", "ejemplo@correo.mx"]])

# ---------------- CFDI ----------------
CLIENTE_A = ("CACX7605101P8", "XOCHILT CASAS CHAVEZ", "612")    # persona física, actividad empresarial
CLIENTE_B = ("FUNK671228PH6", "KARLA FUENTE NOLASCO", "626")    # persona física, RESICO
EMISORES = {"kemper": ("EKU9003173C9", "ESCUELA KEMPER URGATE", "601"), "xenon": ("XIA190128J61", "XENON INDUSTRIAL ARTICLES", "601")}
def cfdi(folio, fecha, emisor, receptor, uso, clave, desc, subtotal, metodo="PUE", forma="04", tipo="I", version="4.0", timbre=True, extra=""):
    total = round(subtotal * 1.16, 2) if tipo in ("I", "E") else 0
    e, r = EMISORES[emisor], receptor
    ns = "http://www.sat.gob.mx/cfd/4" if version == "4.0" else "http://www.sat.gob.mx/cfd/3"
    tfd = (f'\n  <cfdi:Complemento>{extra}<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" '
           f'UUID="{str(uuid.UUID(int=random.getrandbits(128))).upper()}" FechaTimbrado="{fecha}T12:00:00"/></cfdi:Complemento>') if timbre else (f"\n  <cfdi:Complemento>{extra}</cfdi:Complemento>" if extra else "")
    rec_extra = f' DomicilioFiscalReceptor="97000" RegimenFiscalReceptor="{r[2]}"' if version == "4.0" else ""
    conceptos = (f'<cfdi:Concepto ClaveProdServ="{clave}" Cantidad="1" ClaveUnidad="{"ACT" if tipo == "P" else "E48"}" Descripcion="{desc}" '
                 f'ValorUnitario="{subtotal:.2f}" Importe="{subtotal:.2f}"{" ObjetoImp=\"02\"" if version == "4.0" else ""}/>')
    attrs_pago = "" if tipo == "P" else f' FormaPago="{forma}" MetodoPago="{metodo}"'
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<cfdi:Comprobante xmlns:cfdi="{ns}" Version="{version}" Serie="{folio[0]}" Folio="{folio[1]}" Fecha="{fecha}T10:00:00"{attrs_pago} '
            f'SubTotal="{subtotal:.2f}" Moneda="{"XXX" if tipo == "P" else "MXN"}" Total="{total:.2f}" TipoDeComprobante="{tipo}"'
            f'{" Exportacion=\"01\"" if version == "4.0" else ""} LugarExpedicion="97000">\n'
            f'  <cfdi:Emisor Rfc="{e[0]}" Nombre="{e[1]}" RegimenFiscal="{e[2]}"/>\n'
            f'  <cfdi:Receptor Rfc="{r[0]}" Nombre="{r[1]}"{rec_extra} UsoCFDI="{uso}"/>\n'
            f'  <cfdi:Conceptos>{conceptos}</cfdi:Conceptos>{tfd}\n</cfdi:Comprobante>\n')

PUBLICO = ("XAXX010101000", "PUBLICO EN GENERAL", "616")
import re as _re
laptop = cfdi(("A", "1311"), "2026-10-30", "xenon", CLIENTE_A, "I04", "43211503", "Computadora portátil 14 pulgadas", 15500.00, metodo="PPD", forma="99")
laptop_uuid = _re.search(r'UUID="([^"]+)"', laptop).group(1)
pago = ('<pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0"><pago20:Totales MontoTotalPagos="17980.00"/>'
        '<pago20:Pago FechaPago="2026-11-02T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="17980.00">'
        f'<pago20:DoctoRelacionado IdDocumento="{laptop_uuid}" Serie="A" Folio="1311" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="17980.00" ImpPagado="17980.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>'
        '</pago20:Pago></pago20:Pagos>')
FACTURAS = {
    "01-gasolina-correcta.xml": cfdi(("GAS", "88231"), "2026-10-28", "kemper", CLIENTE_A, "G03", "15101514", "Gasolina Magna", 1034.48),
    "02-laptop-a-credito-PPD.xml": laptop,
    "03-comida-otro-rfc-S01.xml": cfdi(("R", "5521"), "2026-11-01", "kemper", PUBLICO, "S01", "90101501", "Consumo de alimentos", 862.07),
    "04-papeleria-SIN-TIMBRE.xml": cfdi(("P", "77"), "2026-10-15", "xenon", CLIENTE_A, "G03", "44121618", "Hojas, carpetas y tóner", 1290.00, timbre=False),
    "05-nota-de-credito.xml": cfdi(("NC", "12"), "2026-10-31", "xenon", CLIENTE_A, "G02", "43211503", "Descuento por devolución de accesorio", 500.00, tipo="E", forma="03"),
    "06-complemento-de-pago.xml": cfdi(("CP", "301"), "2026-11-02", "xenon", CLIENTE_A, "CP01", "84111506", "Pago", 0, tipo="P", extra=pago),
    "07-version-3-3-antigua.xml": cfdi(("V", "9"), "2026-10-20", "kemper", CLIENTE_A, "G03", "78101800", "Flete Mérida-Progreso", 2500.00, version="3.3"),
    "08-software-cliente-B-RESICO.xml": cfdi(("SW", "450"), "2026-10-05", "xenon", CLIENTE_B, "G03", "81112501", "Licencia anual de software contable", 4800.00),
    "09-honorarios-cliente-B.xml": cfdi(("H", "88"), "2026-10-12", "kemper", CLIENTE_B, "G03", "80121603", "Asesoría legal", 3500.00, forma="03"),
    "10-telefono-internet.xml": cfdi(("T", "6612"), "2026-10-09", "kemper", CLIENTE_A, "G03", "83111603", "Servicio de internet y telefonía", 689.66),
}
cf = OUT / "cfdi"; cf.mkdir(parents=True, exist_ok=True)
for name, xml in FACTURAS.items(): (cf / name).write_text(xml, encoding="utf-8")
(cf / "11-archivo-roto.xml").write_text('<?xml version="1.0"?>\n<cfdi:Comprobante Version="4.0" Total="100"\n', encoding="utf-8")
(cf / "12-xml-que-no-es-factura.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<pedido><cliente>Ejemplo</cliente><total>100</total></pedido>\n', encoding="utf-8")
with zipfile.ZipFile(cf / "descarga-masiva-SAT-octubre.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for name, xml in FACTURAS.items(): z.writestr(name, xml)

# ---------------- Paquete completo ----------------
guia = Path(__file__).parent / "GUIA-DE-PRUEBA.pdf"
pack = Path(__file__).parent / "archivos-de-prueba-xook.zip"
with zipfile.ZipFile(pack, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file(): z.write(p, p.relative_to(OUT.parent))
    if guia.exists(): z.write(guia, "archivos-de-prueba/GUIA-DE-PRUEBA.pdf")
print("Listo:", sum(1 for p in OUT.rglob("*") if p.is_file()), "archivos ->", pack.name)
