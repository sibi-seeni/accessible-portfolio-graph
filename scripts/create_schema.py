from app.db import engine
from app.models import Base


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Schema ready: portfolios, sectors, holdings, exposures.")


if __name__ == "__main__":
    main()
