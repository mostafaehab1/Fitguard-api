// Injury-Risk Engine — the academic core (docs/05).
//
// Severity × Frequency × Recency × Persistence × Personalization, per body region.
// Pure `computeRiskProfile` (unit-testable) + `recomputeUserRisk` (loads + persists).
import { riskConfig, bandOf, bandIndex } from "../config/riskConfig.js";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { MistakeCategory } from "../models/MistakeCategory.js";
import { InjuryRiskProfile } from "../models/InjuryRiskProfile.js";
import { InjuryRiskSnapshot } from "../models/InjuryRiskSnapshot.js";
import { User } from "../models/User.js";

function ageDays(endedAt, now) {
  return Math.max(0, (now.getTime() - new Date(endedAt).getTime()) / 86400000);
}

function trendOf(current, previous, deadband) {
  if (previous == null) return "flat";
  if (current > previous + deadband) return "up";
  if (current < previous - deadband) return "down";
  return "flat";
}

/**
 * Pure scoring function (docs/05 §5.3).
 * @param {object} input
 * @param {Array}  input.sessions   recent tracked sessions (desc by endedAt)
 * @param {Map}    input.categoriesByKey  key -> { severityWeight, bodyRegion, correctiveCue }
 * @param {Array}  input.limitations declared body-region limitations
 * @param {object} input.previous   previous InjuryRiskProfile (or null)
 * @param {Date}   input.now
 * @param {object} [input.config]
 * @returns {{ status, profile, snapshot, riskAlert }}
 */
export function computeRiskProfile({
  sessions,
  categoriesByKey,
  limitations = [],
  previous = null,
  now = new Date(),
  config = riskConfig,
}) {
  // 1. Window: union of the N most-recent sessions and those within windowDays.
  const inWindow = sessions.filter(
    (s, i) => i < config.windowSessions || ageDays(s.endedAt, now) <= config.windowDays
  );

  const sessionsConsidered = inWindow.length;
  const prevRegionScore = new Map(
    (previous?.byBodyRegion ?? []).map((r) => [r.region, r.score])
  );
  const prevOverall = previous?.overall?.score ?? null;

  if (sessionsConsidered < config.minSessions) {
    return {
      status: "insufficient_data",
      profile: {
        overall: { score: 0, band: "low", trend: "flat" },
        byBodyRegion: [],
        byExercise: [],
        byMistakeCategory: [],
        sessionsConsidered,
      },
      snapshot: null,
      riskAlert: null,
    };
  }

  // 2-3. Accumulate per region / exercise / category.
  const denomDecay = inWindow.reduce(
    (acc, s) => acc + Math.pow(0.5, ageDays(s.endedAt, now) / config.halfLifeDays),
    0
  );

  const region = new Map(); // region -> { incidentSum, sessions:Set, lastFlaggedAt, byCat:Map }
  const exercise = new Map(); // trackedKey -> { count, lastSeenAt, regions:Set }
  const category = new Map(); // categoryKey -> { count, lastSeenAt, region }
  let correctReps = 0;
  let totalReps = 0;

  inWindow.forEach((s, i) => {
    const decay = Math.pow(0.5, ageDays(s.endedAt, now) / config.halfLifeDays);
    for (const effort of s.efforts ?? []) {
      if (!effort.tracked) continue;
      totalReps += effort.totalReps ?? 0;
      correctReps += effort.correctReps ?? 0;
      const reps = effort.totalReps ?? 0;
      if (reps <= 0) continue;
      for (const m of effort.mistakes ?? []) {
        const cat = categoriesByKey.get(m.categoryKey);
        if (!cat) continue;
        const R = cat.bodyRegion;
        const incident = cat.severityWeight * (m.count / reps);

        let r = region.get(R);
        if (!r) {
          r = { incidentSum: 0, sessions: new Set(), lastFlaggedAt: null, byCat: new Map() };
          region.set(R, r);
        }
        r.incidentSum += decay * incident;
        r.sessions.add(i);
        if (!r.lastFlaggedAt || s.endedAt > r.lastFlaggedAt) r.lastFlaggedAt = s.endedAt;
        r.byCat.set(m.categoryKey, (r.byCat.get(m.categoryKey) ?? 0) + decay * incident);

        if (effort.trackedKey) {
          let ex = exercise.get(effort.trackedKey);
          if (!ex) {
            ex = { count: 0, lastSeenAt: null, regions: new Set() };
            exercise.set(effort.trackedKey, ex);
          }
          ex.count += m.count;
          if (!ex.lastSeenAt || s.endedAt > ex.lastSeenAt) ex.lastSeenAt = s.endedAt;
          ex.regions.add(R);
        }

        let c = category.get(m.categoryKey);
        if (!c) {
          c = { count: 0, lastSeenAt: null, region: R };
          category.set(m.categoryKey, c);
        }
        c.count += m.count;
        if (!c.lastSeenAt || s.endedAt > c.lastSeenAt) c.lastSeenAt = s.endedAt;
      }
    }
  });

  // 4-7. Score each region.
  const byBodyRegion = [];
  const regionScore = new Map();
  for (const [R, r] of region) {
    const incidence = denomDecay > 0 ? r.incidentSum / denomDecay : 0;
    const recurrence = 1 + config.recurrenceBeta * (r.sessions.size / sessionsConsidered);
    const limitFactor = limitations.includes(R) ? config.limitationFactor : 1.0;
    const raw = incidence * recurrence * limitFactor;
    const score = Math.round(100 * (1 - Math.exp(-raw / config.scoreScale)));
    const band = bandOf(score);
    regionScore.set(R, { score, band });
    byBodyRegion.push({
      region: R,
      score,
      band,
      trend: trendOf(score, prevRegionScore.get(R) ?? null, config.trendDeadband),
      lastFlaggedAt: r.lastFlaggedAt,
    });
  }
  byBodyRegion.sort((a, b) => b.score - a.score);

  // 8. Overall (worst region dominates; breadth still counts).
  let overallScore = 0;
  if (byBodyRegion.length > 0) {
    const scores = byBodyRegion.map((b) => b.score);
    const max = Math.max(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    overallScore = Math.round(0.6 * max + 0.4 * mean);
  }
  const overall = {
    score: overallScore,
    band: bandOf(overallScore),
    trend: trendOf(overallScore, prevOverall, config.trendDeadband),
  };

  // Descriptive breakdowns (NOT independently scored; regionBand mirrors a region).
  const worstBandOfRegions = (regions) => {
    let best = "low";
    for (const R of regions) {
      const rs = regionScore.get(R);
      if (rs && bandIndex(rs.band) > bandIndex(best)) best = rs.band;
    }
    return best;
  };
  const byExercise = [...exercise.entries()]
    .map(([trackedKey, ex]) => ({
      trackedKey,
      recentMistakeCount: ex.count,
      lastSeenAt: ex.lastSeenAt,
      regionBand: worstBandOfRegions(ex.regions),
    }))
    .sort((a, b) => b.recentMistakeCount - a.recentMistakeCount);
  const byMistakeCategory = [...category.entries()]
    .map(([categoryKey, c]) => ({
      categoryKey,
      recentCount: c.count,
      lastSeenAt: c.lastSeenAt,
      regionBand: regionScore.get(c.region)?.band ?? "low",
    }))
    .sort((a, b) => b.recentCount - a.recentCount);

  // Risk alert: a region whose band increased into elevated/high vs the previous profile.
  const prevBandByRegion = new Map(
    (previous?.byBodyRegion ?? []).map((r) => [r.region, r.band])
  );
  let riskAlert = null;
  for (const r of byBodyRegion) {
    const prevBand = prevBandByRegion.get(r.region) ?? "low";
    const increasedIntoDanger =
      bandIndex(r.band) > bandIndex(prevBand) && bandIndex(r.band) >= bandIndex("elevated");
    if (increasedIntoDanger && (!riskAlert || r.score > riskAlert.score)) {
      // dominant contributing mistake's cue
      const reg = region.get(r.region);
      let topCat = null;
      let topWeight = -1;
      for (const [catKey, w] of reg.byCat) {
        if (w > topWeight) {
          topWeight = w;
          topCat = catKey;
        }
      }
      riskAlert = {
        region: r.region,
        band: r.band,
        score: r.score,
        cue: categoriesByKey.get(topCat)?.correctiveCue ?? "",
      };
    }
  }

  const accuracy = totalReps > 0 ? Number((correctReps / totalReps).toFixed(3)) : 0;

  return {
    status: "ok",
    profile: { overall, byBodyRegion, byExercise, byMistakeCategory, sessionsConsidered },
    snapshot: {
      overallScore: overall.score,
      byBodyRegion: byBodyRegion.map((b) => ({ region: b.region, score: b.score })),
      accuracy,
    },
    riskAlert,
  };
}

/**
 * Loads a user's recent tracked sessions, recomputes the risk profile, upserts it,
 * appends a snapshot, and returns { status, profile, riskAlert }.
 */
export async function recomputeUserRisk(userId, now = new Date()) {
  const [categories, user, previous, sessions] = await Promise.all([
    MistakeCategory.find({}).lean(),
    User.findById(userId).select("profile.limitations").lean(),
    InjuryRiskProfile.findOne({ userId }).lean(),
    WorkoutSession.find({ userId, source: "device_cv", status: "completed" })
      .sort({ endedAt: -1 })
      .limit(riskConfig.fetchCap)
      .select("endedAt efforts")
      .lean(),
  ]);

  const categoriesByKey = new Map(categories.map((c) => [c.key, c]));
  const limitations = user?.profile?.limitations ?? [];

  const { status, profile, snapshot, riskAlert } = computeRiskProfile({
    sessions,
    categoriesByKey,
    limitations,
    previous,
    now,
  });

  await InjuryRiskProfile.findOneAndUpdate(
    { userId },
    { $set: { ...profile, userId, updatedAt: now } },
    { upsert: true, new: true }
  );

  if (status === "ok" && snapshot) {
    await InjuryRiskSnapshot.create({ userId, takenAt: now, ...snapshot });
  }

  return { status, profile, riskAlert };
}
