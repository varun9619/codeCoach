---
title: Onboarding Tours
description: Create guided codebase walkthroughs for new team members
---

**Onboarding Tours** are step-by-step codebase walkthroughs that help new team members understand your code.

## How It Works

### For Tour Creators

1. Create a tour with multiple "stops"
2. Each stop navigates to a file/line with explanation
3. Save tour as JSON in `.code-coach/tours/`
4. Commit and push for team

### For Tour Takers

1. Open **Code Coach** sidebar
2. Find tour in **Onboarding Tours** section
3. Click **Start**
4. Navigate through stops with Next/Previous

## Creating a Tour

### Quick Create

1. Navigate to your first code location
2. **Command Palette** → "Create Tour"
3. Enter tour name and description
4. Add stops as you navigate

### Add Stops

At each important location:

1. **Command Palette** → "Add Tour Stop"
2. Enter stop title
3. Write explanation
4. Optionally highlight line ranges

### Tour File Format

`.code-coach/tours/auth-overview.json`:

```json
{
  "version": 1,
  "id": "auth-overview",
  "title": "Authentication System Overview",
  "description": "Learn how our auth flow works",
  "author": "alice",
  "estimatedMinutes": 15,
  "stops": [
    {
      "id": "stop-1",
      "title": "Entry Point: Login Controller",
      "filePath": "src/controllers/auth.ts",
      "line": 23,
      "content": "This is where authentication requests enter the system. The controller validates the request body and delegates to the auth service.",
      "highlights": [
        { "start": 25, "end": 30, "note": "Request validation" }
      ]
    },
    {
      "id": "stop-2",
      "title": "Auth Service: Credential Check",
      "filePath": "src/services/auth.ts",
      "line": 45,
      "content": "The service queries the database and verifies password hashes. Never logs or stores plain passwords.",
      "highlights": [
        { "start": 48, "end": 52, "note": "bcrypt comparison" }
      ]
    }
  ]
}
```

## Tour Walkthrough UI

When running a tour:

```
┌─────────────────────────────────────────────────────────┐
│ Authentication Tour                        Step 2/7     │
├─────────────────────────────────────────────────────────┤
│ 📍 AuthService.validateCredentials()                    │
│    src/services/auth.ts:45                              │
│                                                         │
│ This method validates user credentials against the      │
│ database. It uses bcrypt for secure password comparison.│
│                                                         │
│ Key points:                                             │
│ • Never logs passwords (L48)                            │
│ • Constant-time comparison prevents timing attacks (L52)│
│ • Rate limiting applied at controller level             │
│                                                         │
│ Progress: ██████░░░░░░░░░░░░░░ 2 of 7                   │
│                                                         │
│ [← Previous] [Jump to Code] [Next →]                    │
└─────────────────────────────────────────────────────────┘
```

## Sidebar Integration

Tours appear in the Code Coach sidebar:

```
▼ Onboarding Tours (3)

  📚 Authentication Overview
    "Learn how auth works" • 15 min • 2/7 complete
    [Resume]

  📚 Database Architecture
    "Understanding our data layer" • 20 min • Not started
    [Start]

  📚 API Patterns
    "REST conventions used in this project" • 10 min • Complete ✓
```

## Progress Tracking

Tour progress is saved locally in `.code-coach/tour-progress.json`:

```json
{
  "auth-overview": {
    "currentStop": 2,
    "completedAt": null,
    "startedAt": "2025-01-05T10:00:00Z"
  },
  "api-patterns": {
    "currentStop": 5,
    "completedAt": "2025-01-04T15:30:00Z",
    "startedAt": "2025-01-04T14:00:00Z"
  }
}
```

This file is gitignored (personal progress).

## Best Practices

### Tour Structure

1. **Start at entry points** - Where requests come in
2. **Follow the flow** - Data through the system
3. **End at outputs** - Responses, database, etc.

### Stop Content

- Keep explanations concise (2-3 paragraphs max)
- Use bullet points for key observations
- Link to external docs when helpful
- Include "why" not just "what"

### Tour Maintenance

- Update tours when code changes
- Review tours quarterly
- Get feedback from new hires

## Commands

| Command | Description |
|---------|-------------|
| `Create Tour` | Start new tour |
| `Add Tour Stop` | Add stop at current location |
| `Start Tour` | Begin a tour |
| `Resume Tour` | Continue from last stop |
| `End Tour` | Stop current tour |

## Related Features

- [Team Pins](/team/pins/) - Mark stops as team pins too
- [Explain Selection](/features/explain-selection/) - Detailed explanations
- [Knowledge Graph](/team/graph/) - Visual orientation
