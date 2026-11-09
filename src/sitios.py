"""Genera las webs bilingües de demostración (negocios ficticios).

Uso: python src/sitios.py  (también lo llama build.py)
Salida: sitios/dona-elvira.html y sitios/casa-ejemplo.html
"""
import json, re
from pathlib import Path
import minify

SRC = Path(__file__).parent
OUT = SRC.parent / "sitios"
WA = "523321886217"  # demo: los mensajes llegan a Pilón

def L(es, en): return {"es": es, "en": en}

COMMON = {
    "demobar": L("Sitio de demostración hecho por Pilón · negocio ficticio · los mensajes de WhatsApp llegan a Pilón",
                 "Demo website by Pilón · fictional business · WhatsApp messages go to Pilón"),
    "nav2": L("Reseñas", "Reviews"), "nav3": L("Ubicación", "Location"),
    "openNow": L("Abierto ahora", "Open now"), "closedNow": L("Cerrado ahora", "Closed now"), "until": L("hasta las", "until"), "opensAt": L("abre a las", "opens at"),
    "revEy": L("Lo que dicen en Google", "What guests say on Google"), "reviewsOn": L("reseñas en Google", "reviews on Google"), "ownerReply": L("Respuesta del dueño", "Response from the owner"),
    "mapEy": L("Cómo llegar", "Getting here"), "dir": L("Abrir en Google Maps", "Open in Google Maps"),
    "name": L("Nombre", "Name"), "notes": L("Comentarios", "Notes"), "send": L("Enviar por WhatsApp", "Send via WhatsApp"),
    "missing": L("Completa la fecha y tu nombre.", "Please add the date and your name."), "badDates": L("La salida debe ser después de la llegada.", "Check-out must be after check-in."),
    "formNote": L("Se abre WhatsApp con tu solicitud lista. Te confirmamos en minutos.", "WhatsApp opens with your request ready. We confirm within minutes."),
    "perNight": L("por noche", "per night"),
    "tag_spicy": L("picante", "spicy"), "tag_veg": L("vegetariano", "vegetarian"), "tag_star": L("de la casa", "house favorite"),
}

REST = {
    "id": "elvira", "name": "Cocina Doña Elvira", "wa": WA,
    "title": L("Cocina Doña Elvira · Comida yucateca en el Centro de Mérida", "Cocina Doña Elvira · Yucatecan food in downtown Mérida"),
    "tagline": L("Cocina yucateca de casa desde 1998, en un patio colonial de la Calle 60.", "Homestyle Yucatecan cooking since 1998, in a colonial courtyard on Calle 60."),
    "heroImg": "../img/restaurante.jpg", "rating": 4.6, "reviewCount": 312,
    "hours": [["08:00", "18:00"], ["08:00", "23:00"], ["08:00", "23:00"], ["08:00", "23:00"], ["08:00", "23:00"], ["08:00", "23:30"], ["08:00", "23:30"]],
    "facts": [
        {"k": L("Horario", "Hours"), "v": L("Lun a sáb 8:00 a 23:00 · Dom 8:00 a 18:00", "Mon–Sat 8 am – 11 pm · Sun 8 am – 6 pm")},
        {"k": L("Dirección", "Address"), "v": L("Calle 60, Centro (a dos cuadras de Santa Lucía)", "Calle 60, Downtown (two blocks from Santa Lucía park)")},
        {"k": L("Estacionamiento", "Parking"), "v": L("Público en la calle 57, a media cuadra", "Public lot on Calle 57, half a block away")},
    ],
    "menu": [
        {"cat": L("Platos fuertes", "Mains"), "items": [
            {"n": L("Cochinita pibil", "Cochinita pibil"), "d": L("Cerdo marinado en achiote, cocido en hoja de plátano; cebolla morada y tortillas hechas a mano.", "Achiote-marinated pork slow-cooked in banana leaf, with pickled red onion and handmade tortillas."), "p": 195, "tags": ["star"]},
            {"n": L("Poc chuc", "Poc chuc"), "d": L("Cerdo asado con naranja agria, frijol colado y chiltomate.", "Grilled sour-orange pork with strained black beans and roasted tomato salsa."), "p": 210},
            {"n": L("Relleno negro", "Relleno negro"), "d": L("Pavo en recado de chiles tatemados con but (albóndiga de carne y huevo).", "Turkey in charred-chile black sauce with 'but' meat-and-egg filling."), "p": 225, "tags": ["spicy"]},
            {"n": L("Papadzules", "Papadzules"), "d": L("Tortillas rellenas de huevo, bañadas en salsa de pepita y tomate.", "Tortillas filled with egg, covered in pumpkin-seed and tomato sauces."), "p": 160, "tags": ["veg"]},
        ]},
        {"cat": L("Antojitos", "Starters"), "items": [
            {"n": L("Panuchos (3)", "Panuchos (3)"), "d": L("Tortilla rellena de frijol, frita, con pavo, lechuga y aguacate.", "Bean-stuffed fried tortillas topped with turkey, lettuce and avocado."), "p": 120, "tags": ["star"]},
            {"n": L("Salbutes (3)", "Salbutes (3)"), "d": L("Tortilla inflada con pollo deshebrado, tomate y cebolla morada.", "Puffy fried tortillas with shredded chicken, tomato and red onion."), "p": 115},
            {"n": L("Sopa de lima", "Lime soup"), "d": L("Caldo de pollo con lima yucateca y tiras de tortilla.", "Chicken broth with Yucatán lime and crispy tortilla strips."), "p": 110},
            {"n": L("Sikil pak", "Sikil pak"), "d": L("Dip de pepita de calabaza con tomate asado y totopos.", "Toasted pumpkin-seed dip with roasted tomato and chips."), "p": 95, "tags": ["veg"]},
        ]},
        {"cat": L("Bebidas", "Drinks"), "items": [
            {"n": L("Horchata", "Horchata"), "d": L("De arroz con canela, hecha en casa.", "Homemade rice and cinnamon drink."), "p": 45},
            {"n": L("Agua de chaya con piña", "Chaya & pineapple water"), "d": L("La bebida verde de Yucatán.", "Yucatán's famous green drink."), "p": 50, "tags": ["veg"]},
            {"n": L("Cerveza artesanal yucateca", "Local craft beer"), "d": L("Pregunta por la de temporada.", "Ask for the seasonal one."), "p": 85},
        ]},
        {"cat": L("Postres", "Desserts"), "items": [
            {"n": L("Marquesita", "Marquesita"), "d": L("Crepa crujiente con queso de bola y cajeta.", "Crispy rolled crepe with Edam cheese and caramel."), "p": 70, "tags": ["star"]},
            {"n": L("Dulce de papaya", "Candied papaya"), "d": L("Con queso de bola, receta de la abuela.", "With Edam cheese, grandma's recipe."), "p": 65},
        ]},
    ],
    "reviews": [
        {"name": "Jennifer M.", "stars": 5, "when": L("hace 2 días", "2 days ago"), "text": "Amazing cochinita pibil and the best horchata we had in Mérida! The courtyard is beautiful.",
         "reply": "Thank you so much, Jennifer! Our English menu is now ready. We hope to welcome you back! — Elvira and the team"},
        {"name": "Luis Canché", "stars": 4, "when": L("hace 5 días", "5 days ago"), "text": "La comida rica; un sábado tardaron, pero ya avisan el tiempo al ordenar.",
         "reply": "¡Gracias, Luis! Reforzamos la cocina en fin de semana. Te esperamos pronto. — Cocina Doña Elvira"},
        {"name": "Ana Sofía R.", "stars": 5, "when": L("hace 1 semana", "1 week ago"), "text": "Muy buen sazón yucateco y precios justos. Estacionamiento a media cuadra.", "reply": ""},
    ],
    "address": L("Calle 60, Centro, Mérida, Yucatán (dirección de ejemplo)", "Calle 60, Downtown Mérida, Yucatán (sample address)"),
    "mapQuery": "Parque Santa Lucía, Calle 60, Centro, Mérida, Yucatán",
    "faq": [
        {"q": L("¿Aceptan tarjeta?", "Do you take cards?"), "a": L("Sí, tarjeta de débito y crédito, efectivo y transferencia.", "Yes: debit and credit cards, cash and bank transfer.")},
        {"q": L("¿Tienen opciones vegetarianas?", "Do you have vegetarian options?"), "a": L("Sí: papadzules, sikil pak y agua de chaya, entre otros.", "Yes: papadzules, sikil pak and chaya water, among others.")},
        {"q": L("¿Dan factura?", "Can I get an invoice?"), "a": L("Sí, pide tu CFDI el mismo día con tu constancia fiscal.", "Yes, Mexican invoices (CFDI) are issued the same day.")},
        {"q": L("¿Reciben grupos?", "Do you take groups?"), "a": L("Hasta 30 personas en el patio, con reservación.", "Up to 30 guests in the courtyard, with a reservation.")},
    ],
    "t": {
        "nav1": L("Menú", "Menu"), "nav4": L("Reservar", "Book a table"), "cta1": L("Reservar mesa", "Book a table"), "cta2": L("Ver menú", "See the menu"),
        "mainEy": L("Menú", "Menu"), "mainH": L("Recetas de casa, ingredientes de Yucatán", "Family recipes, Yucatán ingredients"), "mainP": L("Precios en pesos, IVA incluido.", "Prices in Mexican pesos, tax included; dollar amounts are approximate."),
        "bookEy": L("Reservaciones", "Reservations"), "bookH": L("Aparta tu mesa en un minuto", "Book your table in one minute"), "bookP": L("Elige día, hora y cuántas personas. Te confirmamos por WhatsApp.", "Pick a day, time and party size. We confirm on WhatsApp."),
        "date": L("Fecha", "Date"), "time": L("Hora", "Time"), "people": L("Personas", "Guests"), "zone": L("Zona", "Seating"), "zones": L("Patio|Salón con aire acondicionado|Barra", "Courtyard|Air-conditioned room|Bar"),
        "notesPh": L("Cumpleaños, silla para bebé, alergias…", "Birthday, high chair, allergies…"),
        "waBook": L("Hola, quiero reservar una mesa en Cocina Doña Elvira:", "Hi! I'd like to book a table at Cocina Doña Elvira:"), "waHello": L("Hola, tengo una pregunta.", "Hi! I have a question."),
        "revH": L("4.6 de 5 con más de 300 reseñas", "Rated 4.6 out of 5 by 300+ guests"), "mapH": L("En el corazón del Centro", "In the heart of downtown"),
        "foot": L("© Cocina Doña Elvira (negocio ficticio) · Sitio de demostración de Pilón, Mérida.", "© Cocina Doña Elvira (fictional business) · Demo website by Pilón, Mérida."),
    },
}

HOTEL = {
    "id": "casa", "name": "Casa Ejemplo", "wa": WA,
    "title": L("Casa Ejemplo · Hotel boutique en el Centro de Mérida", "Casa Ejemplo · Boutique hotel in downtown Mérida"),
    "tagline": L("Siete habitaciones en una casona de 1890, a una cuadra del parque de Santa Lucía.", "Seven rooms in an 1890 mansion, one block from Santa Lucía park."),
    "heroImg": "../img/hotel.jpg", "rating": 4.8, "reviewCount": 187,
    "statusText": L("Recepción 24 horas", "24-hour front desk"),
    "facts": [
        {"k": L("Check-in / check-out", "Check-in / check-out"), "v": L("15:00 / 12:00 · guardamos maletas desde las 10:00", "3 pm / 12 pm · luggage storage from 10 am")},
        {"k": L("Incluye", "Included"), "v": L("Desayuno yucateco, alberca y wifi", "Yucatecan breakfast, plunge pool and wifi")},
        {"k": L("Ubicación", "Location"), "v": L("Calle 55, Centro · caminando a todo", "Calle 55, Downtown · walk everywhere")},
    ],
    "rooms": [
        {"n": L("Habitación Patio", "Courtyard Room"), "d": L("Cama queen, techos de 5 m con vigas, vista al patio.", "Queen bed, 16-ft beamed ceilings, courtyard view."), "p": 2400, "img": "../img/inmueble.jpg"},
        {"n": L("Suite Alberca", "Pool Suite"), "d": L("Cama king, puertas francesas directo a la alberca.", "King bed, French doors opening onto the plunge pool."), "p": 3600, "img": "../img/hotel.jpg"},
        {"n": L("Estudio Familiar", "Family Studio"), "d": L("Dos camas matrimoniales y cocineta; hasta 4 personas.", "Two double beds and kitchenette; sleeps 4."), "p": 3100, "img": "../img/restaurante.jpg"},
    ],
    "reviews": [
        {"name": "Thomas & Claire", "stars": 5, "when": L("hace 3 días", "3 days ago"), "text": "Gorgeous colonial house, the plunge pool was perfect after a hot day exploring. Breakfast was amazing.",
         "reply": "Thank you, Thomas and Claire! We'd love to welcome you back. — The Casa Ejemplo team"},
        {"name": "Daniela G.", "stars": 4, "when": L("hace 6 días", "6 days ago"), "text": "La casa es preciosa y el personal muy amable. Ahora guardan maletas desde temprano.",
         "reply": "¡Gracias, Daniela! Te esperamos de nuevo. — Equipo Casa Ejemplo"},
        {"name": "Marc L.", "stars": 5, "when": L("hace 2 semanas", "2 weeks ago"), "text": "Great location near Santa Lucía park, very quiet rooms. Booking direct on WhatsApp was easy.", "reply": ""},
    ],
    "address": L("Calle 55, Centro, Mérida, Yucatán (dirección de ejemplo)", "Calle 55, Downtown Mérida, Yucatán (sample address)"),
    "mapQuery": "Parque Santa Lucía, Mérida, Yucatán",
    "faq": [
        {"q": L("¿Puedo llegar antes del check-in?", "Can I arrive before check-in?"), "a": L("Sí, guardamos tus maletas desde las 10:00 y, si nos avisas, intentamos darte el cuarto antes.", "Yes, we store luggage from 10 am and try to have your room ready early if you message us.")},
        {"q": L("¿Aceptan mascotas?", "Are pets allowed?"), "a": L("Perros de hasta 10 kg en planta baja, con cargo de $350 por noche.", "Dogs up to 10 kg (22 lb) in ground-floor rooms, $350 MXN per night.")},
        {"q": L("¿Tienen estacionamiento?", "Is there parking?"), "a": L("Hay uno público a una cuadra, con tarifa preferencial para huéspedes.", "There's a public lot one block away with a guest discount.")},
        {"q": L("¿Cómo pago?", "How do I pay?"), "a": L("Tarjeta, transferencia o efectivo. Te damos factura (CFDI) si la necesitas.", "Card, bank transfer or cash. Mexican invoices (CFDI) available.")},
    ],
    "t": {
        "nav1": L("Habitaciones", "Rooms"), "nav4": L("Reservar", "Book"), "cta1": L("Reservar directo", "Book direct"), "cta2": L("Ver habitaciones", "See rooms"),
        "mainEy": L("Habitaciones", "Rooms"), "mainH": L("Siete habitaciones, cada una distinta", "Seven rooms, each one different"), "mainP": L("Tarifas por noche en pesos, con desayuno incluido.", "Nightly rates in Mexican pesos with breakfast included; dollar amounts are approximate."),
        "bookEy": L("Reserva directa", "Book direct"), "bookH": L("Mejor precio reservando con nosotros", "Best rate when you book with us"), "bookP": L("Sin comisiones de plataformas. Te confirmamos por WhatsApp en minutos.", "No booking-site fees. We confirm on WhatsApp within minutes."),
        "checkin": L("Llegada", "Check-in"), "checkout": L("Salida", "Check-out"), "guests": L("Huéspedes", "Guests"), "roomType": L("Habitación", "Room"),
        "notesPh": L("Hora de llegada, cama extra, celebración…", "Arrival time, extra bed, special occasion…"),
        "waBook": L("Hola, quiero reservar en Casa Ejemplo:", "Hi! I'd like to book a stay at Casa Ejemplo:"), "waHello": L("Hola, tengo una pregunta sobre el hotel.", "Hi! I have a question about the hotel."),
        "revH": L("4.8 de 5, según nuestros huéspedes", "Rated 4.8 out of 5 by our guests"), "mapH": L("A una cuadra de Santa Lucía", "One block from Santa Lucía park"),
        "foot": L("© Casa Ejemplo (negocio ficticio) · Sitio de demostración de Pilón, Mérida.", "© Casa Ejemplo (fictional business) · Demo website by Pilón, Mérida."),
    },
}

def build():
    tpl = (SRC / "sitio-plantilla.html").read_text(encoding="utf-8")
    tpl = re.sub(r"<style>(.*?)</style>", lambda m: "<style>" + minify.css(m.group(1)) + "</style>", tpl, count=1, flags=re.S)
    tpl = re.sub(r"<script>(.*?)</script>", lambda m: "<script>" + minify.js(m.group(1)) + "</script>", tpl, count=1, flags=re.S)
    OUT.mkdir(exist_ok=True)
    for slug, d, brand, accent in [("dona-elvira", REST, "#8E3B26", "#B5651D"), ("casa-ejemplo", HOTEL, "#0B4F4A", "#B08A3E")]:
        data = {**d, "t": {**COMMON, **d["t"]}}
        html = (tpl.replace("__DATA__", json.dumps(data, ensure_ascii=False))
                   .replace("__TITLE__", d["title"]["es"]).replace("__DESC__", d["tagline"]["es"])
                   .replace("__BRAND__", brand).replace("__ACCENT__", accent))
        (OUT / f"{slug}.html").write_text(html, encoding="utf-8")
    print("sitios/ listos")

if __name__ == "__main__":
    build()
