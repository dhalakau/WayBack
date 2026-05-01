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
    Item(title="Marienplatz Glockenspiel", description="Famous medieval clock tower performance daily at 11am and noon",
         item_type="bookmark", category="attraction", latitude=48.1374, longitude=11.5755,
         address="Marienplatz, Munich", tags="landmark,must-see,medieval,clock"),
    Item(title="Frauenkirche Cathedral", description="Iconic twin-towered gothic cathedral",
         item_type="bookmark", category="attraction", latitude=48.1385, longitude=11.5733,
         address="Frauenplatz 12, Munich", tags="cathedral,gothic,landmark,church"),
    Item(title="Nymphenburg Palace", description="Baroque summer palace with extensive gardens",
         item_type="bookmark", category="attraction", latitude=48.1583, longitude=11.5031,
         address="Schloss Nymphenburg 1, Munich", tags="palace,baroque,gardens,history"),
    Item(title="Olympic Park Tower", description="Observation tower with panoramic views",
         item_type="bookmark", category="attraction", latitude=48.1755, longitude=11.5518,
         address="Spiridon-Louis-Ring 7, Munich", tags="views,olympics,tower"),

    # MUSEUMS
    Item(title="Deutsches Museum Ticket", description="Entry ticket, hall 3 has aerospace exhibit",
         item_type="ticket", category="museum", latitude=48.1299, longitude=11.5832,
         address="Museumsinsel 1, Munich", event_datetime=now + datetime.timedelta(hours=3),
         tags="ticket,science,technology,museum"),
    Item(title="Alte Pinakothek", description="Old master paintings from 14th-18th century",
         item_type="bookmark", category="museum", latitude=48.1486, longitude=11.5701,
         address="Barer Str. 27, Munich", tags="art,paintings,classical,museum"),
    Item(title="BMW Museum", description="History of BMW cars and motorcycles",
         item_type="ticket", category="museum", latitude=48.1769, longitude=11.5586,
         address="Am Olympiapark 2, Munich", event_datetime=now + datetime.timedelta(days=1),
         tags="cars,bmw,technology,history"),
    Item(title="Lenbachhaus", description="Modern art including Blue Rider expressionists",
         item_type="bookmark", category="museum", latitude=48.1466, longitude=11.5650,
         address="Luisenstr. 33, Munich", tags="art,modern,expressionism,museum"),

    # RESTAURANTS
    Item(title="Viktualienmarkt Lunch", description="Best sausages in Munich at the open-air market",
         item_type="bookmark", category="restaurant", latitude=48.1351, longitude=11.5761,
         address="Viktualienmarkt, Munich", tags="food,lunch,bavarian,sausage,market"),
    Item(title="Hofbräuhaus", description="World-famous traditional beer hall with live music",
         item_type="bookmark", category="restaurant", latitude=48.1376, longitude=11.5797,
         address="Platzl 9, Munich", tags="beer,bavarian,traditional,dinner"),
    Item(title="Augustiner Bräustuben", description="Authentic Bavarian food next to brewery",
         item_type="bookmark", category="restaurant", latitude=48.1381, longitude=11.5512,
         address="Landsberger Str. 19, Munich", tags="beer,bavarian,traditional,brewery"),
    Item(title="Tantris", description="Two Michelin star fine dining",
         item_type="bookmark", category="restaurant", latitude=48.1683, longitude=11.5938,
         address="Johann-Fichte-Str. 7, Munich", event_datetime=now + datetime.timedelta(days=2),
         tags="fine-dining,michelin,reservation,dinner"),
    Item(title="Schmalznudel", description="Famous bakery for traditional Bavarian pastries",
         item_type="bookmark", category="restaurant", latitude=48.1357, longitude=11.5757,
         address="Prälat-Zistl-Str. 8, Munich", tags="pastries,bakery,breakfast,traditional"),

    # CAFES
    Item(title="Café Luitpold", description="Historic café with great pastries and coffee since 1888",
         item_type="bookmark", category="cafe", latitude=48.1421, longitude=11.5750,
         address="Brienner Str. 11, Munich", tags="coffee,breakfast,historic,pastries"),
    Item(title="Man Versus Machine", description="Specialty third-wave coffee roaster",
         item_type="bookmark", category="cafe", latitude=48.1336, longitude=11.5673,
         address="Müllerstr. 23, Munich", tags="coffee,specialty,roaster,modern"),
    Item(title="Cafe Frischhut", description="Traditional cafe famous for Schmalznudel pastry",
         item_type="bookmark", category="cafe", latitude=48.1356, longitude=11.5760,
         address="Prälat-Zistl-Str. 8, Munich", tags="coffee,pastries,traditional,breakfast"),

    # BARS
    Item(title="English Garden Beer Garden", description="Chinesischer Turm, busiest beer garden in Munich",
         item_type="map_pin", category="bar", latitude=48.1541, longitude=11.5869,
         address="Englischer Garten 3, Munich", tags="beer,garden,evening,outdoor"),
    Item(title="Augustiner Keller", description="Traditional beer garden under chestnut trees",
         item_type="map_pin", category="bar", latitude=48.1448, longitude=11.5499,
         address="Arnulfstr. 52, Munich", tags="beer,garden,traditional,evening"),
    Item(title="Zephyr Bar", description="Award-winning craft cocktail bar",
         item_type="bookmark", category="bar", latitude=48.1310, longitude=11.5768,
         address="Baaderstr. 68, Munich", tags="cocktails,craft,evening,modern"),

    # TRANSPORT
    Item(title="Train to Airport", description="S8 from Marienplatz, takes 40 minutes to MUC",
         item_type="calendar_event", category="transport", latitude=48.1374, longitude=11.5755,
         address="Marienplatz S-Bahn", event_datetime=now + datetime.timedelta(hours=22),
         tags="transport,airport,sbahn,departure"),
    Item(title="Bicycle Rental MVG", description="Pickup spot for city bike rental",
         item_type="map_pin", category="transport", latitude=48.1402, longitude=11.5586,
         address="Hauptbahnhof, Munich", tags="bike,rental,transport,mvg"),
    Item(title="Hauptbahnhof", description="Main train station with regional and ICE connections",
         item_type="map_pin", category="transport", latitude=48.1402, longitude=11.5586,
         address="Bayerstr. 10A, Munich", tags="train,station,transport,regional"),

    # ACCOMMODATION & PRACTICAL
    Item(title="Hotel Checkout", description="Check out by 11am, can leave luggage at reception",
         item_type="calendar_event", category="accommodation", latitude=48.1432, longitude=11.5680,
         address="Schillerstr. 9, Munich", event_datetime=now + datetime.timedelta(hours=18),
         tags="hotel,checkout,luggage"),
    Item(title="Pharmacy near hotel", description="Open Sundays, English speaking",
         item_type="map_pin", category="services", latitude=48.1430, longitude=11.5685,
         address="Schillerstr. 12, Munich", tags="pharmacy,services,emergency"),

    # SHOPPING
    Item(title="Kaufingerstrasse", description="Main shopping street, pedestrian zone",
         item_type="bookmark", category="shopping", latitude=48.1379, longitude=11.5715,
         address="Kaufingerstr., Munich", tags="shopping,fashion,pedestrian"),
    Item(title="Dallmayr Delicatessen", description="Historic luxury food hall",
         item_type="bookmark", category="shopping", latitude=48.1392, longitude=11.5783,
         address="Dienerstr. 14-15, Munich", tags="food,luxury,gourmet,gifts"),

    # PARKS
    Item(title="English Garden", description="One of the largest urban parks in the world",
         item_type="bookmark", category="park", latitude=48.1642, longitude=11.6056,
         address="Englischer Garten, Munich", tags="park,nature,walking,outdoor"),
    Item(title="Surfing the Eisbach", description="Watch surfers on the standing wave",
         item_type="map_pin", category="attraction", latitude=48.1432, longitude=11.5862,
         address="Eisbach, English Garden", tags="surfing,unique,outdoor,free"),

    # NOTES
    Item(title="Restaurant tip from Anna", description="She loved the schweinshaxe at Wirtshaus in der Au",
         item_type="note", category="restaurant", latitude=48.1283, longitude=11.5876,
         address="Lilienstr. 51, Munich", tags="recommendation,traditional,bavarian"),
    Item(title="Free walking tour meeting point", description="Daily 11am at Marienplatz fountain",
         item_type="calendar_event", category="attraction", latitude=48.1374, longitude=11.5755,
         address="Marienplatz fountain", event_datetime=now + datetime.timedelta(hours=14),
         tags="tour,free,walking,guide"),
]

db.add_all(items)
db.commit()
db.close()

print(f"Seeded {len(items)} items")