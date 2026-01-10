import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import {
  DiffChange,
  DiffFile,
  DiffHunk,
  DiffSource,
  ParsedDiff,
  DiffExplanation,
  DiffFileExplanation,
  DiffConcern,
  ExplainDiffConfig,
  DEFAULT_EXPLAIN_DIFF_CONFIG
} from './diffTypes';

const execFileAsync = promisify(execFile);

/**
 * Explain Diff - Core diff analysis and explanation module
 *
 * Parses git diffs and generates explanations with AI assistance.
 * Note: Uses execFile (not exec) for security - same pattern as deepDive.ts
 */

/**
 * Get the repository root for a workspace folder
 */
export async function getRepoRoot(workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: workspaceFolder.uri.fsPath
    });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Get working tree diff (staged or unstaged)
 */
export async function getWorkingTreeDiff(
  repoRoot: string,
  staged: boolean = false
): Promise<string> {
  const args = ['diff'];
  if (staged) {
    args.push('--cached');
  }
  args.push('--unified=3', '--no-color');

  try {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Get diff for a specific commit
 */
export async function getCommitDiff(repoRoot: string, commitHash: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', commitHash, '--unified=3', '--no-color', '--format='],
      { cwd: repoRoot }
    );
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Get diff between two refs (branches, tags, commits)
 */
export async function getRangeDiff(
  repoRoot: string,
  fromRef: string,
  toRef: string
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', `${fromRef}...${toRef}`, '--unified=3', '--no-color'],
      { cwd: repoRoot }
    );
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Get diff stats (summary of changes)
 */
export async function getDiffStats(
  repoRoot: string,
  staged: boolean = false
): Promise<{ filesChanged: number; insertions: number; deletions: number }> {
  const args = ['diff', '--stat', '--shortstat'];
  if (staged) {
    args.push('--cached');
  }

  try {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    const match = stdout.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    if (match) {
      return {
        filesChanged: parseInt(match[1]) || 0,
        insertions: parseInt(match[2]) || 0,
        deletions: parseInt(match[3]) || 0
      };
    }
  } catch {
    // Ignore
  }

  return { filesChanged: 0, insertions: 0, deletions: 0 };
}

/**
 * Parse a unified diff string into structured data
 */
export function parseDiff(diffText: string): ParsedDiff {
  const files: DiffFile[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  // Split by file headers
  const fileRegex = /^diff --git a\/(.*?) b\/(.*)$/gm;
  const fileChunks: Array<{ oldPath: string; newPath: string; content: string }> = [];

  let match: RegExpExecArray | null;

  // Find all file headers
  const matches: Array<{ oldPath: string; newPath: string; index: number }> = [];
  while ((match = fileRegex.exec(diffText)) !== null) {
    matches.push({
      oldPath: match[1],
      newPath: match[2],
      index: match.index
    });
  }

  // Extract content for each file
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : diffText.length;
    fileChunks.push({
      oldPath: current.oldPath,
      newPath: current.newPath,
      content: diffText.slice(current.index, nextIndex)
    });
  }

  // Parse each file's diff
  for (const chunk of fileChunks) {
    const file = parseFileDiff(chunk.oldPath, chunk.newPath, chunk.content);
    files.push(file);
    totalAdditions += file.additions;
    totalDeletions += file.deletions;
  }

  return {
    files,
    totalAdditions,
    totalDeletions,
    stats: {
      filesChanged: files.length,
      insertions: totalAdditions,
      deletions: totalDeletions
    }
  };
}

/**
 * Parse a single file's diff
 */
function parseFileDiff(oldPath: string, newPath: string, content: string): DiffFile {
  const hunks: DiffHunk[] = [];
  let additions = 0;
  let deletions = 0;
  let status: DiffFile['status'] = 'modified';
  let isBinary = false;

  // Check for binary file
  if (content.includes('Binary files') || content.includes('GIT binary patch')) {
    isBinary = true;
  }

  // Determine status
  if (content.includes('new file mode')) {
    status = 'added';
  } else if (content.includes('deleted file mode')) {
    status = 'deleted';
  } else if (content.includes('rename from') || content.includes('similarity index')) {
    status = 'renamed';
  } else if (content.includes('copy from')) {
    status = 'copied';
  }

  // Parse hunks
  const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?$/gm;
  let hunkMatch: RegExpExecArray | null;
  const hunkMatches: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    header: string;
    index: number;
  }> = [];

  while ((hunkMatch = hunkRegex.exec(content)) !== null) {
    hunkMatches.push({
      oldStart: parseInt(hunkMatch[1]),
      oldLines: parseInt(hunkMatch[2]) || 1,
      newStart: parseInt(hunkMatch[3]),
      newLines: parseInt(hunkMatch[4]) || 1,
      header: hunkMatch[5]?.trim() || '',
      index: hunkMatch.index + hunkMatch[0].length
    });
  }

  // Parse changes for each hunk
  for (let i = 0; i < hunkMatches.length; i++) {
    const hunk = hunkMatches[i];
    const nextIndex = i + 1 < hunkMatches.length
      ? content.indexOf('\n@@ -', hunk.index)
      : content.length;

    const hunkContent = content.slice(hunk.index, nextIndex === -1 ? undefined : nextIndex);
    const changes: DiffChange[] = [];
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    const lines = hunkContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        changes.push({
          type: 'add',
          content: line.slice(1),
          newLine: newLine++
        });
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        changes.push({
          type: 'delete',
          content: line.slice(1),
          oldLine: oldLine++
        });
        deletions++;
      } else if (line.startsWith(' ') || (line === '' && lines.indexOf(line) !== lines.length - 1)) {
        changes.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLine: oldLine++,
          newLine: newLine++
        });
      }
    }

    hunks.push({
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      changes,
      header: hunk.header || undefined
    });
  }

  return {
    oldPath: status === 'added' ? null : oldPath,
    newPath: status === 'deleted' ? null : newPath,
    status,
    additions,
    deletions,
    hunks,
    isBinary
  };
}

/**
 * Generate a static (non-AI) explanation of a diff
 */
export function generateStaticDiffExplanation(
  diff: ParsedDiff,
  source: DiffSource,
  config: ExplainDiffConfig = DEFAULT_EXPLAIN_DIFF_CONFIG
): DiffExplanation {
  const files: DiffFileExplanation[] = [];

  // Filter files based on config
  let filesToAnalyze = diff.files;
  if (!config.includeTestFiles) {
    filesToAnalyze = filesToAnalyze.filter(
      f => !isTestFile(f.newPath || f.oldPath || '')
    );
  }
  filesToAnalyze = filesToAnalyze.slice(0, config.maxFiles);

  // Generate per-file explanations
  for (const file of filesToAnalyze) {
    const fileExplanation = generateFileExplanation(file);
    files.push(fileExplanation);
  }

  // Generate overall summary
  const summary = generateDiffSummary(diff, source);

  // Generate concerns (static analysis only)
  const concerns: DiffConcern[] = config.showPotentialConcerns
    ? generateStaticConcerns(diff)
    : [];

  return {
    summary,
    files,
    concerns: concerns.length > 0 ? concerns : undefined,
    metadata: {
      filesAnalyzed: files.length,
      aiUsed: false,
      generatedAt: new Date().toISOString(),
      sourceDescription: describeSource(source)
    }
  };
}

/**
 * Generate explanation for a single file
 */
function generateFileExplanation(file: DiffFile): DiffFileExplanation {
  const filePath = file.newPath || file.oldPath || 'unknown';
  let summary = '';

  switch (file.status) {
    case 'added':
      summary = `New file with ${file.additions} lines`;
      break;
    case 'deleted':
      summary = `File deleted (${file.deletions} lines removed)`;
      break;
    case 'renamed':
      summary = `Renamed from ${file.oldPath}`;
      if (file.additions > 0 || file.deletions > 0) {
        summary += ` with ${file.additions} additions and ${file.deletions} deletions`;
      }
      break;
    case 'modified':
      summary = `Modified: +${file.additions} -${file.deletions}`;
      break;
    default:
      summary = `Changed: +${file.additions} -${file.deletions}`;
  }

  // Generate change explanations
  const changes: DiffFileExplanation['changes'] = [];

  for (const hunk of file.hunks) {
    // Group consecutive additions/deletions
    const addedLines = hunk.changes.filter(c => c.type === 'add');
    const deletedLines = hunk.changes.filter(c => c.type === 'delete');

    if (addedLines.length > 0 && deletedLines.length > 0) {
      // Likely a modification
      const startLine = addedLines[0].newLine;
      const endLine = addedLines[addedLines.length - 1].newLine;
      changes.push({
        description: `Modified ${addedLines.length} lines`,
        lineRange: startLine && endLine ? { start: startLine, end: endLine } : undefined,
        changeType: 'modification'
      });
    } else if (addedLines.length > 0) {
      const startLine = addedLines[0].newLine;
      const endLine = addedLines[addedLines.length - 1].newLine;
      changes.push({
        description: `Added ${addedLines.length} lines`,
        lineRange: startLine && endLine ? { start: startLine, end: endLine } : undefined,
        changeType: 'addition'
      });
    } else if (deletedLines.length > 0) {
      changes.push({
        description: `Removed ${deletedLines.length} lines`,
        changeType: 'deletion'
      });
    }
  }

  return { filePath, summary, changes };
}

/**
 * Generate overall diff summary
 */
function generateDiffSummary(diff: ParsedDiff, source: DiffSource): string {
  const { filesChanged, insertions, deletions } = diff.stats;

  const parts: string[] = [];
  parts.push(`${filesChanged} file${filesChanged !== 1 ? 's' : ''} changed`);

  if (insertions > 0) {
    parts.push(`${insertions} insertion${insertions !== 1 ? 's' : ''}(+)`);
  }
  if (deletions > 0) {
    parts.push(`${deletions} deletion${deletions !== 1 ? 's' : ''}(-)`);
  }

  // Categorize by file type
  const byType = new Map<string, number>();
  for (const file of diff.files) {
    const ext = getFileExtension(file.newPath || file.oldPath || '');
    byType.set(ext, (byType.get(ext) || 0) + 1);
  }

  const typeDescriptions: string[] = [];
  for (const [ext, count] of byType) {
    if (ext) {
      typeDescriptions.push(`${count} ${ext} file${count !== 1 ? 's' : ''}`);
    }
  }

  let summary = parts.join(', ');
  if (typeDescriptions.length > 0 && typeDescriptions.length <= 4) {
    summary += ` (${typeDescriptions.join(', ')})`;
  }

  return summary;
}

/**
 * Generate static concerns (patterns that might indicate issues)
 */
function generateStaticConcerns(diff: ParsedDiff): DiffConcern[] {
  const concerns: DiffConcern[] = [];

  for (const file of diff.files) {
    const filePath = file.newPath || file.oldPath || '';

    // Check for large file changes
    if (file.additions + file.deletions > 500) {
      concerns.push({
        severity: 'info',
        message: `Large change: ${file.additions + file.deletions} lines modified`,
        filePath,
        category: 'other'
      });
    }

    // Check for sensitive files
    if (filePath.includes('.env') || filePath.includes('secret') || filePath.includes('credential')) {
      concerns.push({
        severity: 'warning',
        message: 'Changes to potentially sensitive file',
        filePath,
        category: 'security'
      });
    }

    // Check for security-related patterns in changes
    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        if (change.type === 'add') {
          // Check for hardcoded secrets patterns
          if (/(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]+['"]/i.test(change.content)) {
            concerns.push({
              severity: 'warning',
              message: 'Possible hardcoded secret or credential',
              filePath,
              line: change.newLine,
              category: 'security'
            });
          }

          // Check for TODO/FIXME
          if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(change.content)) {
            concerns.push({
              severity: 'info',
              message: 'New TODO/FIXME comment added',
              filePath,
              line: change.newLine,
              category: 'other'
            });
          }

          // Check for console.log/print statements
          if (/\b(console\.log|print\(|printf\(|System\.out\.print)/i.test(change.content)) {
            concerns.push({
              severity: 'info',
              message: 'Debug statement added',
              filePath,
              line: change.newLine,
              category: 'other'
            });
          }
        }
      }
    }
  }

  // Deduplicate concerns
  const seen = new Set<string>();
  return concerns.filter(c => {
    const key = `${c.category}:${c.filePath}:${c.line}:${c.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Describe a diff source for display
 */
export function describeSource(source: DiffSource): string {
  switch (source.type) {
    case 'working':
      return source.staged ? 'Staged changes' : 'Working tree changes';
    case 'commit':
      return `Commit ${source.hash.slice(0, 7)}`;
    case 'range':
      return `${source.fromRef}...${source.toRef}`;
    case 'pr':
      return `PR #${source.number}`;
    default:
      return 'Unknown';
  }
}

/**
 * Check if a file path looks like a test file
 */
function isTestFile(filePath: string): boolean {
  const patterns = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /__tests__\//,
    /test\//,
    /tests\//,
    /\.test$/
  ];
  return patterns.some(p => p.test(filePath));
}

/**
 * Get file extension from path
 */
function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return '';

  // Map common extensions to readable names
  const extMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.html': 'HTML'
  };

  return extMap[ext] || ext.slice(1).toUpperCase();
}

/**
 * Format a diff explanation as markdown
 */
export function formatDiffExplanationMarkdown(explanation: DiffExplanation): string {
  const out: string[] = [];

  out.push('# Diff Explanation');
  out.push('');
  out.push(`**${explanation.metadata.sourceDescription}**`);
  out.push('');
  out.push('## Summary');
  out.push(explanation.summary);
  out.push('');

  if (explanation.files.length > 0) {
    out.push('## Files Changed');
    out.push('');

    for (const file of explanation.files) {
      out.push(`### ${file.filePath}`);
      out.push(file.summary);
      out.push('');

      if (file.changes.length > 0) {
        for (const change of file.changes) {
          const lineRef = change.lineRange
            ? ` (L${change.lineRange.start}-${change.lineRange.end})`
            : '';
          out.push(`- ${change.description}${lineRef}`);
        }
        out.push('');
      }
    }
  }

  if (explanation.concerns && explanation.concerns.length > 0) {
    out.push('## Potential Concerns');
    out.push('');

    for (const concern of explanation.concerns) {
      const icon = concern.severity === 'warning' ? '!!' : 'i';
      const location = concern.filePath
        ? concern.line
          ? `${concern.filePath}:${concern.line}`
          : concern.filePath
        : '';
      out.push(`[${icon}] **${concern.message}**`);
      if (location) {
        out.push(`   ${location}`);
      }
      out.push('');
    }
  }

  out.push('---');
  out.push(`*Generated: ${new Date(explanation.metadata.generatedAt).toLocaleString()}*`);
  if (!explanation.metadata.aiUsed) {
    out.push('*Static analysis only (AI not enabled)*');
  }

  return out.join('\n');
}
