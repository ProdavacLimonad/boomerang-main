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
```

## High-Level Architecture

This is a Model Context Protocol (MCP) server implementing the Boomerang pattern for task orchestration. The key architectural principle is **context isolation** - complex tasks are broken down into subtasks that execute in isolated contexts, preventing context poisoning and ensuring focused execution.

### Core Workflow Pattern

1. **Task Analysis** (`orchestrator.js`): Analyzes task complexity and determines if decomposition is needed
2. **Subtask Creation** (`subtask-manager.js`): Creates isolated execution contexts for each subtask
3. **Isolated Execution**: Each subtask runs with only its specific context data
4. **Result Merging** (`results-merger.js`): Aggregates results from all subtasks into coherent output

### Key Design Decisions

- **File-based Storage**: Uses simple JSON files in `./storage/` for persistence (no external DB required)
- **Context Isolation**: Each subtask gets a fresh context with only explicitly passed data
- **Complexity Scoring**: Automatic assessment (1-10 scale) to determine if task breakdown is beneficial
- **Simulation Mode**: Default execution mode for testing without side effects

### MCP Tools Exposed

The server exposes 6 tools through the MCP protocol:
- `boomerang_analyze_task`: Entry point for any complex task
- `boomerang_create_subtask`: Creates subtasks with isolated contexts
- `boomerang_execute_subtask`: Executes in simulation or real mode
- `boomerang_get_subtask_status`: Progress monitoring
- `boomerang_merge_results`: Combines subtask outputs
- `boomerang_get_task_progress`: Overall task completion status

### Understanding the Context Flow

Context isolation is the core innovation. When a subtask is created:
1. Parent task context is NOT automatically inherited
2. Only explicitly passed data (`contextToPass` parameter) is available
3. Each subtask maintains its own isolated state in `storage/contexts/`
4. Results must be explicitly merged back to parent

This prevents large language models from being overwhelmed by irrelevant context and ensures focused, accurate subtask execution.

## 🔴 HLAVNÍ PRIORITA - Zpracování úkolů a využití nástrojů
- **Při každém novém zadání**: Použij `mcp__sequential-thinking__sequentialthinking` k promyšlení úkolu
- **Při opravě chyb**: 
  1. Nejdřív použij `mcp__sequential-thinking__sequentialthinking` k analýze problému
  2. Poté zadej úkol do `mcp__boomerang__boomerang_analyze_task` pro rozdělení na podúkoly
- **Vždy promysli dostupné MCP servery**:
  - `mcp__filesystem__` pro práci se soubory
  - `mcp__puppeteer__` pro web scraping a automatizaci
  - `mcp__brave-search__` pro vyhledávání informací
  - `mcp__context7__` pro dokumentaci knihoven
  - Zvol nejvhodnější nástroje pro maximální efektivitu

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
- Před commitem spusť: `npm run lint`
- Před commitem spusť: `npm run typecheck`

## Git konvence
- Commit zprávy v angličtině
- Používej conventional commits (feat:, fix:, docs:, etc.)
- Jeden commit = jedna logická změna

## Bezpečnost
- Nikdy neukládej API klíče nebo hesla do kódu
- Používej environment proměnné pro citlivé údaje
- Validuj všechny uživatelské vstupy

## Další pravidla
- Při práci s databází vždy používej prepared statements
- Optimalizuj importy - odstraňuj nepoužité
- Preferuj named exports před default exports