from decimal import Decimal

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


EXPOSURE_VIA_VALUES: tuple[str, ...] = (
    "demand_driver",
    "operating_dependency",
    "housing_cycle",
    "lending",
    "credit_market",
    "financing_dependency",
    "supply_chain",
)

_EXPOSURE_VIA_SQL = ", ".join(f"'{value}'" for value in EXPOSURE_VIA_VALUES)

ASSET_CLASS_VALUES: tuple[str, ...] = (
    "public_equity",
    "private_equity",
    "real_estate",
    "private_credit",
    "infrastructure",
)

# Review lifecycle shared by companies and exposures. Only "approved" rows are
# part of the graph that insight, query and narration read; "proposed" rows are
# waiting on a person (usually created by the connection agent).
STATUS_APPROVED = "approved"
STATUS_PROPOSED = "proposed"
STATUS_REJECTED = "rejected"
STATUS_VALUES: tuple[str, ...] = (STATUS_APPROVED, STATUS_PROPOSED, STATUS_REJECTED)

# Who created a row: seeded demo data, a person in the UI, or the agent.
SOURCE_CURATED = "curated"
SOURCE_USER = "user"
SOURCE_AGENT = "agent"
SOURCE_VALUES: tuple[str, ...] = (SOURCE_CURATED, SOURCE_USER, SOURCE_AGENT)


def _in_sql(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class Sector(Base):
    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class Holding(Base):
    __tablename__ = "holdings"
    __table_args__ = (
        CheckConstraint(
            "weight > 0 AND weight <= 1",
            name="ck_holdings_weight",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(
        ForeignKey("portfolios.id"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String, nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, nullable=False)
    sector: Mapped[str] = mapped_column(String, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)


class Company(Base):
    """Registry of every asset the graph knows about, held or not.

    `ticker` is the same stable identifier used by holdings and exposures, so a
    company can be referenced by exposures before any portfolio holds it.
    """

    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint(_in_sql("asset_class", ASSET_CLASS_VALUES), name="ck_companies_asset_class"),
        CheckConstraint(_in_sql("status", STATUS_VALUES), name="ck_companies_status"),
        CheckConstraint(_in_sql("source", SOURCE_VALUES), name="ck_companies_source"),
    )

    ticker: Mapped[str] = mapped_column(String, primary_key=True)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, nullable=False)
    asset_class: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String, nullable=False, default=STATUS_APPROVED, server_default=STATUS_APPROVED
    )
    source: Mapped[str] = mapped_column(
        String, nullable=False, default=SOURCE_CURATED, server_default=SOURCE_CURATED
    )


class Exposure(Base):
    __tablename__ = "exposures"
    __table_args__ = (
        CheckConstraint(
            f"via IN ({_EXPOSURE_VIA_SQL})",
            name="ck_exposures_via",
        ),
        CheckConstraint(_in_sql("status", STATUS_VALUES), name="ck_exposures_status"),
        CheckConstraint(_in_sql("source", SOURCE_VALUES), name="ck_exposures_source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String, nullable=False, index=True)
    exposed_to_ticker: Mapped[str] = mapped_column(String, nullable=False, index=True)
    via: Mapped[str] = mapped_column(String, nullable=False)
    exposure_sector: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=STATUS_APPROVED,
        server_default=STATUS_APPROVED,
        index=True,
    )
    source: Mapped[str] = mapped_column(
        String, nullable=False, default=SOURCE_CURATED, server_default=SOURCE_CURATED
    )
    # 0-1 self-reported confidence for agent proposals; null for curated rows.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
