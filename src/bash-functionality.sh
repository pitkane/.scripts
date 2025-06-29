#!/bin/zsh

# Git Worktree Management Scripts
# This file contains shell functions and completions for git worktree management

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" && pwd)"

# Function to detect package manager and return appropriate runner command
detect_package_manager() {
    # Check for pnpm-lock.yaml first (most specific)
    if [ -f "pnpm-lock.yaml" ]; then
        echo "pnpx"
        return
    fi
    
    # Check for package-lock.json (npm)
    if [ -f "package-lock.json" ]; then
        echo "npx"
        return
    fi
    
    # Check for yarn.lock
    if [ -f "yarn.lock" ]; then
        echo "yarn dlx"
        return
    fi
    
    # Check for bun.lockb
    if [ -f "bun.lockb" ]; then
        echo "bunx"
        return
    fi
    
    # Default to npx if no lock files found
    echo "npx"
}

# Unalias any existing gwtadd command to avoid conflicts
unalias gwtadd 2>/dev/null

# Git worktree add function - TypeScript wrapper
# This function calls the TypeScript implementation while preserving 
# shell integration features like tab completion and directory context
gwtadd() {
    # Check if we have arguments
    if [ $# -eq 0 ]; then
        echo "Usage: gwtadd <branch-name>"
        return 1
    fi

    # Store the current directory to return to if the TypeScript script fails
    original_dir=$(pwd)
    
    # Detect package manager and get appropriate runner
    local package_runner
    package_runner=$(detect_package_manager)
    
    # Call the TypeScript implementation and capture output
    local output
    output=$($package_runner tsx "$SCRIPT_DIR/git-worktree-add.ts" "$@" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        # Extract the worktree path from the output
        local worktree_path
        worktree_path=$(echo "$output" | grep "^WORKTREE_PATH:" | cut -d: -f2-)
        
        # Show output without the WORKTREE_PATH line
        filtered_output=$(echo "$output" | grep -v "^WORKTREE_PATH:")
        if [ -n "$filtered_output" ]; then
            echo "$filtered_output"
        fi
        
        # Change to the worktree directory if path was provided
        if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
            cd "$worktree_path"
        fi
        
        return 0
    else
        # TypeScript script failed - show error and return to original directory
        echo "$output"
        cd "$original_dir"
        return 1
    fi
}

# Tab completion for gwtadd command
# Uses TypeScript implementation for intelligent completion
_gwtadd() {
    # Detect package manager and get appropriate runner
    local package_runner
    package_runner=$(detect_package_manager)
    
    # Get completion options from TypeScript script
    local completions
    completions=(${(f)"$($package_runner tsx "$SCRIPT_DIR/git-worktree-completion.ts" 2>/dev/null)"})
    
    # Provide completions for the gwtadd command
    if [ ${#completions[@]} -gt 0 ]; then
        _describe 'worktree/branch' completions
    fi
}

# Register the completion function for the gwtadd command
# This tells zsh to use _gwtadd function when tab-completing gwtadd command
compdef _gwtadd gwtadd

# Tab completion for gwtremove command
# Provides completion for existing worktrees and command flags
_gwtremove() {
    local context state line
    
    # Define the completion specification
    _arguments \
        '(-f --force)'{-f,--force}'[force removal without confirmation]' \
        '*::worktree:->worktrees'
    
    # Handle the worktrees context
    case $state in
        worktrees)
            # Get list of existing worktrees (excluding main worktree)
            local worktrees
            worktrees=($(git worktree list 2>/dev/null | awk 'NR>1 {print $1}' | xargs -I {} basename {} 2>/dev/null))
            
            # Provide completions for existing worktrees
            if [ ${#worktrees[@]} -gt 0 ]; then
                _describe 'existing worktrees' worktrees
            fi
            ;;
    esac
}

# Register the completion function for the gwtremove command
compdef _gwtremove gwtremove

# Git worktree remove function - TypeScript wrapper
# This function removes the current worktree and returns to main repository
gwtremove() {
    # Check for force flag
    local force_flag=""
    if [[ "$1" == "--force" ]] || [[ "$1" == "-f" ]]; then
        force_flag="--force"
    fi
    
    # Store the current directory to return to if the TypeScript script fails
    original_dir=$(pwd)
    
    # Detect package manager and get appropriate runner
    local package_runner
    package_runner=$(detect_package_manager)
    
    # Call the TypeScript implementation with proper TTY handling
    local output
    if [ -n "$force_flag" ]; then
        # Force mode - no interaction needed
        output=$($package_runner tsx "$SCRIPT_DIR/git-worktree-remove.ts" $force_flag 2>&1)
    else
        # Interactive mode - get main branch worktree path before removal
        local main_branch_path
        local worktree_list=$(git worktree list 2>/dev/null)
        if [ $? -eq 0 ]; then
            # Find the main branch (try dev, main, master in order)
            for branch in "dev" "main" "master"; do
                main_branch_path=$(echo "$worktree_list" | grep "\\[$branch\\]" | awk '{print $1}')
                if [ -n "$main_branch_path" ]; then
                    break
                fi
            done
            
            # If no main branch found, fall back to shortest path (main repo)
            if [ -z "$main_branch_path" ]; then
                main_branch_path=$(echo "$worktree_list" | awk '{print $1}' | awk 'length < length(shortest) || NR==1 {shortest=$0} END {print shortest}')
            fi
        fi
        
        # Run the TypeScript script directly for interactive prompts
        $package_runner tsx "$SCRIPT_DIR/git-worktree-remove.ts"
        local exit_code=$?
        
        # If successful and we have a main branch path, change to it
        if [ $exit_code -eq 0 ] && [ -n "$main_branch_path" ] && [ -d "$main_branch_path" ]; then
            cd "$main_branch_path"
        fi
        
        return $exit_code
    fi
    
    # Handle force mode results
    if [ -n "$force_flag" ]; then
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            # Extract the worktree path from the output
            local worktree_path
            worktree_path=$(echo "$output" | grep "^WORKTREE_PATH:" | cut -d: -f2-)
            
            # Show output without the WORKTREE_PATH line
            filtered_output=$(echo "$output" | grep -v "^WORKTREE_PATH:")
            if [ -n "$filtered_output" ]; then
                echo "$filtered_output"
            fi
            
            # Try to find main branch worktree instead of just using the provided path
            local main_branch_path
            local worktree_list=$(git worktree list 2>/dev/null)
            if [ $? -eq 0 ]; then
                # Find the main branch (try dev, main, master in order)
                for branch in "dev" "main" "master"; do
                    main_branch_path=$(echo "$worktree_list" | grep "\\[$branch\\]" | awk '{print $1}')
                    if [ -n "$main_branch_path" ]; then
                        break
                    fi
                done
                
                # If no main branch found, use the provided worktree path
                if [ -z "$main_branch_path" ]; then
                    main_branch_path="$worktree_path"
                fi
            else
                main_branch_path="$worktree_path"
            fi
            
            # Change to the main branch worktree directory
            if [ -n "$main_branch_path" ] && [ -d "$main_branch_path" ]; then
                cd "$main_branch_path"
            fi
            
            return 0
        else
            # TypeScript script failed - show error and return to original directory
            echo "$output"
            cd "$original_dir"
            return 1
        fi
    fi
}
