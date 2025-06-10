# Boomerang MCP Server

MCP server implementing Boomerang Tasks workflow orchestration inspired by Roo Code's features.

## Features

- **Task Analysis**: Automatically analyzes task complexity and suggests breakdown into subtasks
- **Context Isolation**: Each subtask runs in isolated context preventing context poisoning
- **Workflow Orchestration**: Manages complete lifecycle from analysis to result merging
- **Progress Tracking**: Real-time monitoring of task and subtask progress
- **Result Aggregation**: Intelligent merging of subtask results with recommendations

## Tools

### `boomerang_analyze_task`
Analyzes a complex task and suggests breaking it into subtasks.

**Input:**
- `description` (string): Task description to analyze
- `projectContext` (object, optional): Project context and constraints

**Output:**
- Task analysis with complexity score and subtask suggestions

### `boomerang_create_subtask`
Creates a new subtask from the analysis.

**Input:**
- `parentTaskId` (string): ID of the parent task
- `subtaskConfig` (object): Subtask configuration (title, description, type, priority)
- `contextToPass` (object, optional): Context data to pass to subtask

**Output:**
- Created subtask with isolated context

### `boomerang_execute_subtask`
Executes a subtask in isolation.

**Input:**
- `subtaskId` (string): ID of subtask to execute
- `executionMode` (string, optional): 'simulation' or 'real' (default: simulation)

**Output:**
- Execution results with summary

### `boomerang_get_subtask_status`
Gets current status of a subtask.

**Input:**
- `subtaskId` (string): ID of the subtask

**Output:**
- Current status and progress information

### `boomerang_merge_results`
Merges results from completed subtasks.

**Input:**
- `parentTaskId` (string): ID of the parent task

**Output:**
- Merged results with final summary and recommendations

### `boomerang_get_task_progress`
Gets overall progress of a parent task.

**Input:**
- `parentTaskId` (string): ID of the parent task

**Output:**
- Overall progress with subtask statuses

## Installation

```bash
npm install
```

## Usage

### As MCP Server
```bash
node server.js
```

### Testing
```bash
npm test
```

## Architecture

```
boomerang-mcp-server/
├── server.js              # Main MCP server
├── tools/
│   ├── orchestrator.js     # Task analysis & decomposition
│   ├── subtask-manager.js  # Subtask lifecycle management
│   └── results-merger.js   # Results aggregation
├── utils/
│   ├── storage.js          # File-based storage system
│   └── context-isolation.js # Context isolation utilities
└── storage/
    ├── tasks/              # Individual task files
    └── contexts/           # Isolated context snapshots
```

## Key Principles

1. **Context Isolation**: Each subtask has its own isolated context
2. **Explicit Information Passing**: Data is explicitly passed between tasks
3. **Workflow Orchestration**: Complete task lifecycle management
4. **Auditability**: Full trace of all tasks and context transfers

## Example Workflow

1. **Analyze**: `boomerang_analyze_task` - Analyze complex task
2. **Create**: `boomerang_create_subtask` - Create subtasks with isolated contexts
3. **Execute**: `boomerang_execute_subtask` - Execute each subtask independently
4. **Monitor**: `boomerang_get_task_progress` - Track overall progress
5. **Merge**: `boomerang_merge_results` - Combine results and generate final summary

## Testing Results

✅ All tests passing:
- Basic Workflow: Complex task breakdown and execution
- Simple Task: Correctly identifies simple tasks that don't need breakdown
- Context Isolation: Proper isolation and data passing between contexts

## License

MIT