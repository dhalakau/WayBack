import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Where the data lives.
#
# In production (Render), set DATABASE_URL to a managed Postgres connection
# string (e.g. a Neon database). Render's free web-service disk is ephemeral:
# a local SQLite file is wiped on every deploy AND every spin-down, which is
# why saved places kept vanishing. Pointing DATABASE_URL at managed Postgres
# is what makes saves survive.
#
# Locally, DATABASE_URL is usually unset, so we fall back to a SQLite file —
# zero setup for dev and tests.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///wayback.db")

# Some providers still hand out the legacy "postgres://" scheme, which
# SQLAlchemy 2.x no longer accepts. Normalise it to "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping checks a connection is alive before handing it out, which
    # matters for serverless Postgres (Neon) that drops idle connections.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
