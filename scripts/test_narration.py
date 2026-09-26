"""Manual check: generate both narrations for portfolio 1.

Requires Snowflake credentials in .env. Run with:

    .venv/bin/python scripts/test_narration.py
"""

from app.db import SessionLocal
from app.insight import get_portfolio_insight
from app.narration import generate_holdings_narration, generate_risk_narration

PORTFOLIO_ID = 1


def main() -> None:
    print("=== Holdings narration ===")
    print(generate_holdings_narration(PORTFOLIO_ID))

    with SessionLocal() as session:
        insight = get_portfolio_insight(session, PORTFOLIO_ID)
    if insight is None:
        raise SystemExit(f"Portfolio {PORTFOLIO_ID} not found")

    print()
    print("=== Risk narration ===")
    print(generate_risk_narration(PORTFOLIO_ID, insight))


if __name__ == "__main__":
    main()
