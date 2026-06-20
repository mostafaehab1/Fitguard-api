# Instructions — Flutter Developer

## HOW TO USE THIS FILE (read this part yourself)

You are building the **phone app**. The app talks to a server (the "backend") that the
team lead built. Your job is to build the screens and connect them to the backend.

**Steps:**
1. Open the team repo (`Fit-Guard-app-main`) in your coding tool. Your code lives in the
   **`Frontend/`** folder.
2. Also keep these files handy and attach them when your LLM asks: `03-api-contract.md`,
   `04-ai-cv-integration.md`, `00-plain-language-overview.md`.
3. Copy the big block below (everything under **"PASTE THIS TO YOUR LLM"**) into your
   coding tool to start.
4. Do the tasks **in the exact order given**. After each task, run the app and check it
   works **before** moving to the next one. Never do two tasks at once.
5. If the LLM ever wants to call an endpoint or send a field that is **not** written in
   this file or in `03-api-contract.md` — **STOP and message the team lead.** Do not let
   it guess.

---

## ════════ PASTE THIS TO YOUR LLM ════════

You are working inside the `Frontend/` folder of a Flutter app called `fit_guard_app`.
It is the client for a fitness/injury-prevention app called FitGuard. Follow these
rules and tasks exactly. Do **one task at a time, in order**, and stop after each task
so I can test it.

### Context you must respect
- The app already has an HTTP setup using the `dio` package:
  `Frontend/lib/Core/network/dio_client.dart`, `api_service.dart`, `api_endpoints.dart`,
  `api_error.dart`, and token storage in `Frontend/lib/Core/utils/pref_helpers.dart`.
  **REUSE these. Do NOT create a second HTTP client or a new way to store tokens.**
- Screens are scaffolded under `Frontend/lib/presentation/screens/` (auth, onboarding,
  home, workouts, nutrition, profile, settings). Build on top of them.

### GOLDEN RULES (breaking any of these is a bug)
1. The backend is the only source of truth. The app **sends what the camera saw**
   (rep counts and mistakes) and **never** calculates or sends an "accuracy" or
   "injury risk" number. Those come back FROM the backend.
2. When sending a workout, identify each exercise by its **`trackedKey`** string (e.g.
   `"bodyweight_squat"`). **Never send a database id.** The backend handles ids.
3. Only call the endpoints listed in `03-api-contract.md`. If you think you need one
   that isn't there, STOP and ask the human — do not invent endpoints or fields.
4. Every backend error looks like `{ "error": { "code": "...", "message": "..." } }`.
   Parse and show `error.message`.
5. Store the access token and refresh token using the existing `pref_helpers`. On any
   `401` response, call `/auth/refresh` once, then retry the original request.
6. Do not change anything outside `Frontend/`.

### TASK 0 — Clean up first
- `Frontend/pubspec.yaml` contains unresolved git merge conflict markers
  (`<<<<<<<`, `=======`, `>>>>>>>`). Fix them by keeping ONE clean version of the
  dependencies (keep: `camera`, `image`, `permission_handler`; remove the duplicate
  `camera` line). Then run `flutter pub get`.
- These screens/packages are **out of scope** for this project — remove their navigation
  entries and screens, or hide them: the **chatbot** screen (and `chat_gpt_sdk`) and the
  **nearby gym** screen (and `geolocator`). Also remove `web_socket_channel` — the old
  camera-streaming approach is replaced by on-phone camera (Task 6).
- DONE WHEN: app compiles and runs with no chatbot/nearby-gym/websocket code.

### TASK 1 — Wire the API base URL
- In `Frontend/lib/Core/constants/api_endpoints.dart`, set ONE constant `baseUrl` to the
  backend URL the team lead gives you (e.g. `https://<backend>.fly.dev/api`). Every
  request path is `baseUrl` + the path from `03-api-contract.md`.
- DONE WHEN: a test call to `GET /health` returns `{ "status": "ok" }`.

### TASK 2 — Auth (register, verify, login, refresh, logout)
- **Register** screen: send `POST /auth/register` with ONLY `{ email, password }`.
  (Important: the profile is NOT collected here — that happens in onboarding.) After
  success, show a "check your email to verify" message.
- **Login**: `POST /auth/login` with `{ email, password }`. If the response code is
  `403 EMAIL_NOT_VERIFIED`, show "please verify your email first." On success, save
  `accessToken` and `refreshToken`.
- Add a dio interceptor: on `401`, call `POST /auth/refresh` with the stored
  `refreshToken`, save the new tokens, retry once. If refresh fails, log the user out.
- **Logout**: `POST /auth/logout` with the refresh token, then clear stored tokens.
- DONE WHEN: a new user can register, verify (link from email), log in, and the token
  is attached automatically to later requests.

### TASK 3 — Onboarding (with the required disclaimer)
- After first login, if `user.onboardingCompleted` is false, force the onboarding flow.
- Collect: name, age, gender, heightCm, weightKg, goal, experienceLevel, activityLevel,
  daysPerWeek (1–7), mealsPerDay, dietaryPreference, limitations (multi-select: Knee,
  Shoulder, Lower back, …), and optional foodDislikes/healthConditions/allergies.
- Show a **disclaimer** ("FitGuard gives fitness guidance, not medical advice") with a
  checkbox the user must tick. Send `disclaimerAccepted: true`.
- Submit all of it with `POST /users/me/onboarding`.
- The backend **auto-generates the AI plan when onboarding completes** — you do NOT call
  the plan endpoint here. Just show a brief "building your plan…" state, then go to Home.
- **Block the Workouts section until onboarding is complete.**
- DONE WHEN: completing onboarding unlocks the rest of the app and an AI plan exists.

### TASK 4 — Show the plan
- On Home, call `GET /plans/me`. Render the structured plan: `workout.weeklySchedule[]`
  (each day → exercises with sets/reps/intensity) and the `nutrition` (calories, macros,
  meals).
- The plan normally already exists (auto-generated at onboarding). Only **if
  `GET /plans/me` returns no active plan** (e.g. generation failed) show a fallback
  "Generate my AI plan" button that calls `POST /users/me/ai-plan`. This is NOT the
  normal path.
- DONE WHEN: a real plan from the backend is displayed.

### TASK 5 — Exercise catalog
- Call `GET /exercises`. Cache the list in memory. You'll need each exercise's
  `trackedKey`, `name`, `type` (`tracked`/`guided`), `instructions`, `demoMediaId`.
- DONE WHEN: you can list exercises and tell tracked from guided.

### TASK 6 — Tracked workout (the camera coach)
- This task uses the on-phone camera form-checker that the AI/camera developer is
  building (a Dart `FormEngine`). Coordinate with them. The camera logic outputs, per
  exercise: `correctReps`, `wrongReps`, and a list of `mistakes` like
  `[{ "categoryKey": "knee_valgus", "count": 3 }]`.
- Flow: download tuning values with `GET /exercises/cv-config`; run the camera engine
  for each tracked exercise in today's plan; show live reps/errors/cue on screen.
- When the workout ends, send ONE request: `POST /workouts/sessions`:
```json
{
  "source": "device_cv",
  "startedAt": "<ISO time>",
  "endedAt": "<ISO time>",
  "efforts": [
    { "trackedKey": "bodyweight_squat", "setsCompleted": 3,
      "totalReps": 20, "correctReps": 15, "wrongReps": 5,
      "mistakes": [ { "categoryKey": "knee_valgus", "count": 3 } ] }
  ]
}
```
- Show the `summary` from the response (accuracy, reps) and, if present, the `riskAlert`
  (a body region + message) as a prominent banner.
- DONE WHEN: a finished tracked workout shows a real summary returned by the backend.
- REMEMBER: never compute accuracy/risk yourself; send only reps + mistakes.

### TASK 7 — Guided workout
- For `guided` exercises: show `instructions` + demo, and a "Mark complete" button that
  sends `POST /workouts/sessions` with `"source": "manual"` and an effort with
  `"tracked": false` (no reps/mistakes needed).
- DONE WHEN: a guided exercise can be marked complete.

### TASK 8 — Progress dashboards
- `GET /progress/summary` → totals, accuracy, completed workouts, top mistakes.
- `GET /progress/risk` → injury-risk by body region (show colored bands:
  low/moderate/elevated/high). Handle `insufficient_data`.
- `GET /progress/trends?metric=accuracy` and `?metric=risk` → draw simple line charts.
- DONE WHEN: the dashboards display real backend data.

### TASK 9 — Coaches & subscription
- `GET /coaches` directory; `GET /coaches/:id` for the profile (bio, specialties,
  rating). **Reviews and transformations are SEPARATE calls:** `GET /coaches/:id/reviews`
  and `GET /coaches/:id/transformations` — do not expect them inside the profile response.
- Subscribe: `POST /subscriptions { coachId }`. Show current subscription with
  `GET /subscriptions/me`; cancel with `DELETE /subscriptions/me`.
- **Important:** subscribing does NOT immediately change the plan. `GET /plans/me` keeps
  returning the **AI plan** (`source:"ai"`) until the coach authors a coach plan. Show a
  "Subscribed — awaiting your coach's plan" state until `GET /plans/me` returns a plan
  with `source:"coach"`.
- DONE WHEN: a user can subscribe, see it reflected, and sees the "awaiting coach plan"
  state until the coach authors one.

### TASK 10 — Become a coach
- Upload documents (gov ID, certificates) with `POST /media` (multipart) → get back
  `mediaId`s. Then `POST /coaches/applications` with bio, specialties, yearsExperience,
  and those mediaIds.
- DONE WHEN: a user can submit a coach application.

### TASK 11 — Notifications
- `GET /notifications` feed; mark read with `PATCH /notifications/:id/read`.
- DONE WHEN: notifications display and can be marked read.

### Common mistakes to avoid (do NOT do these)
- ❌ Sending `exerciseId` instead of `trackedKey` in a workout session.
- ❌ Calculating accuracy or injury risk in the app.
- ❌ Inventing endpoints or request fields not in `03-api-contract.md`.
- ❌ Creating a new HTTP client or token store instead of reusing the existing ones.
- ❌ Letting the user reach workouts before onboarding is complete.
- ❌ Hardcoding the backend URL in many files — it lives in `api_endpoints.dart` only.

### How to test the whole thing
Register → verify email → login → finish onboarding → see AI plan → do a tracked
squat workout → see the summary and (after a few sessions) a risk band → subscribe to a
coach. If each step shows real data from the backend, you're done.

## ════════ END OF LLM BLOCK ════════
