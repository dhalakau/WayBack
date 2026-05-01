from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from database import Base
import datetime


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


class Item(Base):
    __tablename__ = "items"

    id              = Column(Integer, primary_key=True)
    title           = Column(String, nullable=False)
    description     = Column(String)
    item_type       = Column(String)      # bookmark | ticket | map_pin | note
    category        = Column(String)      # restaurant | museum | cafe | bar | outdoor | culture
    latitude        = Column(Float)
    longitude       = Column(Float)
    address         = Column(String)
    event_datetime  = Column(DateTime)
    tags            = Column(String)
    created_at      = Column(DateTime, default=now_utc)

    # Added for contract — used by CIA ranking model
    last_viewed_at  = Column(DateTime, default=now_utc)
    view_count      = Column(Integer, default=0)


class Feedback(Base):
    __tablename__ = "feedback"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(String)
    item_id    = Column(Integer)
    useful     = Column(Boolean, nullable=False)
    method     = Column(String)           # CBR | JITIR | CIA
    lat        = Column(Float)
    lng        = Column(Float)
    time       = Column(Integer)          # unix ms snapshot of when feedback was given
    created_at = Column(DateTime, default=now_utc)
