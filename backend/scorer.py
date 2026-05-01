import math
import datetime

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def location_score(item, user_lat, user_lon):
    if item.latitude is None or item.longitude is None:
        return 0.0
    distance = haversine(user_lat, user_lon, item.latitude, item.longitude)
    if distance <= 200:
        return 1.0
    elif distance >= 5000:
        return 0.0
    return 1.0 - ((distance - 200) / (5000 - 200))

def time_score(item, now):
    if item.event_datetime is None:
        return 0.0
    delta = (item.event_datetime - now).total_seconds()
    if delta < 0:
        return 0.05
    elif delta <= 7200:
        return 1.0
    elif delta <= 172800:
        return 1.0 - ((delta - 7200) / (172800 - 7200))
    return 0.0

def category_score(item, now):
    hour = now.hour
    rules = {
        "restaurant": [(7, 10), (12, 14), (18, 22)],
        "cafe": [(7, 11), (14, 17)],
        "bar": [(18, 24)],
        "museum": [(9, 18)],
        "transport": [(6, 9), (16, 20)],
    }
    windows = rules.get(item.category, [])
    for start, end in windows:
        if start <= hour < end:
            return 1.0
    return 0.2

def compute_score(item, user_lat, user_lon, now):
    loc = location_score(item, user_lat, user_lon)
    tim = time_score(item, now)
    cat = category_score(item, now)
    return round((loc * 0.4) + (tim * 0.4) + (cat * 0.2), 4)