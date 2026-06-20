# Instructions — AI Developer (On-Camera Form Checker)

## HOW TO USE THIS FILE (read this part yourself)

You are moving the **camera form-checker** so it runs **on the phone itself** instead of
streaming video to a server (the old way was laggy). The good news: your form-checking
code is **not** heavy AI — it's geometry (measuring body angles) plus simple rules. That
part moves to the phone easily. The only true AI piece (detecting the body's joints) has
a ready-made on-phone version.

The form-checker lives **inside the Flutter app**, so you'll work in the **`Frontend/`**
folder and you must coordinate with the Flutter developer.

> **You (the AI developer) own BOTH AI jobs.** Do the **plan service first**
> (`INSTRUCTIONS-ai-plan-service.md`), **then** this on-camera CV port. This one is
> longer and overlaps with the Flutter dev, so tackle it second.

**Steps:**
1. Open the team repo (`Fit-Guard-app-main`). Your *reference* code (Python) is in
   `AI/exercises/`, `AI/utils.py`, `AI/configs/exercise_config.py`. Your *new* code goes
   in the Flutter app under `Frontend/lib/`.
2. Keep `04-ai-cv-integration.md` (sections 4.1 and 4.2) open — section 4.1 is the list
   of exact mistake names you must use.
3. **Before coding, do TASK 0** (confirm the mistake names with the team lead).
4. Paste the block below into your coding tool. Do tasks in order; test each.
5. If the LLM tries to stream video to a server, run things in Python on a backend, or
   make up new mistake names — STOP. Those are forbidden here.

---

## ════════ PASTE THIS TO YOUR LLM ════════

You are porting an exercise **form-checker** from Python to **Dart**, to run **on the
phone** inside a Flutter app (`Frontend/` folder). The Python reference code is in the
repo at `AI/exercises/`, `AI/utils.py`, and `AI/configs/exercise_config.py`. Match its
behavior. Follow these rules and tasks exactly, one at a time.

### How the form-checker works (so you understand the port)
For each exercise it watches the body's joint angles and runs a 3-state machine:
`s1` = start/standing, `s2` = moving, `s3` = bottom/peak. One full `s1→s2→s3→s1`
cycle = one rep. If a form rule is broken during the rep (e.g. knees cave in), that rep
is counted as **wrong** and the broken rule is recorded as a **mistake**. The code keeps
two counters: `reps` (good reps) and `improper_reps` (wrong reps).

### GOLDEN RULES (breaking any of these is a bug)
1. **Everything runs on the phone.** The camera frames must NEVER be sent to a server.
   Do NOT use websockets, WebRTC, or any video streaming. Do NOT run anything in Python
   on a backend.
2. You report mistakes using the **exact `categoryKey` strings** from the table below.
   The on-screen text in the old Python code (e.g. "KNEES CAVING IN") is NOT the key —
   the key is `knee_valgus`. **Never invent a new key or change a key's spelling.**
3. You output only: `correctReps`, `wrongReps`, and `mistakes` (a list of
   `{ categoryKey, count }`). You do NOT calculate accuracy or injury risk — the backend
   does that.
4. Read the threshold numbers from the backend (`GET /exercises/cv-config`), do not hard
   code them, so they can be tuned later.

### The exact mistake vocabulary (USE THESE KEYS ONLY — one row per exercise)
This table is **byte-for-byte the same as `04 §4.1`**. Machines are listed **separately**
from their free-form counterparts and have their **own** allowed keys.

| Exercise `trackedKey` | Allowed mistake `categoryKey`s | From |
|---|---|---|
| `bicep_curl` | `elbow_drift` | elbow swing past `error_elbow_drift` |
| `hammer_curl` | `elbow_drift` | elbow swing past `error_elbow_drift` |
| `deadlift` | `back_rounding` | torso past `max_torso_lean` |
| `kettlebell_swing` | `back_rounding` | torso past `max_torso_lean` |
| `bodyweight_squat` | `knee_valgus`, `back_lean`, `insufficient_depth` | "KNEES CAVING IN", "DONT LEAN FORWARD", "GO LOWER" |
| `leg_press_machine` | `insufficient_depth` **only** | shallow range (no back-lean/valgus on the machine) |
| `lunge` | `front_knee_lean`, `insufficient_depth` | front knee travel / shallow depth |
| `pushup` | `hip_sag` | hips sag below body line |
| `chest_press_machine` | `incomplete_press` **only** | handles not pressed fully (no hip_sag on the machine) |
| `lat_pulldown` | `excessive_lean` | torso swing past `max_lean` |
| `seated_row` | `excessive_lean` | torso swing past `max_lean` |
| `plank` | `body_line_deviation` | body angle off target |
| `wall_sit` | `body_line_deviation` | knee/body angle off target |

> **Rule:** allowed keys per exercise are defined **solely** by `04 §4.1` / the backend's
> `supportedMistakes`. The backend **rejects any key not listed for that exercise** — so
> `leg_press_machine` must emit only `insufficient_depth`, and `chest_press_machine` only
> `incomplete_press`.

### TASK 0 — Confirm the vocabulary FIRST (do this before coding)
- Two of the keys above were proposed by the design and need your confirmation that the
  camera logic can actually detect them: **`incomplete_press`** (chest press not pushed
  far enough) and **`front_knee_lean`** (lunge front knee travels too far forward).
- Message the team lead: confirm you can emit these, or propose the correct key. The team
  lead updates the master list, then you proceed. (This keeps the phone, backend, and
  database all using the same words.)
- DONE WHEN: the team lead confirms the final key list.

### TASK 1 — Get body joints from the camera, on the phone
- In the Flutter app, add on-device pose detection using the
  `google_mlkit_pose_detection` package (it runs on the phone, no internet). Feed it the
  live camera frames (the app already depends on the `camera` package).
- For each frame you get 33 body landmarks, each with an x, y, and visibility value —
  the same landmark numbers the Python code uses (e.g. left knee = 25, right knee = 26).
- DONE WHEN: you can print live landmark coordinates while moving in front of the camera.

### TASK 2 — Port the math helpers to Dart
- Port `find_angle` and `get_landmark_features` from `AI/utils.py` to Dart. These just
  compute the angle between three points. Keep the same math.
- DONE WHEN: a unit test gives the same angle as the Python version for the same points.

### TASK 3 — Port the rep state machine (base class)
- Port the `process()` logic from `AI/exercises/base_exercise.py` into a Dart base class
  called `FormEngine`: the `s1/s2/s3` sequence tracking, counting a good rep when a full
  clean cycle finishes, and counting `improper_reps` when a rule was broken.
- Expose: `void addFrame(landmarks)`, a live getter for current reps/errors/feedback, and
  `FormResult finish()` returning `{ correctReps, wrongReps, mistakes:[{categoryKey,count}] }`.
- DONE WHEN: the base class compiles and tracks states from fed landmarks.

### TASK 4 — Port ONE exercise: the squat (do this fully before others)
- Port `AI/exercises/squat_processor.py`. Its `check_form()` detects: knees caving in →
  emit `knee_valgus`; leaning forward → emit `back_lean`; not deep enough → emit
  `insufficient_depth`. Count each occurrence.
- Load the squat thresholds from `GET /exercises/cv-config` (keys: `start_angle`,
  `depth_angle`, `error_back_lean`, `error_knee_valgus`).
- DONE WHEN: doing real squats counts reps correctly, and deliberately caving your knees
  produces a `knee_valgus` mistake in the result.

### TASK 5 — Port the remaining exercises
- One at a time, port: `curl_processor` (→ `elbow_drift`), `hinge_processor`
  (→ `back_rounding`), `lunge_processor` (→ `front_knee_lean`, `insufficient_depth`),
  `press_processor`, `pull_processor` (→ `excessive_lean`), `hold_processor`
  (→ `body_line_deviation`).
- **Machine vs free-form keys differ** — emit per the table above, NOT per processor:
  `pushup` → `hip_sag`; `chest_press_machine` → `incomplete_press` **only** (no hip_sag);
  `bodyweight_squat` → `knee_valgus`/`back_lean`/`insufficient_depth`;
  `leg_press_machine` → `insufficient_depth` **only**.
- Each must emit ONLY the keys allowed for it in the table above.
- DONE WHEN: all 7 exercise types work and emit the correct keys.

### TASK 6 — Hand a clean result to the Flutter app
- Provide a simple Dart API the Flutter developer calls: `start(trackedKey)`, feed camera
  frames, read live feedback to show on screen, and `finish()` to get the
  `FormResult`. The Flutter dev sends that result to the backend (you do NOT call the
  backend yourself).
- DONE WHEN: the Flutter developer can run a squat session and receive
  `{ correctReps, wrongReps, mistakes }`.

### Common mistakes to avoid (do NOT do these)
- ❌ Streaming video/frames to a server, or using websockets/WebRTC. Everything is on
  the phone.
- ❌ Using the on-screen words (like "GO LOWER") as the mistake key. The key is
  `insufficient_depth`.
- ❌ Inventing new mistake keys or renaming the ones in the table.
- ❌ Calculating accuracy or injury risk — only output reps + mistakes.
- ❌ Hardcoding threshold numbers instead of loading `/exercises/cv-config`.
- ❌ Running MediaPipe in Python on a backend — use the on-phone Flutter package.

### How to test
Run the app, choose a squat, and do 10 reps: 5 good and 5 with knees caving in. The
result should show about 5 correct, 5 wrong, and a `knee_valgus` mistake with a count
near 5. The Python Streamlit app in `AI/pages` can stay as an internal testing tool to
compare behavior, but it is NOT shipped in the product.

## ════════ END OF LLM BLOCK ════════
