// Idempotent seed: mistake taxonomy, tracked + guided exercises (with CV thresholds
// mirrored from AI/configs/exercise_config.py), and the first admin.
// Run with: npm run seed
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../database.js";
import { MistakeCategory } from "../models/MistakeCategory.js";
import { Exercise } from "../models/Exercise.js";
import { User } from "../models/User.js";

const MISTAKES = [
  { key: "elbow_drift", label: "Elbow drifting away from the body", appliesTo: ["bicep_curl", "hammer_curl"], bodyRegion: "Elbow", severityWeight: 2, correctiveCue: "Pin your elbows to your sides" },
  { key: "back_rounding", label: "Rounding the lower back", appliesTo: ["deadlift", "kettlebell_swing"], bodyRegion: "Lower back", severityWeight: 5, correctiveCue: "Keep your chest up, don't round your back" },
  { key: "knee_valgus", label: "Knees collapsing inward", appliesTo: ["bodyweight_squat"], bodyRegion: "Knee", severityWeight: 4, correctiveCue: "Push your knees out over your toes" },
  { key: "back_lean", label: "Excessive forward lean", appliesTo: ["bodyweight_squat"], bodyRegion: "Lower back", severityWeight: 3, correctiveCue: "Keep your torso upright" },
  { key: "insufficient_depth", label: "Incomplete range of motion (too shallow)", appliesTo: ["bodyweight_squat", "leg_press_machine", "lunge"], bodyRegion: "Knee", severityWeight: 1, correctiveCue: "Go deeper through a full range of motion" },
  { key: "front_knee_lean", label: "Front knee travels too far forward", appliesTo: ["lunge"], bodyRegion: "Knee", severityWeight: 3, correctiveCue: "Keep your front shin vertical" },
  { key: "hip_sag", label: "Hips sagging out of line", appliesTo: ["pushup"], bodyRegion: "Lower back", severityWeight: 3, correctiveCue: "Brace your core, don't let your hips sag" },
  { key: "incomplete_press", label: "Not pressing through the full range", appliesTo: ["chest_press_machine"], bodyRegion: "Shoulder", severityWeight: 1, correctiveCue: "Press fully and control the return" },
  { key: "excessive_lean", label: "Excessive torso swing", appliesTo: ["lat_pulldown", "seated_row"], bodyRegion: "Lower back", severityWeight: 3, correctiveCue: "Stop swinging, keep your torso still" },
  { key: "body_line_deviation", label: "Body line out of alignment", appliesTo: ["plank", "wall_sit"], bodyRegion: "Lower back", severityWeight: 3, correctiveCue: "Keep a straight line, don't drop your hips" },
];

const t = (type, thresholds) => ({ type, thresholds });

const TRACKED = [
  { trackedKey: "bicep_curl", name: "Bicep Curl", category: "Pull", muscleGroups: ["biceps"], instructions: "Palms facing forward, elbows pinned to your sides, curl toward your shoulders.", supportedMistakes: ["elbow_drift"], cvThresholds: t("curl", { down_angle: 120, up_angle: 90, error_elbow_drift: 40 }) },
  { trackedKey: "hammer_curl", name: "Hammer Curl", category: "Pull", muscleGroups: ["biceps", "forearms"], instructions: "Palms facing each other, thumbs up through the full rep.", supportedMistakes: ["elbow_drift"], cvThresholds: t("curl", { down_angle: 130, up_angle: 80, error_elbow_drift: 35 }) },
  { trackedKey: "deadlift", name: "Deadlift / Hip Hinge", category: "Legs", muscleGroups: ["hamstrings", "glutes", "back"], instructions: "Push your hips back, keep your chest up, and return to a tall lockout.", supportedMistakes: ["back_rounding"], cvThresholds: t("hinge", { start_angle: 160, depth_angle: 110, max_torso_lean: 85 }) },
  { trackedKey: "kettlebell_swing", name: "Kettlebell Swing", category: "Legs", muscleGroups: ["glutes", "hamstrings"], instructions: "Drive from the hips, keep arms relaxed, snap hips to chest height.", supportedMistakes: ["back_rounding"], cvThresholds: t("hinge", { start_angle: 160, depth_angle: 120, max_torso_lean: 85 }) },
  { trackedKey: "bodyweight_squat", name: "Bodyweight Squat", category: "Legs", muscleGroups: ["quads", "glutes"], instructions: "Sit your hips back and down, keep knees tracking over toes, stand tall.", supportedMistakes: ["knee_valgus", "back_lean", "insufficient_depth"], cvThresholds: t("squat", { start_angle: 150, depth_angle: 75, error_back_lean: 50, error_knee_valgus: 0.85 }) },
  { trackedKey: "leg_press_machine", name: "Leg Press Machine", category: "Legs", muscleGroups: ["quads"], instructions: "Lower with control until knees are bent, press back without locking hard.", supportedMistakes: ["insufficient_depth"], cvThresholds: t("squat", { start_angle: 170, depth_angle: 90, error_back_lean: 999, machine_mode: true }) },
  { trackedKey: "lunge", name: "Alternating Lunge", category: "Legs", muscleGroups: ["quads", "glutes"], instructions: "Step back, lower until the front knee is near 90 degrees, drive up.", supportedMistakes: ["front_knee_lean", "insufficient_depth"], cvThresholds: t("lunge", { start_angle: 165, depth_angle: 85, lean_thresh: 45 }) },
  { trackedKey: "pushup", name: "Push-Up", category: "Push", muscleGroups: ["chest", "triceps"], instructions: "Keep a straight line from shoulders to ankles and press fully at the top.", supportedMistakes: ["hip_sag"], cvThresholds: t("press", { start_angle: 160, bottom_angle: 80, error_hip_sag: 160 }) },
  { trackedKey: "chest_press_machine", name: "Chest Press Machine", category: "Push", muscleGroups: ["chest"], instructions: "Press the handles forward with control and avoid shrugging your shoulders.", supportedMistakes: ["incomplete_press"], cvThresholds: t("press", { start_angle: 150, bottom_angle: 80, error_hip_sag: 0, machine_mode: true }) },
  { trackedKey: "lat_pulldown", name: "Lat Pulldown", category: "Pull", muscleGroups: ["lats"], instructions: "Pull your elbows down toward your ribs, chest tall, avoid leaning back.", supportedMistakes: ["excessive_lean"], cvThresholds: t("pull", { contracted_angle: 50, extended_angle: 150, max_lean: 30 }) },
  { trackedKey: "seated_row", name: "Seated Row", category: "Pull", muscleGroups: ["back"], instructions: "Lead with your elbows, keep your torso stable while pulling to your midline.", supportedMistakes: ["excessive_lean"], cvThresholds: t("pull", { contracted_angle: 70, extended_angle: 160, max_lean: 20 }) },
  { trackedKey: "plank", name: "Plank Hold", category: "Core", muscleGroups: ["core"], instructions: "Keep a straight body line, brace your core, avoid hip sag.", supportedMistakes: ["body_line_deviation"], cvThresholds: t("hold", { target_angle: 180, tolerance: 30 }) },
  { trackedKey: "wall_sit", name: "Wall Sit", category: "Legs", muscleGroups: ["quads"], instructions: "Back against the wall, knees around 90 degrees, hold steady.", supportedMistakes: ["body_line_deviation"], cvThresholds: t("hold", { target_angle: 90, tolerance: 15 }) },
];

const GUIDED = [
  { name: "Leg Extension Machine", category: "Legs", muscleGroups: ["quads"], instructions: "Sit with your back supported, extend your knees smoothly, control the return." },
  { name: "Cable Chest Fly", category: "Push", muscleGroups: ["chest"], instructions: "With a slight elbow bend, bring the handles together in front of your chest." },
  { name: "Seated Calf Raise", category: "Legs", muscleGroups: ["calves"], instructions: "Press through the balls of your feet, pause at the top, lower under control." },
];

async function seedMistakes() {
  for (const m of MISTAKES) {
    await MistakeCategory.findOneAndUpdate({ key: m.key }, { $set: { ...m, isActive: true } }, { upsert: true });
  }
  console.log(`seeded ${MISTAKES.length} mistake categories`);
}

async function seedExercises() {
  for (const e of TRACKED) {
    await Exercise.findOneAndUpdate(
      { trackedKey: e.trackedKey },
      { $set: { ...e, type: "tracked", isActive: true } },
      { upsert: true }
    );
  }
  for (const e of GUIDED) {
    await Exercise.findOneAndUpdate(
      { name: e.name },
      { $set: { ...e, type: "guided", isActive: true } },
      { upsert: true }
    );
  }
  console.log(`seeded ${TRACKED.length} tracked + ${GUIDED.length} guided exercises`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { email: email.toLowerCase(), passwordHash, role: "admin", emailVerifiedAt: new Date() },
      $setOnInsert: { profile: {} },
    },
    { upsert: true }
  );
  console.log(`seeded admin: ${email}`);
}

async function main() {
  await connectDb();
  await seedMistakes();
  await seedExercises();
  await seedAdmin();
  console.log("seed complete");
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
