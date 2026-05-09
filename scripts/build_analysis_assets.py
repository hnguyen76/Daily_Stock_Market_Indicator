from __future__ import annotations

import json
from math import sqrt
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "Daily_Global_Stock_Market_Indicators.csv"
ASSET_FILE = ROOT / "assets" / "market_data.js"
REPORT_FILE = ROOT / "reports" / "investment_analysis.md"

REQUIRED_COLUMNS = {
    "Date",
    "Index_Name",
    "Country",
    "Open",
    "High",
    "Low",
    "Close",
    "Volume",
    "Daily_Change_Percent",
}


def pct(value: float | None, decimals: int = 2) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    return f"{value:.{decimals}%}"


def num(value: float | int | None, decimals: int = 2) -> str:
    if value is None or pd.isna(value):
        return "n/a"
    if isinstance(value, int):
        return f"{value:,}"
    return f"{value:,.{decimals}f}"


def clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "item"):
        return clean(value.item())
    if isinstance(value, float) and pd.isna(value):
        return None
    return value


def rank_pct(series: pd.Series, ascending: bool = True) -> pd.Series:
    return series.rank(pct=True, ascending=ascending).fillna(0.0)


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_FILE, parse_dates=["Date"])
    missing = REQUIRED_COLUMNS.difference(df.columns)
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"Missing required columns: {missing_list}")

    df = df.sort_values(["Index_Name", "Date"]).reset_index(drop=True)
    numeric_columns = ["Open", "High", "Low", "Close", "Volume", "Daily_Change_Percent"]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df["Daily_Change"] = df["Daily_Change_Percent"] / 100.0
    df["Close_Return"] = df.groupby("Index_Name")["Close"].pct_change(fill_method=None)
    df["Normalized_Close"] = df.groupby("Index_Name")["Close"].transform(
        lambda values: values / values.iloc[0] * 100
    )
    df["Rolling_30D_Change"] = (
        df.groupby("Index_Name")["Daily_Change"]
        .rolling(30, min_periods=10)
        .mean()
        .reset_index(level=0, drop=True)
    )
    return df


def summarize_indexes(df: pd.DataFrame) -> pd.DataFrame:
    latest_date = df["Date"].max()
    records: list[dict[str, Any]] = []

    for index_name, group in df.groupby("Index_Name", sort=True):
        group = group.sort_values("Date")
        latest = group.iloc[-1]
        last_30 = group.tail(30)
        last_90 = group.tail(90)
        last_365 = group.tail(365)
        close_returns = group["Close_Return"].dropna()

        first_close = float(group["Close"].iloc[0])
        last_close = float(group["Close"].iloc[-1])
        total_close_return = last_close / first_close - 1 if first_close else None
        close_vol_annualized = close_returns.std() * sqrt(252) if len(close_returns) else None

        volume_30 = last_30["Volume"].mean()
        volume_365 = last_365["Volume"].mean()
        volume_trend = volume_30 / volume_365 - 1 if volume_365 else None

        records.append(
            {
                "index": index_name,
                "country": latest["Country"],
                "latestDate": latest_date.strftime("%Y-%m-%d"),
                "latestClose": last_close,
                "latestVolume": int(latest["Volume"]),
                "avgVolume30D": float(volume_30),
                "avgVolume365D": float(volume_365),
                "volumeTrend": volume_trend,
                "avgDailyChange": group["Daily_Change"].mean(),
                "medianDailyChange": group["Daily_Change"].median(),
                "volDailyChange": group["Daily_Change"].std(),
                "annualizedIntradayVol": group["Daily_Change"].std() * sqrt(252),
                "winRate": (group["Daily_Change"] > 0).mean(),
                "avgChange30D": last_30["Daily_Change"].mean(),
                "avgChange90D": last_90["Daily_Change"].mean(),
                "avgChange365D": last_365["Daily_Change"].mean(),
                "vol90D": last_90["Daily_Change"].std(),
                "winRate90D": (last_90["Daily_Change"] > 0).mean(),
                "tailRisk5Pct": group["Daily_Change"].quantile(0.05),
                "bestDay": group["Daily_Change"].max(),
                "worstDay": group["Daily_Change"].min(),
                "closeReturn": total_close_return,
                "closeVolAnnualized": close_vol_annualized,
            }
        )

    summary = pd.DataFrame(records)
    score = (
        rank_pct(summary["avgChange90D"], ascending=True) * 0.30
        + rank_pct(summary["winRate90D"], ascending=True) * 0.25
        + rank_pct(summary["volumeTrend"], ascending=True) * 0.15
        + rank_pct(-summary["vol90D"], ascending=True) * 0.20
        + rank_pct(summary["avgChange365D"], ascending=True) * 0.10
    )
    summary["opportunityScore"] = (score * 100).round(1)

    def regime(row: pd.Series) -> str:
        if row["avgChange90D"] > 0.008 and row["winRate90D"] >= 0.56:
            return "Momentum leader"
        if row["avgChange90D"] > 0 and row["winRate90D"] >= 0.50:
            return "Constructive"
        if row["avgChange90D"] < -0.006 or row["tailRisk5Pct"] < -0.085:
            return "Risk watch"
        return "Neutral"

    summary["regime"] = summary.apply(regime, axis=1)
    return summary.sort_values("opportunityScore", ascending=False).reset_index(drop=True)


def build_series(df: pd.DataFrame) -> dict[str, Any]:
    series: dict[str, Any] = {}
    for index_name, group in df.groupby("Index_Name", sort=True):
        group = group.sort_values("Date")
        series[index_name] = {
            "country": group["Country"].iloc[-1],
            "dates": [date.strftime("%Y-%m-%d") for date in group["Date"]],
            "close": group["Close"].round(2).tolist(),
            "normalizedClose": group["Normalized_Close"].round(2).tolist(),
            "dailyChange": (group["Daily_Change"] * 100).round(2).tolist(),
            "rolling30DChange": (group["Rolling_30D_Change"] * 100).round(2).tolist(),
            "volume": group["Volume"].astype(int).tolist(),
        }
    return series


def build_monthly_heatmap(df: pd.DataFrame) -> list[dict[str, Any]]:
    monthly = df.copy()
    monthly["Month"] = monthly["Date"].dt.to_period("M").astype(str)
    table = (
        monthly.groupby(["Index_Name", "Month"], as_index=False)["Daily_Change"]
        .mean()
        .sort_values(["Index_Name", "Month"])
    )
    return [
        {
            "index": row["Index_Name"],
            "month": row["Month"],
            "avgChange": round(float(row["Daily_Change"]) * 100, 3),
        }
        for _, row in table.iterrows()
    ]


def build_payload(df: pd.DataFrame, summary: pd.DataFrame) -> dict[str, Any]:
    missing_values = int(df[list(REQUIRED_COLUMNS)].isna().sum().sum())
    close_vol_median = summary["closeVolAnnualized"].median()
    daily_change_corr = (
        df.pivot(index="Date", columns="Index_Name", values="Daily_Change")
        .corr()
        .round(3)
        .to_dict()
    )

    payload = {
        "meta": {
            "title": "Daily Global Stock Market Indicators",
            "sourceFile": DATA_FILE.name,
            "rows": int(len(df)),
            "indexes": int(df["Index_Name"].nunique()),
            "countries": int(df["Country"].nunique()),
            "startDate": df["Date"].min().strftime("%Y-%m-%d"),
            "endDate": df["Date"].max().strftime("%Y-%m-%d"),
            "missingValues": missing_values,
            "closeVolAnnualizedMedian": float(close_vol_median),
            "qualityNote": (
                "Close-to-close returns are extremely volatile, so this dashboard treats "
                "Daily_Change_Percent as the primary tactical signal and flags close-level "
                "performance as exploratory."
            ),
        },
        "summary": summary.to_dict(orient="records"),
        "series": build_series(df),
        "monthlyHeatmap": build_monthly_heatmap(df),
        "correlation": daily_change_corr,
    }
    return clean(payload)


def build_report(df: pd.DataFrame, summary: pd.DataFrame) -> str:
    leaders = summary.head(3)
    risk_watch = summary.sort_values("tailRisk5Pct").head(3)
    constructive = summary[summary["regime"].isin(["Momentum leader", "Constructive"])]
    latest_date = df["Date"].max().strftime("%Y-%m-%d")

    lines = [
        "# Professional Investment Analysis",
        "",
        "This report converts the `Daily_Global_Stock_Market_Indicators.csv` dataset into a",
        "repeatable market-indicator analysis for GitHub. It is research material, not",
        "personalized financial advice or a recommendation to buy or sell any security.",
        "",
        "## Dataset Scope",
        "",
        f"- Date range: {df['Date'].min().strftime('%Y-%m-%d')} to {latest_date}",
        f"- Observations: {len(df):,}",
        f"- Indexes covered: {df['Index_Name'].nunique()}",
        f"- Countries covered: {df['Country'].nunique()}",
        f"- Missing required values: {int(df[list(REQUIRED_COLUMNS)].isna().sum().sum()):,}",
        "",
        "## Data Quality Read",
        "",
        "The dataset is useful for building a market analytics workflow, but close-to-close",
        "returns show unusually large volatility for major equity indexes. That means close",
        "level CAGR, Sharpe ratios, and drawdown statistics should be treated as exploratory",
        "rather than tradeable backtest evidence. The dashboard therefore emphasizes",
        "`Daily_Change_Percent`, rolling signal strength, downside tail risk, volume trend,",
        "and cross-index comparison.",
        "",
        "## Executive View",
        "",
    ]

    for _, row in leaders.iterrows():
        lines.append(
            "- "
            f"{row['index']} ({row['country']}): opportunity score {row['opportunityScore']:.1f}/100, "
            f"90D average daily change {pct(row['avgChange90D'])}, "
            f"90D win rate {pct(row['winRate90D'])}, "
            f"volume trend {pct(row['volumeTrend'])}, regime: {row['regime']}."
        )

    lines.extend(
        [
            "",
            "## Investment Interpretation",
            "",
            "A professional allocation read should separate three questions:",
            "",
            "1. Momentum: which markets have the strongest recent average daily change?",
            "2. Risk: which markets have larger downside tails or unstable 90-day volatility?",
            "3. Liquidity: where is recent volume expanding or contracting versus the trailing year?",
            "",
            "Based on this dataset, the highest ranked markets are best interpreted as",
            "watchlist candidates for further due diligence. They should not be treated as",
            "standalone buy signals because the source data does not include valuation,",
            "earnings, rates, macro policy, sector composition, currency movement, or live",
            "market microstructure.",
            "",
            "## Current Watchlist From The Dataset",
            "",
        ]
    )

    if constructive.empty:
        lines.append("- No index currently clears the constructive/momentum filter.")
    else:
        for _, row in constructive.iterrows():
            lines.append(
                "- "
                f"{row['index']}: {row['regime']} with {pct(row['avgChange90D'])} "
                f"90D average daily change and {pct(row['winRate90D'])} positive-day rate."
            )

    lines.extend(
        [
            "",
            "## Risk Watch",
            "",
        ]
    )
    for _, row in risk_watch.iterrows():
        lines.append(
            "- "
            f"{row['index']}: 5th percentile daily change {pct(row['tailRisk5Pct'])}, "
            f"worst day {pct(row['worstDay'])}, 90D volatility {pct(row['vol90D'])}."
        )

    lines.extend(
        [
            "",
            "## Portfolio Guidance",
            "",
            "- Use the dashboard as a screening layer, then validate with live index data and",
            "  macro context before making capital-allocation decisions.",
            "- Favor diversified exposure instead of concentrating in a single regional index.",
            "- Rebalance when a tactical position grows large enough to change portfolio risk.",
            "- Match the risk level to investor time horizon, liquidity needs, and loss tolerance.",
            "",
            "These principles align with SEC Investor.gov guidance that diversification can",
            "reduce portfolio concentration risk, while asset allocation should reflect time",
            "horizon and risk tolerance.",
            "",
            "## Source Links For Investor Context",
            "",
            "- SEC Investor.gov: Diversify Your Investments - https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments",
            "- SEC Investor.gov: Asset Allocation and Diversification - https://www.investor.gov/introduction-investing/getting-started/assessing-your-risk-tolerance",
            "- SEC Investor.gov: What is Risk? - https://www.investor.gov/introduction-investing/investing-basics/what-risk",
            "",
            "## Methodology",
            "",
            "- `Daily_Change_Percent` is converted to decimal form for signal calculations.",
            "- Opportunity score combines 90D average daily change, 90D win rate, volume trend,",
            "  lower 90D volatility, and 365D average daily change.",
            "- Volume trend compares 30D average volume with 365D average volume.",
            "- Risk watch highlights downside tail behavior using the 5th percentile and worst day.",
            "- All calculations are reproducible with `python scripts/build_analysis_assets.py`.",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    df = load_data()
    summary = summarize_indexes(df)
    payload = build_payload(df, summary)

    ASSET_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    ASSET_FILE.write_text(
        "window.MARKET_DATA = "
        + json.dumps(payload, ensure_ascii=True, allow_nan=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    REPORT_FILE.write_text(build_report(df, summary), encoding="utf-8")

    print(f"Wrote {ASSET_FILE.relative_to(ROOT)}")
    print(f"Wrote {REPORT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
