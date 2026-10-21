"""Idempotent schema upgrades for databases created before the company registry.

`Base.metadata.create_all` creates missing tables but never alters existing
ones, so a database seeded by an earlier version still needs the newer
exposure columns and a backfilled `companies` table. Every statement here is
safe to run repeatedly.
"""

from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from app.models import Base

_EXPOSURE_COLUMNS = (
    "ALTER TABLE exposures ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'approved'",
    "ALTER TABLE exposures ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'curated'",
    "ALTER TABLE exposures ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION",
    "CREATE INDEX IF NOT EXISTS ix_exposures_status ON exposures (status)",
)

# Holdings already carry name and sector; asset class falls back to public
# equity, which matches how the frontend treated unknown tickers.
_BACKFILL_COMPANIES = """
INSERT INTO companies (ticker, company_name, sector, asset_class, status, source)
SELECT DISTINCT ON (ticker) ticker, company_name, sector, 'public_equity', 'approved', 'curated'
FROM holdings
ORDER BY ticker, id
ON CONFLICT (ticker) DO NOTHING
"""


def reset_sequences(session: Session) -> None:
    """Move serial sequences past explicitly seeded ids so new inserts succeed."""
    for table in ("sectors", "portfolios", "holdings", "exposures"):
        session.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"
            )
        )


def ensure_schema(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session, session.begin():
        for statement in _EXPOSURE_COLUMNS:
            session.execute(text(statement))
        session.execute(text(_BACKFILL_COMPANIES))
        reset_sequences(session)
