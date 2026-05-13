"""
Seed script — populates the SQLite database with 30 Munich places.

The descriptions here are pre-baked (one-shot, hand-curated) so the app shows
rich content without ever calling a live AI endpoint at runtime. Re-run this
script any time you want to reset the database to its known good state:

    cd backend
    python seed.py
"""
from database import engine, Base, SessionLocal
from models import Item
import datetime

Base.metadata.create_all(bind=engine)

db = SessionLocal()
db.query(Item).delete()
db.commit()

now = datetime.datetime.utcnow()

items = [
    # ATTRACTIONS
    Item(
        title="Marienplatz Glockenspiel",
        description=(
            "The Neues Rathaus tower hosts a 32-figure mechanical performance at 11am, "
            "noon, and 5pm telling the story of a 16th-century royal wedding and the "
            "barrel-makers' dance. Best viewed from the square's centre — arrive 10 "
            "minutes early to find a spot through the wall of tourist phones."
        ),
        item_type="bookmark", category="attraction",
        latitude=48.1374, longitude=11.5755,
        address="Marienplatz, Munich", tags="landmark,must-see,medieval,clock",
    ),
    Item(
        title="Frauenkirche Cathedral",
        description=(
            "Munich's defining skyline: twin onion-domed towers, each 99 metres tall and "
            "visible from across the city. Inside, look for the 'Devil's Footprint' stone "
            "near the entrance; the south tower offers a free climb with sweeping views "
            "of the Alps on a clear day."
        ),
        item_type="bookmark", category="attraction",
        latitude=48.1385, longitude=11.5733,
        address="Frauenplatz 12, Munich", tags="cathedral,gothic,landmark,church",
    ),
    Item(
        title="Nymphenburg Palace",
        description=(
            "Baroque summer residence of the Bavarian royals with manicured French and "
            "English gardens stretching nearly two kilometres. Allow half a day — the "
            "porcelain manufactory and the Marstallmuseum (royal coaches) are worth the "
            "extra detour beyond the main palace rooms."
        ),
        item_type="bookmark", category="attraction",
        latitude=48.1583, longitude=11.5031,
        address="Schloss Nymphenburg 1, Munich", tags="palace,baroque,gardens,history",
    ),
    Item(
        title="Olympic Park Tower",
        description=(
            "The 291-metre Olympiaturm gives the best panoramic view of Munich, with the "
            "Alps visible on clear days. The revolving restaurant up top is dated but the "
            "observation deck below is excellent value at around €10 — go at sunset."
        ),
        item_type="bookmark", category="attraction",
        latitude=48.1755, longitude=11.5518,
        address="Spiridon-Louis-Ring 7, Munich", tags="views,olympics,tower",
    ),

    # MUSEUMS
    Item(
        title="Deutsches Museum Ticket",
        description=(
            "One of the world's oldest and largest science museums: a real U-boat, mining "
            "tunnels, the original Wright Flyer. Plan a full day — Hall 3's aerospace "
            "exhibit and the historic instruments collection are the standouts."
        ),
        item_type="ticket", category="museum",
        latitude=48.1299, longitude=11.5832,
        address="Museumsinsel 1, Munich",
        event_datetime=now + datetime.timedelta(hours=3),
        tags="ticket,science,technology,museum",
    ),
    Item(
        title="Alte Pinakothek",
        description=(
            "Old masters from the 14th to 18th century: Dürer's self-portraits, Rubens, "
            "Rembrandt's Self-Portrait with Beret, Da Vinci's Madonna of the Carnation. "
            "Sundays are €1 entry but expect lines that stretch around the building."
        ),
        item_type="bookmark", category="museum",
        latitude=48.1486, longitude=11.5701,
        address="Barer Str. 27, Munich", tags="art,paintings,classical,museum",
    ),
    Item(
        title="BMW Museum",
        description=(
            "Architectural marvel shaped like four giant cylinders, telling the BMW story "
            "from 1916 motorcycles to current electric concept cars. Combine with BMW Welt "
            "next door (free entry) for the full experience — allow two to three hours."
        ),
        item_type="ticket", category="museum",
        latitude=48.1769, longitude=11.5586,
        address="Am Olympiapark 2, Munich",
        event_datetime=now + datetime.timedelta(days=1),
        tags="cars,bmw,technology,history",
    ),
    Item(
        title="Lenbachhaus",
        description=(
            "Best collection of the Blue Rider expressionist movement anywhere: Kandinsky, "
            "Franz Marc, Gabriele Münter. The bright yellow Italianate villa is itself a "
            "work of art, and the rooftop café has surprisingly good cake."
        ),
        item_type="bookmark", category="museum",
        latitude=48.1466, longitude=11.5650,
        address="Luisenstr. 33, Munich", tags="art,modern,expressionism,museum",
    ),

    # RESTAURANTS
    Item(
        title="Viktualienmarkt Lunch",
        description=(
            "Open-air food market since 1807 with 140 stalls — Bavarian sausages, exotic "
            "fruits, cheese, smoked fish. The beer garden in the middle rotates brewery "
            "taps weekly, one of the only places in Munich where you can compare them."
        ),
        item_type="bookmark", category="restaurant",
        latitude=48.1351, longitude=11.5761,
        address="Viktualienmarkt, Munich", tags="food,lunch,bavarian,sausage,market",
    ),
    Item(
        title="Hofbräuhaus",
        description=(
            "The world's most famous beer hall, founded in 1589 by the Duke of Bavaria. "
            "Loud, packed, openly touristy — but the Maß of helles and the live oompah "
            "band are an iconic Munich experience. Go once and you'll never forget it."
        ),
        item_type="bookmark", category="restaurant",
        latitude=48.1376, longitude=11.5797,
        address="Platzl 9, Munich", tags="beer,bavarian,traditional,dinner",
    ),
    Item(
        title="Augustiner Bräustuben",
        description=(
            "Authentic Bavarian food in Augustiner brewery's own tap room — far less "
            "touristy than Hofbräuhaus, just as good. The Schweinshaxe (pork knuckle) is "
            "among the best in the city; arrive before 7pm or expect a 30-minute wait."
        ),
        item_type="bookmark", category="restaurant",
        latitude=48.1381, longitude=11.5512,
        address="Landsberger Str. 19, Munich", tags="beer,bavarian,traditional,brewery",
    ),
    Item(
        title="Tantris",
        description=(
            "Two Michelin stars and 50+ years of culinary history in a striking 1970s "
            "building that feels like a Bond villain's lair. The tasting menu runs around "
            "€200 per person; reservations open weeks in advance and are essential."
        ),
        item_type="bookmark", category="restaurant",
        latitude=48.1683, longitude=11.5938,
        address="Johann-Fichte-Str. 7, Munich",
        event_datetime=now + datetime.timedelta(days=2),
        tags="fine-dining,michelin,reservation,dinner",
    ),
    Item(
        title="Schmalznudel",
        description=(
            "Tiny bakery near Viktualienmarkt specialising in Schmalznudel — fried dough "
            "rings dusted in sugar, a Bavarian breakfast tradition. Get there before 10am "
            "or they sell out. The queue looks long but moves fast."
        ),
        item_type="bookmark", category="restaurant",
        latitude=48.1357, longitude=11.5757,
        address="Prälat-Zistl-Str. 8, Munich", tags="pastries,bakery,breakfast,traditional",
    ),

    # CAFES
    Item(
        title="Café Luitpold",
        description=(
            "Viennese-style coffeehouse since 1888, rebuilt after WWII with a beautiful "
            "glass-roofed Palmengarten dining room. Their handmade pralines and the "
            "breakfast brioche pair perfectly with a Maria Theresia coffee."
        ),
        item_type="bookmark", category="cafe",
        latitude=48.1421, longitude=11.5750,
        address="Brienner Str. 11, Munich", tags="coffee,breakfast,historic,pastries",
    ),
    Item(
        title="Man Versus Machine",
        description=(
            "Munich's leading third-wave coffee roaster, with a brutally minimal flagship "
            "in the Glockenbach quarter. The pour-overs are exceptional, the espresso is "
            "excellent; food is limited to pastries — go for the coffee, not the menu."
        ),
        item_type="bookmark", category="cafe",
        latitude=48.1336, longitude=11.5673,
        address="Müllerstr. 23, Munich", tags="coffee,specialty,roaster,modern",
    ),
    Item(
        title="Cafe Frischhut",
        description=(
            "Same building as Schmalznudel but the sit-down side, with proper coffee and "
            "Bavarian pastries since the 1970s. Decor unchanged in decades — the locals "
            "love it, and most tourists never find their way in."
        ),
        item_type="bookmark", category="cafe",
        latitude=48.1356, longitude=11.5760,
        address="Prälat-Zistl-Str. 8, Munich", tags="coffee,pastries,traditional,breakfast",
    ),

    # BARS
    Item(
        title="English Garden Beer Garden",
        description=(
            "The Chinesischer Turm beer garden, Munich's most famous, seats 7,000 under "
            "century-old chestnut trees. Bring your own food (a Bavarian tradition!), buy "
            "the beer on-site, and stay through sunset for the brass band on the pagoda."
        ),
        item_type="map_pin", category="bar",
        latitude=48.1541, longitude=11.5869,
        address="Englischer Garten 3, Munich", tags="beer,garden,evening,outdoor",
    ),
    Item(
        title="Augustiner Keller",
        description=(
            "A 6,500-seat beer garden under century-old chestnut trees, pouring Augustiner "
            "straight from wooden kegs. Less touristy than the English Garden, more "
            "popular with locals — arrive early on warm weekends or expect to share a table."
        ),
        item_type="map_pin", category="bar",
        latitude=48.1448, longitude=11.5499,
        address="Arnulfstr. 52, Munich", tags="beer,garden,traditional,evening",
    ),
    Item(
        title="Zephyr Bar",
        description=(
            "Award-winning craft cocktail bar in a warm, low-lit Glockenbach space with a "
            "constantly rotating menu. The bartenders care; the bar snacks are a notch "
            "above; reservations recommended on Fridays and Saturdays."
        ),
        item_type="bookmark", category="bar",
        latitude=48.1310, longitude=11.5768,
        address="Baaderstr. 68, Munich", tags="cocktails,craft,evening,modern",
    ),

    # TRANSPORT
    Item(
        title="Train to Airport",
        description=(
            "S8 line from Marienplatz to MUC takes 40 minutes, runs every 20 minutes from "
            "around 4am to midnight. A single ticket is around €13; multi-day City passes "
            "work but double-check the airport-included version before buying."
        ),
        item_type="calendar_event", category="transport",
        latitude=48.1374, longitude=11.5755,
        address="Marienplatz S-Bahn",
        event_datetime=now + datetime.timedelta(hours=22),
        tags="transport,airport,sbahn,departure",
    ),
    Item(
        title="Bicycle Rental MVG",
        description=(
            "Convenient pickup at Hauptbahnhof for MVG Rad city bikes — first 30 minutes "
            "free with the app, then per-minute pricing. Helmets not included; the bike "
            "lanes throughout central Munich are excellent and well-marked."
        ),
        item_type="map_pin", category="transport",
        latitude=48.1402, longitude=11.5586,
        address="Hauptbahnhof, Munich", tags="bike,rental,transport,mvg",
    ),
    Item(
        title="Hauptbahnhof",
        description=(
            "Munich's main railway station — hub for regional trains, ICE intercity, "
            "S-Bahn, U-Bahn, and trams. Currently under massive renovation through 2028; "
            "navigation between platforms can be confusing, so allow 15 extra minutes for "
            "tight connections."
        ),
        item_type="map_pin", category="transport",
        latitude=48.1402, longitude=11.5586,
        address="Bayerstr. 10A, Munich", tags="train,station,transport,regional",
    ),

    # ACCOMMODATION & SERVICES
    Item(
        title="Hotel Checkout",
        description=(
            "Standard checkout is 11am at most central hotels; nearly all will hold "
            "luggage at reception for the day if you're flying out later. Tip €2-5 per "
            "bag if you hold longer than a few hours."
        ),
        item_type="calendar_event", category="accommodation",
        latitude=48.1432, longitude=11.5680,
        address="Schillerstr. 9, Munich",
        event_datetime=now + datetime.timedelta(hours=18),
        tags="hotel,checkout,luggage",
    ),
    Item(
        title="Pharmacy near hotel",
        description=(
            "One of the few central pharmacies open Sundays; English spoken. Munich "
            "pharmacies rotate Sunday duty, so check the door for the 'Notdienst' "
            "(emergency duty) listing if this one happens to be closed when you arrive."
        ),
        item_type="map_pin", category="services",
        latitude=48.1430, longitude=11.5685,
        address="Schillerstr. 12, Munich", tags="pharmacy,services,emergency",
    ),

    # SHOPPING
    Item(
        title="Kaufingerstrasse",
        description=(
            "Central pedestrian shopping street running west from Marienplatz, with major "
            "German chains (Galeria, dm, Müller) and international brands. Cobblestones "
            "look pretty but are rough on heels; standard Sunday closures apply."
        ),
        item_type="bookmark", category="shopping",
        latitude=48.1379, longitude=11.5715,
        address="Kaufingerstr., Munich", tags="shopping,fashion,pedestrian",
    ),
    Item(
        title="Dallmayr Delicatessen",
        description=(
            "Munich's most legendary delicatessen since 1700, three floors of indulgence: "
            "their own coffee blend, a fish counter with caviar, pralines, and a "
            "Michelin-starred restaurant upstairs. Even just window-shopping is worth it."
        ),
        item_type="bookmark", category="shopping",
        latitude=48.1392, longitude=11.5783,
        address="Dienerstr. 14-15, Munich", tags="food,luxury,gourmet,gifts",
    ),

    # PARKS & UNIQUE
    Item(
        title="English Garden",
        description=(
            "At 375 hectares, one of the world's largest urban parks — bigger than New "
            "York's Central Park. Walk the full north-south path in roughly 90 minutes; "
            "Monopteros for sunset and Kleinhesseloher See for paddleboats are the highlights."
        ),
        item_type="bookmark", category="park",
        latitude=48.1642, longitude=11.6056,
        address="Englischer Garten, Munich", tags="park,nature,walking,outdoor",
    ),
    Item(
        title="Surfing the Eisbach",
        description=(
            "A standing wave on the Eisbach river at the southern edge of the English "
            "Garden, where surfers ride year-round in wetsuits. Watching from the bridge "
            "is free; the best view is from the western side around midday."
        ),
        item_type="map_pin", category="attraction",
        latitude=48.1432, longitude=11.5862,
        address="Eisbach, English Garden", tags="surfing,unique,outdoor,free",
    ),

    # NOTES
    Item(
        title="Restaurant tip from Anna",
        description=(
            "Wirtshaus in der Au is a traditional Bavarian inn famous for its Schweinshaxe "
            "(roasted pork knuckle), in the Au quarter east of the river. Anna's been "
            "twice and says it's better than Hofbräuhaus by a mile; reservations advisable."
        ),
        item_type="note", category="restaurant",
        latitude=48.1283, longitude=11.5876,
        address="Lilienstr. 51, Munich", tags="recommendation,traditional,bavarian",
    ),
    Item(
        title="Free walking tour meeting point",
        description=(
            "Sandemans New Munich tour kicks off daily at 11am from the Marienplatz "
            "fountain — 2.5 hours, English-language, tip-based. Good guides cover Third "
            "Reich history and beer culture honestly without leaning on tourist clichés."
        ),
        item_type="calendar_event", category="attraction",
        latitude=48.1374, longitude=11.5755,
        address="Marienplatz fountain",
        event_datetime=now + datetime.timedelta(hours=14),
        tags="tour,free,walking,guide",
    ),
]

db.add_all(items)
db.commit()
db.close()

print(f"Seeded {len(items)} items with rich descriptions.")
