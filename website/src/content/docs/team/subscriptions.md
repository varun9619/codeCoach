---
title: Change Subscriptions
description: Get notified when critical code changes
---

**Change Subscriptions** alert you when files or symbols you care about are modified by teammates.

## How It Works

1. Subscribe to files or symbols
2. When a teammate modifies them
3. You get notified on `git pull`

## Subscribing

### Subscribe to a File

1. Right-click file in Explorer
2. Select **Subscribe to Changes**
3. Enter reason: "I own this module"

### Subscribe to a Symbol

1. Right-click function/class
2. Select **Subscribe to Changes**
3. Enter reason: "Critical startup path"

### Subscribe via Pattern

For multiple files:

```bash
Code Coach: Subscribe to File Changes
```

Enter glob pattern: `src/auth/**/*.ts`

## Subscription Data

Stored in `.code-coach/subscriptions.json` (gitignored):

```json
{
  "version": 1,
  "subscriptions": [
    {
      "id": "sub-12345",
      "type": "file",
      "pattern": "src/auth/**/*.ts",
      "reason": "I own the auth module",
      "notify": "always"
    },
    {
      "id": "sub-67890",
      "type": "symbol",
      "symbol": "DatabaseConnection.initialize",
      "filePath": "src/db/connection.ts",
      "reason": "Critical startup path",
      "notify": "onMajorChange"
    }
  ]
}
```

## Notification Types

| Type | When Notified |
|------|---------------|
| `always` | Any change to subscribed item |
| `onMajorChange` | Significant changes (not just formatting) |
| `onBreaking` | Breaking changes detected |

## Notifications

When you `git pull` with subscribed changes:

```
🔔 Code Coach: 3 subscribed files changed

Changes detected in:
• src/auth/validate.ts (modified)
  You subscribed because: "I own the auth module"

• src/db/connection.ts (modified)
  You subscribed because: "Critical startup path"

• src/auth/types.ts (deleted!)
  You subscribed because: "Auth type definitions"

[View Changes] [Dismiss]
```

Click **View Changes** to see diff explanation.

## Managing Subscriptions

### View All

```bash
Code Coach: Manage Subscriptions
```

Shows list with options to edit or delete.

### Check for Changes

Manually check (instead of waiting for pull):

```bash
Code Coach: Check Subscribed Changes
```

## Configuration

### Enable/Disable

```json
{
  "codeCoach.subscriptions.enabled": true
}
```

### Check on Pull

```json
{
  "codeCoach.subscriptions.checkOnPull": true
}
```

### Notification Style

```json
{
  "codeCoach.subscriptions.notificationStyle": "modal" // or "toast"
}
```

## Use Cases

### Module Ownership

Subscribe to modules you maintain:

```
Pattern: src/payments/**/*.ts
Reason: "Payment module owner - need to review all changes"
```

### Critical Paths

Subscribe to must-not-break code:

```
Symbol: OrderProcessor.processPayment
Reason: "Revenue-critical - any changes need my review"
```

### Learning

Subscribe to code you want to understand better:

```
Pattern: src/core/**/*.ts
Reason: "Learning the core architecture"
```

## Related Features

- [Explain Diff](/team/explain-diff/) - Understand what changed
- [Team Pins](/team/pins/) - Mark critical code
- [Deep Dive](/features/deep-dive/) - View file history
