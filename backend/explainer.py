import math
import datetime

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def format_distance(meters):
    if meters < 1000:
        return f"{int(meters)}m"
    return f"{meters / 1000:.1f}km"

def format_time(seconds):
    if seconds < 3600:
        m = int(seconds / 60)
        return f"{m} minute{'s' if m != 1 else ''}"
    elif seconds < 86400:
        h = int(seconds / 3600)
        return f"{h} hour{'s' if h != 1 else ''}"
    else:
        d = int(seconds / 86400)
        return f"{d} day{'s' if d != 1 else ''}"

def explain(item, user_lat, user_lon, now=None):
    now = now or datetime.datetime.utcnow()
    reasons = []

    if item.latitude and item.longitude:
        distance = haversine(user_lat, user_lon, item.latitude, item.longitude)
        if distance <= 5000:
            reasons.append(f"you are {format_distance(distance)} away")

    if item.event_datetime:
        delta = (item.event_datetime - now).total_seconds()
        if 0 < delta <= 172800:
            reasons.append(f"this is happening in {format_time(delta)}")
        elif delta < 0:
            reasons.append("this event recently passed")

    hour = now.hour
    cat = (item.category or "").lower()
    if cat == "restaurant" and 12 <= hour < 14:
        reasons.append("it's lunchtime")
    elif cat == "restaurant" and 18 <= hour < 22:
        reasons.append("it's dinnertime")
    elif cat == "cafe" and 7 <= hour < 11:
        reasons.append("it's a good time for coffee")
    elif cat == "bar" and hour >= 18:
        reasons.append("it's evening")

    if item.item_type == "ticket":
        reasons.insert(0, "you have a saved ticket for this")
    elif item.item_type == "bookmark":
        reasons.insert(0, "you bookmarked this place")
    elif item.item_type == "map_pin":
        reasons.insert(0, "you pinned this on your map")

    if not reasons:
        return "This matches something you saved earlier."
    elif len(reasons) == 1:
        return f"Showing because {reasons[0]}."
    else:
        return f"Showing because {', '.join(reasons[:-1])} and {reasons[-1]}."
