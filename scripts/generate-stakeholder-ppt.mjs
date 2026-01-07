import PptxGenJS from 'pptxgenjs';

const pptx = new PptxGenJS();

// Branding colors
const COLORS = {
  primary: '2563EB',      // Blue
  secondary: '1E40AF',    // Dark blue
  accent: '10B981',       // Green
  dark: '1F2937',         // Dark gray
  light: 'F3F4F6',        // Light gray
  white: 'FFFFFF',
  copilot: '6B7280',      // Gray for Copilot
  codeCoach: '2563EB'     // Blue for Code Coach
};

// Slide master
pptx.defineSlideMaster({
  title: 'TITLE_SLIDE',
  background: { color: COLORS.primary },
  objects: [
    { rect: { x: 0, y: 5.0, w: '100%', h: 0.5, fill: { color: COLORS.secondary } } }
  ]
});

pptx.defineSlideMaster({
  title: 'CONTENT_SLIDE',
  background: { color: COLORS.white },
  objects: [
    { rect: { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: COLORS.primary } } },
    { rect: { x: 0, y: 5.2, w: '100%', h: 0.3, fill: { color: COLORS.light } } }
  ]
});

// Helper function for content slides
function addContentSlide(title, content) {
  const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });
  slide.addText(title, {
    x: 0.5, y: 0.15, w: 9, h: 0.5,
    fontSize: 24, bold: true, color: COLORS.white
  });
  return slide;
}

// ===========================================
// SLIDE 1: Title
// ===========================================
let slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });
slide.addText('Code Coach', {
  x: 0.5, y: 1.5, w: 9, h: 1,
  fontSize: 54, bold: true, color: COLORS.white
});
slide.addText('Understanding Code You Didn\'t Write', {
  x: 0.5, y: 2.5, w: 9, h: 0.6,
  fontSize: 28, color: COLORS.white
});
slide.addText('Stakeholder Presentation', {
  x: 0.5, y: 3.3, w: 9, h: 0.5,
  fontSize: 18, color: COLORS.light
});
slide.addText('January 2025', {
  x: 0.5, y: 4.5, w: 9, h: 0.4,
  fontSize: 14, color: COLORS.light
});

// ===========================================
// SLIDE 2: The Problem
// ===========================================
slide = addContentSlide('The Problem We Solve');
slide.addText([
  { text: '58%', options: { fontSize: 72, bold: true, color: COLORS.primary } },
  { text: '\nof developer time is spent', options: { fontSize: 24, color: COLORS.dark } },
  { text: '\nreading and understanding code', options: { fontSize: 24, bold: true, color: COLORS.dark } }
], { x: 0.5, y: 1.2, w: 4.5, h: 2.5, valign: 'middle' });

slide.addText([
  { text: 'Current tools optimize for the 42%\n(code generation)\n\n', options: { fontSize: 18, color: COLORS.dark } },
  { text: 'Code Coach optimizes for the 58%\n(code understanding)', options: { fontSize: 18, bold: true, color: COLORS.primary } }
], { x: 5.2, y: 1.2, w: 4.3, h: 2.5, valign: 'middle' });

slide.addText('Sources: Microsoft Research, GitHub Developer Survey 2024', {
  x: 0.5, y: 4.8, w: 9, h: 0.3, fontSize: 10, color: COLORS.copilot
});

// ===========================================
// SLIDE 3: What is Code Coach
// ===========================================
slide = addContentSlide('What is Code Coach?');
slide.addText('A VS Code extension that explains code you didn\'t write', {
  x: 0.5, y: 1.1, w: 9, h: 0.5,
  fontSize: 20, italic: true, color: COLORS.dark
});

const features = [
  ['Plain-English Explanations', 'Every explanation cites specific line numbers'],
  ['Root-Cause Error Tracing', 'Traces errors back through call chains'],
  ['Privacy-First Architecture', 'Works offline, local LLMs, or redacted cloud'],
  ['Team Configuration', 'Share settings via git, not per-user setup'],
  ['Test Gap Analysis', 'Shows which branches lack test coverage'],
  ['Deep Dive Sidebar', 'One-click access to usages, blame, history, tests']
];

features.forEach((f, i) => {
  const y = 1.7 + (i * 0.55);
  slide.addText('●', { x: 0.5, y, w: 0.3, h: 0.4, fontSize: 16, color: COLORS.accent });
  slide.addText(f[0], { x: 0.8, y, w: 3, h: 0.4, fontSize: 16, bold: true, color: COLORS.dark });
  slide.addText(f[1], { x: 3.8, y, w: 5.7, h: 0.4, fontSize: 14, color: COLORS.copilot });
});

// ===========================================
// SLIDE 4: Copilot vs Code Coach - Overview
// ===========================================
slide = addContentSlide('GitHub Copilot vs Code Coach');
slide.addText('Different Tools for Different Problems', {
  x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, italic: true, color: COLORS.dark
});

// Table header
slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 9, h: 0.5, fill: { color: COLORS.primary } });
slide.addText('Aspect', { x: 0.6, y: 1.65, w: 2.5, h: 0.4, fontSize: 14, bold: true, color: COLORS.white });
slide.addText('GitHub Copilot', { x: 3.2, y: 1.65, w: 3, h: 0.4, fontSize: 14, bold: true, color: COLORS.white });
slide.addText('Code Coach', { x: 6.5, y: 1.65, w: 3, h: 0.4, fontSize: 14, bold: true, color: COLORS.white });

const comparisons = [
  ['Primary Function', 'Code generation', 'Code understanding'],
  ['Target User', 'Writing new code', 'Reading unfamiliar code'],
  ['AI Role', 'Autocomplete + agent', 'Explanation + citation'],
  ['Trust Model', '"Trust the output"', '"Verify with citations"'],
  ['Privacy Default', 'Cloud-first', 'Offline-first'],
  ['Team Config', 'Per-user / Enterprise only', 'Git-tracked, free']
];

comparisons.forEach((row, i) => {
  const y = 2.15 + (i * 0.45);
  const bg = i % 2 === 0 ? COLORS.light : COLORS.white;
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 0.45, fill: { color: bg } });
  slide.addText(row[0], { x: 0.6, y: y + 0.05, w: 2.5, h: 0.35, fontSize: 12, bold: true, color: COLORS.dark });
  slide.addText(row[1], { x: 3.2, y: y + 0.05, w: 3, h: 0.35, fontSize: 12, color: COLORS.copilot });
  slide.addText(row[2], { x: 6.5, y: y + 0.05, w: 3, h: 0.35, fontSize: 12, bold: true, color: COLORS.primary });
});

// ===========================================
// SLIDE 5: Feature - Cited Explanations
// ===========================================
slide = addContentSlide('Key Feature: Cited Explanations');
slide.addText('Every claim links to specific source lines', {
  x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, italic: true, color: COLORS.dark
});

// Code Coach example box
slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 5.5, h: 2.2, fill: { color: COLORS.light }, line: { color: COLORS.primary, width: 2 } });
slide.addText('Code Coach Explanation', { x: 0.7, y: 1.7, w: 5, h: 0.3, fontSize: 12, bold: true, color: COLORS.primary });
slide.addText([
  { text: 'This function validates user input by:\n\n' },
  { text: '1. Checking for empty strings ', options: { bold: true } }, { text: '(line 12-14)\n' },
  { text: '2. Validating email format via regex ', options: { bold: true } }, { text: '(line 16)\n' },
  { text: '3. Throwing ValidationError on failure ', options: { bold: true } }, { text: '(line 18)\n\n' },
  { text: '✓ 3 citations verified against source', options: { color: COLORS.accent, bold: true } }
], { x: 0.7, y: 2.0, w: 5, h: 1.7, fontSize: 11, color: COLORS.dark });

// Copilot comparison
slide.addShape(pptx.shapes.RECTANGLE, { x: 6.2, y: 1.6, w: 3.3, h: 2.2, fill: { color: COLORS.light }, line: { color: COLORS.copilot, width: 1 } });
slide.addText('Copilot', { x: 6.4, y: 1.7, w: 3, h: 0.3, fontSize: 12, bold: true, color: COLORS.copilot });
slide.addText('Generates explanations without line references.\n\nNo way to verify accuracy.\n\nUsers must trust output blindly.', {
  x: 6.4, y: 2.1, w: 2.9, h: 1.5, fontSize: 11, color: COLORS.copilot
});

slide.addText('Why it matters: Verifiable explanations build trust and reduce errors in understanding', {
  x: 0.5, y: 4.0, w: 9, h: 0.4, fontSize: 14, bold: true, color: COLORS.dark
});

// ===========================================
// SLIDE 6: Feature - Root Cause Tracing
// ===========================================
slide = addContentSlide('Key Feature: Root-Cause Error Tracing');
slide.addText('Traces errors back to their true origin', {
  x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, italic: true, color: COLORS.dark
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 9, h: 2.5, fill: { color: '1F2937' } });
slide.addText([
  { text: 'Error: ', options: { color: 'EF4444' } },
  { text: 'Cannot read property \'name\' of undefined\n', options: { color: COLORS.white } },
  { text: '    at formatUser (utils.ts:45)\n', options: { color: COLORS.copilot } },
  { text: '    at processResponse (api.ts:23)\n', options: { color: COLORS.copilot } },
  { text: '    at fetchData (service.ts:12)\n\n', options: { color: COLORS.copilot } },
  { text: '┌─ Code Coach: Trace Diagnostic Origin ─────────────┐\n', options: { color: COLORS.accent } },
  { text: '│ Root Cause: service.ts:8                         │\n', options: { color: COLORS.accent, bold: true } },
  { text: '│                                                   │\n', options: { color: COLORS.accent } },
  { text: '│ The `user` parameter can be undefined when API   │\n', options: { color: COLORS.white } },
  { text: '│ returns empty (api.ts:20), but formatUser()      │\n', options: { color: COLORS.white } },
  { text: '│ doesn\'t handle this case (utils.ts:45).          │\n', options: { color: COLORS.white } },
  { text: '└──────────────────────────────────────────────────┘', options: { color: COLORS.accent } }
], { x: 0.7, y: 1.7, w: 8.6, h: 2.3, fontSize: 10, fontFace: 'Courier New' });

slide.addText([
  { text: 'Copilot: ', options: { bold: true, color: COLORS.copilot } },
  { text: 'Can explain what an error means. Cannot trace why it happened.' }
], { x: 0.5, y: 4.3, w: 9, h: 0.4, fontSize: 14, color: COLORS.dark });

// ===========================================
// SLIDE 7: Enterprise Privacy
// ===========================================
slide = addContentSlide('Enterprise-Grade Privacy');
slide.addText('Four privacy modes for any compliance requirement', {
  x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, italic: true, color: COLORS.dark
});

// Privacy modes table
const privacyModes = [
  ['offline', 'None', 'Static analysis only - zero network', 'Air-gapped environments'],
  ['local', 'localhost', 'Local LLMs (Ollama, LM Studio)', 'Data never leaves machine'],
  ['redacted', 'Cloud', 'Strips comments, strings, secrets', 'Cloud AI with protection'],
  ['full', 'Cloud', 'Full context to trusted provider', 'Maximum AI capability']
];

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 9, h: 0.45, fill: { color: COLORS.primary } });
slide.addText('Mode', { x: 0.6, y: 1.65, w: 1.3, h: 0.35, fontSize: 12, bold: true, color: COLORS.white });
slide.addText('Network', { x: 1.9, y: 1.65, w: 1.3, h: 0.35, fontSize: 12, bold: true, color: COLORS.white });
slide.addText('What It Does', { x: 3.3, y: 1.65, w: 3.2, h: 0.35, fontSize: 12, bold: true, color: COLORS.white });
slide.addText('Use Case', { x: 6.6, y: 1.65, w: 2.8, h: 0.35, fontSize: 12, bold: true, color: COLORS.white });

privacyModes.forEach((row, i) => {
  const y = 2.1 + (i * 0.5);
  const bg = i % 2 === 0 ? COLORS.light : COLORS.white;
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 0.5, fill: { color: bg } });
  slide.addText(row[0], { x: 0.6, y: y + 0.08, w: 1.3, h: 0.35, fontSize: 11, bold: true, color: COLORS.primary, fontFace: 'Courier New' });
  slide.addText(row[1], { x: 1.9, y: y + 0.08, w: 1.3, h: 0.35, fontSize: 11, color: COLORS.dark });
  slide.addText(row[2], { x: 3.3, y: y + 0.08, w: 3.2, h: 0.35, fontSize: 11, color: COLORS.dark });
  slide.addText(row[3], { x: 6.6, y: y + 0.08, w: 2.8, h: 0.35, fontSize: 11, color: COLORS.copilot });
});

slide.addText([
  { text: 'vs Copilot: ', options: { bold: true } },
  { text: 'Requires Enterprise plan ($39/user/month) for data exclusion policies' }
], { x: 0.5, y: 4.3, w: 9, h: 0.4, fontSize: 14, color: COLORS.dark });

// ===========================================
// SLIDE 8: Team Configuration
// ===========================================
slide = addContentSlide('Team-Shareable Configuration');
slide.addText('Settings committed to git, not locked in VS Code', {
  x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, italic: true, color: COLORS.dark
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 5, h: 2.8, fill: { color: '1F2937' } });
slide.addText([
  { text: '// .code-coach/config.json (git-tracked)\n', options: { color: '6B7280' } },
  { text: '{\n' },
  { text: '  "ai": {\n' },
  { text: '    "enabled": ', options: { color: '93C5FD' } }, { text: 'true,\n' },
  { text: '    "provider": ', options: { color: '93C5FD' } }, { text: '"openrouter",\n', options: { color: '86EFAC' } },
  { text: '    "model": ', options: { color: '93C5FD' } }, { text: '"anthropic/claude-3.5-sonnet"\n', options: { color: '86EFAC' } },
  { text: '  },\n' },
  { text: '  "privacy": {\n' },
  { text: '    "mode": ', options: { color: '93C5FD' } }, { text: '"redacted",\n', options: { color: '86EFAC' } },
  { text: '    "redactPatterns": ', options: { color: '93C5FD' } }, { text: '["API_KEY=.*"]\n', options: { color: '86EFAC' } },
  { text: '  }\n' },
  { text: '}' }
], { x: 0.7, y: 1.7, w: 4.6, h: 2.6, fontSize: 10, fontFace: 'Courier New', color: COLORS.white });

slide.addText('Benefits', { x: 5.7, y: 1.6, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: COLORS.dark });
const benefits = [
  'New team members get settings automatically',
  'Consistent AI behavior across team',
  'Privacy policies enforced project-wide',
  'No per-user configuration needed',
  'Settings evolve with codebase'
];
benefits.forEach((b, i) => {
  slide.addText('✓', { x: 5.7, y: 2.1 + (i * 0.45), w: 0.3, h: 0.35, fontSize: 14, color: COLORS.accent });
  slide.addText(b, { x: 6.1, y: 2.1 + (i * 0.45), w: 3.4, h: 0.35, fontSize: 12, color: COLORS.dark });
});

slide.addText('Copilot: Settings are per-user or require Business/Enterprise plan for org policies', {
  x: 0.5, y: 4.6, w: 9, h: 0.3, fontSize: 12, color: COLORS.copilot
});

// ===========================================
// SLIDE 9: Pricing Comparison
// ===========================================
slide = addContentSlide('Pricing: Code Coach vs Copilot');

// Table
const pricingData = [
  ['Feature', 'Copilot Free', 'Copilot Pro', 'Code Coach'],
  ['Price', '$0', '$10/mo', '$0 (BYOK)'],
  ['Code Explanations', '50 chats/mo', 'Unlimited', 'Unlimited'],
  ['Offline Mode', '✗', '✗', '✓'],
  ['Local LLMs', '✗', '✗', '✓'],
  ['Team Config', '✗', '✗', '✓'],
  ['Citation Verification', '✗', '✗', '✓'],
  ['Coverage Analysis', '✗', '✗', '✓'],
  ['Error Tracing', '✗', '✗', '✓']
];

pricingData.forEach((row, i) => {
  const y = 1.2 + (i * 0.42);
  const isHeader = i === 0;
  const bg = isHeader ? COLORS.primary : (i % 2 === 0 ? COLORS.white : COLORS.light);
  const textColor = isHeader ? COLORS.white : COLORS.dark;

  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 0.42, fill: { color: bg } });
  slide.addText(row[0], { x: 0.6, y: y + 0.05, w: 2.8, h: 0.32, fontSize: 11, bold: isHeader || i > 1, color: textColor });
  slide.addText(row[1], { x: 3.5, y: y + 0.05, w: 1.8, h: 0.32, fontSize: 11, bold: isHeader, color: isHeader ? textColor : COLORS.copilot, align: 'center' });
  slide.addText(row[2], { x: 5.4, y: y + 0.05, w: 1.8, h: 0.32, fontSize: 11, bold: isHeader, color: isHeader ? textColor : COLORS.copilot, align: 'center' });

  // Highlight Code Coach column
  const ccColor = row[3].includes('✓') ? COLORS.accent : (isHeader ? textColor : COLORS.primary);
  slide.addText(row[3], { x: 7.3, y: y + 0.05, w: 2.1, h: 0.32, fontSize: 11, bold: true, color: ccColor, align: 'center' });
});

slide.addText('BYOK = Bring Your Own Key. Use your existing OpenRouter, OpenAI, Anthropic, or local LLM.', {
  x: 0.5, y: 4.7, w: 9, h: 0.3, fontSize: 11, color: COLORS.copilot
});

// ===========================================
// SLIDE 10: Target Customers
// ===========================================
slide = addContentSlide('Target Customer Segments');

const segments = [
  { title: 'Privacy-Conscious Teams', pain: 'Can\'t send code to cloud AI', solution: 'Offline mode + local LLMs + redaction' },
  { title: 'Onboarding New Developers', pain: 'Ramping up takes weeks', solution: 'Deep Dive + Explain Selection + AI summaries' },
  { title: 'Debugging Complex Issues', pain: 'Error traces are cryptic', solution: 'Trace Diagnostic Origin + stack parsing' },
  { title: 'Teams with Coverage Requirements', pain: 'Don\'t know what tests missing', solution: 'Test Gap Finder + branch visualization' },
  { title: 'Compliance-Driven Enterprises', pain: 'Need audit trails for AI usage', solution: 'Audit logging + allowed domains' }
];

segments.forEach((seg, i) => {
  const y = 1.1 + (i * 0.75);
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 0.15, h: 0.65, fill: { color: COLORS.primary } });
  slide.addText(seg.title, { x: 0.8, y, w: 3, h: 0.35, fontSize: 13, bold: true, color: COLORS.dark });
  slide.addText('Pain: ' + seg.pain, { x: 3.8, y, w: 2.8, h: 0.35, fontSize: 11, color: COLORS.copilot });
  slide.addText('Solution: ' + seg.solution, { x: 6.7, y, w: 2.8, h: 0.55, fontSize: 11, color: COLORS.primary });
});

// ===========================================
// SLIDE 11: Roadmap
// ===========================================
slide = addContentSlide('Product Roadmap');

const roadmap = [
  { phase: 'Now', title: 'Core Platform', items: ['Cited explanations', 'Privacy modes', 'Team config', 'Test gap analysis', 'Deep Dive sidebar'] },
  { phase: 'Q2 2025', title: 'Team Intelligence', items: ['Explain Diff (PR summaries)', 'Team pinned symbols', 'Onboarding tours', 'Explanation templates'] },
  { phase: 'Q3 2025', title: 'Learning Layer', items: ['Concept extraction', 'Knowledge graph', 'Quiz mode', 'Progress tracking'] },
  { phase: 'Q4 2025', title: 'Enterprise', items: ['Audit logging', 'SSO integration', 'Custom model endpoints', 'Role-based access'] }
];

roadmap.forEach((r, i) => {
  const x = 0.5 + (i * 2.35);
  slide.addShape(pptx.shapes.RECTANGLE, { x, y: 1.1, w: 2.2, h: 0.5, fill: { color: i === 0 ? COLORS.accent : COLORS.primary } });
  slide.addText(r.phase, { x, y: 1.15, w: 2.2, h: 0.4, fontSize: 14, bold: true, color: COLORS.white, align: 'center' });
  slide.addText(r.title, { x, y: 1.65, w: 2.2, h: 0.4, fontSize: 12, bold: true, color: COLORS.dark, align: 'center' });

  r.items.forEach((item, j) => {
    slide.addText('• ' + item, { x: x + 0.1, y: 2.1 + (j * 0.4), w: 2.1, h: 0.35, fontSize: 10, color: COLORS.dark });
  });
});

// ===========================================
// SLIDE 12: Competitive Response
// ===========================================
slide = addContentSlide('Competitive Moat & Response Strategy');

const responses = [
  { trigger: 'If Copilot adds explanations:', response: 'Emphasize citations. "Copilot explains. Code Coach proves it."' },
  { trigger: 'If Copilot adds offline mode:', response: 'Already have it + team config + privacy modes.' },
  { trigger: 'If Copilot adds coverage:', response: 'Deep integration with test frameworks + mutation testing.' },
  { trigger: 'If Copilot adds team config:', response: 'Already shipped + team annotations + onboarding tours.' }
];

responses.forEach((r, i) => {
  const y = 1.2 + (i * 0.85);
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 0.75, fill: { color: i % 2 === 0 ? COLORS.light : COLORS.white } });
  slide.addText(r.trigger, { x: 0.7, y: y + 0.05, w: 4, h: 0.35, fontSize: 12, bold: true, color: COLORS.dark });
  slide.addText(r.response, { x: 0.7, y: y + 0.4, w: 8.5, h: 0.35, fontSize: 12, color: COLORS.primary });
});

slide.addText('Core Insight: Copilot is a generation tool. Code Coach is an understanding tool.\nThey complement each other—for the 58% of time reading code, Code Coach is the better choice.', {
  x: 0.5, y: 4.2, w: 9, h: 0.7, fontSize: 13, bold: true, color: COLORS.dark, align: 'center'
});

// ===========================================
// SLIDE 13: Key Messages
// ===========================================
slide = addContentSlide('Key Messages by Audience');

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.2, w: 4.3, h: 1.5, fill: { color: COLORS.light }, line: { color: COLORS.primary, width: 2 } });
slide.addText('For Marketing', { x: 0.7, y: 1.3, w: 4, h: 0.35, fontSize: 14, bold: true, color: COLORS.primary });
slide.addText('"GitHub Copilot writes code you don\'t understand.\nCode Coach explains code you didn\'t write."', {
  x: 0.7, y: 1.65, w: 4, h: 0.9, fontSize: 12, italic: true, color: COLORS.dark
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 5.2, y: 1.2, w: 4.3, h: 1.5, fill: { color: COLORS.light }, line: { color: COLORS.primary, width: 2 } });
slide.addText('For Sales', { x: 5.4, y: 1.3, w: 4, h: 0.35, fontSize: 14, bold: true, color: COLORS.primary });
slide.addText('"Your developers spend 58% of their time reading code. Copilot ignores that. We optimize for it."', {
  x: 5.4, y: 1.65, w: 4, h: 0.9, fontSize: 12, italic: true, color: COLORS.dark
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 2.85, w: 4.3, h: 1.5, fill: { color: COLORS.light }, line: { color: COLORS.primary, width: 2 } });
slide.addText('For Technical Audience', { x: 0.7, y: 2.95, w: 4, h: 0.35, fontSize: 14, bold: true, color: COLORS.primary });
slide.addText('"Cited explanations. Root-cause tracing. Offline-first privacy. Team-shareable config. Everything Copilot isn\'t."', {
  x: 0.7, y: 3.3, w: 4, h: 0.9, fontSize: 12, italic: true, color: COLORS.dark
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 5.2, y: 2.85, w: 4.3, h: 1.5, fill: { color: COLORS.light }, line: { color: COLORS.primary, width: 2 } });
slide.addText('For Privacy-Focused Buyers', { x: 5.4, y: 2.95, w: 4, h: 0.35, fontSize: 14, bold: true, color: COLORS.primary });
slide.addText('"Four privacy modes from fully offline to full cloud. No $39/user enterprise plan required."', {
  x: 5.4, y: 3.3, w: 4, h: 0.9, fontSize: 12, italic: true, color: COLORS.dark
});

// ===========================================
// SLIDE 14: Summary
// ===========================================
slide = addContentSlide('Summary: The Code Coach Advantage');

const advantages = [
  { dimension: 'Trust', advantage: 'Citations verify every claim' },
  { dimension: 'Debugging', advantage: 'Static call-chain tracing to root cause' },
  { dimension: 'Privacy', advantage: 'Offline-first with four modes' },
  { dimension: 'Teams', advantage: 'Git-tracked configuration sharing' },
  { dimension: 'Testing', advantage: 'Coverage-aware gap analysis' },
  { dimension: 'Cost', advantage: 'Free with BYOK vs $10-39/month' },
  { dimension: 'Flexibility', advantage: 'Any OpenAI-compatible endpoint' }
];

advantages.forEach((a, i) => {
  const y = 1.2 + (i * 0.5);
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 2, h: 0.45, fill: { color: COLORS.primary } });
  slide.addText(a.dimension, { x: 0.6, y: y + 0.07, w: 1.8, h: 0.32, fontSize: 13, bold: true, color: COLORS.white });
  slide.addText(a.advantage, { x: 2.7, y: y + 0.07, w: 6.8, h: 0.32, fontSize: 13, color: COLORS.dark });
});

slide.addText('The fundamental insight: Copilot optimizes for writing (42%). Code Coach optimizes for reading (58%).', {
  x: 0.5, y: 4.7, w: 9, h: 0.35, fontSize: 13, bold: true, color: COLORS.primary, align: 'center'
});

// ===========================================
// SLIDE 15: Call to Action
// ===========================================
slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });
slide.addText('Next Steps', {
  x: 0.5, y: 1.2, w: 9, h: 0.8,
  fontSize: 44, bold: true, color: COLORS.white
});

const ctas = [
  '1. Try Code Coach in your VS Code environment',
  '2. Evaluate with a pilot team (2-4 weeks)',
  '3. Compare developer productivity metrics',
  '4. Roll out team configuration via git'
];

ctas.forEach((cta, i) => {
  slide.addText(cta, { x: 0.5, y: 2.2 + (i * 0.55), w: 9, h: 0.5, fontSize: 22, color: COLORS.white });
});

slide.addText('Questions?', {
  x: 0.5, y: 4.6, w: 9, h: 0.5,
  fontSize: 28, bold: true, color: COLORS.light
});

// Save the presentation
const outputPath = './docs/Code_Coach_Stakeholder_Presentation.pptx';
pptx.writeFile({ fileName: outputPath })
  .then(() => console.log(`Presentation saved to: ${outputPath}`))
  .catch(err => console.error('Error saving presentation:', err));
