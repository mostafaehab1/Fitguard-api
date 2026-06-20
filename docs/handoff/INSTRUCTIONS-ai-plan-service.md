# Instructions — AI Developer (Plan Service)

## HOW TO USE THIS FILE (read this part yourself)

You are building the **"plan helper"** — a small web service that writes a workout plan
and a diet plan when the backend asks for one. It has **no database** and **no users**.
It just receives a person's details and returns a plan as JSON.

> **You (the AI developer) own BOTH AI jobs.** Do **this plan service first**, then the
> on-camera CV port in `INSTRUCTIONS-ai-oncamera-cv.md`. This one is self-contained and
> unblocks the app's plan screen; the CV port is longer and overlaps with the Flutter dev.

You already wrote most of the brains for this in the team repo
(`AI/services/workout_generator.py` and the nutrition code). Your job is to wrap that in
a clean, small service that follows the agreed format, and to **delete the parts we're
not using** (the database backends and the food-photo analysis).

**Steps:**
1. Open the team repo (`Fit-Guard-app-main`) — your code is in the **`AI/`** folder.
2. Keep these files handy and attach when asked: `04-ai-cv-integration.md` (sections 4.3
   and 4.5), `02-domain-model.md` (section 2.10).
3. Paste the block below (under **"PASTE THIS TO YOUR LLM"**) into your coding tool.
4. Do tasks **in order**, test each before moving on.
5. If the LLM wants to add a database, store users, or change the response format —
   STOP and check this file. Those are forbidden here.

---

## ════════ PASTE THIS TO YOUR LLM ════════

You are building a small, **stateless** FastAPI service called the FitGuard Plan
Service. It lives in the `AI/` folder of the repo. It has **no database**. It exposes
exactly three routes: `GET /health`, `POST /v1/plans/workout`, `POST /v1/plans/nutrition`.
Follow these rules and tasks exactly, one at a time.

### GOLDEN RULES (breaking any of these is a bug)
1. **No database. No user accounts. No saving anything.** This service receives data,
   returns a plan, and forgets. The main backend stores everything.
2. The response JSON must match the exact shapes in TASK 2 and TASK 3 below — no extra
   or renamed fields. The main backend will reject anything that doesn't match.
3. When picking exercises, you may ONLY use exercises from the `exerciseCatalog` that
   the request gives you, and you must refer to each by its exact `trackedKey` string.
   **Never invent an exercise or a trackedKey.**
4. Every request carries a header `X-Service-Key`. Reject requests where it doesn't
   match the configured secret with HTTP 401.
5. If the AI/LLM step fails or returns invalid JSON, fall back to the deterministic
   generator (TASK 4) so the service NEVER returns a broken plan.

### TASK 0 — Slim down to a stateless service (delete what we don't use)
- DELETE / stop using the database backends: `AI/backend/app` (and the separate
  `Backend/app` if present). Remove their database code, models, and the
  `sqlalchemy / asyncpg / alembic` dependencies. We are not using Postgres.
- REMOVE the **food image analysis** feature (the `openai` GPT-4o food code and the
  `cohere` food detection). It is out of scope. Keep the nutrition **plan** logic.
- Keep: `AI/services/workout_generator.py` (you'll reuse it), and the nutrition plan
  logic.
- DONE WHEN: the project no longer imports any database or food-image code.

### TASK 1 — Create the service skeleton
- Create a FastAPI app with three routes: `GET /health` (returns `{"status":"ok"}`),
  `POST /v1/plans/workout`, `POST /v1/plans/nutrition`.
- Add a dependency that checks the `X-Service-Key` header against an env var
  `SERVICE_KEY`; return 401 if missing or wrong.
- DONE WHEN: `GET /health` works and the two plan routes exist (can return a stub).

### TASK 2 — `POST /v1/plans/workout`
- The request body looks like:
```json
{
  "profile": { "age": 24, "gender": "Male", "heightCm": 178, "weightKg": 82,
               "goal": "Muscle Building", "experienceLevel": "Intermediate",
               "activityLevel": "Moderate", "mealsPerDay": 3,
               "dietaryPreference": "No restriction", "allergies": "", "foodDislikes": "",
               "limitations": ["Knee"], "daysPerWeek": 4 },
  "exerciseCatalog": [
    { "trackedKey": "bodyweight_squat", "name": "Bodyweight Squat", "type": "tracked", "muscleGroups": ["quads","glutes"] }
  ]
}
```
- You must return EXACTLY this shape (this is the agreed plan format):
```json
{
  "weeklySchedule": [
    { "dayOfWeek": "Mon", "focus": "Lower body", "rest": false,
      "items": [
        { "trackedKey": "bodyweight_squat", "sets": 4, "reps": "8-12",
          "restSeconds": 90, "intensity": "RPE 7", "notes": "" }
      ] }
  ],
  "notes": "Knee limitation respected: no deep loaded squats."
}
```
- RULES: every `items[].trackedKey` MUST be one of the `exerciseCatalog` trackedKeys.
  If `limitations` includes a body part, avoid exercises that stress it and say so in
  `notes` (this is a safety requirement).
- The backend always sends the **full profile**; the **workout** plan uses `goal`,
  `experienceLevel`, `daysPerWeek`, and `limitations` (the rest are for nutrition).
- DONE WHEN: posting a sample profile returns a valid plan using only catalog exercises.

### TASK 3 — `POST /v1/plans/nutrition`
- Request body: `{ "profile": { ...the SAME full profile object as TASK 2... } }`.
- The **nutrition** plan uses: `age`, `gender`, `heightCm`, `weightKg`, **`activityLevel`**
  (the Mifflin-St Jeor *activity factor*), `goal` (deficit/surplus), `mealsPerDay` (how
  many meals to structure), and `dietaryPreference` / `allergies` / `foodDislikes` (honor
  the diet — e.g. no meat for Vegetarian, exclude listed allergens).
- Return EXACTLY:
```json
{
  "dailyCalories": 2600, "protein_g": 165, "carbs_g": 300, "fat_g": 70,
  "hydrationLiters": 3.0,
  "mealStructure": [
    { "meal": "Breakfast", "guidance": "Protein + complex carbs", "approxCalories": 600 }
  ],
  "notes": "Vegetarian honored."
}
```
- Calculate calories with the Mifflin-St Jeor formula × an activity factor, then adjust
  for the goal (deficit for Weight Loss, surplus for Muscle Building).
- DONE WHEN: posting a profile returns sensible calories/macros/meals.

### TASK 4 — Use an LLM, but ALWAYS have a safe fallback
- For each endpoint: first try to get the plan from an LLM (you can use the same
  provider you already use, e.g. Groq/OpenAI). Tell the LLM to return **JSON only** in
  the exact shape above, and give it the `exerciseCatalog` so it can't invent exercises.
- After the LLM responds, **validate** the JSON against the required shape. If it is
  missing fields, has wrong types, or uses a trackedKey not in the catalog → **discard
  it and use the deterministic generator instead** (reuse the logic in
  `AI/services/workout_generator.py` for workouts; use the Mifflin-St Jeor calculation
  for nutrition). The caller must never receive a broken or empty plan.
- IMPORTANT: your old `workout_generator.py` uses some loose keys like `"press"` and
  `"hinge"`. Map those to real catalog trackedKeys (e.g. `pushup`, `deadlift`). Only
  output trackedKeys that exist in the request's `exerciseCatalog`.
- DONE WHEN: even if you unplug the LLM (or it returns garbage), both endpoints still
  return a valid plan.

### TASK 5 — Configuration
- Read from environment variables: `SERVICE_KEY` (the shared secret), and your LLM
  provider key. Provide a `.env.example` listing them. Expose the app on a port via
  `uvicorn`.
- DONE WHEN: the service runs with `uvicorn` and reads config from env.

### Common mistakes to avoid (do NOT do these)
- ❌ Adding a database, user table, or "save plan" logic. This service stores nothing.
- ❌ Returning a different JSON shape than TASK 2 / TASK 3.
- ❌ Using an exercise/trackedKey that isn't in the request's `exerciseCatalog`.
- ❌ Letting a bad LLM response reach the caller — always validate and fall back.
- ❌ Keeping the food-photo analysis or the Postgres backends.

### How to test
Run the service, then with a tool like `curl` or the FastAPI `/docs` page, POST a sample
profile to both endpoints (with the `X-Service-Key` header). Confirm: valid JSON in the
exact shape, only catalog exercises used, and that it still works when you force the LLM
to fail (it should fall back).

## ════════ END OF LLM BLOCK ════════
