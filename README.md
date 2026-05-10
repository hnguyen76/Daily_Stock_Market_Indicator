# Daily Global Stock Market Indicators
https://hnguyen76.github.io/Daily_Stock_Market_Indicator/

Professional analytics layer for a daily global stock market indicator dataset. The
project includes a reproducible Python analysis pipeline, a static interactive
dashboard, and an investment research report suitable for publishing on GitHub.

## What Is Included

- `index.html` - interactive static dashboard with trend, risk, heatmap, and scorecard views.
- `reports/investment_analysis.md` - professional investment analysis and methodology.
- `scripts/build_analysis_assets.py` - reproducible pipeline that rebuilds dashboard data and the report from the CSV.
- `Daily_Global_Stock_Market_Indicators.csv` - source dataset.

## Dashboard

Open `index.html` in a browser to view the dashboard locally. The dashboard has no
frontend build step and no external JavaScript dependencies, so it is ready for
GitHub Pages or any static hosting service.

Key views:

- Rebased close trend and rolling 30-day market momentum.
- 90-day risk and signal positioning map.
- Monthly average daily-change heatmap.
- Opportunity-score and risk-watch lists.
- Sortable cross-index market scoreboard.

## Investment Analysis

The analysis intentionally treats this dataset as a screening layer, not a live
trading signal. Close-to-close returns show unusually large volatility for major
equity indexes, so the dashboard emphasizes `Daily_Change_Percent`, rolling signal
strength, downside tail behavior, volume trend, and relative market comparison.

Read the full report: [Professional Investment Analysis](reports/investment_analysis.md)

## Reproduce The Assets

```bash
python -m pip install -r requirements.txt
python scripts/build_analysis_assets.py
```

The script regenerates:

- `assets/market_data.js`
- `reports/investment_analysis.md`

## Methodology Summary

The opportunity score combines:

- 90-day average daily change.
- 90-day positive-day rate.
- 30-day versus 365-day volume trend.
- Lower 90-day volatility.
- 365-day average daily change.

Risk watch uses downside tail behavior, including 5th percentile daily change and
worst observed day.

## Investor Context

This project is for research and education. It is not personalized financial
advice. Before making investment decisions, validate signals with live market
data, macro context, costs, taxes, risk tolerance, and time horizon.

Useful SEC Investor.gov references:

- Diversification: https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments
- Asset allocation and diversification: https://www.investor.gov/introduction-investing/getting-started/assessing-your-risk-tolerance
- Investment risk: https://www.investor.gov/introduction-investing/investing-basics/what-risk
