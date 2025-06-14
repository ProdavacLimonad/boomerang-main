# 🪃 Rychlé opravy pro okamžité zlepšení

## 1. Orchestrator - VŽDY používat Boomerang

**Soubor**: `tools/orchestrator.js`
**Řádek**: ~31

```javascript
// PŘED:
if (complexity.score < 3) {
  return {
    complexity: complexity.score,
    shouldBreakDown: false,
    // ...
  };
}

// PO:
// Odstraň celou podmínku nebo změň na:
// VŽDY rozdělit úkol podle CLAUDE.md
return {
  complexity: complexity.score,
  shouldBreakDown: true, // VŽDY true
  reason: `🪃 Task complexity score: ${complexity.score}/10. Using Boomerang pattern for optimal execution.`,
  suggestedSubtasks: subtasks,
  estimatedTime: this.estimateTime(subtasks)
};
```

## 2. Server - Přidat emoji do odpovědí

**Soubor**: `server.js`
**Každý handler** (~řádky 80, 110, 140, atd.)

```javascript
// Příklad pro handleAnalyzeTask:
return {
  status: 'success',
  emoji: '🪃',
  message: '🪃 Task analyzed using Boomerang pattern',
  analysis,
  timestamp: new Date().toISOString()
};
```

## 3. Orchestrator - Přidat getTaskProgress

**Soubor**: `tools/orchestrator.js`
**Na konec třídy**:

```javascript
async getTaskProgress(taskId) {
  const task = await this.storage.loadTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  const subtaskProgresses = await Promise.all(
    (task.subtasks || []).map(async (subtaskId) => {
      const subtask = await this.storage.loadTask(subtaskId);
      return {
        id: subtaskId,
        title: subtask?.title || 'Unknown',
        status: subtask?.status || 'unknown',
        mode: subtask?.mode?.name || 'N/A',
        progress: subtask?.status === 'completed' ? 100 : 
                 subtask?.status === 'executing' ? 50 : 
                 subtask?.status === 'approved' ? 25 : 0
      };
    })
  );
  
  const totalProgress = subtaskProgresses.length > 0 
    ? subtaskProgresses.reduce((sum, st) => sum + st.progress, 0) / subtaskProgresses.length
    : 0;
  
  return {
    emoji: '🪃',
    taskId,
    description: task.description,
    status: task.status,
    totalProgress: Math.round(totalProgress),
    subtasks: subtaskProgresses,
    createdAt: task.createdAt
  };
}
```

## 4. SubtaskManager - Optimalizovat auto-approval

**Soubor**: `tools/subtask-manager.js`
**Řádek**: ~145

```javascript
// Lepší výchozí pravidla pro auto-approval
const autoApprovalRules = {
  maxImpact: options.maxImpact || 
    (subtask.mode.id === 'docs' ? 'high' : 'medium'),
  allowedModes: options.allowedModes || 
    ['code', 'test', 'docs', 'debug'], // Přidat debug
  maxEstimatedTime: options.maxEstimatedTime || 
    (subtask.mode.id === 'test' ? 120 : 60),
  requiresManualReview: options.requiresManualReview || 
    (subtask.mode.id === 'architect') // Architect vždy manual
};
```

## 5. Orchestrator - Integrace módů

**Soubor**: `tools/orchestrator.js`
**Import na začátek**:

```javascript
import { SubtaskModes } from './subtask-modes.js';
```

**Upravit suggestSubtasks** (~řádek 90):

```javascript
// V každém subtasku přidat suggestedMode
subtasks.push({
  title: "Design and Planning",
  description: "Analyze requirements and create implementation plan",
  type: "design",
  priority: "high",
  estimatedDuration: "15-30 minutes",
  suggestedMode: SubtaskModes.selectBestMode(
    "Analyze requirements and create implementation plan", 
    "design"
  )
});
```

Tyto rychlé opravy zajistí, že server bude fungovat více jako Roo Code Boomerang mode bez nutnosti rozsáhlého refaktoringu.