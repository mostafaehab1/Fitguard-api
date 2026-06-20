# FitGuard — System Design & Integration Specification

This folder is the single source of truth for **how FitGuard is built and how the
three sub-teams integrate**. It is written to be (a) precise enough that the
Flutter and AI teammates can implement without guessing, and (b) defensible in an
academic evaluation.

> **Roles**
> - **Backend / Team Lead:** Mostafa — owns this spec, the API, the database, the
>   injury-risk engine, and the integration contracts.
> - **Frontend:** Flutter app — consumes [`03-api-contract.md`](03-api-contract.md).
> - **AI developer (1):** workout/nutrition plan generation + on-device Computer Vision —
>   implements [`04-ai-cv-integration.md`](04-ai-cv-integration.md), plan service first.

## Start here

- **[`00-plain-language-overview.md`](00-plain-language-overview.md)** — the entire
  system explained in plain words, no jargon. Read this first; give it to everyone.
- **[`handoff/WHO-GETS-WHICH-FILES.md`](handoff/WHO-GETS-WHICH-FILES.md)** — which
  documents to send to which teammate, and the ready-to-use, LLM-friendly instruction
  file for each person.

## Reading order

| # | Document | What it answers | Main audience |
|---|----------|-----------------|---------------|
| 0 | [`00-plain-language-overview.md`](00-plain-language-overview.md) | The whole system in plain English | Everyone + professors |
| 1 | [`01-system-overview.md`](01-system-overview.md) | Vision, actors, scope, tech stack, deployment, **Architecture Decision Records** | Professors + everyone |
| 2 | [`02-domain-model.md`](02-domain-model.md) | Every entity, the ERD, full schemas | Backend + AI |
| 3 | [`03-api-contract.md`](03-api-contract.md) | REST endpoints, payloads, errors, RBAC | **Flutter dev** |
| 4 | [`04-ai-cv-integration.md`](04-ai-cv-integration.md) | CV event contract + LLM plan-gen contract | **AI team** |
| 5 | [`05-injury-risk-engine.md`](05-injury-risk-engine.md) | The cumulative-risk scoring model (the thesis) | Professors |
| 6 | [`06-flows-and-lifecycle.md`](06-flows-and-lifecycle.md) | Sequence diagrams for every cycle | Everyone |
| 7 | [`07-security-ops.md`](07-security-ops.md) | Auth hardening, validation, media, seeding, deploy, testing | Backend |
| 8 | [`08-team-integration-guide.md`](08-team-integration-guide.md) | Per-person "do exactly this" checklist | FE + AI |

### `handoff/` — give these directly to your teammates

| File | For |
|------|-----|
| [`handoff/WHO-GETS-WHICH-FILES.md`](handoff/WHO-GETS-WHICH-FILES.md) | You — the distribution map |
| [`handoff/INSTRUCTIONS-flutter-developer.md`](handoff/INSTRUCTIONS-flutter-developer.md) | Flutter dev — LLM-ready task brief |
| [`handoff/INSTRUCTIONS-ai-plan-service.md`](handoff/INSTRUCTIONS-ai-plan-service.md) | AI dev (plans) — LLM-ready task brief |
| [`handoff/INSTRUCTIONS-ai-oncamera-cv.md`](handoff/INSTRUCTIONS-ai-oncamera-cv.md) | AI dev (camera) — LLM-ready task brief |

## Status

| Document | Status |
|----------|--------|
| 01 System overview | ✅ Drafted |
| 02 Domain model | ✅ Drafted |
| 03 API contract | ✅ Drafted |
| 04 AI/CV integration | ✅ Drafted (grounded in the AI team's real code) |
| 05 Injury-risk engine | ✅ Drafted |
| 06 Flows & lifecycle | ✅ Drafted |
| 07 Security & ops | ✅ Drafted |
| 08 Team integration guide | ✅ Drafted |

## Conventions used in this spec

- **Coach vs trainer:** The product term is **Coach**. The current codebase stores
  the role string as `"trainer"` and aliases it to `coach` in responses. This spec
  uses **coach** everywhere; see ADR-011 for the standardization note.
- **Tracked vs guided exercise:** *Tracked* = analyzed by Computer Vision (free
  weights, form-sensitive). *Guided* = instructions only (machines).
- **System of record:** The **backend** is authoritative for all stored and derived
  data. The phone and the AI service are *producers* of inputs; they never write
  derived scores (risk, accuracy trends) directly.
- All dates are ISO-8601 UTC. All IDs are MongoDB ObjectIds rendered as strings.
