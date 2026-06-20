# 00 — FitGuard in Plain Words

*Read this first. No technical background needed. It explains the whole system in
everyday language. The other documents (01–08) are the technical detail; this one is
the picture in your head.*

---

## What FitGuard is

FitGuard is a phone app that acts like a **gym coach who watches your form**. When you
do an exercise in front of your phone camera, it counts your reps and notices when
you're doing the movement wrong — like your knees caving in during a squat — and tells
you to fix it.

The important idea: **most gym injuries don't come from one bad lift. They come from
doing the same movement slightly wrong, over and over, for weeks.** So FitGuard doesn't
just judge one workout. It remembers your mistakes over time and warns you when a bad
habit is building up into an injury risk.

On top of that, the app gives every user an **AI-made workout plan and diet plan**, and
lets people who want extra help **subscribe to a real human coach**.

---

## The four kinds of "people" in the system

1. **User (the athlete)** — the normal person using the app to train safely.
2. **Coach** — a verified fitness professional who can make plans for users who pay to
   subscribe to them.
3. **Admin** — the person who keeps the platform clean: approves coaches, manages the
   exercise list, etc.
4. **AI** — not a person, but a helper. It writes the workout/diet plans, and the
   camera "form checker" is also AI.

---

## The pieces of the system (and what each one is for)

Think of it like a restaurant:

- **The phone app** = the *dining room and the menu* — the only part the user touches.
  Built with Flutter.
- **The backend** = the *kitchen and the manager* — the single place that stores
  everything and makes all the decisions and rules. Built by the team lead. **This is
  the one source of truth.** Everything important is decided here.
- **The database** = the *filing cabinet* where the backend keeps all records (users,
  plans, workout history, risk scores). We use MongoDB.
- **The AI plan helper** = a *specialist you phone up when you need a plan written*. It
  has no memory and no filing cabinet of its own. The backend asks it "write a plan for
  this person," it replies with the plan, and that's it. Built by the AI team.
- **The camera form-checker** = runs **on the phone itself** (not on a server). It uses
  the camera to watch your body, count reps, and spot mistakes. Built by the AI team +
  Flutter dev together.
- **The photo storage** = a *photo locker* (a cloud service) for images like coach
  certificates and before/after photos. The filing cabinet only keeps the *address* of
  each photo, not the photo itself.

> **One golden rule that holds the whole thing together:** the backend (the kitchen) is
> the only place that decides scores and keeps records. The phone *reports what it saw*
> ("the user did 20 squats, 5 were sloppy") but the phone never decides the injury-risk
> score itself. That keeps the numbers trustworthy and impossible to fake.

---

## How a user moves through the app (the journey)

1. **Sign up** with email and password.
2. **Verify email** (click a link) — required before you can log in.
3. **Onboarding:** answer questions about yourself (age, height, weight, goal,
   experience, any injuries/limitations) and **tick a box agreeing that FitGuard is
   fitness guidance, not medical advice.**
4. The app asks the AI helper to **create your free workout + diet plan.**
5. **Train:** open today's workout. For camera-tracked exercises (like squats), the
   phone watches and coaches you. For machine exercises it just shows instructions.
6. After the workout you get a **summary** (reps, accuracy, mistakes) and, if a bad
   pattern is building up, an **injury-risk alert.**
7. Over time, **progress screens** show whether your form is improving and which body
   parts are at risk.
8. **Optional:** browse coaches and subscribe to one. While subscribed, the coach's
   plans replace the AI plans. When the subscription ends, you go back to AI plans.

---

## The heart: the injury-risk idea (in plain words)

Every time the camera catches a mistake (say "knees caving in"), the backend writes it
down. Then it works out a **risk score from 0 to 100 for each body part** (knees, lower
back, shoulders…) using common sense:

- **Worse mistakes count more** (rounding your back on a deadlift is more dangerous than
  not squatting deep enough).
- **More frequent mistakes count more** (caving knees on half your reps vs. one rep).
- **Recent mistakes count more** than old ones.
- **Mistakes that keep coming back, session after session, count the most** — because
  that's exactly what causes long-term injury.
- **If you told us about an old injury** (e.g. bad knee), we're more cautious about that
  body part.

If a body part crosses into "elevated" or "high" risk, the user gets an alert with a
tip ("push your knees out over your toes"). And if you improve your form, the score
**drops on its own** over time. This score is the thing that makes FitGuard special —
it's not just a workout logger.

---

## Free vs. paid

- **Free (everyone):** AI workout plan, AI diet plan, camera form-checker, progress
  tracking, injury-risk alerts. This is the full experience on its own.
- **Paid (optional):** subscribe monthly to a verified human coach who writes and
  updates your plans and can see your progress and risk. This is the "human safety net"
  for people who need more than an app — for example, people with health conditions the
  AI shouldn't be trusted to handle alone.

---

## What we deliberately do NOT build (and that's on purpose)

No medical diagnosis, no live video calls with coaches, no appointment booking, no
in-app chat, no food-photo logging or calorie diary, no smart-watch syncing, and no
real credit-card payment (we record a "payment" but don't charge a real card). Saying
"we left these out on purpose to stay focused" is a strength, not a gap.

---

## Who on the team builds what (one line each)

- **Team lead (backend):** the kitchen — the central server, the database, the
  injury-risk scoring, and all the rules.
- **Flutter developer:** the phone app — every screen, plus running the camera
  form-checker on the phone.
- **AI developer (plans):** the small "plan helper" service that writes workout/diet
  plans when the backend asks.
- **AI developer (camera):** moving the form-checking logic onto the phone and making
  sure it reports mistakes in the agreed words.

The exact, step-by-step task list for each person is in their personal instruction file
(see the `handoff/` folder).
