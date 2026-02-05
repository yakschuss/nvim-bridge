# nvim-bridge

Bidirectional bridge between [Claude Code](https://claude.ai/claude-code) and Neovim. Every file Claude edits automatically opens in your editor.

## Features

- **Auto-sync edits** - Files Claude edits instantly appear in Neovim
- **Read buffers** - Claude can see what you're working on
- **Navigate files** - Claude can open files at specific lines
- **Execute commands** - Run Vim/Lua commands from Claude

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jschuss/nvim-bridge/main/install.sh | bash
```

Then restart Claude Code.

## Usage

Start Neovim with a socket:

```bash
nvim --listen /tmp/nvim-$USER.sock myfile.py
```

Or add an alias to your shell config:

```bash
alias vim='nvim --listen /tmp/nvim-$USER.sock'
```

Now when Claude edits files, they automatically open in Neovim.

## What gets installed

| Location | Purpose |
|----------|---------|
| `~/.config/nvim-bridge/` | MCP server (Node.js) |
| `~/.claude/hooks/push-to-nvim.sh` | Auto-push hook |
| `~/.claude/settings.json` | Hook configuration |
| `~/.claude.json` | MCP server registration |

## MCP Tools

The bridge exposes these tools to Claude:

| Tool | Description |
|------|-------------|
| `nvim_get_buffer` | Read current buffer content |
| `nvim_set_buffer` | Write to buffer |
| `nvim_get_context` | Get editor state (file, cursor, diagnostics) |
| `nvim_navigate` | Open file at line/column |
| `nvim_execute` | Run Vim command or Lua code |
| `nvim_status` | Check if Neovim is connected |

## Requirements

- Node.js 18+
- Neovim 0.9+
- Claude Code CLI
- `jq` (for the hook)

## Uninstall

```bash
rm -rf ~/.config/nvim-bridge
rm ~/.claude/hooks/push-to-nvim.sh
# Manually remove the hook from ~/.claude/settings.json
# Manually remove nvim-bridge from ~/.claude.json mcpServers
```

## License

MIT
