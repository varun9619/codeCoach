# Code Coach (VS Code Extension)

A minimal static-only MVP that helps you understand code and diagnostics.

## MVP features

- **Explain Selection**: highlight code and get a line-by-line plain-English walkthrough.
- **Explain Diagnostic**: hover on a VS Code diagnostic to see a plain-English explanation + likely causes + fixes.

## AI (optional)

This extension can store an API key securely (VS Code Secret Storage). It does not force any specific model/provider.

- Command Palette → **Code Coach: Set AI API Key**
- Command Palette → **Code Coach: Clear AI API Key**

Settings:

- `codeCoach.ai.enabled` (default: false)
- `codeCoach.ai.baseUrl` (your endpoint base URL)
- `codeCoach.ai.endpointPath` (default: /chat/completions)
- `codeCoach.ai.model` (model/deployment id required by your endpoint)
- `codeCoach.ai.authHeader` (default: Authorization)
- `codeCoach.ai.authScheme` (default: Bearer)

Example (Siemens docs style):

- `codeCoach.ai.baseUrl`: `https://api.siemens.com/llm/v1`
- `codeCoach.ai.endpointPath`: `/chat/completions` (confirm in your docs)
- `codeCoach.ai.model`: your chosen model/deployment name

## Usage

- Select code → Command Palette → **Code Coach: Explain Selection**
- Hover over an error underline → see the **Code Coach** hover
- Command Palette → **Code Coach: Explain Diagnostic** (uses the diagnostic under your cursor, else the first in the file)

## Development

```bash
npm install
npm run compile
```

Run the extension:

- Press `F5` in VS Code (uses the extension host launch config).

## Notes

This MVP is static-only: it does not run your code or capture runtime values.
