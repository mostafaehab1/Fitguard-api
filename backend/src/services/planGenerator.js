// Deterministic plan generator — the safe fallback when the AI service is
// unavailable or returns malformed output (docs/04 §4.3.3). No external calls.

const ACTIVITY_FACTORS = {
  Sedentary: 1.2,
  Light: 1.375,
  Moderate: 1.55,
  Active: 1.725,
  "Very Active": 1.9,
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SPLITS = {
  1: ["Full body"],
  2: ["Upper", "Lower"],
  3: ["Full body", "Full body", "Full body"],
  4: ["Upper", "Lower", "Upper", "Lower"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
  7: ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Core"],
};

const FOCUS_CATEGORIES = {
  "Full body": ["Legs", "Push", "Pull", "Core"],
  Upper: ["Push", "Pull"],
  Lower: ["Legs"],
  Push: ["Push"],
  Pull: ["Pull"],
  Legs: ["Legs"],
  Core: ["Core"],
};

const SETS_REPS = {
  Beginner: { sets: 3, reps: "10-12", restSeconds: 60, intensity: "RPE 6" },
  Intermediate: { sets: 4, reps: "8-12", restSeconds: 90, intensity: "RPE 7" },
  Advanced: { sets: 4, reps: "6-10", restSeconds: 120, intensity: "RPE 8" },
};

// Body-region limitation → exercise categories to de-emphasize.
const REGION_AVOID_CATEGORIES = {
  Knee: ["Legs"],
  Hip: ["Legs"],
  "Lower back": ["Legs", "Pull"],
  Shoulder: ["Push"],
  Elbow: ["Push", "Pull"],
  Wrist: ["Push", "Pull"],
  Neck: [],
};

export function computeNutrition(profile) {
  const {
    age,
    weightKg,
    heightCm,
    gender,
    activityLevel = "Moderate",
    goal = "Maintain",
    mealsPerDay = 3,
  } = profile;

  // Mifflin-St Jeor
  const s = gender === "Male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  const tdee = bmr * (ACTIVITY_FACTORS[activityLevel] ?? 1.55);

  let calories = tdee;
  if (goal === "Weight Loss") calories = tdee * 0.8;
  else if (goal === "Muscle Building") calories = tdee * 1.1;
  calories = Math.round(calories);

  const proteinPerKg = goal === "Muscle Building" ? 2.0 : 1.8;
  const protein_g = Math.round(proteinPerKg * weightKg);
  const fat_g = Math.round((calories * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));

  const meals = Math.max(1, Math.min(Number(mealsPerDay) || 3, 8));
  const per = Math.round(calories / meals);
  const names = ["Breakfast", "Lunch", "Dinner", "Snack 1", "Snack 2", "Snack 3", "Snack 4", "Snack 5"];
  const mealStructure = Array.from({ length: meals }, (_, i) => ({
    meal: names[i] ?? `Meal ${i + 1}`,
    guidance: "Whole foods; balance protein, complex carbs, and vegetables.",
    approxCalories: per,
  }));

  const hydrationLiters = Number((weightKg * 0.033).toFixed(1));
  const dietNote =
    profile.dietaryPreference && profile.dietaryPreference !== "No restriction"
      ? ` Honors ${profile.dietaryPreference} preference.`
      : "";
  const goalNote =
    goal === "Weight Loss"
      ? "Calorie deficit (~20%) for fat loss."
      : goal === "Muscle Building"
        ? "Slight surplus (~10%) to support muscle gain."
        : "Maintenance calories.";

  return {
    dailyCalories: calories,
    protein_g,
    carbs_g,
    fat_g,
    hydrationLiters,
    mealStructure,
    notes: goalNote + dietNote,
  };
}

export function buildWorkout(profile, exercises, limitedRegions = []) {
  const days = Math.max(1, Math.min(Number(profile.daysPerWeek) || 3, 7));
  const split = SPLITS[days] || SPLITS[3];
  const sr = SETS_REPS[profile.experienceLevel] || SETS_REPS.Beginner;

  const avoid = new Set();
  for (const r of limitedRegions) {
    (REGION_AVOID_CATEGORIES[r] || []).forEach((c) => avoid.add(c));
  }
  const usable = (exercises || []).filter((e) => e.isActive !== false && !avoid.has(e.category));

  const weeklySchedule = split.slice(0, days).map((focus, idx) => {
    const cats = FOCUS_CATEGORIES[focus] || [];
    const pool = usable.filter((e) => cats.length === 0 || cats.includes(e.category));
    const chosen = pool.slice(0, 5);
    return {
      dayOfWeek: DAY_NAMES[idx],
      focus,
      rest: false,
      items: chosen.map((e) => ({
        exerciseId: e._id,
        exerciseName: e.name,
        trackedKey: e.trackedKey ?? null,
        sets: sr.sets,
        reps: sr.reps,
        restSeconds: sr.restSeconds,
        intensity: sr.intensity,
        notes: "",
      })),
    };
  });

  const notes = limitedRegions.length
    ? `Adjusted for limitations: ${limitedRegions.join(", ")} — exercises stressing these areas were reduced.`
    : "Balanced split based on your goal and experience level.";

  return { weeklySchedule, notes };
}
