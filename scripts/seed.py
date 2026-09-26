import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import EXPOSURE_VIA_VALUES, Exposure, Holding, Portfolio, Sector

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_data.json"
ALLOWED_VIA = set(EXPOSURE_VIA_VALUES)
WEIGHT_TOLERANCE = Decimal("0.0001")


def load_demo_data(path: Path = DATA_PATH) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate(data: dict[str, Any]) -> None:
    portfolios = data["portfolios"]
    if len(portfolios) != 3:
        raise ValueError(f"expected exactly 3 portfolios, found {len(portfolios)}")

    sector_names = {sector["name"] for sector in data["sectors"]}

    for portfolio in portfolios:
        holdings = portfolio["holdings"]
        if not 5 <= len(holdings) <= 8:
            raise ValueError(
                f"portfolio {portfolio['name']!r} must have 5-8 holdings, found {len(holdings)}"
            )

        total_weight = Decimal("0")
        for holding in holdings:
            if "weight" not in holding:
                raise ValueError(
                    f"holding {holding['ticker']!r} in portfolio "
                    f"{portfolio['name']!r} is missing weight"
                )
            weight = Decimal(str(holding["weight"]))
            if not Decimal("0") < weight <= Decimal("1"):
                raise ValueError(
                    f"holding {holding['ticker']!r} in portfolio "
                    f"{portfolio['name']!r} has weight {weight}, must be > 0 and <= 1"
                )
            total_weight += weight

            if holding["sector"] not in sector_names:
                raise ValueError(
                    f"holding {holding['ticker']!r} references unknown sector "
                    f"{holding['sector']!r}"
                )

        if abs(total_weight - Decimal("1")) > WEIGHT_TOLERANCE:
            raise ValueError(
                f"portfolio {portfolio['name']!r} holding weights sum to "
                f"{total_weight}, expected 1.0"
            )

    for exposure in data["exposures"]:
        if exposure["via"] not in ALLOWED_VIA:
            raise ValueError(
                f"exposure {exposure['id']} has invalid via {exposure['via']!r}"
            )
        exposure_sector = exposure.get("exposure_sector")
        if not isinstance(exposure_sector, str) or not exposure_sector.strip():
            raise ValueError(
                f"exposure {exposure['id']} is missing a non-empty exposure_sector"
            )
        if exposure_sector not in sector_names:
            raise ValueError(
                f"exposure {exposure['id']} references unknown exposure_sector "
                f"{exposure_sector!r}"
            )


def seed(data: dict[str, Any]) -> dict[str, int]:
    counts = {
        "portfolios": len(data["portfolios"]),
        "sectors": len(data["sectors"]),
        "holdings": sum(len(p["holdings"]) for p in data["portfolios"]),
        "exposures": len(data["exposures"]),
    }

    with SessionLocal() as session:
        with session.begin():
            session.execute(delete(Exposure))
            session.execute(delete(Holding))
            session.execute(delete(Portfolio))
            session.execute(delete(Sector))

            session.add_all(
                Sector(id=sector["id"], name=sector["name"])
                for sector in data["sectors"]
            )
            session.add_all(
                Portfolio(id=portfolio["id"], name=portfolio["name"])
                for portfolio in data["portfolios"]
            )
            session.flush()

            session.add_all(
                Holding(
                    portfolio_id=portfolio["id"],
                    ticker=holding["ticker"],
                    company_name=holding["company_name"],
                    shares=holding["shares"],
                    sector=holding["sector"],
                    weight=Decimal(str(holding["weight"])),
                )
                for portfolio in data["portfolios"]
                for holding in portfolio["holdings"]
            )
            session.flush()

            session.add_all(
                Exposure(
                    id=exposure["id"],
                    ticker=exposure["ticker"],
                    exposed_to_ticker=exposure["exposed_to_ticker"],
                    via=exposure["via"],
                    exposure_sector=exposure["exposure_sector"],
                    note=exposure["note"],
                )
                for exposure in data["exposures"]
            )

    return counts


def main() -> None:
    data = load_demo_data()
    validate(data)
    counts = seed(data)
    print("Seed complete:")
    for table in ("portfolios", "sectors", "holdings", "exposures"):
        print(f"  {table}: {counts[table]}")


if __name__ == "__main__":
    main()
