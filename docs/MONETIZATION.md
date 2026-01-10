# Monetization Plan

This document defines pricing, packaging, licensing, and entitlement flows for Code Coach. It assumes the core extension remains open‑source and BYOK‑friendly.

---

## Positioning

**Free core, paid collaboration + compliance.**  
Code Coach remains useful offline and with BYOK. Paid tiers unlock org controls, shared assets, and compliance features.

---

## Pricing (recommended)

| Tier | Price | Target |
|------|------:|--------|
| Free | $0 | Individual devs / OSS |
| Pro | $15/mo | Power users who want advanced AI workflows |
| Team | $12/user/mo (min 5) | Engineering teams |
| Enterprise | Custom | Security‑sensitive orgs |

---

## Feature Gating Matrix (tied to current features)

Legend: ✅ included, ⚠️ limited, 🔒 paid

| Feature | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| Explain Selection (static) | ✅ | ✅ | ✅ | ✅ |
| Explain Diagnostic (static) | ✅ | ✅ | ✅ | ✅ |
| Trace Diagnostic Origin | ✅ | ✅ | ✅ | ✅ |
| Trace Stack Trace | ✅ | ✅ | ✅ | ✅ |
| Deep Dive (usages/blame/history/tests/coverage) | ✅ | ✅ | ✅ | ✅ |
| Code Smells + Quick Fix previews | ✅ | ✅ | ✅ | ✅ |
| Test Gap Finder | ✅ | ✅ | ✅ | ✅ |
| Coach Mode | ✅ | ✅ | ✅ | ✅ |
| BYOK AI (all providers) | ✅ | ✅ | ✅ | ✅ |
| AI Summary in Deep Dive | ⚠️ (optional) | ✅ | ✅ | ✅ |
| Why Does This Work (AI) | ⚠️ (optional) | ✅ | ✅ | ✅ |
| Prompt optimizer presets | 🔒 | ✅ | ✅ | ✅ |
| Per‑feature AI quality tuning | 🔒 | ✅ | ✅ | ✅ |
| Shared pins/notes/rule packs | 🔒 | 🔒 | ✅ | ✅ |
| Central policy manager | 🔒 | 🔒 | ✅ | ✅ |
| Audit log export to SIEM | 🔒 | 🔒 | ✅ | ✅ |
| SSO/SAML + SCIM | 🔒 | 🔒 | 🔒 | ✅ |
| On‑prem LLM gateway | 🔒 | 🔒 | 🔒 | ✅ |
| SLA + dedicated support | 🔒 | 🔒 | 🔒 | ✅ |

**Notes**
- AI features can remain free with BYOK, but Pro unlocks “advanced AI modes” (Why‑Works, Deep Dive Summary, presets).
- Team tier is where monetization becomes real: compliance + collaboration.

---

## Pricing Page Copy (ready to use)

### Hero
**Headline:** Understand any code. Fix any bug. Ship with confidence.  
**Subhead:** Code Coach is the explainability layer for AI‑generated and inherited codebases.  
**CTA:** “Install Free” | “Start Team Trial”

### Section: Why Code Coach
- **Cited explanations:** Every insight links back to file:line.  
- **Root‑cause tracing:** Call chains and stack‑trace parsing.  
- **Privacy‑first:** Offline, local, redacted, or full‑context AI.

### Section: Built for teams
- **Org policies:** Provider allowlists, redaction, privacy modes.  
- **Shared Deep Dive assets:** Pins, notes, and rule packs.  
- **Audit logs:** SIEM‑friendly event exports.

### Pricing Cards (short copy)
**Free:** Full static analysis + BYOK.  
**Pro:** Advanced AI workflows + presets.  
**Team:** Shared assets + policy control + audit export.  
**Enterprise:** SSO, on‑prem, and SLAs.

---

## License & Entitlement Flow

### Goals
- Minimal friction for Free users.
- Clear upgrade path for Pro/Team/Enterprise.
- Offline grace period for paid plans.

### Flow (high‑level)
1) User signs in (GitHub/Google).  
2) Extension requests a **license token**.  
3) Token stored in **VS Code Secret Storage**.  
4) Entitlement checked on startup + daily refresh.  
5) If token missing/expired: paid features are hidden or degraded gracefully.

### API Endpoints (example)

**POST** `/api/license/issue`  
Request:
```json
{
  "userId": "u_123",
  "deviceId": "dev_abc",
  "plan": "team",
  "seats": 10
}
```
Response:
```json
{
  "token": "jwt...",
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

**POST** `/api/license/refresh`  
Request:
```json
{ "token": "jwt..." }
```
Response:
```json
{ "token": "jwt...", "expiresAt": "2026-01-01T00:00:00Z" }
```

### Token (JWT) claims
- `sub` (user id)
- `org` (org id, optional)
- `plan` (free/pro/team/enterprise)
- `features` (list of enabled capabilities)
- `exp` (expiration)
- `device` (device id)

### Client‑side enforcement
- On activation, read token from Secret Storage.
  - If missing: Free tier.
  - If expired: enter grace mode (7 days).
- Feature checks should be **local** and **fast**.

---

## Entitlement Mapping (feature flags)

| Flag | Unlocks |
|------|---------|
| `ai_advanced` | Why‑Works, AI Summary, prompt presets |
| `team_policies` | org‑wide privacy/allowlist/redaction |
| `shared_assets` | shared pins/notes/rule packs |
| `audit_export` | SIEM‑ready log export |
| `sso` | SAML/SCIM |
| `on_prem` | private LLM gateway |

---

## Rollout Plan (90 days)

**Weeks 1‑4:** OSS launch + BYOK + onboarding.  
**Weeks 5‑8:** Team plan with policies + shared assets.  
**Weeks 9‑12:** Enterprise pilots (SSO/on‑prem).

---

## Success Metrics

- Free → Team conversion: 2–4% within 90 days.
- Team retention: > 80% at 3 months.
- Pro to Team upgrade: 20% of Pro accounts.
