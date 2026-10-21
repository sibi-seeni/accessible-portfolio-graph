from app.db import engine
from app.migrate import ensure_schema


def main() -> None:
    ensure_schema(engine)
    print("Schema ready: portfolios, sectors, holdings, exposures, companies.")


if __name__ == "__main__":
    main()
