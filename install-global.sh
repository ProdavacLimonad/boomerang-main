#!/bin/bash

# Global Enhanced Boomerang Installation Script

echo "🚀 Installing Enhanced Boomerang Globally..."

# 1. Install as global MCP server
echo "📦 Installing Boomerang MCP Server..."
npm run global-install

# 2. Create global alias for project setup
echo "🔧 Creating global aliases..."
echo "" >> ~/.bashrc
echo "# Enhanced Boomerang Aliases" >> ~/.bashrc
echo "alias boomerang-setup='cp $PWD/UNIVERSAL_CLAUDE.md ./CLAUDE.md && echo \"✅ Enhanced Boomerang enabled in this project\"'" >> ~/.bashrc
echo "alias boomerang-server='node $PWD/server.js'" >> ~/.bashrc
echo "alias boomerang-status='node $PWD/cli.js status'" >> ~/.bashrc

# 3. Create system-wide template
sudo mkdir -p /usr/local/share/boomerang
sudo cp UNIVERSAL_CLAUDE.md /usr/local/share/boomerang/
sudo chmod 644 /usr/local/share/boomerang/UNIVERSAL_CLAUDE.md

# 4. Add to Claude Desktop config
CLAUDE_CONFIG="$HOME/.config/claude/claude_desktop_config.json"
if [ ! -f "$CLAUDE_CONFIG" ]; then
    mkdir -p "$HOME/.config/claude"
    echo '{"mcpServers": {}}' > "$CLAUDE_CONFIG"
fi

# Add Boomerang to Claude config (backup existing)
cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG.backup"
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
config.mcpServers.boomerang = {
    command: 'node',
    args: ['$PWD/server.js'],
    env: {
        BOOMERANG_LOG_LEVEL: 'info',
        BOOMERANG_MAX_CONCURRENT_TASKS: '10'
    }
};
fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
"

echo ""
echo "✅ Enhanced Boomerang installed globally!"
echo ""
echo "📋 Usage in any project:"
echo "  boomerang-setup     # Add CLAUDE.md to current project"
echo "  boomerang-server    # Start MCP server manually"
echo "  boomerang-status    # Check server status"
echo ""
echo "🔄 Restart Claude Desktop to activate MCP integration"
echo "💡 Then use boomerang-setup in any project directory"