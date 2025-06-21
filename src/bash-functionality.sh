#!/bin/zsh

# Git Worktree Management Scripts
# This file contains shell functions and completions for git worktree management

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
    
    # Call the TypeScript implementation and capture output
    local output
    output=$(pnpx tsx /Users/mikko/.scripts/src/git-worktree-add.ts "$@" 2>&1)
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
    # Get completion options from TypeScript script
    local completions
    completions=(${(f)"$(pnpx tsx /Users/mikko/.scripts/src/git-worktree-completion.ts 2>/dev/null)"})
    
    # Provide completions for the gwtadd command
    if [ ${#completions[@]} -gt 0 ]; then
        _describe 'worktree/branch' completions
    fi
}

# Register the completion function for the gwtadd command
# This tells zsh to use _gwtadd function when tab-completing gwtadd command
compdef _gwtadd gwtadd

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
    
    # Call the TypeScript implementation with proper TTY handling
    local output
    if [ -n "$force_flag" ]; then
        # Force mode - no interaction needed
        output=$(pnpx tsx /Users/mikko/.scripts/src/git-worktree-remove.ts $force_flag 2>&1)
    else
        # Interactive mode - run directly without capturing output first for prompts
        # The TypeScript script will handle changing to main repo before removal
        pnpx tsx /Users/mikko/.scripts/src/git-worktree-remove.ts
        local exit_code=$?
        
        # If successful, change to main repository in the shell
        if [ $exit_code -eq 0 ]; then
            # Get the main repository path
            local worktree_paths=$(git worktree list)
            local main_repo_path=$(echo "$worktree_paths" | awk '{print $1}' | awk 'length < length(shortest) || NR==1 {shortest=$0} END {print shortest}')
            
            if [ -d "$main_repo_path" ]; then
                cd "$main_repo_path"
            fi
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
    fi
}
