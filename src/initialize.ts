#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

async function main() {
  const zshrcPath = join(homedir(), ".zshrc");
  const scriptPath = join(process.cwd(), "src/bash-functionality.sh");

  console.log("💫 Initializing @mikko/scripts...");

  // Check if bash-functionality.sh exists
  if (!existsSync(scriptPath)) {
    console.error("L Error: src/bash-functionality.sh not found");
    process.exit(1);
  }

  // Read current .zshrc content
  let zshrcContent = "";
  if (existsSync(zshrcPath)) {
    zshrcContent = readFileSync(zshrcPath, "utf8");
  }

  // Check if already sourced
  const sourceCommand = `source "${scriptPath}"`;
  const commentLine = "# @mikko/scripts bash functionality";

  if (zshrcContent.includes(sourceCommand)) {
    console.log("⚠️ bash-functionality.sh already sourced in ~/.zshrc");
    return;
  }

  // Add source command to .zshrc
  const newContent = `${
    zshrcContent + (zshrcContent.endsWith("\n") ? "" : "\n")
  }\n${commentLine}\n${sourceCommand}\n`;

  writeFileSync(zshrcPath, newContent);
  console.log("✅ Added bash-functionality.sh to ~/.zshrc");
  console.log(
    "=� Run `source ~/.zshrc` or restart your terminal to load the functions"
  );
}

main().catch((error) => {
  console.error("L Error:", error.message);
  process.exit(1);
});
