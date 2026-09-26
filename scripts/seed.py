import json
from pathlib import Path
from typing import Any

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import Exposure, Holding, Portfolio, Sector

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_data.json"
ALLOWED_VIA = {"supply_chain", "competitor", "regulatory"}


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
        for holding in holdings:
            if holding["sector"] not in sector_names:
                raise ValueError(
                    f"holding {holding['ticker']!r} references unknown sector "
                    f"{holding['sector']!r}"
                )

    for exposure in data["exposures"]:
        if exposure["via"] not in ALLOWED_VIA:
            raise ValueError(
                f"exposure {exposure['id']} has invalid via {exposure['via']!r}"
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
