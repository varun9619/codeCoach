# Code Coach

**The missing manual for code you didn't write.**

Code Coach is a VS Code extension that explains code, traces errors, and helps teams onboard faster. It works with static analysis by default and optionally enhances explanations with AI (BYOK: bring your own key).

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Features](#core-features)
   - [Explain Selection](#explain-selection)
   - [Explain Why This Works](#explain-why-this-works)
   - [Explain Diagnostic](#explain-diagnostic)
   - [Trace Diagnostic Origin](#trace-diagnostic-origin)
   - [Trace Stack Trace](#trace-stack-trace)
   - [Deep Dive](#deep-dive)
   - [Code Smells](#code-smells)
   - [Test Gap Finder](#test-gap-finder)
   - [Coach Mode](#coach-mode)
3. [Team Intelligence (Phase 2)](#team-intelligence-phase-2)
   - [Explanation Templates](#explanation-templates)
   - [Team Pinned Symbols](#team-pinned-symbols)
   - [Explain Diff](#explain-diff)
   - [Onboarding Tours](#onboarding-tours)
   - [Code Change Subscriptions](#code-change-subscriptions)
   - [Shared Explanation Cache](#shared-explanation-cache)
   - [Knowledge Graph](#knowledge-graph)
4. [Enterprise Features (Phase 4)](#enterprise-features-phase-4)
   - [SSO Integration](#sso-integration)
   - [Custom Model Endpoints](#custom-model-endpoints)
5. [AI Configuration](#ai-configuration)
6. [Privacy Modes](#privacy-modes)
7. [Settings Reference](#settings-reference)
8. [Troubleshooting](#troubleshooting)
9. [Development](#development)

---

## Quick Start

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/varun9619/codeCoach.git
   cd codeCoach/extension
   npm install
   npm run compile
   ```

2. Press `F5` in VS Code to launch the Extension Host.

### First Commands to Try

| Command | Shortcut | What It Does |
|---------|----------|--------------|
| `Code Coach: Explain Selection` | Select code → `Cmd+Shift+P` | Get line-by-line explanation |
| `Code Coach: Deep Dive` | Place cursor on symbol → `Cmd+Shift+P` | See usages, history, tests |
| `Code Coach: Show Knowledge Graph` | `Cmd+Shift+P` | Visualize codebase structure |

---

## Core Features

### Explain Selection

**What it does:** Provides a plain-English, line-by-line explanation of selected code with citations.

**How to use:**
1. Select any code block in your editor
2. Right-click → **Code Coach: Explain Selection** (or use Command Palette)
3. Choose an explanation template (if prompted):
   - **Junior Developer**: Basics-focused, beginner-friendly
   - **Security Review**: Focuses on vulnerabilities and risks
   - **Performance Analysis**: Identifies bottlenecks and optimizations
   - **Legacy Code Archaeology**: Historical context and patterns
   - **Code Review**: PR-ready summary

**Example output:**
```
## Summary
Transforms raw API response into normalized user objects, handling pagination.

## Line-by-Line
L12: Extracts `data` array from response
L14: Creates Map for O(1) dedup lookup
L16-22: Iterates and normalizes each user object
L24: Handles next page cursor if present

## Related
• Used by: src/api/users.ts:fetchAllUsers (L45)
• Calls: src/utils/normalize.ts:normalizeUser
```

---

### Explain Why This Works

**What it does:** Analyzes code to explain not just *what* it does, but *why* it works—including assumptions, edge cases, and potential breakpoints.

**How to use:**
1. Select code that "just works" but you're not sure why
2. Command Palette → **Code Coach: Explain Why This Works**

**Example output:**
```
## Why It Works
The regex pattern relies on the `g` flag to match all occurrences.

## Assumptions
• Input is always a string (no null check)
• Unicode characters are not expected

## Edge Cases Handled
• Empty string returns empty array
• Multiple consecutive delimiters are handled

## What Could Break This
• Null/undefined input would throw
• Very long strings may hit regex backtracking limits
```

---

### Explain Diagnostic

**What it does:** Translates TypeScript/ESLint error codes into plain English with causes and fixes.

**How to use:**
1. Hover over any red/yellow squiggle in your code
2. See the enhanced Code Coach tooltip with:
   - Plain-English explanation
   - Likely causes
   - Suggested fixes
   - Quick-fix actions

**Supported diagnostic codes:**
- TypeScript: 2304, 2339, 2322, 2345, 2551, 7006, and 50+ more
- ESLint: Common rules with explanations

**Quick fixes available:**
- Add optional chaining (`?.`)
- Add non-null assertion (`!`)
- Add explicit type annotation
- Disable ESLint rule (with comment)

---

### Trace Diagnostic Origin

**What it does:** Traces an error back through the call chain to find the root cause.

**How to use:**
1. Place cursor on a line with an error
2. Command Palette → **Code Coach: Trace Diagnostic Origin**
3. View the call graph showing:
   - Error location
   - Intermediate callers
   - Root cause (highlighted)

**Example output:**
```
UserCard.tsx:23 ← user prop
     ↑
UserList.tsx:45 ← users[index]
     ↑
useFetchUsers.ts:12 ← API response.data
     ↑ [ROOT CAUSE]
API returned empty array when user not found
```

---

### Trace Stack Trace

**What it does:** Paste a stack trace and get a linked, navigable call chain.

**How to use:**
1. Copy a stack trace from console/logs
2. Command Palette → **Code Coach: Trace Stack Trace**
3. Paste the stack trace when prompted
4. Click any line to jump to that location

---

### Deep Dive

**What it does:** Opens a comprehensive sidebar showing everything about a symbol.

**How to use:**
1. Place cursor on any function, class, or variable
2. Right-click → **Code Coach: Deep Dive** (or Command Palette)
3. Explore the sidebar sections:

| Section | What It Shows |
|---------|---------------|
| **Overview** | Signature, JSDoc, type info |
| **Usages** | All references across the codebase |
| **Blame** | Git blame for each line |
| **History** | Recent commits affecting this symbol |
| **Tests** | Test files that cover this symbol |
| **Coverage** | Branch coverage from lcov/istanbul |
| **AI Summary** | Natural language summary (if AI enabled) |

**Additional actions:**
- **Pin Symbol**: Keep important symbols accessible
- **Export Report**: Generate markdown documentation
- **Filter Sections**: Show only what you need

---

### Code Smells

**What it does:** Detects common code quality issues with severity ratings and fixes.

**How to use:**
1. Command Palette → **Code Coach: Show Code Smells**
2. Or see the CodeLens indicator above functions: `⚠️ 2 potential issues`
3. Click to expand and see:
   - Issue type and severity
   - Explanation
   - Suggested fix
   - Preview diff before applying

**Detected smells:**
| Smell | Severity | Description |
|-------|----------|-------------|
| Nested loops | Medium | O(n²) complexity warning |
| Deep nesting | Low | >4 levels of nesting |
| Long function | Low | >50 lines |
| Many parameters | Low | >5 parameters |
| Dead code | Low | Unreachable code detected |
| Callback hell | Medium | Deeply nested callbacks |
| SQL injection risk | High | Unsanitized user input in queries |
| Hardcoded secrets | High | API keys/passwords in code |

---

### Test Gap Finder

**What it does:** Analyzes code coverage to find untested branches and suggest test cases.

**Prerequisites:**
- Coverage file: `lcov.info` or `coverage-final.json`
- Run your test suite with coverage enabled first

**How to use:**
1. Command Palette → **Code Coach: Show Test Gaps**
2. Or see CodeLens: `Tests: 3 passing, 2 branches uncovered`
3. Click to see:
   - Uncovered branches with line numbers
   - Condition that needs testing
   - Sample input to trigger the branch
   - "Generate Test" action

---

### Coach Mode

**What it does:** Adds subtle inline annotations throughout your code, like a smart comment layer.

**How to use:**
1. Settings → `codeCoach.coachMode.enabled: true`
2. See ghost text after complex lines:
   ```typescript
   const result = data.map(x => x * 2);  // ← transforms each element, returns new array
   ```

**Configuration:**
- `codeCoach.coachMode.maxHints`: Maximum hints per file (default: 50)

---

## Team Intelligence (Phase 2)

### Explanation Templates

**What it does:** Choose from pre-configured explanation styles tailored to different audiences.

**Available templates:**
| Template | Best For |
|----------|----------|
| Junior Developer | New team members, learning |
| Security Review | Audit, compliance |
| Performance Analysis | Optimization work |
| Legacy Code Archaeology | Maintenance of old code |
| Code Review | PR reviews |
| Architecture Overview | System design |

**How to use:**
1. Select code → **Code Coach: Explain Selection**
2. Pick a template from the dropdown
3. Or set a default: Settings → `codeCoach.templates.default`

**Create custom templates:**
1. Create a `.md` file in `.code-coach/templates/`
2. Add YAML frontmatter:
   ```yaml
   ---
   id: my-template
   name: My Custom Template
   description: For specific use case
   audience: Team leads
   systemPrompt: Focus on architectural patterns and design decisions
   ---
   ```

---

### Team Pinned Symbols

**What it does:** Mark important symbols for team visibility—perfect for onboarding.

**How to use:**
1. Right-click on any symbol → **Pin for Team**
2. Add tags: `auth`, `critical`, `legacy`, `api`, `security`, etc.
3. Add a note explaining why it's important
4. View all pins: Command Palette → **Code Coach: Show Team Pins**

**Storage:** Pins are saved in `.code-coach/pins.json` (commit to share with team)

---

### Explain Diff

**What it does:** Explains git changes in plain English—great for PR reviews.

**How to use:**
1. Command Palette → **Code Coach: Explain Diff**
2. Choose the diff source:
   - **Working Tree**: Uncommitted changes
   - **Staged Changes**: Changes ready to commit
   - **Last Commit**: Most recent commit
   - **Commit Range**: Compare two commits

**Example output:**
```
## Summary
Added user authentication with JWT tokens

## Changes
• src/auth.ts: New file - JWT validation middleware
• src/routes.ts: Added /login and /logout endpoints
• package.json: Added jsonwebtoken dependency

## Impact
• All protected routes now require Authorization header
• Breaking change: Old session-based auth removed
```

---

### Onboarding Tours

**What it does:** Create interactive, guided tours through your codebase.

**How to create a tour:**
1. Command Palette → **Code Coach: Create Tour**
2. Enter tour name and description
3. Add stops:
   - Navigate to a file/line
   - Command Palette → **Code Coach: Add Tour Stop**
   - Enter explanation for this stop
4. Save the tour

**How to run a tour:**
1. Command Palette → **Code Coach: Start Tour**
2. Select a tour from the list
3. Use Next/Previous to navigate
4. Click "Go to Code" to jump to each location

**Storage:** Tours are saved in `.code-coach/tours/` (commit to share)

---

### Code Change Subscriptions

**What it does:** Get notified when specific files or symbols change.

**How to use:**
1. Command Palette → **Code Coach: Subscribe to File Changes**
2. Choose subscription type:
   - **File Pattern**: `src/auth/**/*.ts`
   - **Symbol**: Specific function or class
   - **Directory**: All files in a folder
3. Set notification level:
   - **Always**: Every change
   - **On Major Change**: Signature/export changes
   - **On Breaking Change**: Potential breaking changes only

**View subscriptions:**
- Command Palette → **Code Coach: Manage Subscriptions**

---

### Shared Explanation Cache

**What it does:** Caches AI explanations so team members don't wait (or pay) for the same explanation twice.

**How it works:**
1. When you explain code, the result is cached
2. Cache key includes: file path, line range, template, and source hash
3. When a teammate explains the same code, they get the cached result instantly
4. Cache invalidates when code changes (source hash changes)

**Storage:** `.code-coach/cache/explanations.json`

**Management:**
- Command Palette → **Code Coach: Show Cache Statistics**
- Command Palette → **Code Coach: Clear Explanation Cache**

---

### Knowledge Graph

**What it does:** Visualizes your codebase as an interactive dependency graph.

**How to use:**
1. Command Palette → **Code Coach: Show Knowledge Graph**
2. Explore the visualization:
   - **Nodes**: Files, directories, modules
   - **Edges**: Import/export relationships
   - **Colors**: Node types (file, directory, class, function)
   - **Size**: Importance (based on connections)

**Interactions:**
- **Click node**: Open file in editor
- **Double-click**: Deep Dive on that symbol
- **Drag**: Rearrange the graph
- **Scroll**: Zoom in/out
- **Search**: Find nodes by name

**Focus mode:**
- Command Palette → **Code Coach: Focus Knowledge Graph on Current File**
- Shows only nodes connected to the current file

---

## Enterprise Features (Phase 4)

### SSO Integration

**What it does:** Authenticate with your company's identity provider.

**Supported providers:**
- Microsoft Entra ID (Azure AD)
- Okta
- Auth0
- Google Workspace
- Custom OIDC

**How to use:**
1. Command Palette → **Code Coach: Enterprise SSO Login**
2. Select your identity provider
3. Enter configuration:
   - **Client ID**: From your IdP's app registration
   - **Tenant/Domain**: Your organization's tenant
4. Complete authentication in browser
5. Return to VS Code—you're signed in!

**Check status:**
- Command Palette → **Code Coach: Enterprise SSO Status**

**Sign out:**
- Command Palette → **Code Coach: Enterprise SSO Logout**

---

### Custom Model Endpoints

**What it does:** Connect to self-hosted or enterprise AI deployments.

**Supported endpoints:**
| Type | Description |
|------|-------------|
| Azure OpenAI | Azure-hosted OpenAI models |
| AWS Bedrock | Amazon Bedrock with Claude/Titan |
| Google Vertex AI | GCP-hosted models |
| vLLM | Self-hosted vLLM server |
| Text Generation Inference | Hugging Face TGI |
| Ollama | Local Ollama server |
| OpenAI-Compatible | Any OpenAI-compatible API |
| Anthropic-Compatible | Any Anthropic-compatible API |

**How to add an endpoint:**
1. Command Palette → **Code Coach: Add Custom Model Endpoint**
2. Select endpoint type
3. Enter configuration:
   - **Name**: Display name
   - **Base URL**: API endpoint
   - **Model**: Model/deployment name
   - **API Key**: (stored securely)
4. Test the connection

**Manage endpoints:**
- Command Palette → **Code Coach: Manage Custom Endpoints**
- Actions: Test, Set Default, Remove

**Use SSO for authentication:**
- When adding an endpoint, select "SSO Token" as auth method
- Your SSO session token is passed to the endpoint

---

## AI Configuration

### Setting Up AI

1. **Enable AI:**
   ```json
   "codeCoach.ai.enabled": true
   ```

2. **Set your API key:**
   - Command Palette → **Code Coach: Set AI API Key**
   - Enter your key (stored in VS Code Secret Storage)

3. **Choose a provider:**
   ```json
   "codeCoach.ai.provider": "openrouter"  // or openai, anthropic, gemini, ollama, lmstudio
   ```

### Provider Defaults

| Provider | Default Model | Requires Key |
|----------|---------------|--------------|
| OpenRouter | claude-3.5-sonnet | Yes |
| OpenAI | gpt-4o-mini | Yes |
| Anthropic | claude-3-5-sonnet | Yes |
| Gemini | gemini-1.5-pro | Yes |
| Ollama | llama3.1 | No (local) |
| LM Studio | local-model | No (local) |

### Advanced Settings

```json
{
  "codeCoach.ai.temperature": 0.2,        // Lower = more deterministic
  "codeCoach.ai.maxTokens": 800,          // Response length limit
  "codeCoach.ai.promptOptimizer": true,   // Structure prompts automatically
  "codeCoach.ai.strictJson": false        // Require JSON responses
}
```

---

## Privacy Modes

Code Coach supports four privacy levels:

| Mode | Description | AI Calls | Code Sent |
|------|-------------|----------|-----------|
| `offline` | Static analysis only | No | Never |
| `local` | Only localhost LLMs | Localhost only | Local only |
| `redacted` | Strips sensitive data | Yes | Sanitized |
| `full` | Complete context | Yes | Full code |

**Set privacy mode:**
```json
"codeCoach.privacy.mode": "redacted"
```

**Redaction patterns:**
```json
"codeCoach.privacy.redactPatterns": [
  "API_KEY=.*",
  "SECRET=.*",
  "PASSWORD=.*",
  "Bearer [A-Za-z0-9-_]+"
]
```

---

## Settings Reference

### AI Settings (`codeCoach.ai.*`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | false | Enable AI features |
| `provider` | string | openrouter | AI provider |
| `model` | string | (provider default) | Model name |
| `temperature` | number | 0.2 | Creativity (0-2) |
| `maxTokens` | number | 800 | Max response length |
| `promptOptimizer` | boolean | true | Structure prompts |

### Privacy Settings (`codeCoach.privacy.*`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mode` | string | offline | Privacy level |
| `allowedDomains` | array | [] | Allowed API domains |
| `redactPatterns` | array | [] | Patterns to strip |
| `maxContextChars` | number | 4000 | Max context size |

### UI Settings (`codeCoach.ui.*`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `explainSelection` | string | output | Output surface |
| `explainDiagnostic` | string | output | Output surface |
| `codeSmells` | string | output | Output surface |
| `testGaps` | string | output | Output surface |

Values: `output`, `panel`, or `peek`

### Team Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `templates.default` | string | general | Default template |
| `templates.showPicker` | boolean | true | Show template picker |
| `deepDive.sections` | array | all | Visible sections |
| `deepDive.aiSummary` | boolean | true | Include AI summary |

---

## Troubleshooting

### AI Not Working

1. Check `codeCoach.ai.enabled` is `true`
2. Check `codeCoach.privacy.mode` is not `offline`
3. Verify API key: Command Palette → **Code Coach: Set AI API Key**
4. Check Output panel for errors: View → Output → Code Coach

### Deep Dive Missing Data

- **No blame/history**: Ensure you're in a git repository
- **No coverage**: Run tests with `--coverage` and check for `lcov.info`
- **No tests**: Test detection is heuristic—check file naming

### Knowledge Graph Empty

- Only scans TypeScript/JavaScript files
- Check that `src/` or similar directories exist
- Large repos may take time to build

### Performance Issues

Enable symbol prewarming for large repos:
```json
{
  "codeCoach.performance.prewarmSymbols": true,
  "codeCoach.performance.prewarmFileLimit": 500,
  "codeCoach.performance.prewarmGlob": ["src/**/*.ts"]
}
```

---

## Development

### Building

```bash
cd extension
npm install
npm run compile
npm run watch  # For development
```

### Running

Press `F5` in VS Code to launch the Extension Host.

### Testing

Open a TypeScript file and try:
1. Select code → Explain Selection
2. Hover on an error → See enhanced diagnostic
3. Run Show Knowledge Graph

### Project Structure

```
extension/src/
├── extension.ts          # Entry point
├── AI Layer/             # AI integration
├── Core Analysis/        # Static analysis
├── UI Providers/         # VS Code UI
├── Team Intelligence/    # Phase 2 features
└── Enterprise/           # Phase 4 features
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `PRODUCT_PROPOSAL.md` | Vision and roadmap |
| `docs/IMPLEMENTATION_PLAN.md` | Technical plan |
| `docs/MONETIZATION.md` | Pricing strategy |
| `docs/COMPETITIVE_MOAT.md` | Competitive analysis |
| `docs/CASCADING_CONFIG.md` | Config system docs |

---

## Contributing

PRs welcome! See the development section above to get started.

---

## License

MIT

---

Made with care for developers who inherit code they didn't write.
