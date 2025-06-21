#!/usr/bin/env node

import { $ } from "zx";
import {
  validateGitRepository,
  discoverMainBranch,
  getWorktreePaths,
  determineWorktreeBase,
  branchExistsLocally,
  getCurrentBranch,
  switchToDirectory
} from "./git-worktree-utils.js";

/**
 * Git Worktree Add Script
 * Creates and manages git worktrees via the gwtadd command
 *
 * Usage: pnpx tsx git-worktree-add.ts <branch-name>
 *
 * This script:
 * - Dynamically discovers the main branch (main, develop, dev, etc.)
 * - Creates a new git worktree from the main branch
 * - Handles both existing and new branches
 * - Switches to existing worktrees if they already exist
 * - Maintains the same directory structure as the original shell script
 */


/**
 * Switches to an existing worktree and shows status
 * @param targetPath Path to the existing worktree
 */
async function switchToExistingWorktree(targetPath: string): Promise<void> {
  console.log(`Switched to existing worktree: ${targetPath}`);

  // Show current branch from the worktree directory
  const currentBranch = await getCurrentBranch(targetPath);
  console.log(`On branch: ${currentBranch}`);
  
  // Output the target path for the shell wrapper to use
  switchToDirectory(targetPath);
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

  const currentBranch = await getCurrentBranch(targetPath);
  console.log(`On branch: ${currentBranch}`);
  
  // Output the target path for the shell wrapper to use
  switchToDirectory(targetPath);
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

  const currentBranch = await getCurrentBranch(targetPath);
  console.log(`On branch: ${currentBranch}`);
  
  // Output the target path for the shell wrapper to use
  switchToDirectory(targetPath);
}

/**
 * Main function that orchestrates the worktree management
 */
async function main() {
  // Get command line arguments (skip node and script name)
  const args = process.argv.slice(2);

  // Check if branch name was provided
  if (args.length === 0) {
    console.log("Usage: gwtadd <branch-name>");
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
