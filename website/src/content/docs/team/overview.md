---
title: Team Intelligence Overview
description: Share code understanding across your team
---

**Team Intelligence** transforms Code Coach from an individual tool into a team collaboration platform.

## The Problem

Teams struggle with shared code understanding:

- New hires take weeks to become productive
- Knowledge lives in people's heads, not systems
- Critical code changes without proper review
- AI-generated code enters codebase without documentation

## The Solution

Team Intelligence provides:

| Feature | Benefit |
|---------|---------|
| [Explanation Templates](/team/templates/) | Tailor explanations for different audiences |
| [Team Pinned Symbols](/team/pins/) | Mark and annotate important code |
| [Explain Diff](/team/explain-diff/) | Understand what changed in PRs |
| [Onboarding Tours](/team/tours/) | Guided codebase walkthroughs |
| [Change Subscriptions](/team/subscriptions/) | Get notified when critical code changes |
| [Shared Cache](/team/cache/) | Reuse AI explanations across team |
| [Knowledge Graph](/team/graph/) | Visualize codebase structure |

## How It Works

### Team-Shareable Files

Code Coach stores team data in `.code-coach/`:

```
.code-coach/
├── config.json           # Team settings
├── pins.json             # Team-pinned symbols
├── templates/            # Custom explanation templates
├── tours/                # Onboarding tour definitions
└── cache/
    └── explanations.json # Shared AI explanations
```

**Add to git** and your team shares configuration.

### Personal Files (gitignored)

Some data stays personal:

```
.code-coach/
├── subscriptions.json    # Personal file subscriptions
└── tour-progress.json    # Personal tour progress
```

## Quick Start

### 1. Initialize Team Config

```bash
# Creates .code-coach/config.json
Code Coach: Create Config
```

### 2. Pin Important Code

Right-click critical functions → **Pin for Team**

### 3. Create an Onboarding Tour

```bash
Code Coach: Create Tour
```

### 4. Share with Team

```bash
git add .code-coach/
git commit -m "Add Code Coach team configuration"
git push
```

## Pricing

Team Intelligence features require the Team plan:

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | Core features only |
| Pro | $9/mo | Unlimited AI + priority |
| **Team** | $19/user/mo | All Team Intelligence |

## Next Steps

- [Explanation Templates](/team/templates/) - Customize for your audience
- [Team Pins](/team/pins/) - Mark important code
- [Onboarding Tours](/team/tours/) - Guide new team members
