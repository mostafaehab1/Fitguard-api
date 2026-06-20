# 03 — API Contract

**Audience:** the Flutter developer (primary), backend (authority).
Base URL: `{API_BASE}/api`. All bodies are JSON. All authenticated requests send
`Authorization: Bearer <accessToken>`. The OpenAPI/Swagger UI at `/api-docs` stays the
machine-readable mirror of this document.

## 3.1 Conventions

- **IDs** are MongoDB ObjectId strings.
- **Dates** are ISO-8601 UTC.
- **Pagination** (list endpoints): `?page=1&limit=20` → response includes
  `pagination: { page, limit, total, pages }`.
- **The phone speaks `trackedKey`, not ObjectIds.** For workouts the client sends
  `trackedKey` (e.g. `"bodyweight_squat"`); the backend resolves it to `exerciseId`.
  The client gets the catalog (with both) from `GET /exercises`.

## 3.2 Standard error envelope

Every error returns this shape (already implemented):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "age must be between 8 and 110", "details": [ ] } }
```

| HTTP | `code` examples |
|------|-----------------|
| 400 | `VALIDATION_ERROR`, `INVALID_TOKEN`, `INVALID_RESET_TOKEN` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `EMAIL_NOT_VERIFIED`, `NOT_SUBSCRIBED`, `FORBIDDEN_ROLE` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `ACTIVE_SUBSCRIPTION_EXISTS`, `APPLICATION_PENDING` |
| 422 | `VALIDATION_ERROR` (zod field errors in `details`) |
| 429 | `RATE_LIMITED` |

## 3.3 RBAC matrix

| Area | user | coach | admin | public |
|------|:----:|:-----:|:-----:|:------:|
| Auth, own profile/onboarding | ✓ | ✓ | ✓ | register/login |
| Generate own AI plan, run workouts, own progress/risk | ✓ | ✓ | ✓ | — |
| Browse coaches, read reviews/transformations | ✓ | ✓ | ✓ | ✓ (directory) |
| Subscribe / cancel subscription | ✓ | ✓ | ✓ | — |
| Submit coach application | ✓ | — | — | — |
| Coach: assign/update plans **for own active subscribers**, view their progress | — | ✓ | — | — |
| Coach: manage own profile/transformations | — | ✓ | — | — |
| Review coach applications, manage users/exercises | — | — | ✓ | — |

> **Resolved (A1):** registration now takes **email + password only**; the profile is
> submitted later via the onboarding endpoint. **Resolved (A2):** workout sessions
> live under `/workouts`. **Integrity:** there is intentionally **no** endpoint for
> anyone (incl. admin) to modify `WorkoutSession`, `InjuryRiskProfile`, or AI results.

---

## 3.4 Auth  `/auth`

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/auth/register` | public | `{ email, password }` | **email+password only** now. Sends verification email |
| POST | `/auth/login` | public | `{ email, password }` | 403 `EMAIL_NOT_VERIFIED` until verified. Returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | public | `{ refreshToken }` | 🆕 rotates tokens (ADR-009) |
| POST | `/auth/logout` | user | `{ refreshToken }` | 🆕 revokes refresh token |
| GET | `/auth/verify-email?token=` | public | — | marks email verified |
| POST | `/auth/forgot-password` | public | `{ email }` | always 200 (no enumeration) |
| POST | `/auth/reset-password` | public | `{ token, newPassword }` | |

`user` object:
```json
{ "id":"…","email":"…","role":"user","emailVerified":true,
  "onboardingCompleted":false, "profile": { } }
```

## 3.5 Users & onboarding  `/users`

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/users/me/profile` | user | — |
| POST | `/users/me/onboarding` | user | full profile + `disclaimerAccepted:true` 🆕 |
| PATCH | `/users/me/profile` | user | partial profile |
| POST | `/users/me/ai-plan` | user | — → generates & activates AI plan |

**Onboarding body** (gates `onboardingCompletedAt`; `disclaimerAccepted` required):
```json
{ "name":"Sara","age":24,"gender":"Female","heightCm":168,"weightKg":62,
  "goal":"Muscle Building","experienceLevel":"Beginner","activityLevel":"Moderate",
  "daysPerWeek":4,"mealsPerDay":3,"dietaryPreference":"No restriction",
  "limitations":["Knee"], "foodDislikes":"", "healthConditions":"", "allergies":"",
  "disclaimerAccepted": true }
```
`400 VALIDATION_ERROR` if `disclaimerAccepted !== true`.

## 3.6 Plans  `/plans`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/plans/me` | user | the user's single **active** plan (AI or coach) |
| POST | `/plans/coach` | coach | assign/replace a subscriber's plan → `{ userId, workout, nutrition, notes }` |
| PATCH | `/plans/:id` | coach | update a plan the coach owns (bumps `version`) |

Active plan response = the structured `PlanAssignment` (`02 §2.10`): `source`,
`workout.weeklySchedule[]`, `nutrition`, `version`.

**Ownership guard (item 5):** `POST /plans/coach` and `PATCH /plans/:id` are allowed
**only when the target user is an active subscriber of the requesting coach** (an
`active` `Subscription` with `endDate > now`). Otherwise → `403 NOT_SUBSCRIBED`. A coach
may only edit plans they authored.

**Exercise identifier (item 6):** coach-submitted plan `items[]` use **`trackedKey`**
(same as AI plans) — never `exerciseId`. The backend resolves `trackedKey → exerciseId`
and snapshots `exerciseName`, per the resolution rule in `02 §2.11`.

## 3.7 Exercises  `/exercises`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/exercises?type=tracked\|guided&category=` | user | catalog (id, name, type, trackedKey, instructions, demoMediaId) |
| GET | `/exercises/:id` | user | one exercise |
| GET | `/exercises/cv-config` | user | 🆕 thresholds JSON for the on-device CV — **built by reading `cvThresholds` off the active tracked `Exercise`s** (`02 §2.8`, `04 §4.2.3`) |
| POST | `/exercises` | admin | create |
| PATCH | `/exercises/:id` | admin | update |

## 3.8 Workouts & sessions  `/workouts`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/workouts/sessions` | user | submit a completed session (`04 §4.2.4`) |
| GET | `/workouts/sessions?page=&limit=&from=&to=` | user | own sessions, paginated |
| GET | `/workouts/sessions/:id` | user (owner) | one session detail |

The client posts raw `efforts` only; backend computes `accuracy`/`summary` and
recomputes risk. Response includes the session `summary` and optional `riskAlert`.

## 3.9 Progress  `/progress`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/progress/summary?from=&to=` | user | 🆕 **overall** aggregates over ALL sessions (fixes the per-page bug) — totalReps, correctReps, accuracy, top mistake categories, completed workouts, consistency |
| GET | `/progress/risk` | user | current `InjuryRiskProfile` (`02 §2.12`) or `insufficient_data` |
| GET | `/progress/trends?metric=accuracy\|risk&days=45` | user | 🆕 time series from `InjuryRiskSnapshot` for charts |

## 3.10 Coaches  `/coaches`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/coaches?specialty=&page=` | public | approved coach directory (name, bio, specialties, ratingAvg, ratingCount, profileImage) |
| GET | `/coaches/:id` | public | full profile + certifications + transformations |
| POST | `/coaches/applications` | user | apply: `{ bio, specialties, yearsExperience, governmentIdMediaId, certificationMediaIds[] }` |
| GET | `/coaches/me/profile` | coach | own profile |
| PATCH | `/coaches/me/profile` | coach | edit bio/specialties/expertise/profileImage |
| GET | `/coaches/me/subscribers` | coach | active subscribers |
| GET | `/coaches/me/subscribers/:userId/progress` | coach | 🆕 read a subscriber's progress + risk (read-only) |
| GET | `/coaches/:id/reviews` | public | reviews |
| POST | `/coaches/:id/reviews` | user (past/active subscriber) | `{ rating, comment }` — backend derives the subscription (see below) |
| GET | `/coaches/:id/transformations` | public | showcases |
| POST | `/coaches/me/transformations` | coach | `{ title, description, beforeMediaId, afterMediaId, durationWeeks }` |

**Review subscription derivation (item 3):** the request body is only `{ rating, comment }`.
The backend finds the **most recent `active`/`expired` `Subscription` between this user
and coach that has no existing `Review`**, and uses its `_id` as `subscriptionId`. If no
such eligible un-reviewed subscription exists → `403 NOT_SUBSCRIBED` (never subscribed) or
`409` (every eligible subscription already reviewed). Writing the review recomputes
`CoachProfile.ratingAvg/ratingCount`.

## 3.11 Subscriptions  `/subscriptions`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/subscriptions/me` | user | active subscription or null |
| POST | `/subscriptions` | user | `{ coachId }` → creates **mock Payment** + activates; coach plans become active (`06`) |
| DELETE | `/subscriptions/me` | user | cancel (stays active until `endDate`) |

`POST /subscriptions` returns `{ subscription, payment }`. 409
`ACTIVE_SUBSCRIPTION_EXISTS` if already subscribed to a different coach.

## 3.12 Notifications  `/notifications`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/notifications?unread=true&page=` | user | in-app feed |
| PATCH | `/notifications/:id/read` | user | mark read |
| PATCH | `/notifications/read-all` | user | mark all read |

## 3.13 Media  `/media`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/media` | user | multipart upload → `{ mediaId, url }`; stored in object storage, DB keeps reference (`07`) |
| GET | `/media/:id` | varies | 🆕 fetch an asset after an ownership/role check — streams it or 302-redirects to a short-lived signed URL |

**Access control (item 13):** `coach_id_doc` and `certification` live in **private
storage** and are served **only** via `GET /media/:id` as a **short-lived signed URL**,
readable by the **owner or an admin** — never a public URL. Public kinds (`profile_image`,
`transformation_*`, `exercise_demo`) may be returned as public URLs.

## 3.14 Admin  `/admin`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/dashboard` | admin | platform counts |
| GET | `/admin/users?role=&page=` | admin | user list |
| GET | `/admin/users/:id` | admin | user detail |
| PATCH | `/admin/users/:id/role` | admin | change role |
| GET | `/admin/coach-applications?status=pending` | admin | review queue |
| PATCH | `/admin/coach-applications/:id` | admin | `{ decision:"approved"\|"rejected", note }` → on approve: create `CoachProfile`, set role, notify |
| GET | `/admin/mistake-categories` / POST / PATCH | admin | manage CV mistake taxonomy + severities |

---

## 3.15 Path changes from current code (for the backend)

| Now | Becomes | Reason |
|-----|---------|--------|
| `POST /auth/register` (full profile) | email+password only | A1 split |
| — | `POST /users/me/onboarding` | A1 split + disclaimer |
| `GET /workouts/me/plan` | `GET /plans/me` | resource clarity |
| `POST /workouts` (coach assign) | `POST /plans/coach` | resource clarity |
| `POST /progress/sessions` | `POST /workouts/sessions` | A2 |
| `GET /progress/me` | `GET /progress/summary` (+fix overall) | B1 bug |
| login returns `token` | returns `accessToken`+`refreshToken` | ADR-009 |
