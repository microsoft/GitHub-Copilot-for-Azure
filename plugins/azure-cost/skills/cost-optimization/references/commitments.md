# Commitment Analysis

1. Require a billing scope for portfolio utilization. If only a subscription is
   available, ask for its billing account before calling
   `list_benefit_utilization`.
2. Report utilization per Reservation or Savings Plan. Flag less than 90% for
   investigation; do not aggregate unrelated commitments.
3. Call `query_costs` with `AmortizedCost`, grouped by `PricingModel`, for a
   recent window. Report committed and on-demand spend per currency.
4. Call `get_benefit_recommendations` for new purchases. Preserve the tool's
   look-back period, savings amount, savings percentage, coverage, and expected
   utilization; do not relabel period savings as monthly savings.
5. For low utilization, call `list_reservation_transactions` with the billing
   scope and a required `from` date. Optionally set `to`; the lookback is limited
   to about three months. Correlate purchase, refund, or exchange events with
   scope or region mismatch and resource inventory changes. Treat missing
   history as inconclusive rather than proof that nothing changed.
6. Present current utilization, coverage, new recommendations, and remediation
   options. Never purchase, exchange, or refund a commitment without explicit
   user approval.
