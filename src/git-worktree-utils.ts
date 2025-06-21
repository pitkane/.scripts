#!/usr/bin/env node

import { $ } from "zx";

/**
 * Git Worktree Utilities
 * Shared functionality for git worktree management scripts
 */

/**
 * Validates that we're in a git repository
 * @throws Error if not in a git repository
 */
export async function validateGitRepository(): Promise<void> {
  try {
    await $`git rev-parse --git-dir`;
  } catch (_error) {
    throw new Error("Not in a git repository");
  }
}

/**
 * Discovers the main branch of the repository
 * Tries common patterns and falls back to the default branch
 * @returns The name of the main branch
 */
export async function discoverMainBranch(): Promise<string> {
  // Common main branch names to try
  const commonMainBranches = ["main", "develop", "dev", "master"];

  try {
    // First, try to get the default branch from remote
    const remoteHeadOutput =
      await $`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo ""`;
    const remoteHead = remoteHeadOutput.stdout.trim();

    if (remoteHead) {
      // Extract branch name from refs/remotes/origin/branch-name
      const match = remoteHead.match(/refs\/remotes\/origin\/(.+)/);
      if (match) {
        const defaultBranch = match[1];
        console.log(`Using default branch: ${defaultBranch}`);
        return defaultBranch;
      }
    }
  } catch (_error) {
    // Remote HEAD not available, continue with other methods
  }

  // Try common branch names
  for (const branchName of commonMainBranches) {
    try {
      // Check if branch exists locally
      await $`git show-ref --verify --quiet refs/heads/${branchName}`;
      console.log(`Using main branch: ${branchName}`);
      return branchName;
    } catch (_error) {
      // Branch doesn't exist locally, try remote
      try {
        await $`git show-ref --verify --quiet refs/remotes/origin/${branchName}`;
        console.log(`Using main branch: ${branchName} (from remote)`);
        return branchName;
      } catch (_remoteError) {
        // Branch doesn't exist remotely either, continue
      }
    }
  }

  // Fallback: get the first branch from git branch output
  try {
    const branchOutput = await $`git branch --list`;
    const firstBranch = branchOutput.stdout
      .trim()
      .split("\n")[0]
      .replace(/^\*?\s*/, ""); // Remove * and whitespace

    if (firstBranch) {
      console.log(`Using fallback branch: ${firstBranch}`);
      return firstBranch;
    }
  } catch (_error) {
    // If all else fails, use 'main'
  }

  console.log("Using default fallback: main");
  return "main";
}

/**
 * Gets all worktree paths from git worktree list
 * @returns Array of worktree paths
 */
export async function getWorktreePaths(): Promise<string[]> {
  const worktreeListOutput = await $`git worktree list`;
  return worktreeListOutput.stdout
    .trim()
    .split("\n")
    .map((line) => line.split(/\s+/)[0]) // Extract just the path (first column)
    .filter((path) => path.length > 0);
}

/**
 * Determines the base directory for worktrees
 * @param worktreePaths Array of existing worktree paths
 * @returns The base directory path for worktrees
 */
export function determineWorktreeBase(worktreePaths: string[]): string {
  // Check if we have a bare repository (contains .git at the end)
  const bareGitPath = worktreePaths.find((path) => path.endsWith(".git"));

  if (bareGitPath) {
    // Bare repo - use the parent of the .git directory
    return bareGitPath.replace(/\/\.git$/, "");
  }
  // Regular repo - find the shortest path (likely the main repository)
  // This represents the root of the worktree structure
  return worktreePaths.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest
  );
}

/**
 * Checks if a branch exists locally
 * @param branchName Name of the branch to check
 * @returns True if branch exists locally
 */
export async function branchExistsLocally(
  branchName: string
): Promise<boolean> {
  try {
    await $`git show-ref --verify --quiet refs/heads/${branchName}`;
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Gets the current working directory
 * @returns Current working directory path
 */
export function getCurrentDirectory(): string {
  return process.cwd();
}

/**
 * Gets the current branch name from a given directory
 * @param path Directory path (defaults to current directory)
 * @returns Current branch name
 */
export async function getCurrentBranch(path?: string): Promise<string> {
  const command = path
    ? $`git -C ${path} branch --show-current`
    : $`git branch --show-current`;
  const result = await command;
  return result.stdout.trim();
}

/**
 * Checks if the current directory is a git worktree (not the main repository)
 * @returns True if current directory is a worktree
 */
export async function isCurrentDirectoryWorktree(): Promise<boolean> {
  try {
    // Get the current directory
    const currentDir = getCurrentDirectory();

    // Get all worktree paths
    const worktreePaths = await getWorktreePaths();

    // Determine which is the main repository (base)
    const worktreeBase = determineWorktreeBase(worktreePaths);

    // Check if current directory is not the main repository
    return currentDir !== worktreeBase && worktreePaths.includes(currentDir);
  } catch (_error) {
    return false;
  }
}

/**
 * Switches to a directory and outputs path for shell wrapper
 * @param targetPath Path to switch to
 * @param message Optional message to display
 */
export function switchToDirectory(targetPath: string, message?: string): void {
  if (message) {
    console.log(message);
  }
  console.log(`WORKTREE_PATH:${targetPath}`);
}
