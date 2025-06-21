#!/usr/bin/env node

import { $, question } from "zx";
import {
  determineWorktreeBase,
  discoverMainBranch,
  getCurrentBranch,
  getCurrentDirectory,
  getWorktreePaths,
  isCurrentDirectoryWorktree,
  switchToDirectory,
  validateGitRepository,
} from "./git-worktree-utils.js";

/**
 * Git Worktree Remove Script
 * Removes the current git worktree with confirmation
 *
 * Usage: pnpx tsx git-worktree-remove.ts
 *
 * This script:
 * - Checks if current directory is a worktree (not main repository)
 * - Asks for confirmation before removing
 * - Removes the current worktree
 * - Switches back to the main branch/repository
 */

/**
 * Prompts user for confirmation using zx
 * @param message The confirmation message
 * @returns Promise that resolves to true if user confirms
 */
async function askForConfirmation(message: string): Promise<boolean> {
  try {
    // Use zx question helper for interactive prompts
    const answer = await question(`${message} (y/N): `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  } catch (error) {
    // If user cancels (Ctrl+C), treat as "no"
    return false;
  }
}

/**
 * Main function that orchestrates the worktree removal
 */
async function main() {
  try {
    // Get command line arguments (skip node and script name)
    const args = process.argv.slice(2);
    const forceRemove = args.includes("--force") || args.includes("-f");

    // Validate we're in a git repository
    await validateGitRepository();

    // Check if we're in a worktree (not the main repository)
    const isWorktree = await isCurrentDirectoryWorktree();

    if (!isWorktree) {
      console.log(
        "❌ Error: Not in a git worktree. Use this command from within a worktree directory."
      );
      process.exit(1);
    }

    // Get current directory and branch info
    const currentDir = getCurrentDirectory();
    const currentBranch = await getCurrentBranch();
    const worktreeName = currentDir.split("/").pop();

    console.log(`📍 Current worktree: ${worktreeName}`);
    console.log(`🌿 Current branch: ${currentBranch}`);
    console.log(`📁 Path: ${currentDir}`);

    // Ask for confirmation unless forced
    let confirmed = forceRemove;
    if (!confirmed) {
      confirmed = await askForConfirmation(
        "⚠️  Are you sure you want to remove this worktree?"
      );
    }

    if (!confirmed) {
      console.log("❌ Operation cancelled.");
      process.exit(0);
    }

    // Get worktree paths and main branch before removal
    const worktreePaths = await getWorktreePaths();
    const worktreeBase = determineWorktreeBase(worktreePaths);
    const mainBranch = await discoverMainBranch();

    // Change to main repository before removing to avoid "No such file or directory" errors
    process.chdir(worktreeBase);
    console.log(`📂 Changed to main repository: ${worktreeBase}`);

    // Switch to main branch before removing worktree, handling case where it's already checked out elsewhere
    console.log(`🌿 Switching to main branch: ${mainBranch}`);
    try {
      await $`git checkout ${mainBranch}`;
    } catch (checkoutError) {
      // If main branch is already checked out in another worktree, use detached HEAD instead
      console.log(`⚠️  Main branch is checked out elsewhere, using detached HEAD instead`);
      await $`git checkout --detach ${mainBranch}`;
    }

    // Remove the worktree
    console.log(`🗑️  Removing worktree: ${currentDir}`);
    await $`git worktree remove ${currentDir} --force`;

    console.log("✅ Worktree removed successfully");

    // Output path for shell wrapper in force mode (already in main repo)
    if (forceRemove) {
      switchToDirectory(worktreeBase);
    }

    // Show current branch in main repository (from the main repo directory)
    try {
      const mainRepoCurrentBranch = await getCurrentBranch(worktreeBase);
      console.log(`🌿 On branch: ${mainRepoCurrentBranch}`);

      // If we're not on the main branch, suggest switching
      if (mainRepoCurrentBranch !== mainBranch) {
        console.log(
          `💡 Tip: You might want to switch to the main branch (${mainBranch})`
        );
      }
    } catch (branchError) {
      // If we can't get the current branch, that's okay - just continue
      console.log("🌿 Switched to main repository");
    }
  } catch (error) {
    console.log("❌ Error removing worktree:");
    console.error(error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
