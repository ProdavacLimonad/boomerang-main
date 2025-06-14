# Universal Enhanced Boomerang Rules

Copy this file to any project as `CLAUDE.md` to enable Enhanced Boomerang workflow.

## 🔴 MANDATORY - Enhanced Boomerang Workflow for ALL Projects

### **Core Rule: Always Use Boomerang for Complex Tasks**
- **For ANY task with complexity ≥ 3**: Use Enhanced Boomerang system
- **Workflow**: `sequential-thinking` → `boomerang_analyze_task` → Auto-mode selection → Execute

### **When to Use Enhanced Boomerang:**
- ✅ **Web development** (React, Vue, Angular, Next.js)
- ✅ **API development** (REST, GraphQL, microservices)
- ✅ **Database work** (schema design, migrations, queries)
- ✅ **DevOps tasks** (CI/CD, deployment, monitoring)
- ✅ **Testing suites** (unit, integration, E2E)
- ✅ **Code refactoring** (large-scale changes)
- ✅ **Documentation projects** (API docs, guides)
- ❌ **Simple scripts** (< 50 lines, single purpose)
- ❌ **Quick bug fixes** (1-2 line changes)

## 🎯 Enhanced Boomerang Modes & MCP Integration

### **Automatic Mode Selection:**
The system intelligently chooses the optimal mode based on task description:

| Mode | Triggers | MCP Tools Used | Output |
|------|----------|----------------|---------|
| 🪃 **Orchestrator** | Complex multi-step tasks | `boomerang_*`, `sequential-thinking` | Workflow plan |
| 🏗️ **Architect** | "design", "architecture", "structure" | `brave-search`, `context7`, `filesystem` | Architecture docs |
| 💻 **Code** | "implement", "create", "build" | `filesystem`, `context7`, `brave-search` | Working code |
| 🐛 **Debug** | "error", "bug", "issue", "problem" | `filesystem`, `puppeteer`, `brave-search` | Problem resolution |
| 🧪 **Test** | "test", "testing", "coverage" | `filesystem`, `puppeteer`, `context7` | Test suite |
| 👁️ **Review** | "review", "audit", "check" | `filesystem`, `brave-search`, `context7` | Review report |
| 📚 **Docs** | "document", "documentation" | `filesystem`, `context7`, `brave-search` | Documentation |

### **MCP Tool Usage Protocol:**

#### **🏗️ Architect Mode Standard Flow:**
```
1. brave_search → Research best practices for [technology]
2. context7 → Get official documentation for [framework]
3. filesystem → Analyze existing project structure
4. Generate architecture recommendations with rationale
```

#### **💻 Code Mode Standard Flow:**
```
1. filesystem → Survey project structure and conventions
2. context7 → Get implementation documentation
3. filesystem → Read related existing code
4. filesystem → Write/edit implementation files
5. filesystem → Verify implementation
```

#### **🐛 Debug Mode Standard Flow:**
```
1. filesystem → Read error logs and stack traces
2. filesystem → Search for related code patterns
3. puppeteer → Reproduce web issues (if applicable)
4. brave_search → Research known solutions
5. filesystem → Apply and test fixes
```

#### **🧪 Test Mode Standard Flow:**
```
1. filesystem → Analyze code to be tested
2. context7 → Get testing framework documentation
3. filesystem → Create comprehensive test files
4. puppeteer → Run E2E tests (for web applications)
5. filesystem → Verify test coverage and results
```

## 🔧 Performance & Error Handling Rules

### **Optimization Standards:**
- **Batch filesystem operations**: Use `read_multiple_files` vs multiple single reads
- **Cache documentation**: Store `context7` results in subtask context
- **Minimize web searches**: Use `brave_search` only when local resources insufficient
- **Parallelize calls**: Run independent MCP tools concurrently

### **Error Handling Strategy:**
```
Primary tool fails → Use secondary tool
context7 unavailable → Use brave_search for documentation  
filesystem errors → Log and continue with available tools
puppeteer fails → Use brave_search for web research
All MCP tools fail → Use Boomerang simulation mode
```

## 📊 Approval & Context Flow

### **Auto-Approval Rules:**
- ✅ **Auto-approved**: Test mode, Docs mode, low-impact Code tasks
- ⏳ **Manual review**: Architect mode, high-impact Code, Debug with system changes
- 🔒 **Always manual**: Database migrations, production deployments, security changes

### **Context Flow:**
- **Downward**: Project context, requirements, constraints flow to subtasks
- **Upward**: Results, deliverables, next steps flow back to parent
- **Sibling**: Share relevant findings between related subtasks

## 🚀 Usage Examples

### **Example 1: Web Application Development**
```bash
Task: "Create full-stack e-commerce site with user auth, product catalog, and payments"
→ Boomerang analyzes: Complexity 8/10
→ Creates subtasks:
  - 🏗️ Database Architecture (manual approval)
  - 💻 Authentication System (auto-approved)
  - 💻 Product Catalog API (auto-approved)  
  - 💻 Payment Integration (manual approval)
  - 🧪 E2E Test Suite (auto-approved)
  - 📚 API Documentation (auto-approved)
```

### **Example 2: Bug Investigation**
```bash
Task: "Fix user login failing with 500 error"
→ Boomerang analyzes: Complexity 4/10
→ Creates subtasks:
  - 🐛 Log Analysis (auto-approved)
  - 🐛 Frontend Debugging (auto-approved)
  - 💻 Fix Implementation (auto-approved)
  - 🧪 Regression Testing (auto-approved)
```

## 📝 Project-Specific Configuration

### **Environment Variables (Optional):**
```bash
export BOOMERANG_LOG_LEVEL=info
export BOOMERANG_MAX_CONCURRENT_TASKS=5
export BOOMERANG_WEBHOOK_SLACK_URL=your_slack_webhook
```

### **Project Context Template:**
```json
{
  "framework": "Next.js|React|Vue|Angular|...",
  "database": "PostgreSQL|MySQL|MongoDB|...", 
  "testing": "Jest|Cypress|Playwright|...",
  "deployment": "Vercel|AWS|Docker|...",
  "requirements": ["responsive", "SEO", "accessibility"],
  "constraints": ["budget", "timeline", "performance"]
}
```

## ⚡ Quick Start Commands

```bash
# Start Enhanced Boomerang workflow for any complex task
mcp__sequential-thinking__sequentialthinking
mcp__boomerang__boomerang_analyze_task

# Monitor progress
mcp__boomerang__boomerang_get_task_progress

# Check subtask details  
mcp__boomerang__boomerang_get_subtask_status
```

---

## 🎯 Universal Principles

1. **Always start complex tasks with Boomerang analysis**
2. **Trust automatic mode selection** - system knows best tools for each task type
3. **Use approval system** - let system auto-approve safe tasks, review risky ones
4. **Leverage context flow** - pass relevant info between subtasks efficiently
5. **Monitor progress** - use built-in tools to track workflow status
6. **Follow MCP protocols** - each mode has optimized tool usage patterns

**Result**: Consistent, efficient, high-quality task execution across all projects! 🚀

---

*Copy this file as `CLAUDE.md` to any project root to enable Enhanced Boomerang workflow.*