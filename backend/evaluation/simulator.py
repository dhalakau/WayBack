"""
Simulates tourist sessions for evaluation.
A 'session' = a sequence of context events as a tourist moves through Munich.
"""
import datetime
import random


# Realistic Munich tourist hotspots — sessions move between these
TOURIST_LOCATIONS = [
    {"name": "Marienplatz",    "lat": 48.1374, "lon": 11.5755, "category": "attraction"},
    {"name": "Viktualienmarkt","lat": 48.1351, "lon": 11.5761, "category": "restaurant"},
    {"name": "Deutsches Museum","lat": 48.1299, "lon": 11.5832, "category": "museum"},
    {"name": "Englischer Garten","lat": 48.1541, "lon": 11.5869, "category": "park"},
    {"name": "Hauptbahnhof",   "lat": 48.1402, "lon": 11.5586, "category": "transport"},
    {"name": "Nymphenburg",    "lat": 48.1583, "lon": 11.5031, "category": "attraction"},
    {"name": "Olympic Park",   "lat": 48.1755, "lon": 11.5518, "category": "attraction"},
    {"name": "Hofbräuhaus",    "lat": 48.1376, "lon": 11.5797, "category": "restaurant"},
    {"name": "Alte Pinakothek","lat": 48.1486, "lon": 11.5701, "category": "museum"},
    {"name": "Augustiner Keller","lat": 48.1448, "lon": 11.5499, "category": "bar"},
]


def generate_session(num_events=8, start_hour=9, seed=None):
    """
    Generate a simulated tourist session — a sequence of (location, time, category) events.

    Returns:
        list of context dicts, each ready to pass to a recommender.
    """
    if seed is not None:
        random.seed(seed)

    base_date = datetime.datetime(2026, 4, 27, start_hour, 0, 0)
    locations = random.sample(TOURIST_LOCATIONS, k=min(num_events, len(TOURIST_LOCATIONS)))

    events = []
    current_time = base_date
    for loc in locations:
        events.append({
            "lat": loc["lat"] + random.uniform(-0.001, 0.001),  # add small noise
            "lon": loc["lon"] + random.uniform(-0.001, 0.001),
            "now": current_time,
            "current_category": loc["category"],
            "current_text": loc["name"].lower(),
            "ground_truth_location": loc["name"],
        })
        # advance 30-90 minutes between events
        current_time += datetime.timedelta(minutes=random.randint(30, 90))

    return events


def generate_multiple_sessions(num_sessions=10, num_events=8):
    """Generate several diverse sessions for robust evaluation."""
    return [
        generate_session(num_events=num_events, start_hour=random.randint(8, 18), seed=s)
        for s in range(num_sessions)
    ]