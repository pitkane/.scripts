# Personal Scripts Collection

🚧 **Work in Progress** 🚧

A collection of my personal scripts and utilities for productivity and development workflow automation.

## Current Scripts

### Git Worktree Management
Scripts that make working with Git worktrees simple and intuitive.

#### What are Git Worktrees?

Git worktrees allow you to have multiple working directories from the same Git repository. Instead of switching branches and losing your current work, you can have different branches checked out in separate folders simultaneously.

**Traditional workflow:**

```bash
# You have to switch branches, losing current work context
git checkout feature-branch
# work on feature
git checkout main
# work on main
```

**With worktrees:**

```bash
# Each branch has its own folder - work on multiple branches simultaneously!
/my-project/main     <- main branch
/my-project/feature  <- feature branch
/my-project/hotfix   <- hotfix branch
```

#### Installation

1. Clone this repository to your preferred location (e.g., `~/.scripts`)
2. Install dependencies:
   ```bash
   cd ~/.scripts
   pnpm install
   ```
3. Add the shell functions to your shell configuration:
   ```bash
   # Add this line to your ~/.zshrc or ~/.bashrc
   source ~/.scripts/src/bash-functionality.sh
   ```
4. Reload your shell:
   ```bash
   source ~/.zshrc  # or source ~/.bashrc
   ```

#### Commands

##### `gwtadd <branch-name>`

Creates a new worktree for the specified branch.

**Examples:**

```bash
# Create worktree for existing branch
gwtadd feature-login

# Create worktree and new branch (if branch doesn't exist)
gwtadd new-feature
```

**What it does:**

- Creates a new folder with the branch name
- Checks out the branch in that folder
- Automatically changes your terminal to the new folder
- If the branch doesn't exist, creates it from the main branch

##### `gwtremove`

Removes the current worktree and switches back to the main branch folder.

**Examples:**

```bash
# From inside a worktree folder
gwtremove

# Force remove without confirmation
gwtremove --force
```

**What it does:**

- Confirms you want to remove the current worktree
- Switches to the main branch before removal (to avoid conflicts)
- Removes the worktree folder and git references
- Changes your terminal to the main branch folder

#### Quick Start Guide

##### First Time Setup

1. Navigate to your existing Git repository:

   ```bash
   cd /path/to/your/project
   ```

2. Create your first worktree:

   ```bash
   gwtadd feature-branch
   ```

   This creates `/path/to/your/project/feature-branch/` and switches you there.

3. Work on your feature branch normally:

   ```bash
   # You're now in the feature-branch folder
   # Make changes, commit, push as usual
   git add .
   git commit -m "Add new feature"
   git push
   ```

4. Need to quickly check the main branch? Open a new terminal tab:
   ```bash
   cd /path/to/your/project/main  # or whatever your main branch is called
   # You can work here while keeping your feature branch work intact
   ```

##### Daily Workflow

```bash
# Start working on a new feature
gwtadd user-authentication
# Terminal automatically switches to the new folder

# Work on the feature...
# When done, remove the worktree
gwtremove
# Terminal switches back to main branch folder
```

#### Development

##### Available Scripts

```bash
# Type check all TypeScript files
pnpm typecheck

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

##### How It Works

The scripts use a hybrid approach:

- **Shell functions** (`bash-functionality.sh`) provide seamless shell integration
- **TypeScript scripts** handle the complex Git operations
- **Tab completion** makes branch names easy to discover and select
