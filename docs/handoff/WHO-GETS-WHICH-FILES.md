# Who Gets Which Files — Distribution Map

*This is for you (the team lead). It tells you exactly which documents to send to each
teammate, what everyone shares, and how they should use the files with their coding
LLM. Don't send the whole `docs/` folder to everyone — send each person only their set,
or they'll get overwhelmed and their LLM will wander off-task.*

---

## How each teammate uses their files (tell them this)

> 1. Open the team app repo you already downloaded (`Fit-Guard-app-main`) in your coding
>    tool (Cursor / Claude Code / VS Code + Copilot, etc.).
> 2. Put **your instruction file** and the **shared files** into the project (or attach
>    them to the chat).
> 3. Paste the block from your instruction file marked **"PASTE THIS TO YOUR LLM"**.
> 4. Do the tasks **in order**. Do not skip ahead. After each task, test it before
>    moving on.

---

## Shared with EVERYONE (both teammates + you)

These give the common picture and the rules nobody may break:

| File | Why everyone needs it |
|------|------------------------|
| `00-plain-language-overview.md` | The whole system in plain words |
| `01-system-overview.md` | Actors, scope, the big decisions |
| `08-team-integration-guide.md` → **§8.2 "The five contracts"** | The shared rules that must never be broken by one person alone |

---

## Flutter developer

**Send:** the shared set **+**

| File | Use |
|------|-----|
| `handoff/INSTRUCTIONS-flutter-developer.md` | ⭐ their step-by-step task file |
| `03-api-contract.md` | every endpoint + request/response they call |
| `04-ai-cv-integration.md` (focus **§4.2**) | how the on-camera form-checker runs on the phone + what to send the backend |
| `06-flows-and-lifecycle.md` | the order screens happen in |

## AI developer — Stream 1: Plan service (do this first)

**Send:** the shared set **+**

| File | Use |
|------|-----|
| `handoff/INSTRUCTIONS-ai-plan-service.md` | ⭐ their step-by-step task file |
| `04-ai-cv-integration.md` (focus **§4.3** and **§4.5**) | the exact plan request/response + what to delete |
| `02-domain-model.md` (focus **§2.10**) | the exact shape of a plan |

## AI developer — Stream 2: Camera/CV (do this after the plan service)

**Send:** the shared set **+**

| File | Use |
|------|-----|
| `handoff/INSTRUCTIONS-ai-oncamera-cv.md` | ⭐ their step-by-step task file |
| `04-ai-cv-integration.md` (focus **§4.1** and **§4.2**) | the exercise/mistake vocabulary + on-phone plan |
| `05-injury-risk-engine.md` | *context only* — why the mistakes they report matter |

## You (team lead / backend)

You keep **all** documents. Your task list is `08-team-integration-guide.md §8.3` plus
the technical docs `02`, `03`, `05`, `06`, `07`.

---

## The single AI developer — gets BOTH files, in order

There is **one AI developer** who owns both AI streams. Give them **both** instruction
files and **both** doc sets, and have them work in this order:

1. **First → `INSTRUCTIONS-ai-plan-service.md`** (the stateless plan service —
   self-contained, unblocks the Flutter plan screen).
2. **Then → `INSTRUCTIONS-ai-oncamera-cv.md`** (the on-phone camera port — longer, and it
   overlaps with the Flutter developer, so those two must talk).

---

## One-page cheat sheet

| Person | Their ⭐ instruction file | Plus these docs |
|--------|--------------------------|-----------------|
| Flutter dev | `INSTRUCTIONS-flutter-developer.md` | 00, 01, 08§8.2, 03, 04§4.2, 06 |
| AI developer (1st: plans) | `INSTRUCTIONS-ai-plan-service.md` | 00, 01, 08§8.2, 04§4.3+§4.5, 02§2.10 |
| AI developer (2nd: camera) | `INSTRUCTIONS-ai-oncamera-cv.md` | 00, 01, 08§8.2, 04§4.1+§4.2, 05 |
| You (backend) | 08§8.3 | everything |
