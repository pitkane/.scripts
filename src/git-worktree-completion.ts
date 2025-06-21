#!/usr/bin/env node

import { $ } from "zx";

/**
 * Git Worktree Tab Completion Script
 * Provides intelligent tab completion for the gwtadd command
 *
 * Returns a list of available worktree names and branch names
 * that can be used for completion in the shell
 */

async function getCompletionOptions(): Promise<string[]> {
  try {
    // Check if we're in a git repository
    await $`git rev-parse --git-dir`;
  } catch (_error) {
    // Not in a git repository - return empty array
    return [];
  }

  try {
    const completionOptions: string[] = [];

    // Get list of existing worktrees
    const worktreeListOutput = await $`git worktree list`;
    const worktreePaths = worktreeListOutput.stdout
      .trim()
      .split("\n")
      .map((line) => line.split(/\s+/)[0]) // Extract just the path (first column)
      .filter((path) => path.length > 0);

    // Find the base directory using the same logic as the main script
    let worktreeBase = "";

    // Check if we have a bare repository (contains .git at the end)
    const bareGitPath = worktreePaths.find((path) => path.endsWith(".git"));

    if (bareGitPath) {
      // Bare repo - use the parent of the .git directory
      worktreeBase = bareGitPath.replace(/\/\.git$/, "");
    } else {
      // Regular repo - find the shortest path (likely the main repository)
      worktreeBase = worktreePaths.reduce((shortest, current) =>
        current.length < shortest.length ? current : shortest
      );
    }

    // Extract worktree names from paths (excluding the main worktree)
    for (const path of worktreePaths) {
      if (path !== worktreeBase && path.length > 0) {
        // Get just the directory name, not the full path
        const worktreeName = path.split("/").pop();
        if (worktreeName) {
          completionOptions.push(worktreeName);
        }
      }
    }

    // Get remote branch names that aren't yet worktrees
    try {
      const branchesOutput = await $`git branch -r`;
      const remoteBranches = branchesOutput.stdout
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => !line.includes("HEAD")) // Exclude HEAD references
        .map((line) => line.replace(/^.*origin\//, "")) // Remove 'origin/' prefix
        .filter((branch) => branch.length > 0);

      // Add remote branches to completion options
      completionOptions.push(...remoteBranches);
    } catch (_branchError) {
      // If we can't get branches, that's okay - just use worktrees
    }

    // Remove duplicates and sort
    const uniqueOptions = [...new Set(completionOptions)].sort();

    return uniqueOptions;
  } catch (_error) {
    // If there's any error, return empty array
    return [];
  }
}

async function main() {
  try {
    const options = await getCompletionOptions();

    // Output each option on a separate line for shell completion
    for (const option of options) {
      console.log(option);
    }
  } catch (_error) {
    // Silent failure for completion scripts
    process.exit(0);
  }
}

// Run the main function
main().catch(() => {
  // Silent failure for completion scripts
  process.exit(0);
});
