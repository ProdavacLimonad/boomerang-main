# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Run as MCP server (for integration with Claude Desktop or other MCP clients)
npm start
# or
node server.js

# Run tests to verify functionality
npm test
# or
node test.js

# CLI monitoring commands
chmod +x cli.js
npm run cli status              # Overall server status
npm run cli tasks --limit 20    # List recent tasks
npm run cli queue status        # Priority queue status
npm run cli cache stats         # Cache statistics
npm run cli health              # Health check
npm run cli logs --lines 100    # View logs
npm run cli cleanup --days 7    # Clean old files

# Environment variables for configuration
export BOOMERANG_LOG_LEVEL=info
export BOOMERANG_LOG_FILE=./storage/logs/boomerang.log
export BOOMERANG_MAX_CONCURRENT_TASKS=5
export BOOMERANG_WEBHOOK_SLACK_URL=https://hooks.slack.com/...
export BOOMERANG_WEBHOOK_DISCORD_URL=https://discord.com/api/webhooks/...
```

## High-Level Architecture

This is a Model Context Protocol (MCP) server implementing the Boomerang pattern for task orchestration. The key architectural principle is **context isolation** - complex tasks are broken down into subtasks that execute in isolated contexts, preventing context poisoning and ensuring focused execution.

### Core Workflow Pattern

1. **Task Analysis** (`orchestrator.js`): Analyzes task complexity and determines if decomposition is needed
2. **Subtask Creation** (`subtask-manager.js`): Creates isolated execution contexts for each subtask
3. **Priority Queue Processing**: Tasks are queued by priority (high/medium/low) with SLA monitoring
4. **Isolated Execution**: Each subtask runs with only its specific context data
5. **Result Merging** (`results-merger.js`): Aggregates results from all subtasks into coherent output

### Key Design Decisions

- **File-based Storage**: Uses simple JSON files in `./storage/` for persistence (no external DB required)
- **Context Isolation**: Each subtask gets a fresh context with only explicitly passed data
- **Complexity Scoring**: Automatic assessment (1-10 scale) to determine if task breakdown is beneficial
- **Priority Queue System**: High/medium/low priority queues with SLA tracking and automatic cleanup
- **Comprehensive Logging**: Structured JSON logging with configurable levels (debug/info/warn/error)
- **Input Validation**: JSON Schema validation for all API endpoints using Joi
- **Retry Logic**: Exponential backoff with jitter for failed operations
- **Caching**: LRU cache with TTL for repeated task results
- **Webhook Notifications**: Real-time notifications to Slack, Discord, Teams
- **Production Ready**: CLI monitoring, health checks, metrics, and cleanup utilities
- **Simulation Mode**: Default execution mode for testing without side effects

### Enhanced MCP Tools (Roo Code Boomerang Features)

The server exposes enhanced tools with Roo Code functionality:

#### Core Boomerang Tools:
- `boomerang_analyze_task`: Entry point for any complex task with automatic mode selection
- `boomerang_create_subtask`: Creates subtasks with specialized modes and approval workflow
- `boomerang_execute_subtask`: Executes in simulation or real mode with context isolation
- `boomerang_get_subtask_status`: Enhanced progress monitoring with mode info and navigation
- `boomerang_merge_results`: Combines subtask outputs with upward context flow
- `boomerang_get_task_progress`: Overall task completion status with detailed breakdown

#### Enhanced Features:
- **🎯 Automatic Mode Selection**: System intelligently chooses optimal mode (Code, Architect, Debug, Test, Review, Docs)
- **✅ Smart Approval System**: Auto-approval for low-risk tasks, manual review for high-impact changes
- **📊 Context Flow Management**: Explicit downward/upward context passing between parent/child tasks
- **🔄 Task Navigation**: Navigate between parent, child, and sibling tasks with validation
- **💬 Conversation History**: Complete conversation tracking per subtask with mode context
- **🔧 Bulk Operations**: Batch approval, mode changes, and priority adjustments
- **📈 Enhanced Monitoring**: Real-time tracking of modes, approvals, and workflow progress

### Understanding the Context Flow

Context isolation is the core innovation. When a subtask is created:
1. Parent task context is NOT automatically inherited
2. Only explicitly passed data (`contextToPass` parameter) is available
3. Each subtask maintains its own isolated state in `storage/contexts/`
4. Results must be explicitly merged back to parent

This prevents large language models from being overwhelmed by irrelevant context and ensures focused, accurate subtask execution.

### Production Features

#### Logging System (`utils/logger.js`)
- **Structured JSON logging** with timestamp, level, message, and metadata
- **Configurable levels**: debug, info, warn, error
- **Multiple outputs**: console (pretty formatted) and file (JSON)
- **Environment variables**: `BOOMERANG_LOG_LEVEL`, `BOOMERANG_LOG_FILE`

#### Input Validation (`utils/validator.js`)
- **JSON Schema validation** using Joi for all API endpoints
- **Comprehensive schemas** for task analysis, subtask creation, execution
- **Detailed error messages** for invalid input parameters

#### Retry Logic (`utils/retry.js`)
- **Exponential backoff** with configurable base delay and max attempts
- **Jitter support** to prevent thundering herd
- **Context preservation** and detailed error logging
- **Configurable per operation** with override options

#### Caching System (`utils/cache.js`)
- **LRU cache** with automatic TTL management
- **Hit/miss statistics** and performance metrics
- **Automatic cleanup** of expired entries
- **Singleton pattern** for consistent access across components

#### Priority Queue (`utils/priority-queue.js`)
- **Three priority levels**: high (30s SLA), medium (2min SLA), low (10min SLA)
- **SLA monitoring** with violation tracking and alerting
- **Automatic cleanup** of expired tasks
- **Comprehensive statistics** and throughput metrics

#### Webhook Notifications (`utils/webhooks.js`)
- **Multi-platform support**: Slack, Discord, Microsoft Teams
- **Rich formatting** with colors, emojis, and structured data
- **Error handling** with retry logic for failed deliveries
- **Configurable via environment variables**

#### CLI Monitoring (`cli.js`)
- **Comprehensive monitoring** with status, tasks, queue, cache commands
- **Health checks** for storage, logs, and cache systems
- **Log viewing** with filtering by level and follow mode
- **Cleanup utilities** for old files and maintenance

#### Production Utilities
- **Health check endpoint** (`/health`) for load balancers
- **Secure ID generation** using crypto.randomBytes()
- **Directory auto-creation** with race condition protection
- **Graceful error handling** throughout the application

## 🔴 HLAVNÍ PRIORITA - Enhanced Boomerang Workflow
- **Používej Boomerang pro úkoly se složitostí 2+ (jednoduché úkoly mají skóre 1)**: 
  1. Použij `mcp__sequential-thinking__sequentialthinking` k promyšlení úkolu
  2. 🪃 Analyzuj úkol pomocí `mcp__boomerang__boomerang_analyze_task` (vždy zobraz emoji 🪃 při použití Boomerang nástrojů)
  3. Nech systém vytvořit specializované podúkoly (pro úkoly se skóre 2+)
- **Výhody Enhanced Boomerang systému**:
  - 🪃 **Orchestrator Mode** - automaticky řídí celý workflow
  - 🏗️ **Specialized Modes** - Code, Architect, Debug, Test, Review, Docs
  - ✅ **Approval System** - automatické schvalování bezpečných úkolů
  - 📊 **Context Flow** - upward/downward context mezi parent/child taskami
  - 🔄 **Navigation** - bezpečný přechod mezi souvisejícími úkoly
  - 💬 **Conversation History** - kompletní historie pro každý podúkol
- **Kdy použít Boomerang**:
  - Úkoly se složitostí 2 a víše (complexity score 2-10)
  - Středně složité až komplexní projekty
  - Multi-step operace
  - Když úkol obsahuje klíčová slova jako: implement, create, build, test, deploy
  - Jednoduché úkoly (score 1) se provádí přímo bez Boomerang
- **Dostupné MCP servery pro integraci**:
  - `mcp__filesystem__` pro práci se soubory
  - `mcp__puppeteer__` pro web scraping a automatizaci
  - `mcp__brave-search__` pro vyhledávání informací
  - `mcp__context7__` pro dokumentaci knihoven

## Styl kódu
- Používej TypeScript pro všechny nové soubory
- Dodržuj existující konvence v projektu
- Preferuj funkcionální programování před OOP kde to dává smysl
- Používej async/await místo callbacků

## Názvy souborů a struktura
- Komponenty React: PascalCase (např. UserProfile.tsx)
- Utility funkce: camelCase (např. formatDate.ts)
- Konstanty: UPPER_SNAKE_CASE
- CSS moduly: kebab-case (např. user-profile.module.css)

## Komentáře a dokumentace
- Piš komentáře v češtině
- Dokumentuj složité algoritmy
- Přidávej JSDoc komentáře k veřejným funkcím

## Testování
- Před commitem spusť: `npm test`
- Před commitem spusť: `npm run lint` (pokud existuje)
- Před commitem spusť: `npm run typecheck` (pokud existuje)
- Pro monitoring a zdraví serveru: `npm run cli health`
- Pro vyčištění starých souborů: `npm run cli cleanup`

## Git konvence
- Commit zprávy v angličtině
- Používej conventional commits (feat:, fix:, docs:, etc.)
- Jeden commit = jedna logická změna

## Bezpečnost
- Nikdy neukládej API klíče nebo hesla do kódu
- Používej environment proměnné pro citlivé údaje
- Validuj všechny uživatelské vstupy

## Monitoring a Production
- Používej `npm run cli status` pro přehled serveru
- Sleduj logy pomocí `npm run cli logs --follow`
- Kontroluj prioritní frontu: `npm run cli queue status`
- Monitoruj cache výkon: `npm run cli cache stats`
- Nastav environment variables pro production:
  - `BOOMERANG_LOG_LEVEL=info` pro produkci
  - `BOOMERANG_MAX_CONCURRENT_TASKS=10` pro větší zátěž
  - Webhook URLs pro notifikace

## Enhanced Boomerang Workflow Examples

### Příklad typického workflow:
```bash
# 1. 🪃 Analyzuj komplexní úkol
🪃 mcp__boomerang__boomerang_analyze_task 
  "Vytvořit e-commerce web s autentizací, produkty a platby"

# 2. Systém automaticky vytvoří specializované podúkoly:
# - 🏗️ Database Architecture (Architect mode) - Manual approval required
# - 💻 Authentication System (Code mode) - Auto-approved  
# - 💻 Product Catalog (Code mode) - Auto-approved
# - 🧪 E2E Testing (Test mode) - Auto-approved

# 3. 🪃 Sleduj progress a naviguj mezi úkoly
🪃 mcp__boomerang__boomerang_get_task_progress <parent-task-id>

# 4. Výsledky se automaticky sloučí s upward context flow
```

### Kdy použít Enhanced Boomerang:
- ✅ **Úkoly se složitostí 2+** (complexity score 2-10)
- ✅ **Web development projekty** 
- ✅ **API development s testováním**  
- ✅ **Database design + implementace**
- ✅ **DevOps automation workflows**
- ✅ **Středně složité utility skripty** 
- ✅ **Komplexní bug fixy**
- ✅ **Větší práce s kódem**
- ❌ **NEPOUŽÍVAT pro trivilní úkoly (score 1)** - např. oprava překlepů, změna verze

## 🔧 MCP Integration Rules pro Enhanced Boomerang

### **MCP Tool Selection Matrix:**

| Boomerang Mode | Primary MCP Tools | Secondary Tools | Use Cases |
|----------------|-------------------|-----------------|-----------|
| 🪃 **Orchestrator** | `mcp__boomerang__*` | `mcp__sequential-thinking__` | Workflow coordination, task breakdown |
| 🏗️ **Architect** | `mcp__brave-search__`<br>`mcp__context7__` | `mcp__filesystem__` | Research best practices, get documentation, analyze existing code |
| 💻 **Code** | `mcp__filesystem__`<br>`mcp__context7__` | `mcp__brave-search__` | File operations, library docs, implementation patterns |
| 🐛 **Debug** | `mcp__filesystem__`<br>`mcp__puppeteer__` | `mcp__brave-search__` | Log analysis, reproduction, web debugging |
| 🧪 **Test** | `mcp__filesystem__`<br>`mcp__puppeteer__` | `mcp__context7__` | File creation, E2E testing, web automation |
| 👁️ **Review** | `mcp__filesystem__`<br>`mcp__brave-search__` | `mcp__context7__` | Code analysis, security research, standards lookup |
| 📚 **Docs** | `mcp__filesystem__`<br>`mcp__context7__` | `mcp__brave-search__` | Documentation creation, API reference, examples |

### **Tool Selection Algorithm:**
1. **Start with Boomerang analysis** - Always use `mcp__boomerang__boomerang_analyze_task` first
2. **Use mode-specific primary tools** - Based on automatically selected mode
3. **Add secondary tools as needed** - For additional functionality
4. **Apply fallback strategy** - If primary tool fails or unavailable

### **Specific Integration Rules:**

#### **🏗️ Architect Mode Protocol:**
```bash
1. mcp__brave_search__brave_web_search → research current best practices
2. mcp__context7__resolve_library_id → find relevant libraries  
3. mcp__context7__get_library_docs → get technical documentation
4. mcp__filesystem__read_file → analyze existing codebase (if applicable)
5. Generate architecture recommendations
```

#### **💻 Code Mode Protocol:**
```bash
1. mcp__filesystem__list_directory → survey project structure
2. mcp__context7__get_library_docs → get implementation docs
3. mcp__filesystem__read_multiple_files → read related files
4. mcp__filesystem__write_file OR mcp__filesystem__edit_file → implement code
5. mcp__filesystem__read_file → verify implementation
```

#### **🐛 Debug Mode Protocol:**
```bash
1. mcp__filesystem__read_file → read error logs/stack traces
2. mcp__filesystem__search_files → find related code patterns
3. mcp__puppeteer__navigate + screenshot → reproduce web issues (if applicable)
4. mcp__brave_search__brave_web_search → research similar issues
5. mcp__filesystem__edit_file → apply fixes
```

#### **🧪 Test Mode Protocol:**
```bash
1. mcp__filesystem__read_file → analyze code to be tested
2. mcp__context7__get_library_docs → get testing framework docs
3. mcp__filesystem__write_file → create test files
4. mcp__puppeteer__* → perform E2E tests (for web apps)
5. mcp__filesystem__read_file → verify test results
```

### **Performance Optimization Rules:**
- **Batch filesystem operations** - Use `mcp__filesystem__read_multiple_files` instead of multiple single reads
- **Cache documentation lookups** - Store `mcp__context7__` results in subtask context
- **Minimize web searches** - Use `mcp__brave_search__` only when local resources insufficient
- **Parallelize independent calls** - Run multiple MCP tools concurrently when possible

### **Error Handling Strategy:**
```bash
# Primary tool unavailable → Use secondary
If mcp__context7__ fails → Use mcp__brave_search__ for documentation
If mcp__filesystem__ fails → Log error, continue with available tools
If mcp__puppeteer__ fails → Use mcp__brave_search__ for web research instead

# Complete MCP failure → Graceful degradation  
If all external MCP tools fail → Use internal Boomerang simulation mode
```

### **Context Passing Rules:**
- **Downward context** - Pass relevant MCP results from parent to child subtasks
- **Upward context** - Include MCP tool usage summary in subtask results
- **Sibling context** - Share MCP findings between related subtasks

## Další pravidla
- Při práci s databází vždy používej prepared statements
- Optimalizuj importy - odstraňuj nepoužité
- Preferuj named exports před default exports
- Používej retry logiku pro externí API calls
- Validuj všechny vstupy před zpracováním
- Loguj důležité akce pro debugging
- **Pro úkoly se složitostí 2+: Použij Enhanced Boomerang systém a zobraz emoji 🪃 při každém použití Boomerang nástroje**
- **Pro jednoduché úkoly (score 1): Proveď přímo bez Boomerang pattern**