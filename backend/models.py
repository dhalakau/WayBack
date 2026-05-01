from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String)
    item_type = Column(String)     # bookmark, ticket, map_pin, calendar_event, note
    category = Column(String)      # restaurant, museum, cafe, bar, transport
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String)
    event_datetime = Column(DateTime)
    tags = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)