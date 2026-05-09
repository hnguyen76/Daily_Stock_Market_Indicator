# Professional Investment Analysis

This report converts the `Daily_Global_Stock_Market_Indicators.csv` dataset into a
repeatable market-indicator analysis for GitHub. It is research material, not
personalized financial advice or a recommendation to buy or sell any security.

## Dataset Scope

- Date range: 2020-01-01 to 2024-12-31
- Observations: 18,270
- Indexes covered: 10
- Countries covered: 8
- Missing required values: 0

## Data Quality Read

The dataset is useful for building a market analytics workflow, but close-to-close
returns show unusually large volatility for major equity indexes. That means close
level CAGR, Sharpe ratios, and drawdown statistics should be treated as exploratory
rather than tradeable backtest evidence. The dashboard therefore emphasizes
`Daily_Change_Percent`, rolling signal strength, downside tail risk, volume trend,
and cross-index comparison.

## Executive View

- Nikkei 225 (Japan): opportunity score 75.2/100, 90D average daily change 0.12%, 90D win rate 50.00%, volume trend 13.56%, regime: Constructive.
- S&P 500 (USA): opportunity score 69.5/100, 90D average daily change 0.23%, 90D win rate 48.89%, volume trend 3.05%, regime: Neutral.
- FTSE 100 (UK): opportunity score 69.2/100, 90D average daily change 0.02%, 90D win rate 50.00%, volume trend -2.44%, regime: Constructive.

## Investment Interpretation

A professional allocation read should separate three questions:

1. Momentum: which markets have the strongest recent average daily change?
2. Risk: which markets have larger downside tails or unstable 90-day volatility?
3. Liquidity: where is recent volume expanding or contracting versus the trailing year?

Based on this dataset, the highest ranked markets are best interpreted as
watchlist candidates for further due diligence. They should not be treated as
standalone buy signals because the source data does not include valuation,
earnings, rates, macro policy, sector composition, currency movement, or live
market microstructure.

## Current Watchlist From The Dataset

- Nikkei 225: Constructive with 0.12% 90D average daily change and 50.00% positive-day rate.
- FTSE 100: Constructive with 0.02% 90D average daily change and 50.00% positive-day rate.

## Risk Watch

- Hang Seng: 5th percentile daily change -5.84%, worst day -30.98%, 90D volatility 4.39%.
- Nikkei 225: 5th percentile daily change -5.78%, worst day -41.54%, 90D volatility 4.06%.
- Dow Jones: 5th percentile daily change -5.61%, worst day -32.22%, 90D volatility 3.77%.

## Portfolio Guidance

- Use the dashboard as a screening layer, then validate with live index data and
  macro context before making capital-allocation decisions.
- Favor diversified exposure instead of concentrating in a single regional index.
- Rebalance when a tactical position grows large enough to change portfolio risk.
- Match the risk level to investor time horizon, liquidity needs, and loss tolerance.

These principles align with SEC Investor.gov guidance that diversification can
reduce portfolio concentration risk, while asset allocation should reflect time
horizon and risk tolerance.

## Source Links For Investor Context

- SEC Investor.gov: Diversify Your Investments - https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments
- SEC Investor.gov: Asset Allocation and Diversification - https://www.investor.gov/introduction-investing/getting-started/assessing-your-risk-tolerance
- SEC Investor.gov: What is Risk? - https://www.investor.gov/introduction-investing/investing-basics/what-risk

## Methodology

- `Daily_Change_Percent` is converted to decimal form for signal calculations.
- Opportunity score combines 90D average daily change, 90D win rate, volume trend,
  lower 90D volatility, and 365D average daily change.
- Volume trend compares 30D average volume with 365D average volume.
- Risk watch highlights downside tail behavior using the 5th percentile and worst day.
- All calculations are reproducible with `python scripts/build_analysis_assets.py`.
