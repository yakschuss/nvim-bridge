#!/bin/bash
# Auto-push edited files to Neovim after Claude edits them
# Part of nvim-bridge: https://github.com/yakschuss/nvim-bridge

FILE_PATH=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

nvim --server "/tmp/nvim-$USER.sock" --remote-send "<Esc>:edit $FILE_PATH<CR>" 2>/dev/null
exit 0
