/**
 * Change Detector - Analyzes git changes for subscribed items
 *
 * Compares git refs to detect changes to files/symbols that
 * the user has subscribed to.
 */

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  Subscription,
  DetectedChange,
  ChangeSummary,
  matchesSubscription
} from './subscriptionTypes';

const execFileAsync = promisify(execFile);

interface GitFileChange {
  status: 'A' | 'M' | 'D' | 'R' | 'C';
  filePath: string;
  oldPath?: string;
  additions: number;
  deletions: number;
}

/**
 * ChangeDetector - Detects changes to subscribed items
 */
export class ChangeDetector {
  private static instance: ChangeDetector | undefined;
  private lastCheckedRef: string | undefined;

  private constructor() {}

  static getInstance(): ChangeDetector {
    if (!ChangeDetector.instance) {
      ChangeDetector.instance = new ChangeDetector();
    }
    return ChangeDetector.instance;
  }

  /**
   * Get the current HEAD ref
   */
  async getCurrentHead(): Promise<string | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: workspaceFolder.uri.fsPath
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Get the last checked ref (or origin/main if never checked)
   */
  getLastCheckedRef(): string {
    return this.lastCheckedRef || 'origin/main';
  }

  /**
   * Update the last checked ref
   */
  setLastCheckedRef(ref: string): void {
    this.lastCheckedRef = ref;
  }

  /**
   * Get changes between two refs
   */
  async getChangesBetweenRefs(
    fromRef: string,
    toRef: string = 'HEAD'
  ): Promise<GitFileChange[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    try {
      // Get list of changed files with stats
      const { stdout } = await execFileAsync(
        'git',
        ['diff', '--name-status', '--numstat', fromRef, toRef],
        { cwd: workspaceFolder.uri.fsPath }
      );

      return this.parseGitDiff(stdout);
    } catch (err) {
      console.error('[Code Coach] Failed to get git changes:', err);
      return [];
    }
  }

  /**
   * Get changes in the most recent pull
   */
  async getChangesSinceLastPull(): Promise<GitFileChange[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    try {
      // Get the ref before the last pull (ORIG_HEAD is set by git pull)
      const { stdout: origHead } = await execFileAsync(
        'git',
        ['rev-parse', 'ORIG_HEAD'],
        { cwd: workspaceFolder.uri.fsPath }
      );

      return this.getChangesBetweenRefs(origHead.trim(), 'HEAD');
    } catch {
      // ORIG_HEAD doesn't exist, try last checked ref
      if (this.lastCheckedRef) {
        return this.getChangesBetweenRefs(this.lastCheckedRef, 'HEAD');
      }
      return [];
    }
  }

  /**
   * Parse git diff output
   */
  private parseGitDiff(output: string): GitFileChange[] {
    const changes: GitFileChange[] = [];
    const lines = output.trim().split('\n').filter(Boolean);

    // git diff --name-status --numstat produces:
    // additions\tdeletions\tfilePath
    // status\tfilePath (or status\toldPath\tnewPath for renames)

    let i = 0;
    while (i < lines.length) {
      const numstatMatch = lines[i]?.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (numstatMatch) {
        const additions = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1]);
        const deletions = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2]);
        const filePath = numstatMatch[3];

        i++;
        // Look for corresponding name-status line
        const statusMatch = lines[i]?.match(/^([AMDRC])\d*\t(.+)$/);
        if (statusMatch) {
          const status = statusMatch[1] as GitFileChange['status'];
          const pathInfo = statusMatch[2];

          let actualPath = filePath;
          let oldPath: string | undefined;

          if (status === 'R' || status === 'C') {
            const paths = pathInfo.split('\t');
            oldPath = paths[0];
            actualPath = paths[1] || filePath;
          }

          changes.push({
            status,
            filePath: actualPath,
            oldPath,
            additions,
            deletions
          });
          i++;
        } else {
          // No status line, infer as modified
          changes.push({
            status: 'M',
            filePath,
            additions,
            deletions
          });
        }
      } else {
        i++;
      }
    }

    // If no numstat data, try name-status only format
    if (changes.length === 0) {
      for (const line of lines) {
        const match = line.match(/^([AMDRC])\d*\t(.+)$/);
        if (match) {
          const status = match[1] as GitFileChange['status'];
          const pathInfo = match[2];

          let filePath = pathInfo;
          let oldPath: string | undefined;

          if (status === 'R' || status === 'C') {
            const paths = pathInfo.split('\t');
            oldPath = paths[0];
            filePath = paths[1] || paths[0];
          }

          changes.push({
            status,
            filePath,
            oldPath,
            additions: 0,
            deletions: 0
          });
        }
      }
    }

    return changes;
  }

  /**
   * Get commit info for a ref
   */
  async getCommitInfo(ref: string): Promise<{ hash: string; message: string; author: string } | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', '-1', '--format=%H|%s|%an', ref],
        { cwd: workspaceFolder.uri.fsPath }
      );

      const [hash, message, author] = stdout.trim().split('|');
      return { hash, message, author };
    } catch {
      return undefined;
    }
  }

  /**
   * Detect changes that match subscriptions
   */
  async detectChanges(
    subscriptions: Subscription[],
    fromRef?: string,
    toRef: string = 'HEAD'
  ): Promise<ChangeSummary> {
    const activeSubscriptions = subscriptions.filter(s => s.active);
    if (activeSubscriptions.length === 0) {
      return {
        totalChanges: 0,
        bySubscription: new Map(),
        byFile: new Map()
      };
    }

    const actualFromRef = fromRef || this.getLastCheckedRef();
    const gitChanges = await this.getChangesBetweenRefs(actualFromRef, toRef);

    const detectedChanges: DetectedChange[] = [];
    const bySubscription = new Map<string, DetectedChange[]>();
    const byFile = new Map<string, DetectedChange[]>();

    for (const gitChange of gitChanges) {
      for (const subscription of activeSubscriptions) {
        if (matchesSubscription(subscription, gitChange.filePath)) {
          const change: DetectedChange = {
            subscription,
            filePath: gitChange.filePath,
            changeType: this.mapStatus(gitChange.status),
            additions: gitChange.additions,
            deletions: gitChange.deletions,
            detectedAt: new Date().toISOString()
          };

          detectedChanges.push(change);

          // Group by subscription
          const subChanges = bySubscription.get(subscription.id) || [];
          subChanges.push(change);
          bySubscription.set(subscription.id, subChanges);

          // Group by file
          const fileChanges = byFile.get(gitChange.filePath) || [];
          fileChanges.push(change);
          byFile.set(gitChange.filePath, fileChanges);
        }
      }
    }

    return {
      totalChanges: detectedChanges.length,
      bySubscription,
      byFile,
      gitRange: {
        from: actualFromRef,
        to: toRef
      }
    };
  }

  /**
   * Map git status to change type
   */
  private mapStatus(status: GitFileChange['status']): DetectedChange['changeType'] {
    switch (status) {
      case 'A': return 'added';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      case 'C': return 'added';
      default: return 'modified';
    }
  }

  /**
   * Check if there are any new changes since last check
   */
  async hasNewChanges(): Promise<boolean> {
    const currentHead = await this.getCurrentHead();
    if (!currentHead) return false;

    if (!this.lastCheckedRef) {
      return true; // First check, assume there are changes
    }

    return currentHead !== this.lastCheckedRef;
  }

  /**
   * Format a change summary for display
   */
  formatChangeSummary(summary: ChangeSummary): string {
    if (summary.totalChanges === 0) {
      return 'No changes detected in subscribed files.';
    }

    const lines: string[] = [];
    lines.push(`## ${summary.totalChanges} Changes Detected`);
    lines.push('');

    if (summary.gitRange) {
      lines.push(`*Comparing ${summary.gitRange.from.slice(0, 7)}...${summary.gitRange.to.slice(0, 7)}*`);
      lines.push('');
    }

    // Group by subscription
    for (const [subId, changes] of summary.bySubscription) {
      const subscription = changes[0]?.subscription;
      if (!subscription) continue;

      const label = subscription.type === 'file' ? subscription.pattern :
                    subscription.type === 'symbol' ? subscription.symbol :
                    subscription.path;

      lines.push(`### ${label}`);
      if (subscription.reason) {
        lines.push(`*${subscription.reason}*`);
      }
      lines.push('');

      for (const change of changes) {
        const icon = change.changeType === 'added' ? '+' :
                     change.changeType === 'deleted' ? '-' :
                     change.changeType === 'renamed' ? '~' : '*';
        lines.push(`- ${icon} \`${change.filePath}\` (+${change.additions}/-${change.deletions})`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
