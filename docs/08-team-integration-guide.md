# 08 — Team Integration Guide

This is the **"do exactly this"** doc. It assigns work, defines the contracts nobody
may break unilaterally, and sequences the build so the three of you don't collide. If a
teammate reads only one document, it's this one (then their referenced section).

## 8.1 Ownership map

| Person | Owns | Reads |
|--------|------|-------|
| **Mostafa (Backend + Lead)** | Express+Mongo API, DB, injury-risk engine, lifecycle jobs, AI client, this spec | all |
| **Flutter dev** | the app, on-device CV runtime (with AI), all screens | `03`, `04 §4.2`, `06` |
| **AI developer** | **both** the stateless plan service (workout + nutrition) **and** the Dart form-engine port (+ confirm CV vocabulary) — built in that order | `04 §4.1–4.3`, `02 §2.10`, `05` |

## 8.2 The five contracts nobody breaks alone

Changing any of these requires the lead's sign-off **and** a spec edit first:

1. **CV vocabulary** (`04 §4.1`) — `trackedKey`s + `categoryKey`s + severities. The
   phone emits only these; the backend seeds and validates them.
2. **Session-submit payload** (`04 §4.2.4`) — raw events only; server derives scores.
3. **Plan JSON schema** (`02 §2.10`, `04 §4.3`) — what the AI returns and the backend
   stores.
4. **Error envelope** (`03 §3.2`) — `{ error: { code, message, details } }`.
5. **Auth** — `Bearer` access token; `trackedKey` (never ObjectId) flows from phone.

## 8.3 What each person does

### Backend (Mostafa) — build order

**Phase 1 (core / thesis):**
1. Migrate models per `02 §2.18` (role→coach; structured plans; per-session
   `WorkoutSession`; new `MistakeCategory`, `InjuryRiskProfile/Snapshot`,
   `Notification`, `MediaAsset`, `CoachProfile`).
2. Split `register` / add `POST /users/me/onboarding` + disclaimer (A1).
3. `setActivePlan()` invariant + `User.activePlanId` (B2/ADR-006).
4. Session submit → validate → compute summary → **injury-risk engine** (`05`).
5. `GET /progress/summary` (overall, fixes B1), `/progress/risk`, `/progress/trends`.
6. AI client (`04 §4.3.4`) + deterministic fallback; wire `POST /users/me/ai-plan`.
7. Lifecycle jobs: expire-subscriptions + reverts (B3), reminders (`06 §6.4`).
8. Hardening: zod, rate limiting, hashed tokens, refresh tokens, CORS (`07`).
9. Seed exercises + mistake categories + admin (`07 §7.6`).

**Phase 2 (completeness):** mock `Payment` on subscribe; `Review` (+ rating recompute);
`Transformation`; media upload endpoint + access control.

### Flutter dev — screens → endpoints

| Screen | Endpoint(s) |
|--------|-------------|
| Register / verify / login | `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/refresh` |
| Onboarding + **disclaimer checkbox** | `POST /users/me/onboarding` |
| Home / plan | `GET /plans/me` |
| Workout (tracked) | `GET /exercises/cv-config` → on-device CV → `POST /workouts/sessions` |
| Workout (guided) | `GET /exercises/:id` → `POST /workouts/sessions {source:manual}` |
| Summary + risk alert | response of session submit |
| Progress dashboard | `GET /progress/summary`, `/progress/risk`, `/progress/trends` |
| Coach directory / profile | `GET /coaches`, `/coaches/:id`, reviews, transformations |
| Subscribe / manage | `POST /subscriptions`, `GET/DELETE /subscriptions/me` |
| Become a coach | `POST /media`, `POST /coaches/applications` |
| Notifications | `GET /notifications`, mark-read |

Rules: store `accessToken` in memory + `refreshToken` securely; on `401`, refresh once
then retry; block workout entry until `onboardingCompleted`; send `trackedKey`, never
ObjectIds.

### AI developer — do these two streams **in series** (plan service first)

One person owns both AI streams. Build the **plan service first** (self-contained,
unblocks the Flutter plan screen), **then** the CV/Dart port (longer, couples with the
Flutter dev). See `handoff/INSTRUCTIONS-ai-plan-service.md` then
`handoff/INSTRUCTIONS-ai-oncamera-cv.md`.

**Stream 1 — plan service (do first):**
- Build **one stateless FastAPI service**, two endpoints: `/v1/plans/workout`,
  `/v1/plans/nutrition` (`04 §4.3`). No database.
- LLM returns **JSON only**, conforming to the schemas; pick exercises **only** from
  the supplied `exerciseCatalog`; honor `limitations` as a hard constraint.
- Validate `X-Service-Key`; expose `GET /health`.
- **Retire** `Backend/app` and the persistence in `AI/backend/app`; reuse only the
  generation logic. **Remove** food image analysis (`04 §4.5`).

**Stream 2 — on-device form engine (do after the plan service):**
- Confirm the **CV vocabulary + severities** in `04 §4.1` (especially the two inferred
  keys `incomplete_press`, `front_knee_lean`). Adjust the table with the lead if wrong.
- Port to Dart (with the Flutter dev): `utils.find_angle`/`get_landmark_features`,
  `base_exercise.process()` (s1/s2/s3 + rep counting), one `check_form()` per
  processor. **Start with squat** (most complete reference).
- Output per exercise: `correctReps` (=`reps`), `wrongReps` (=`improper_reps`),
  `mistakes[{categoryKey,count}]`. Load thresholds from `/exercises/cv-config`.
- Keep the Streamlit pages as an **internal test harness** only; drop the
  WebSocket/WebRTC streaming from the product.

## 8.4 Definition of done (per cycle)

A cycle is "done" only when all three layers agree:

- [ ] **Onboarding:** register→verify→login→onboard(+disclaimer)→AI plan visible.
- [ ] **Tracked workout:** on-device reps/mistakes → submitted → summary + risk update.
- [ ] **Risk:** `/progress/risk` reflects the worked-example math; alert fires on band
      increase.
- [ ] **Coaching:** apply→admin approve→appear in directory→subscribe→coach plan
      active→expire→revert to AI.
- [ ] Each endpoint matches `03`; each payload matches the `§8.2` contracts.

## 8.5 Suggested milestones

| Week | Backend | Flutter | AI developer (in series) |
|------|---------|---------|--------------------------|
| 1 | model migration, auth split, validation | auth + onboarding screens | **plan service:** skeleton + workout/nutrition endpoints |
| 2 | sessions + risk engine + progress | plan + workout(tracked) + summary | **plan service:** LLM + fallback done; retire Postgres + food analysis · *then start CV* |
| 3 | AI client + plan-gen wiring; coaches/subs | progress dashboards; coach directory | **CV port:** confirm vocabulary; Dart squat path end-to-end |
| 4 | lifecycle jobs, notifications, hardening | subscribe/notifications; polish | **CV port:** remaining processors |
| 5 | Phase-2 (reviews/transformations/payment); seeds; deploy | reviews/transformations; e2e | **CV port:** calibrate severities on pilot data |

## 8.6 Defense talking points (map features → what professors asked)

- **Injury prevention is real, not a label** → the cumulative, severity-weighted,
  recurrence-aware risk engine (`05`) with a worked example.
- **Human factor for at-risk users** → verified coaches (gov-ID + certs), the
  `limitations` personalization, and coach access to subscriber risk (`05 §5.8`).
- **AI is assistive, not authoritative** → backend owns all scoring; LLM output is
  validated with a deterministic fallback; disclaimer + coach backstop.
- **Disciplined scope** → explicit exclusions (`01 §1.4`); food analysis cut to honor
  them.
- **Production-shaped** → one system of record, structured contracts, lifecycle jobs,
  security hardening, tests, deployment.
