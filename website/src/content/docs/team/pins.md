---
title: Team Pinned Symbols
description: Mark and annotate important code for your team
---

**Team Pinned Symbols** lets you mark critical code with annotations that the whole team sees.

## How to Use

### Pin a Symbol

1. **Right-click** on any function, class, or variable
2. Select **Pin for Team**
3. Enter annotation: "Why is this important?"
4. Optionally add tags: `critical`, `security`, `architecture`

### View Team Pins

1. Open **Code Coach** sidebar
2. Expand **Team Pins** section
3. Click any pin to navigate to that code

## What Team Sees

In Deep Dive sidebar:

```
▼ Team Pins (3)

  ★ AuthenticationMiddleware
    "Core auth logic - check before modifying"
    src/middleware/auth.ts:23 • @alice 3 days ago
    Tags: critical, security

  ★ DatabaseConnection.initialize()
    "Critical startup path - affects all services"
    src/db/connection.ts:12 • @bob 1 week ago
    Tags: critical

  ★ calculateTax()
    "Complex rounding rules - see JIRA-1234"
    src/utils/tax.ts:45 • @charlie 2 weeks ago
    Tags: finance
```

## Pin Data Storage

Pins are stored in `.code-coach/pins.json`:

```json
{
  "version": 1,
  "pins": [
    {
      "id": "auth-middleware-12345",
      "symbol": "AuthenticationMiddleware",
      "filePath": "src/middleware/auth.ts",
      "line": 23,
      "annotation": "Core auth logic - check before modifying",
      "author": "alice",
      "createdAt": "2025-01-04T10:30:00Z",
      "tags": ["critical", "security"]
    }
  ]
}
```

**Commit this file** to share pins with your team.

## Tags

Use tags to categorize pins:

| Tag | Use For |
|-----|---------|
| `critical` | Must not break |
| `security` | Security-sensitive code |
| `architecture` | Core patterns |
| `performance` | Performance-critical |
| `deprecated` | Being phased out |
| `finance` | Financial calculations |

Filter pins by tag in the sidebar.

## Managing Pins

### Edit Pin

1. Right-click pin in sidebar
2. Select **Edit Annotation**
3. Update text or tags

### Remove Pin

1. Right-click pin in sidebar
2. Select **Unpin**

### View All Pins

```bash
Code Coach: Show Team Pins
```

## Personal vs Team Pins

| Personal Pins | Team Pins |
|---------------|-----------|
| Stored locally | Stored in `.code-coach/pins.json` |
| Only you see | Whole team sees |
| Quick bookmarks | Documented landmarks |

## Use Cases

### Onboarding

Pin key entry points with helpful context:

```
"Start here - main request handler"
"Auth tokens validated in this middleware"
"Database migrations in this folder"
```

### Code Review

Mark areas that need careful review:

```
"Security-critical - needs 2 approvers"
"Performance-sensitive - benchmark changes"
```

### Documentation

Link to external resources:

```
"Complex algorithm - see RFC-9234"
"Business rules documented in Confluence"
```

## Related Features

- [Deep Dive](/features/deep-dive/) - View pins in context
- [Onboarding Tours](/team/tours/) - Guided walkthroughs
- [Knowledge Graph](/team/graph/) - Visualize pinned code
