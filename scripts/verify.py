#!/usr/bin/env python3
"""Sample portfolio numbers — same literals as app.js SAMPLE."""

from decimal import Decimal, ROUND_HALF_UP

SAMPLE = [
    {"name": "삼성전자", "ticker": "005930", "shares": Decimal("100"), "price": Decimal("80000"), "avg": Decimal("70000")},
    {"name": "QQQ", "ticker": "QQQ", "shares": Decimal("20"), "price": Decimal("500000"), "avg": Decimal("450000")},
    {"name": "NVDA", "ticker": "NVDA", "shares": Decimal("8"), "price": Decimal("1500000"), "avg": Decimal("1200000")},
]


def round1(n: Decimal) -> Decimal:
    return n.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def region_of(ticker: str) -> str:
    t = ticker.strip().upper()
    bare = t.removesuffix(".KS").removesuffix(".KQ")
    if bare.isdigit() and len(bare) == 6:
        return "kr"
    if t.endswith(".KS") or t.endswith(".KQ"):
        return "kr"
    return "us"


def main() -> None:
    assert region_of("005930") == "kr"
    assert region_of("005930.KS") == "kr"
    assert region_of("QQQ") == "us"
    assert region_of("NVDA") == "us"

    values = [h["shares"] * h["price"] for h in SAMPLE]
    total = sum(values)
    assert total == Decimal("30000000")

    weights = [round1(v / total * 100) for v in values]
    assert weights == [Decimal("26.7"), Decimal("33.3"), Decimal("40.0")]
    assert sum(weights) == Decimal("100.0")

    kr = sum(v for h, v in zip(SAMPLE, values) if region_of(h["ticker"]) == "kr")
    us = sum(v for h, v in zip(SAMPLE, values) if region_of(h["ticker"]) == "us")
    assert kr == Decimal("8000000")
    assert us == Decimal("22000000")
    assert round1(kr / total * 100) == Decimal("26.7")
    assert round1(us / total * 100) == Decimal("73.3")

    pnl = [(h["price"] - h["avg"]) * h["shares"] for h in SAMPLE]
    assert pnl == [Decimal("1000000"), Decimal("1000000"), Decimal("2400000")]

    cash_total = total + Decimal("2000000")
    assert round1(Decimal("8000000") / cash_total * 100) == Decimal("25.0")
    assert round1(Decimal("22000000") / cash_total * 100) == Decimal("68.8")
    assert round1(Decimal("2000000") / cash_total * 100) == Decimal("6.3")

    print("ok")
    print(f"total={total}")
    print(f"weights={weights}")
    print(f"kr={round1(kr / total * 100)} us={round1(us / total * 100)}")


if __name__ == "__main__":
    main()
