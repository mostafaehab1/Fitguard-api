// Tunable constants for the injury-risk engine (docs/05 §5.5).
// Kept in one place so they can be calibrated without touching the logic.
export const riskConfig = {
  windowSessions: 20, // N — rolling history depth
  windowDays: 45, // alternative window bound
  minSessions: 3, // below this → insufficient_data
  halfLifeDays: 14, // H — recency aggressiveness
  recurrenceBeta: 1.0, // β — persistence emphasis
  limitationFactor: 1.25, // personalization boost for declared limitations
  scoreScale: 1.5, // S₀ — saturation point
  trendDeadband: 5, // ± noise filter for trend
  fetchCap: 100, // max recent tracked sessions pulled per recompute
};

export const RISK_BANDS = ["low", "moderate", "elevated", "high"];

export function bandOf(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "elevated";
  if (score >= 25) return "moderate";
  return "low";
}

export function bandIndex(band) {
  return RISK_BANDS.indexOf(band);
}
