#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { $, cd } from "zx";

/**
 * Comprehensive test script for git worktree commands
 * Creates a test repository in /tmp and tests gwtadd/gwtremove functionality
 */

const TEST_REPO_PATH = "/tmp/git-worktree-test";
const SCRIPTS_PATH = process.cwd(); // Current repository where the scripts are located

/**
 * Colors for output
 */
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

/**
 * Print colored output
 */
function print(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print test section header
 */
function printSection(title: string) {
  print(`\n${colors.bold}=== ${title} ===${colors.reset}`, "blue");
}

/**
 * Print test result
 */
function printResult(test: string, passed: boolean) {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  const color = passed ? "green" : "red";
  print(`${status} ${test}`, color);
}

/**
 * Clean up test directory
 */
async function cleanup() {
  if (existsSync(TEST_REPO_PATH)) {
    print(`Cleaning up ${TEST_REPO_PATH}`, "yellow");
    rmSync(TEST_REPO_PATH, { recursive: true, force: true });
  }
}

/**
 * Setup test repository with initial structure
 */
async function setupTestRepo() {
  printSection("Setting up test repository");

  // Clean up any existing test repo
  await cleanup();

  // Create and initialize git repository
  await $`mkdir -p ${TEST_REPO_PATH}`;
  cd(TEST_REPO_PATH);

  await $`git init`;
  await $`git config user.name "Test User"`;
  await $`git config user.email "test@example.com"`;

  // Create initial file and commit
  await $`echo "# Test Repository" > README.md`;
  await $`git add README.md`;
  await $`git commit -m "Initial commit"`;

  // Create dev branch (our main branch for testing)
  await $`git checkout -b dev`;
  await $`echo "This is the dev branch" >> README.md`;
  await $`git add README.md`;
  await $`git commit -m "Add dev branch content"`;

  // Create a feature branch to test existing branch checkout
  await $`git checkout -b existing-feature`;
  await $`echo "Feature content" > feature.txt`;
  await $`git add feature.txt`;
  await $`git commit -m "Add feature"`;

  // Go back to dev as our main branch
  await $`git checkout dev`;

  print("✅ Test repository setup complete", "green");
  print(`📁 Repository location: ${TEST_REPO_PATH}`, "blue");

  // Show initial state
  const branches = await $`git branch`;
  print("📋 Available branches:", "blue");
  console.log(branches.stdout);
}

/**
 * Test gwtadd with existing branch
 */
async function testGwtaddExistingBranch() {
  printSection("Testing gwtadd with existing branch");

  cd(TEST_REPO_PATH);

  try {
    // Test adding worktree for existing branch
    await $`pnpx tsx ${SCRIPTS_PATH}/src/git-worktree-add.ts existing-feature`;

    // Verify worktree was created
    const worktreeExists = existsSync(join(TEST_REPO_PATH, "existing-feature"));
    printResult("Worktree directory created", worktreeExists);

    // Verify git worktree list shows the new worktree
    const worktreeList = await $`git worktree list`;
    const hasWorktree = worktreeList.stdout.includes("existing-feature");
    printResult("Worktree registered with git", hasWorktree);

    // Verify correct branch is checked out
    cd(join(TEST_REPO_PATH, "existing-feature"));
    const currentBranch = await $`git branch --show-current`;
    const isCorrectBranch = currentBranch.stdout.trim() === "existing-feature";
    printResult("Correct branch checked out", isCorrectBranch);

    // Verify feature.txt exists (content from the branch)
    const featureFileExists = existsSync(
      join(TEST_REPO_PATH, "existing-feature", "feature.txt")
    );
    printResult("Branch-specific files present", featureFileExists);

    return true;
  } catch (error) {
    print(`❌ Error testing existing branch: ${error}`, "red");
    return false;
  }
}

/**
 * Test gwtadd with new branch
 */
async function testGwtaddNewBranch() {
  printSection("Testing gwtadd with new branch");

  cd(TEST_REPO_PATH);

  try {
    // Test adding worktree for new branch
    await $`pnpx tsx ${SCRIPTS_PATH}/src/git-worktree-add.ts new-feature`;

    // Verify worktree was created
    const worktreeExists = existsSync(join(TEST_REPO_PATH, "new-feature"));
    printResult("New worktree directory created", worktreeExists);

    // Verify git worktree list shows the new worktree
    const worktreeList = await $`git worktree list`;
    const hasWorktree = worktreeList.stdout.includes("new-feature");
    printResult("New worktree registered with git", hasWorktree);

    // Verify correct branch is checked out
    cd(join(TEST_REPO_PATH, "new-feature"));
    const currentBranch = await $`git branch --show-current`;
    const isCorrectBranch = currentBranch.stdout.trim() === "new-feature";
    printResult("New branch created and checked out", isCorrectBranch);

    // Verify it has content from dev branch (base branch)
    const readmeExists = existsSync(
      join(TEST_REPO_PATH, "new-feature", "README.md")
    );
    printResult("Base branch content present", readmeExists);

    return true;
  } catch (error) {
    print(`❌ Error testing new branch: ${error}`, "red");
    return false;
  }
}

/**
 * Test gwtremove command
 */
async function testGwtremove() {
  printSection("Testing gwtremove");

  try {
    // Start from the new-feature worktree
    cd(join(TEST_REPO_PATH, "new-feature"));

    // Test force remove (non-interactive) and capture output
    const removeOutput = await $`pnpx tsx ${SCRIPTS_PATH}/src/git-worktree-remove.ts --force`;

    // Verify worktree directory was removed
    const worktreeExists = existsSync(join(TEST_REPO_PATH, "new-feature"));
    printResult("Worktree directory removed", !worktreeExists);

    // Verify git worktree list doesn't show the removed worktree
    cd(TEST_REPO_PATH);
    const worktreeList = await $`git worktree list`;
    const hasWorktree = worktreeList.stdout.includes("new-feature");
    printResult("Worktree unregistered from git", !hasWorktree);

    // Verify the TypeScript script outputs the correct path for shell wrapper
    const outputsPath = removeOutput.stdout.includes("WORKTREE_PATH:");
    printResult("Outputs path for shell wrapper", outputsPath);

    // Verify the removal process completed successfully
    const isRemovalSuccessful = !worktreeExists && !hasWorktree;
    printResult("Worktree removal completed successfully", isRemovalSuccessful);

    return true;
  } catch (error) {
    print(`❌ Error testing gwtremove: ${error}`, "red");
    return false;
  }
}

/**
 * Test worktree workflow end-to-end
 */
async function testWorkflow() {
  printSection("Testing complete workflow");

  cd(TEST_REPO_PATH);

  try {
    // Create worktree
    await $`pnpx tsx ${SCRIPTS_PATH}/src/git-worktree-add.ts workflow-test`;

    // Make changes in the worktree
    cd(join(TEST_REPO_PATH, "workflow-test"));
    await $`echo "Workflow test content" > workflow.txt`;
    await $`git add workflow.txt`;
    await $`git commit -m "Add workflow test file"`;

    // Verify commit was made
    const log = await $`git log --oneline -n 1`;
    const hasCommit = log.stdout.includes("Add workflow test file");
    printResult("Can make commits in worktree", hasCommit);

    // Remove the worktree
    await $`pnpx tsx ${SCRIPTS_PATH}/src/git-worktree-remove.ts --force`;

    // Verify the branch still exists (even though worktree is gone)
    cd(TEST_REPO_PATH);
    const branches = await $`git branch`;
    const branchExists = branches.stdout.includes("workflow-test");
    printResult("Branch preserved after worktree removal", branchExists);

    return true;
  } catch (error) {
    print(`❌ Error testing workflow: ${error}`, "red");
    return false;
  }
}

/**
 * Show final repository state
 */
async function showFinalState() {
  printSection("Final repository state");

  cd(TEST_REPO_PATH);

  try {
    print("📋 Git worktree list:", "blue");
    const worktreeList = await $`git worktree list`;
    console.log(worktreeList.stdout);

    print("🌿 Git branches:", "blue");
    const branches = await $`git branch -a`;
    console.log(branches.stdout);

    print("📁 Directory structure:", "blue");
    const dirs = await $`find . -maxdepth 1 -type d | sort`;
    console.log(dirs.stdout);
  } catch (error) {
    print(`Error showing final state: ${error}`, "red");
  }
}

/**
 * Main test function
 */
async function main() {
  print("🧪 Starting Git Worktree Tests", "bold");
  print(`📍 Test location: ${TEST_REPO_PATH}`, "blue");
  print(`🔧 Scripts location: ${SCRIPTS_PATH}`, "blue");

  const testResults: boolean[] = [];

  try {
    // Setup
    await setupTestRepo();

    // Run tests
    testResults.push(await testGwtaddExistingBranch());
    testResults.push(await testGwtaddNewBranch());
    testResults.push(await testGwtremove());
    testResults.push(await testWorkflow());

    // Show final state
    await showFinalState();

    // Summary
    printSection("Test Summary");
    const passed = testResults.filter((r) => r).length;
    const total = testResults.length;

    if (passed === total) {
      print(`🎉 All tests passed! (${passed}/${total})`, "green");
    } else {
      print(`⚠️  Some tests failed: ${passed}/${total} passed`, "yellow");
    }

    print("\n💡 To explore the test repository:", "blue");
    print(`   cd ${TEST_REPO_PATH}`, "blue");
    print("💡 To clean up:", "blue");
    print(`   rm -rf ${TEST_REPO_PATH}`, "blue");
  } catch (error) {
    print(`❌ Test execution failed: ${error}`, "red");
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on("SIGINT", async () => {
  print("\n🛑 Tests interrupted, cleaning up...", "yellow");
  await cleanup();
  process.exit(0);
});

// Run tests
main().catch((error) => {
  print(`💥 Unexpected error: ${error}`, "red");
  process.exit(1);
});
