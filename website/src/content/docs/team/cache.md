---
title: Shared Explanation Cache
description: Cache and share AI explanations across your team
---

**Shared Explanation Cache** saves AI explanations so your team doesn't regenerate the same insights.

## How It Works

1. You explain code → AI generates explanation
2. Explanation cached with metadata
3. Teammate explains same code → instant cache hit
4. Shows "Cached by @alice 2 days ago"

## Benefits

### Cost Savings

- Avoid redundant API calls
- One explanation serves entire team
- Significant savings on large teams

### Speed

- Cached explanations are instant
- No waiting for AI response
- Better developer experience

### Consistency

- Same code gets same explanation
- Reduces confusion from varying AI outputs
- Builds shared understanding

## Cache Storage

Stored in `.code-coach/cache/explanations.json`:

```json
{
  "version": 1,
  "entries": [
    {
      "key": "a1b2c3:10-25:junior-dev:redacted",
      "filePath": "src/auth/validate.ts",
      "explanation": "This function validates user input...",
      "createdBy": "alice",
      "createdAt": "2025-01-05T10:00:00Z",
      "expiresAt": "2025-01-12T10:00:00Z",
      "hitCount": 5
    }
  ]
}
```

### Cache Key Format

```
{fileHash}:{startLine}-{endLine}:{templateId}:{privacyMode}
```

Different templates and privacy modes get separate cache entries.

## Configuration

### Enable Caching

```json
{
  "codeCoach.cache.enabled": true
}
```

### Share with Team

```json
{
  "codeCoach.cache.shareWithTeam": true
}
```

When enabled, commit `.code-coach/cache/` to git.

### TTL (Time to Live)

```json
{
  "codeCoach.cache.ttlDays": 7
}
```

Explanations expire after this many days.

### Max Entries

```json
{
  "codeCoach.cache.maxEntries": 500
}
```

Oldest entries evicted when limit reached.

## Cache Indicators

When viewing a cached explanation:

```
EXPLANATION (cached)
Cached by @alice • 2 days ago • 5 hits

This function validates user input...
```

## Commands

| Command | Description |
|---------|-------------|
| `Show Cache Statistics` | View cache size, hit rate |
| `Clear Explanation Cache` | Remove all cached entries |

### Cache Statistics

```
CACHE STATISTICS

Total entries: 234
Cache size: 1.2 MB
Hit rate: 67% (last 7 days)
Top cached files:
  • src/auth/validate.ts (12 entries)
  • src/db/connection.ts (8 entries)
  • src/utils/helpers.ts (6 entries)
```

## Cache Invalidation

Cache entries are invalidated when:

1. **File content changes** - Hash mismatch
2. **TTL expires** - Entry too old
3. **Manual clear** - User clears cache
4. **Limit reached** - Oldest entries evicted

## Best Practices

### Do Cache

- Stable utility functions
- Well-documented APIs
- Shared libraries

### Don't Cache

- Frequently changing code
- Personal/experimental code
- Sensitive business logic

### Git Strategy

For team sharing:

```bash
# Include cache in commits
git add .code-coach/cache/

# Or keep local only (add to .gitignore)
echo ".code-coach/cache/" >> .gitignore
```

## Related Features

- [Explanation Templates](/team/templates/) - Cache per template
- [Privacy Modes](/config/privacy/) - Cache per privacy mode
- [AI Providers](/config/ai-providers/) - Configure AI for caching
