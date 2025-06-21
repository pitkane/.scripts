#!/usr/bin/env node

import { $, cd } from "zx";

/**
 * Git Worktree Management Script
 * Converts the shell-based gwt function to TypeScript
 *
 * Usage: pnpx tsx git-worktree.ts <branch-name>
 *
 * This script:
 * - Dynamically discovers the main branch (main, develop, dev, etc.)
 * - Creates a new git worktree from the main branch
 * - Handles both existing and new branches
 * - Switches to existing worktrees if they already exist
 * - Maintains the same directory structure as the original shell script
 */

/**
 * Validates that we're in a git repository
 * @throws Error if not in a git repository
 */
async function validateGitRepository(): Promise<void> {
  try {
    await $`git rev-parse --git-dir`;
  } catch (error) {
    throw new Error("Not in a git repository");
  }
}

/**
 * Discovers the main branch of the repository
 * Tries common patterns and falls back to the default branch
 * @returns The name of the main branch
 */
async function discoverMainBranch(): Promise<string> {
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
  } catch (error) {
    // Remote HEAD not available, continue with other methods
  }

  // Try common branch names
  for (const branchName of commonMainBranches) {
    try {
      // Check if branch exists locally
      await $`git show-ref --verify --quiet refs/heads/${branchName}`;
      console.log(`Using main branch: ${branchName}`);
      return branchName;
    } catch (error) {
      // Branch doesn't exist locally, try remote
      try {
        await $`git show-ref --verify --quiet refs/remotes/origin/${branchName}`;
        console.log(`Using main branch: ${branchName} (from remote)`);
        return branchName;
      } catch (remoteError) {
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
  } catch (error) {
    // If all else fails, use 'main'
  }

  console.log("Using default fallback: main");
  return "main";
}

/**
 * Gets all worktree paths from git worktree list
 * @returns Array of worktree paths
 */
async function getWorktreePaths(): Promise<string[]> {
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
function determineWorktreeBase(worktreePaths: string[]): string {
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
async function branchExistsLocally(branchName: string): Promise<boolean> {
  try {
    await $`git show-ref --verify --quiet refs/heads/${branchName}`;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Switches to an existing worktree and shows status
 * @param targetPath Path to the existing worktree
 */
async function switchToExistingWorktree(targetPath: string): Promise<void> {
  console.log(`Switched to existing worktree: ${targetPath}`);

  // Show current branch from the worktree directory
  const currentBranch = await $`git -C ${targetPath} branch --show-current`;
  console.log(`On branch: ${currentBranch.stdout.trim()}`);
  
  // Output the target path for the shell wrapper to use
  console.log(`WORKTREE_PATH:${targetPath}`);
}

/**
 * Creates a new worktree with an existing branch
 * @param targetPath Path where the worktree should be created
 * @param branchName Name of the existing branch
 */
async function createWorktreeWithExistingBranch(
  targetPath: string,
  branchName: string
): Promise<void> {
  await $`git worktree add ${targetPath} ${branchName}`;
  console.log(`Created worktree with existing branch: ${targetPath}`);

  const currentBranch = await $`git -C ${targetPath} branch --show-current`;
  console.log(`On branch: ${currentBranch.stdout.trim()}`);
  
  // Output the target path for the shell wrapper to use
  console.log(`WORKTREE_PATH:${targetPath}`);
}

/**
 * Creates a new worktree with a new branch from the main branch
 * @param targetPath Path where the worktree should be created
 * @param branchName Name of the new branch to create
 * @param mainBranch Name of the main branch to branch from
 */
async function createWorktreeWithNewBranch(
  targetPath: string,
  branchName: string,
  mainBranch: string
): Promise<void> {
  await $`git worktree add ${targetPath} ${mainBranch} -b ${branchName}`;
  console.log(`Created and switched to new worktree: ${targetPath}`);
  console.log(`Created new branch '${branchName}' from '${mainBranch}'`);

  const currentBranch = await $`git -C ${targetPath} branch --show-current`;
  console.log(`On branch: ${currentBranch.stdout.trim()}`);
  
  // Output the target path for the shell wrapper to use
  console.log(`WORKTREE_PATH:${targetPath}`);
}

/**
 * Main function that orchestrates the worktree management
 */
async function main() {
  // Get command line arguments (skip node and script name)
  const args = process.argv.slice(2);

  // Check if branch name was provided
  if (args.length === 0) {
    console.log("Usage: gwt <branch-name>");
    process.exit(1);
  }

  const branchName = args[0];

  try {
    // Validate we're in a git repository
    await validateGitRepository();

    // Discover the main branch
    const mainBranch = await discoverMainBranch();

    // Get all worktree paths
    const worktreePaths = await getWorktreePaths();

    // Determine the base directory for worktrees
    const worktreeBase = determineWorktreeBase(worktreePaths);

    // Create the full path for the new worktree
    const targetPath = `${worktreeBase}/${branchName}`;

    // Check if worktree already exists
    const existingWorktree = worktreePaths.find((path) => path === targetPath);

    if (existingWorktree) {
      // Worktree exists - switch to it
      await switchToExistingWorktree(targetPath);
    } else {
      // Worktree doesn't exist - create it
      const branchExists = await branchExistsLocally(branchName);

      if (branchExists) {
        // Branch exists - create worktree with existing branch
        await createWorktreeWithExistingBranch(targetPath, branchName);
      } else {
        // Branch doesn't exist - create new branch from main branch
        await createWorktreeWithNewBranch(targetPath, branchName, mainBranch);
      }
    }
  } catch (error) {
    console.log("Error managing worktree:");
    console.error(error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
