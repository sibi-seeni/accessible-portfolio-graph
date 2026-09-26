from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


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


class Exposure(Base):
    __tablename__ = "exposures"
    __table_args__ = (
        CheckConstraint(
            "via IN ('supply_chain', 'competitor', 'regulatory')",
            name="ck_exposures_via",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String, nullable=False, index=True)
    exposed_to_ticker: Mapped[str] = mapped_column(String, nullable=False, index=True)
    via: Mapped[str] = mapped_column(String, nullable=False)
    exposure_sector: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
