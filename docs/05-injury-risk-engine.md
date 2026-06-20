# 05 — Injury-Risk Engine

This is the academic core of FitGuard. It is the component that justifies the claim
*"we prevent injuries caused by cumulative poor form"* — and the part professors will
probe hardest. It is deliberately **interpretable** (a transparent, parameterized
formula), not a black box, so every number can be explained and defended.

> **Framing for the defense.** This is a *risk-awareness indicator*, not a medical
> prediction. It is not clinically validated. Its job is to surface *recurring,
> severity-weighted, region-specific* form problems so users (and coaches) can act
> before cumulative load causes injury. This honest scope is what the onboarding
> disclaimer covers.

## 5.1 Design principles (what makes this not a workout logger)

A naive app counts mistakes. FitGuard's score combines **five** factors a serious
reviewer will look for:

| Factor | Captures | Source |
|--------|----------|--------|
| **Severity** | How dangerous a mistake is (rounding a deadlift ≫ shallow squat) | `MistakeCategory.severityWeight` (1–5) |
| **Frequency** | How often it happens *per rep* (exposure-normalized) | `count / totalReps` |
| **Recency** | Recent form matters more than months-old form | exponential time decay |
| **Persistence** | **Recurring across sessions**, not one bad day — the thesis | distinct sessions with the mistake |
| **Personalization** | Pre-existing conditions raise sensitivity | `User.profile.limitations` |

Risk is computed **per body region** (Knee, Lower back, Shoulder, …) because injuries
are region-specific and "your knees are at elevated risk" is far more actionable than
a single opaque number.

## 5.2 Inputs

Computed from completed **tracked** `WorkoutSession`s over a rolling **window**:

- Window = the last `N = 20` completed tracked sessions **or** the last `45` days
  (whichever covers more), with a **minimum of 3 sessions**; below that the profile
  reads `insufficient_data` (cold-start).
- For each session `s`, each effort, each mistake `m`:
  - `severity(m)` ∈ [1,5] and `region(m)` from `MistakeCategory`
  - `count(s,m)` and `reps(s,m)` = reps of that exercise in that session
  - `ageDays(s)` = days between `s.endedAt` and now

## 5.3 The formula

**Step 1 — per-incident severity-weighted rate** (exposure-normalized):

```
incident(s,m) = severity(m) × ( count(s,m) / reps(s,m) )        ∈ [0, 5]
```

**Step 2 — time decay** (half-life `H = 14` days):

```
decay(s) = 0.5 ^ ( ageDays(s) / H )                            ∈ (0, 1]
```

**Step 3 — region incidence** (time-weighted mean over the window):

```
Incidence(R) = Σ_{s,m∈R} decay(s)·incident(s,m)
               ───────────────────────────────────
                     Σ_{s∈window} decay(s)
```

**Step 4 — persistence / recurrence** (the cumulative-over-time emphasis):

```
Recurrence(R) = 1 + β × ( sessionsWith(R) / sessionsInWindow )   , β = 1.0
```
A mistake appearing in 9/10 sessions ⇒ ≈2.0×; in 1/10 ⇒ ≈1.1×. This is what
separates a *recurring* risk from an *isolated* slip.

**Step 5 — personalization** (the "human-condition" sensitivity):

```
limitFactor(R) = 1.25 if R ∈ user.limitations else 1.0
```

**Step 6 — raw → bounded score** (saturating, scale `S₀ = 1.5`):

```
Raw(R)   = Incidence(R) × Recurrence(R) × limitFactor(R)
Score(R) = round( 100 × ( 1 − e^( −Raw(R) / S₀ ) ) )            ∈ [0, 100]
```

**Step 7 — bands & trend:**

| Band | Score |
|------|-------|
| low | 0–24 |
| moderate | 25–49 |
| elevated | 50–74 |
| high | 75–100 |

`trend` = compare `Score(R)` to the previous snapshot with a ±5 deadband → `up` /
`down` / `flat`.

**Step 8 — overall:**

```
Overall = round( 0.6 × max_R Score(R) + 0.4 × mean_R Score(R) )
```
The worst region dominates (so a single dangerous pattern isn't averaged away) while
breadth still counts.

**Edge cases (item 16):**
- If **no region is flagged** (no qualifying mistakes in the window), `overall.score = 0`,
  `overall.band = "low"`, and `byBodyRegion` is empty.
- On the **first snapshot** (nothing earlier to compare against), every `trend = "flat"`.
- Below the minimum session count the profile is `insufficient_data` (no scores at all).

### Why improvement lowers risk automatically

No special "improvement" term is needed. As a user fixes their form, recent sessions
have low `incident` **and** the highest `decay` weight, while the old bad sessions
decay toward zero and eventually leave the window. `Score(R)` falls on its own — an
*emergent* property, which is a clean thing to show in the defense.

## 5.4 Worked example (knee valgus on squats)

Three squat sessions in the window; `knee_valgus` has `severity = 4`, region `Knee`.

| Session | ageDays | decay | reps | valgus count | rate | incident |
|---------|---------|-------|------|--------------|------|----------|
| A | 0 | 1.000 | 20 | 6 | 0.300 | 1.200 |
| B | 7 | 0.707 | 18 | 3 | 0.167 | 0.667 |
| C | 21 | 0.354 | 20 | 5 | 0.250 | 1.000 |

```
Incidence(Knee) = (1.000·1.200 + 0.707·0.667 + 0.354·1.000) / (1.000+0.707+0.354)
                = 2.025 / 2.061 = 0.983
Recurrence(Knee) = 1 + 1.0 × (3/3) = 2.0
Raw(Knee)  = 0.983 × 2.0 × 1.0 = 1.966
Score(Knee)= 100 × (1 − e^(−1.966/1.5)) = 100 × (1 − 0.270) = 73  → "elevated"
```
If the user declared a **Knee** limitation: `Raw = 1.966 × 1.25 = 2.458` →
`Score = 81` → **high**. Personalization correctly pushes an at-risk user up a band.

## 5.5 Constants (all tunable; calibrate against pilot data)

| Constant | Symbol | Default | Meaning |
|----------|--------|---------|---------|
| Window size | `N` | 20 sessions | rolling history depth |
| Window age | — | 45 days | alternative window bound |
| Min sessions | — | 3 | below this → `insufficient_data` |
| Decay half-life | `H` | 14 days | recency aggressiveness |
| Recurrence weight | `β` | 1.0 | persistence emphasis |
| Limitation factor | — | 1.25 | personalization boost |
| Score scale | `S₀` | 1.5 | saturation point |
| Trend deadband | — | ±5 | noise filter |

These live in one config module (`riskConfig`) so they can be tuned without touching
logic — and so you can *show* the sensitivity analysis in your report.

## 5.6 Computation, storage, triggering

- **Trigger:** after every successfully-saved completed **tracked** session.
- **Write:** upsert `InjuryRiskProfile` (current state) **and** append an
  `InjuryRiskSnapshot` (for trend charts in `/api/progress/trends`).
- **Authority:** computed **only** server-side from raw events (ADR-004). No client or
  AI input can set a score. Admins cannot edit it (data-integrity rule).
- **Scored vs descriptive (item 12):** only `overall` and `byBodyRegion` carry computed
  `score`/`band`/`trend` from the formula above. `byExercise` and `byMistakeCategory` in
  `InjuryRiskProfile` (`02 §2.12`) are **descriptive** — recent counts, `lastSeenAt`, and
  the contributing region's band — so no undefined sub-score is implied.
- **Cost:** O(window) per recompute — trivial; no background job required, though a
  nightly recompute can apply decay even on rest days (optional).

## 5.7 Risk alerts (closes the loop)

When a region's band increases (e.g. `moderate → elevated`) versus the previous
snapshot, create a `risk_alert` `Notification`:

> *"Heads up: your **knees** are at **elevated** risk from repeated knee cave-in on
> squats. Cue: push your knees out over your toes."*

The cue text is `MistakeCategory.correctiveCue` for the dominant contributing mistake.
This is the moment the platform delivers on "alert the user on the spot before
cumulative damage" — at the session boundary rather than mid-rep, which is the honest,
defensible version of real-time alerting for an on-device app.

## 5.8 Coach view

A subscribed coach can read a subscriber's `InjuryRiskProfile` and `trends`
(read-only) via `GET /api/coaches/me/subscribers/:userId/progress`. This is the
"human factor": when the engine flags elevated risk, the coach can intervene by
adjusting the plan — the AI-plus-human safety net professors asked for.

## 5.9 Honest limitations (state these proactively)

- Heuristic, not clinically validated; thresholds are reasoned, not trial-derived.
- Depends on on-device CV accuracy (false positives/negatives propagate).
- Per-rep counts assume the CV correctly attributes mistakes; ambiguous form may be
  under/over-counted.
- It estimates *risk exposure*, not injury probability. Framed as awareness, with the
  coach + disclaimer as the safety backstop, this is a sound and defensible design.
