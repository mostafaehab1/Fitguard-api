# 06 — Flows & Lifecycle

Sequence diagrams for every cycle, plus the **scheduled jobs** that close the cycles
your current code leaves open (subscription expiry, plan reversion). Diagrams render
on GitHub.

## 6.1 Onboarding: register → verify → onboard → AI plan

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Flutter
    participant BE as Backend
    participant MAIL as SMTP
    participant AI as AI Plan Service

    U->>FE: sign up (email, password)
    FE->>BE: POST /auth/register
    BE->>MAIL: verification email
    BE-->>FE: 201 (user, emailVerified=false)
    U->>MAIL: open email, click link
    MAIL-->>BE: GET /auth/verify-email?token
    BE-->>U: verified
    U->>FE: log in
    FE->>BE: POST /auth/login
    BE-->>FE: accessToken + refreshToken
    FE->>U: show onboarding form + disclaimer
    U->>FE: profile + accept disclaimer
    FE->>BE: POST /users/me/onboarding
    BE->>BE: set onboardingCompletedAt, disclaimerAcceptedAt
    Note over BE: onboarding completion AUTO-triggers AI plan generation<br/>(no separate app call)
    BE->>AI: POST /v1/plans/workout + /v1/plans/nutrition (profile, catalog)
    AI-->>BE: structured JSON (validated, else fallback)
    BE->>BE: create active PlanAssignment(source=ai), set User.activePlanId
    BE-->>FE: onboarding response (+ active plan)
```

**Gate:** the app must not allow workouts until `onboardingCompletedAt` is set. Login
is blocked until email is verified (already enforced).

**AI-plan trigger (item 18):** the backend auto-generates the first AI plan **once**, as
part of onboarding completion. `POST /users/me/ai-plan` is a **manual fallback** the app
calls only when `GET /plans/me` shows no active plan (e.g. generation failed) or when the
user explicitly asks to regenerate.

## 6.2 Tracked workout execution (on-device CV → risk)

```mermaid
sequenceDiagram
    actor U as User
    participant CV as On-device Form Engine
    participant FE as Flutter
    participant BE as Backend

    U->>FE: start workout (today's plan day)
    FE->>BE: GET /exercises/cv-config
    loop each tracked exercise
        U->>CV: perform reps (camera, on-device)
        CV->>FE: live reps / errors / cue
    end
    FE->>BE: POST /workouts/sessions (efforts: reps + mistake events)
    BE->>BE: validate keys ∈ supportedMistakes, correct+wrong==total
    BE->>BE: compute accuracy + summary
    BE->>BE: recompute InjuryRiskProfile + append Snapshot
    alt risk band increased
        BE->>BE: create risk_alert Notification
    end
    BE-->>FE: session summary (+ riskAlert)
    FE->>U: workout summary + any risk alert
```

Guided exercises skip CV: the app shows instructions/demo and posts a `manual`
session with `tracked:false`.

## 6.3 Plan ownership & subscription lifecycle (the cycle your code breaks today)

```mermaid
stateDiagram-v2
    [*] --> AIPlan: onboarding complete
    AIPlan --> AIPlan: subscribe to coach\n(plan STAYS AI until coach authors)
    AIPlan --> CoachPlan: coach authors plan\n(POST /plans/coach → setActivePlan)
    CoachPlan --> CoachPlan: coach updates plan\n(version++)
    CoachPlan --> AIPlan: subscription expires / cancelled\n(lifecycle job reverts)
    AIPlan --> AIPlan: regenerate AI plan
```

**Invariant enforced centrally (ADR-006):** exactly one active `PlanAssignment` per
user, pointed to by `User.activePlanId`. A single service function
`setActivePlan(userId, planId)` deactivates the previous active plan and updates the
pointer atomically — never ad-hoc `updateMany` in two controllers.

### Subscribe flow

```mermaid
sequenceDiagram
    actor U as User
    participant BE as Backend
    U->>BE: POST /subscriptions { coachId }
    BE->>BE: guard: no other active subscription
    BE->>BE: create mock Payment(status=succeeded)
    BE->>BE: create Subscription(active, endDate=+1mo), set User.activeSubscriptionId
    BE->>BE: KEEP current AI plan active (activePlanId unchanged)
    BE->>BE: Notification(subscription_activated)
    BE-->>U: { subscription, payment }
```

**Plan during the subscribe gap (item 7):** subscribing does **not** change the active
plan. The user keeps their **AI plan** until the coach actually authors one via
`POST /plans/coach`, at which point `setActivePlan` swaps `activePlanId` to the coach
plan (and deactivates the AI plan). If the subscription ends before the coach ever
authored a plan, the user was already on the AI plan, so there is nothing to revert.

## 6.4 Scheduled jobs (these fix bugs B2/B3)

Run via a scheduler (`node-cron` in-process, or a Fly.io scheduled machine). All jobs
are **idempotent**.

| Job | Cadence | Action |
|-----|---------|--------|
| **expire-subscriptions** | hourly | For `Subscription` where `status=active && endDate<=now`: set `status=expired`; clear `User.activeSubscriptionId`; deactivate the coach `PlanAssignment`; reactivate the latest AI plan (or generate one if none); `Notification(subscription_expired)` |
| **expiry-reminders** | daily | Subscriptions expiring within 3 days → `Notification(subscription_expiring)` (+ email) |
| **risk-decay (optional)** | nightly | Recompute `InjuryRiskProfile` so risk decays on rest days too |

```mermaid
sequenceDiagram
    participant J as expire-subscriptions (hourly)
    participant BE as Backend
    J->>BE: find active subs with endDate <= now
    loop each expired sub
        BE->>BE: sub.status = expired
        BE->>BE: clear User.activeSubscriptionId
        BE->>BE: deactivate coach PlanAssignment
        BE->>BE: setActivePlan(user, latest AI plan)  // revert
        BE->>BE: Notification(subscription_expired)
    end
```

> Until this job exists, an expired subscriber stays on a stale coach plan forever and
> never reverts to AI — the bug called out in the review (B3).

## 6.5 Coach verification

```mermaid
sequenceDiagram
    actor U as User
    participant BE as Backend
    actor A as Admin
    U->>BE: POST /media (gov ID, certs) → mediaIds
    U->>BE: POST /coaches/applications { bio, specialties, yearsExperience, mediaIds }
    BE->>BE: CoachApplication(status=pending)
    A->>BE: GET /admin/coach-applications?status=pending
    A->>BE: PATCH /admin/coach-applications/:id { decision }
    alt approved
        BE->>BE: User.role=coach; create/activate CoachProfile
        BE->>BE: Notification(coach_approved)
    else rejected
        BE->>BE: keep role=user; Notification(coach_rejected, note)
    end
```

The gov-ID + certifications requirement is the **human-verification** safeguard
(only vetted humans supervise at-risk users) — make this explicit in the defense.

## 6.6 Notification fan-out

A single `notify(userId, type, payload)` service writes a `Notification` (in-app) and,
for the email-worthy types, sends an email. Triggers:

| Type | Trigger |
|------|---------|
| `email_verification` | register |
| `coach_approved` / `coach_rejected` | admin decision |
| `subscription_activated` | subscribe |
| `subscription_expiring` / `subscription_expired` | lifecycle jobs |
| `plan_updated` | coach updates a subscriber's plan |
| `risk_alert` | risk band increases (`05 §5.7`) |

## 6.7 Review eligibility

```mermaid
flowchart LR
    A[POST /coaches/:id/reviews<br/>body: rating, comment] --> B[Backend DERIVES the subscription:<br/>most recent active/expired sub with<br/>this coach AND no existing review]
    B -->|found| C[Create Review with that subscriptionId]
    B -->|never subscribed| E[403 NOT_SUBSCRIBED]
    B -->|all eligible subs already reviewed| D[409 already reviewed]
    C --> F[Recompute CoachProfile.ratingAvg/Count]
```

The client never sends `subscriptionId`; the backend derives it (item 3). One review per
subscription period is enforced by the unique index `{ userId, subscriptionId }`
(`02 §2.14`).
