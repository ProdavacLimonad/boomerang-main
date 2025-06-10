# 🪃 Boomerang MCP Server

[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready **Model Context Protocol (MCP) server** implementing the **Enhanced Boomerang Tasks** workflow orchestration system. Inspired by Roo Code's advanced task breakdown capabilities, this server provides intelligent task decomposition, context isolation, and specialized execution modes for complex software development projects.

## 🎯 Key Features

### 🪃 **Enhanced Boomerang Workflow**
- **Intelligent Task Analysis**: Automatic complexity assessment and breakdown recommendations
- **Specialized Execution Modes**: Code, Architect, Debug, Test, Review, Documentation modes
- **Smart Approval System**: Auto-approval for safe tasks, manual review for high-impact changes
- **Context Flow Management**: Explicit upward/downward context passing between tasks

### 🏗️ **Production-Ready Architecture**
- **Context Isolation**: Each subtask runs in isolated context preventing context poisoning
- **Priority Queue System**: High/medium/low priority queues with SLA monitoring
- **Comprehensive Logging**: Structured JSON logging with configurable levels
- **Webhook Notifications**: Real-time alerts to Slack, Discord, Teams
- **CLI Monitoring**: Health checks, metrics, and maintenance utilities
- **Retry Logic**: Exponential backoff with jitter for failed operations
- **LRU Caching**: Performance optimization with TTL management

### 🔧 **Developer Experience**
- **File-based Storage**: No external database required - uses simple JSON files
- **Input Validation**: JSON Schema validation for all API endpoints
- **Simulation Mode**: Default safe execution mode for testing
- **Task Navigation**: Navigate between parent, child, and sibling tasks
- **Conversation History**: Complete tracking per subtask with mode context

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd boomerang-main

# Install dependencies
npm install

# Start the MCP server
npm start
```

### Global Installation

```bash
# Install globally for system-wide access
npm run global-install

# Or use the install script
chmod +x install-global.sh
./install-global.sh
```

### Integration with Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "boomerang": {
      "command": "node",
      "args": ["/path/to/boomerang-main/server.js"]
    }
  }
}
```

## 💻 Usage Examples

### Basic Workflow

```javascript
// 1. Analyze a complex task
await boomerang_analyze_task({
  description: "Create a full-stack e-commerce application with authentication, product catalog, and payment processing",
  projectContext: {
    framework: "React + Node.js",
    database: "PostgreSQL",
    requirements: ["responsive design", "admin panel", "API documentation"]
  }
});

// 2. System automatically creates specialized subtasks:
// 🏗️ Architecture Design (Architect mode) - Manual approval required
// 💻 Authentication System (Code mode) - Auto-approved
// 💻 Product Catalog API (Code mode) - Auto-approved  
// 🧪 E2E Testing Suite (Test mode) - Auto-approved
// 📚 API Documentation (Docs mode) - Auto-approved

// 3. Monitor progress
await boomerang_get_task_progress({ taskId: "parent-task-id" });

// 4. Results automatically merge with upward context flow
await boomerang_merge_results({ taskId: "parent-task-id" });
```

### Advanced Features

```bash
# CLI monitoring and management
npm run cli status                    # Server overview
npm run cli tasks --limit 20          # Recent tasks
npm run cli queue status              # Priority queue metrics
npm run cli cache stats               # Cache performance
npm run cli health                    # Health check
npm run cli logs --follow --level info # Live log monitoring
npm run cli cleanup --days 7          # Maintenance cleanup
```

## 🛠️ MCP Tools Reference

### Core Workflow Tools

#### `boomerang_analyze_task`
Analyzes task complexity and suggests optimal breakdown strategy.

**Parameters:**
- `description` (string): Task description to analyze
- `projectContext` (object, optional): Project context and constraints

**Returns:** Task analysis with complexity score (1-10) and subtask recommendations

#### `boomerang_create_subtask` 
Creates specialized subtasks with automatic mode selection.

**Parameters:**
- `parentTaskId` (string): Parent task identifier
- `subtaskConfig` (object): Configuration with title, description, type, priority
- `contextToPass` (object, optional): Explicit context data for subtask

**Returns:** Created subtask with assigned mode and approval status

#### `boomerang_execute_subtask`
Executes subtask in isolated context with specified mode.

**Parameters:**
- `subtaskId` (string): Subtask identifier
- `executionMode` (string): `"simulation"` (default) or `"real"`

**Returns:** Execution results with mode-specific output format

#### `boomerang_get_subtask_status`
Retrieves detailed subtask status and progress.

**Parameters:**
- `subtaskId` (string): Subtask identifier

**Returns:** Status, progress, mode info, and navigation options

#### `boomerang_merge_results`
Combines subtask results into coherent final output.

**Parameters:**
- `taskId` (string): Parent task identifier

**Returns:** Merged results with executive summary and recommendations

#### `boomerang_get_task_progress`
Gets overall task completion status with detailed breakdown.

**Parameters:**
- `taskId` (string): Parent task identifier

**Returns:** Progress overview with all subtask statuses

## 🎭 Specialized Execution Modes

| Mode | Icon | Purpose | Auto-Approval | Context Requirements |
|------|------|---------|---------------|---------------------|
| **Orchestrator** | 🪃 | Workflow coordination and delegation | ✅ | Project overview, requirements |
| **Code** | 💻 | Implementation, refactoring, bug fixes | ✅ | Technical specs, existing codebase |
| **Architect** | 🏗️ | System design and architecture | ❌ | Business requirements, constraints |
| **Debug** | 🐛 | Issue investigation and resolution | ✅ | Error logs, reproduction steps |
| **Test** | 🧪 | Test creation and quality assurance | ✅ | Code to test, test requirements |
| **Review** | 👁️ | Code review and quality assessment | ✅ | Code to review, standards |
| **Documentation** | 📚 | Documentation and API reference | ✅ | Code structure, user requirements |

## 🏗️ Architecture Overview

```
boomerang-mcp-server/
├── 📁 server.js                   # Main MCP server entry point
├── 📁 cli.js                      # CLI monitoring and management
├── 📁 tools/
│   ├── orchestrator.js            # Task analysis & breakdown
│   ├── subtask-manager.js          # Subtask lifecycle management  
│   ├── results-merger.js           # Results aggregation
│   ├── task-executor.js            # Execution engine
│   ├── subtask-modes.js            # Specialized mode definitions
│   └── approval-system.js          # Approval workflow management
├── 📁 utils/
│   ├── storage.js                  # File-based storage system
│   ├── context-isolation.js        # Context isolation utilities
│   ├── logger.js                   # Structured JSON logging
│   ├── validator.js                # Input validation schemas
│   ├── cache.js                    # LRU cache with TTL
│   ├── priority-queue.js           # Priority queue with SLA monitoring
│   ├── retry.js                    # Exponential backoff retry logic
│   └── webhooks.js                 # Multi-platform notifications
└── 📁 storage/
    ├── tasks/                      # Individual task files
    ├── contexts/                   # Isolated context snapshots
    ├── approvals/                  # Approval requests and decisions
    └── logs/                       # Application logs
```

### Key Design Principles

1. **🔒 Context Isolation**: Each subtask operates in isolated context with explicit data passing
2. **🎯 Specialized Modes**: Different execution modes for different types of work
3. **✅ Smart Approval**: Automatic approval for safe operations, manual review for high-impact changes
4. **📊 Priority Management**: SLA-based priority queuing with automatic escalation
5. **🔄 Upward Context Flow**: Results and learnings flow back to parent tasks
6. **🛡️ Production Ready**: Comprehensive logging, monitoring, and error handling

## ⚙️ Configuration

### Environment Variables

```bash
# Logging configuration
export BOOMERANG_LOG_LEVEL=info              # debug, info, warn, error
export BOOMERANG_LOG_FILE=./storage/logs/boomerang.log

# Performance tuning
export BOOMERANG_MAX_CONCURRENT_TASKS=5      # Concurrent execution limit
export BOOMERANG_CACHE_TTL=3600              # Cache TTL in seconds
export BOOMERANG_CACHE_MAX_SIZE=1000         # Maximum cache entries

# Webhook notifications
export BOOMERANG_WEBHOOK_SLACK_URL=https://hooks.slack.com/...
export BOOMERANG_WEBHOOK_DISCORD_URL=https://discord.com/api/webhooks/...
export BOOMERANG_WEBHOOK_TEAMS_URL=https://outlook.office.com/webhook/...

# Priority queue SLA settings (seconds)
export BOOMERANG_SLA_HIGH=30                 # High priority SLA
export BOOMERANG_SLA_MEDIUM=120              # Medium priority SLA  
export BOOMERANG_SLA_LOW=600                 # Low priority SLA
```

### MCP Integration Scripts

```bash
# Install as MCP server for current user
npm run mcp:install

# Install globally for all users  
npm run mcp:install:global

# Remove MCP integration
npm run mcp:remove

# List all MCP servers
npm run mcp:list

# View MCP server logs
npm run mcp:logs
```

## 🧪 Testing

```bash
# Run comprehensive test suite
npm test

# Run specific test categories
npm run test:workflow          # Workflow orchestration tests
npm run test:isolation         # Context isolation tests  
npm run test:modes            # Specialized mode tests
npm run test:integration      # MCP integration tests

# Test with CLI monitoring
npm run cli health            # Health check
npm run cli status            # Overall status
```

## 🔍 Monitoring & Debugging

### Health Monitoring

```bash
# Comprehensive health check
npm run cli health

# Real-time status monitoring  
npm run cli status --watch

# View system metrics
npm run cli stats --detailed
```

### Log Analysis

```bash
# View recent logs
npm run cli logs --lines 100

# Follow logs in real-time
npm run cli logs --follow --level info

# Filter logs by component
npm run cli logs --component orchestrator --level debug
```

### Performance Metrics

```bash
# Cache performance
npm run cli cache stats

# Priority queue metrics
npm run cli queue status --detailed

# Task execution statistics
npm run cli tasks --analytics --days 7
```

## 🚨 Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check Node.js version (requires 18+)
node --version

# Verify dependencies
npm install

# Check storage permissions
ls -la ./storage/
```

**High memory usage:**
```bash
# Clear cache
npm run cli cache clear

# Clean old files
npm run cli cleanup --days 3

# Check task queue
npm run cli queue status
```

**Webhook notifications not working:**
```bash
# Test webhook URLs
npm run cli webhooks test

# Check environment variables
echo $BOOMERANG_WEBHOOK_SLACK_URL

# View webhook logs
npm run cli logs --component webhooks
```

### Performance Optimization

**For high-throughput scenarios:**
```bash
# Increase concurrent task limit
export BOOMERANG_MAX_CONCURRENT_TASKS=10

# Optimize cache settings
export BOOMERANG_CACHE_MAX_SIZE=5000
export BOOMERANG_CACHE_TTL=7200

# Enable debug logging temporarily
export BOOMERANG_LOG_LEVEL=debug
```

## 🤝 Contributing

### Development Guidelines

1. **Follow TypeScript conventions** for all new code
2. **Add comprehensive tests** for new features
3. **Update documentation** for API changes
4. **Use conventional commits** (feat:, fix:, docs:, etc.)
5. **Ensure all tests pass** before submitting PRs

### Development Commands

```bash
# Setup development environment
npm install
npm run setup-project

# Run in development mode with auto-reload
npm run dev

# Lint and format code  
npm run lint
npm run format

# Type checking
npm run typecheck

# Build for production
npm run build
```

### Adding New Modes

```javascript
// In tools/subtask-modes.js
static MODES = {
  NEW_MODE: {
    id: 'new_mode',
    name: '🔧 New Mode',
    description: 'Description of new mode capabilities',
    capabilities: ['capability1', 'capability2'],
    contextRequirements: ['required_context'],
    outputFormat: 'output_format'
  }
}
```

## 📈 Roadmap

- [ ] **Web Dashboard**: Browser-based monitoring and management interface
- [ ] **Plugin System**: Extensible architecture for custom modes and tools
- [ ] **Multi-language Support**: Python, Go, and Rust subtask execution
- [ ] **Distributed Execution**: Multi-node task distribution with load balancing
- [ ] **Advanced Analytics**: Machine learning-powered task optimization
- [ ] **Integration APIs**: REST and GraphQL APIs for external system integration

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol (MCP)** team for the excellent protocol specification
- **Roo Code** for inspiring the Boomerang Tasks workflow pattern
- **Claude AI** for development assistance and architectural guidance

---

## 🔗 Quick Links

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Integration Guide](https://docs.anthropic.com/claude/docs/mcp)
- [Issue Tracker](https://github.com/your-repo/boomerang-mcp-server/issues)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Development Setup](docs/DEVELOPMENT.md)

**Ready to boost your development workflow with intelligent task orchestration? Get started with Boomerang MCP Server today! 🚀**