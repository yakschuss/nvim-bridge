#!/bin/bash
set -e

echo "Installing nvim-bridge..."

# Config
INSTALL_DIR="$HOME/.config/nvim-bridge"
HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
CLAUDE_CONFIG="$HOME/.claude.json"
NVIM_PLUGIN_DIR="$HOME/.local/share/nvim/site/plugin"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  echo "Cloning nvim-bridge..."
  git clone --quiet https://github.com/yakschuss/nvim-bridge.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 2. Install dependencies and build
echo "Installing dependencies..."
npm install --silent
npm run build --silent

# 3. Install hook
echo "Installing hook..."
mkdir -p "$HOOKS_DIR"
cp "$INSTALL_DIR/hooks/push-to-nvim.sh" "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR/push-to-nvim.sh"

# 4. Install nvim plugin
echo "Installing Neovim plugin..."
mkdir -p "$NVIM_PLUGIN_DIR"
cp "$INSTALL_DIR/plugin/nvim-bridge.lua" "$NVIM_PLUGIN_DIR/"

# 5. Update settings.json with hook config
echo "Configuring Claude Code hooks..."
if [ -f "$SETTINGS_FILE" ]; then
  # Check if hooks already configured
  if grep -q '"PostToolUse"' "$SETTINGS_FILE" 2>/dev/null; then
    echo -e "${YELLOW}Hook config already exists in settings.json - skipping${NC}"
  else
    # Add hooks to existing settings
    TMP_FILE=$(mktemp)
    jq '. + {
      "hooks": {
        "PostToolUse": [
          {
            "matcher": "Edit|Write",
            "hooks": [
              {
                "type": "command",
                "command": "'"$HOOKS_DIR"'/push-to-nvim.sh"
              }
            ]
          }
        ]
      }
    }' "$SETTINGS_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$SETTINGS_FILE"
  fi
else
  # Create new settings file
  cat > "$SETTINGS_FILE" << EOF
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOKS_DIR/push-to-nvim.sh"
          }
        ]
      }
    ]
  }
}
EOF
fi

# 6. Register MCP server with Claude Code
echo "Registering MCP server..."
if [ -f "$CLAUDE_CONFIG" ]; then
  if grep -q '"nvim-bridge"' "$CLAUDE_CONFIG" 2>/dev/null; then
    echo -e "${YELLOW}MCP server already registered - skipping${NC}"
  else
    TMP_FILE=$(mktemp)
    jq '.mcpServers["nvim-bridge"] = {
      "command": "node",
      "args": ["'"$INSTALL_DIR"'/dist/index.js"]
    }' "$CLAUDE_CONFIG" > "$TMP_FILE" && mv "$TMP_FILE" "$CLAUDE_CONFIG"
  fi
else
  cat > "$CLAUDE_CONFIG" << EOF
{
  "mcpServers": {
    "nvim-bridge": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/index.js"]
    }
  }
}
EOF
fi

echo ""
echo -e "${GREEN}nvim-bridge installed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code"
echo "  2. Start Neovim with: nvim --listen /tmp/nvim-\$USER.sock <file>"
echo ""
echo "Tip: Add this alias to your shell config:"
echo "  alias vim='nvim --listen /tmp/nvim-\$USER.sock'"
