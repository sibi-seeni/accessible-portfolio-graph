from sqlalchemy import CheckConstraint

from app.models import Base


def test_table_names() -> None:
    assert set(Base.metadata.tables) == {"portfolios", "sectors", "holdings", "exposures"}


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
    }
    assert table.c.id.primary_key
    assert table.c.ticker.nullable is False
    assert table.c.exposed_to_ticker.nullable is False
    assert table.c.via.nullable is False
    assert table.c.exposure_sector.nullable is False
    assert table.c.note.nullable is False


def test_exposures_via_check_constraint() -> None:
    table = Base.metadata.tables["exposures"]
    checks = [c for c in table.constraints if isinstance(c, CheckConstraint)]
    assert len(checks) == 1
    sqltext = str(checks[0].sqltext)
    for value in ("supply_chain", "competitor", "regulatory"):
        assert value in sqltext


def _indexed_columns(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {tuple(sorted(index.columns.keys())) for index in table.indexes}


def test_expected_indexes() -> None:
    assert ("portfolio_id",) in _indexed_columns("holdings")
    assert ("ticker",) in _indexed_columns("holdings")
    assert ("ticker",) in _indexed_columns("exposures")
    assert ("exposed_to_ticker",) in _indexed_columns("exposures")
