# 07 — Security & Operations

This document turns the review findings into concrete hardening, plus the operational
pieces (media, seeding, deployment, testing) that make FitGuard production-shaped and
defensible.

## 7.1 Auth hardening (fixes review findings C1–C6)

| # | Fix | Detail |
|---|-----|--------|
| **C1** | **Hash one-time tokens** | Store `sha256(token)` for password-reset and email-verification, not the raw token. Email the raw token; look up by hash. Limits damage if the DB leaks. |
| **C6** | **Expire verification tokens** | Add `emailVerificationTokenExpiresAt` (e.g. 24h); re-send on expiry. |
| **C2** | **Rate limiting** | `express-rate-limit`: login & forgot-password ≤ 5/15min per IP+email; register ≤ 10/hour per IP; global ≤ 100/min. Return `429 RATE_LIMITED`. |
| **C4** | **Refresh tokens (ADR-009)** | Short access token (15m) + long refresh token (30d). Store `sha256(refreshToken)` in `User.refreshTokenHash`. `/auth/refresh` rotates; `/auth/logout` clears. |
| **C3** | **CORS allowlist** | Replace bare `cors()` with an explicit `origin` allowlist from `CORS_ORIGINS` env (the Flutter web/app origins). |
| **C5** | **Enumeration** | Acceptable to keep `409 EMAIL_TAKEN` on register, but document it as a conscious trade-off; `forgot-password` already resists enumeration — keep it that way. |

Already-good (keep): bcrypt (10 rounds), `select:false` on secrets, 1h reset expiry,
role self-escalation blocked, generic forgot-password response.

## 7.2 Request validation (ADR-010)

Replace the per-controller manual checks with **zod** schemas + one
`validate(schema)` middleware. On failure → `422` with field errors in
`error.details`. One schema per endpoint body/query, colocated with the route. This
removes the inconsistent hand-rolled validation across controllers.

## 7.3 Authorization & data integrity

- `authMiddleware` verifies the access token → `req.auth = { userId, role }`.
- `rbac(['coach'])` / `rbac(['admin'])` guards by role (already present —
  [rbacMiddleware.js](../backend/src/middlewares/rbacMiddleware.js)).
- **Ownership checks** on every `/me/...` and `:id` resource (a user may only read
  their own sessions; a coach only their own subscribers).
- **Integrity rule (no endpoint exists to violate it):** nobody — including admin —
  can mutate `WorkoutSession`, `InjuryRiskProfile`/`Snapshot`, or AI-generated results.
  Admin powers are limited to users, roles, exercises, mistake categories, and coach
  applications.

## 7.4 Media storage (ADR for `MediaAsset`)

- Binaries live in **object storage** (Cloudinary or S3); MongoDB stores only a
  `MediaAsset` reference (`02 §2.17`).
- Upload via `POST /media` (multipart) → server validates **mime + size by `kind`**:
  - `profile_image`, `transformation_*`, `exercise_demo`: images only
    (`image/jpeg|png|webp`), ≤ **5MB**.
  - `certification`, `coach_id_doc`: images **or** `application/pdf`, ≤ **10MB** (item 8).
- **Access control (item 13):** `coach_id_doc` and `certification` go to **private
  storage** and are served **only** through `GET /media/:id` as **short-lived signed
  URLs**, to the **owner or an admin** — never public URLs. Public kinds (`profile_image`,
  `transformation_*`, `exercise_demo`) may use public URLs.
- On delete, remove both the DB reference and the provider object (`publicId`).

## 7.5 Configuration / environment

| Var | Required | Purpose |
|-----|:---:|---------|
| `MONGODB_URI` | ✓ | database |
| `JWT_SECRET` | ✓ | access-token signing |
| `JWT_ACCESS_EXPIRES_IN` | | default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | | default `30d` |
| `CORS_ORIGINS` | ✓ (prod) | comma-separated allowlist |
| `APP_BASE_URL` | | links in emails |
| `MAIL_FROM`, `SMTP_*` | ✓ (prod) | email (already wired) |
| `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `AI_SERVICE_TIMEOUT_MS` | ✓ | plan-gen service (`04 §4.4`) |
| `MEDIA_PROVIDER`, `CLOUDINARY_*` / `S3_*` | ✓ | media storage |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ✓ | first-admin bootstrap for the seed (`§7.6`) |

Keep the existing fail-fast `config.js` pattern (throw on missing required vars).

## 7.6 Seeding

A `seed` script (idempotent, keyed by natural keys) populates reference data:

1. **`MistakeCategory`** — the 13-row severity/cue table from `04 §4.1`.
2. **`Exercise` (tracked)** — the 13 tracked exercises (with `trackedKey`,
   `supportedMistakes`, and **`cvThresholds` copied from
   `AI/configs/exercise_config.py`** — these feed `GET /exercises/cv-config`) (item 2).
3. **`Exercise` (guided)** — seed **2–3 concrete guided** exercises (`type:"guided"`,
   **no `trackedKey`**, with `instructions` + `demoMediaId`) so the guided/manual path is
   real and testable (item 15): e.g. **Leg Extension Machine**, **Cable Chest Fly**,
   **Seated Calf Raise**.
4. **Admin bootstrap** — create the first `admin` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   env (no self-registration of admins — enforced in code).

Seeds must be re-runnable without duplicating (upsert on `key` / `trackedKey` / email).

## 7.7 Testing strategy

| Layer | Tool | Must cover |
|-------|------|-----------|
| Unit | Jest/Vitest | **Injury-risk engine** (the worked example in `05 §5.4` as a fixture), zod validators, plan-fallback generator, `setActivePlan` invariant |
| Integration | supertest | auth flow (register→verify→login→refresh), onboarding gate, session submit + risk recompute, subscribe→expire→revert, RBAC denials |
| Contract | — | AI service: malformed JSON → deterministic fallback; unknown `categoryKey` rejected |
| AI side | pytest (exists) | the form processors already have tests — keep them as the on-device port's reference oracle |

Target the **risk engine and the lifecycle job** for the highest coverage — they are
the most defensible "we tested the hard parts" story.

## 7.8 Deployment

- **Backend** → Fly.io (already initialized) + **MongoDB Atlas**.
- **AI plan service** → its own Fly.io app / container; reachable only by the backend
  via `AI_SERVICE_KEY`.
- **On-device CV** ships inside the Flutter app — no server cost.
- Health: `GET /api/health` (exists) for the backend, `GET /health` for the AI
  service; wire both to platform health checks.
- **Scheduler:** run the `06 §6.4` jobs via `node-cron` in the backend process, or a
  separate Fly.io scheduled machine for isolation.
- **Logging:** keep `morgan`; add request IDs and structured error logging. Never log
  tokens, passwords, or media of `coach_id_doc`.

## 7.9 Pre-production checklist

- [ ] `NODE_ENV=production`; dev-only token echoes (`devToken`) disabled (already gated)
- [ ] CORS allowlist set; rate limiting on
- [ ] One-time tokens hashed; refresh tokens live
- [ ] Indexes: `User.email`, `WorkoutSession.{userId,endedAt}`,
      `Subscription.{userId,status,endDate}`, unique `Review.{userId,subscriptionId}`,
      **partial-unique** `CoachApplication.userId` **where `status=="pending"`**,
      unique `InjuryRiskProfile.userId`
- [ ] Seeds run (exercises, mistake categories, admin)
- [ ] AI service reachable + fallback verified
- [ ] Lifecycle jobs scheduled and idempotent
- [ ] Backups enabled on Atlas
