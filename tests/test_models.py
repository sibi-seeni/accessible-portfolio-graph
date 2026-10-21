from sqlalchemy import CheckConstraint

from app.models import Base


def test_table_names() -> None:
    assert set(Base.metadata.tables) == {
        "portfolios",
        "sectors",
        "holdings",
        "exposures",
        "companies",
    }


def test_portfolios_columns() -> None:
    table = Base.metadata.tables["portfolios"]
    assert set(table.columns.keys()) == {"id", "name"}
    assert table.c.id.primary_key
    assert table.c.name.nullable is False
    assert table.c.name.unique is True


def test_sectors_columns() -> None:
    table = Base.metadata.tables["sectors"]
    assert set(table.columns.keys()) == {"id", "name"}
    assert table.c.id.primary_key
    assert table.c.name.nullable is False
    assert table.c.name.unique is True


def test_holdings_columns_and_foreign_key() -> None:
    table = Base.metadata.tables["holdings"]
    assert set(table.columns.keys()) == {
        "id",
        "portfolio_id",
        "ticker",
        "company_name",
        "shares",
        "sector",
        "weight",
    }
    assert table.c.id.primary_key
    assert table.c.portfolio_id.nullable is False
    fk = next(iter(table.c.portfolio_id.foreign_keys))
    assert fk.target_fullname == "portfolios.id"
    assert table.c.ticker.nullable is False
    assert table.c.company_name.nullable is False
    assert table.c.shares.nullable is False
    assert table.c.sector.nullable is False
    assert table.c.weight.nullable is False


def test_holdings_weight_check_constraint() -> None:
    table = Base.metadata.tables["holdings"]
    checks = [
        c
        for c in table.constraints
        if isinstance(c, CheckConstraint) and c.name == "ck_holdings_weight"
    ]
    assert len(checks) == 1
    sqltext = str(checks[0].sqltext)
    assert "weight > 0" in sqltext
    assert "weight <= 1" in sqltext


def test_exposures_columns() -> None:
    table = Base.metadata.tables["exposures"]
    assert set(table.columns.keys()) == {
        "id",
        "ticker",
        "exposed_to_ticker",
        "via",
        "exposure_sector",
        "note",
        "status",
        "source",
        "confidence",
    }
    assert table.c.id.primary_key
    assert table.c.ticker.nullable is False
    assert table.c.exposed_to_ticker.nullable is False
    assert table.c.via.nullable is False
    assert table.c.exposure_sector.nullable is False
    assert table.c.note.nullable is False


def test_exposures_via_check_constraint() -> None:
    from app.models import EXPOSURE_VIA_VALUES

    table = Base.metadata.tables["exposures"]
    checks = [
        c
        for c in table.constraints
        if isinstance(c, CheckConstraint) and c.name == "ck_exposures_via"
    ]
    assert len(checks) == 1
    sqltext = str(checks[0].sqltext)
    for value in EXPOSURE_VIA_VALUES:
        assert value in sqltext
    assert "competitor" not in sqltext
    assert "regulatory" not in sqltext


def _indexed_columns(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {tuple(sorted(index.columns.keys())) for index in table.indexes}


def test_expected_indexes() -> None:
    assert ("portfolio_id",) in _indexed_columns("holdings")
    assert ("ticker",) in _indexed_columns("holdings")
    assert ("ticker",) in _indexed_columns("exposures")
    assert ("exposed_to_ticker",) in _indexed_columns("exposures")


def test_companies_columns_and_constraints() -> None:
    from app.models import ASSET_CLASS_VALUES

    table = Base.metadata.tables["companies"]
    assert set(table.columns.keys()) == {
        "ticker",
        "company_name",
        "sector",
        "asset_class",
        "description",
        "status",
        "source",
    }
    assert table.c.ticker.primary_key
    checks = {
        c.name: str(c.sqltext)
        for c in table.constraints
        if isinstance(c, CheckConstraint)
    }
    for value in ASSET_CLASS_VALUES:
        assert value in checks["ck_companies_asset_class"]
    assert "proposed" in checks["ck_companies_status"]
    assert "agent" in checks["ck_companies_source"]


def test_exposure_lifecycle_defaults() -> None:
    table = Base.metadata.tables["exposures"]
    assert table.c.status.server_default.arg == "approved"
    assert table.c.source.server_default.arg == "curated"
    assert table.c.confidence.nullable is True
