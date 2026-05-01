import sys
import os
import datetime
import pytest

# Ensure backend root is importable when pytest runs from tests/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Item


@pytest.fixture(scope="session")
def db_items():
    """Load all seeded items from the database once per session."""
    db = SessionLocal()
    items = db.query(Item).all()
    db.close()
    assert len(items) > 0, "Database is empty — run seed.py first"
    return items


@pytest.fixture(scope="session")
def base_context():
    """A realistic Munich context used across recommender tests."""
    return {
        "lat": 48.1374,
        "lon": 11.5755,
        "now": datetime.datetime.now(datetime.timezone.utc),
        "current_category": "restaurant",
        "current_text": "traditional bavarian beer hall",
    }
