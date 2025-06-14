#!/usr/bin/env node

import { Storage } from './utils/storage.js';
import { Orchestrator } from './tools/orchestrator.js';
import { SubtaskManager } from './tools/subtask-manager.js';
import { ResultsMerger } from './tools/results-merger.js';
import fs from 'fs/promises';

class BoomerangTester {
  constructor() {
    this.storage = new Storage('./storage');
    this.orchestrator = new Orchestrator(this.storage);
    this.subtaskManager = new SubtaskManager(this.storage);
    this.resultsMerger = new ResultsMerger(this.storage);
  }

  async setupTestEnvironment() {
    try {
      await fs.mkdir('./storage', { recursive: true });
      await fs.mkdir('./storage/tasks', { recursive: true });
      await fs.mkdir('./storage/contexts', { recursive: true });
      console.log('✅ Test environment setup complete');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error.message);
    }
  }

  async testBasicWorkflow() {
    console.log('\n🧪 Testing Basic Boomerang Workflow\n');

    try {
      // Test 1: Analyze a complex task
      console.log('1️⃣ Analyzing complex task...');
      const taskDescription = 'Create a new user authentication system with login, registration, password reset, and email verification features. Include comprehensive testing and deployment setup.';
      
      const analyzedTask = await this.orchestrator.analyzeTask(taskDescription, {
        framework: 'Node.js',
        database: 'PostgreSQL',
        environment: 'development'
      });

      console.log(`   Task ID: ${analyzedTask.id}`);
      console.log(`   Should break down: ${analyzedTask.analysis.shouldBreakDown}`);
      console.log(`   Complexity score: ${analyzedTask.analysis.complexity}/10`);
      console.log(`   Suggested subtasks: ${analyzedTask.analysis.suggestedSubtasks.length}`);

      if (!analyzedTask.analysis.shouldBreakDown) {
        console.log('❌ Task should have been flagged for breakdown');
        return false;
      }

      // Test 2: Create subtasks
      console.log('\n2️⃣ Creating subtasks...');
      const subtaskIds = [];
      
      for (const subtaskConfig of analyzedTask.analysis.suggestedSubtasks) {
        const subtask = await this.subtaskManager.createSubtask(
          analyzedTask.id,
          subtaskConfig,
          { parentDescription: taskDescription, framework: 'Node.js' }
        );
        subtaskIds.push(subtask.id);
        console.log(`   Created subtask: ${subtask.title} (${subtask.id})`);
      }

      // Test 3: Execute subtasks
      console.log('\n3️⃣ Executing subtasks...');
      for (const subtaskId of subtaskIds) {
        console.log(`   Executing subtask ${subtaskId}...`);
        const result = await this.subtaskManager.executeSubtask(subtaskId, 'simulation');
        console.log(`   Status: ${result.status}`);
        console.log(`   Key outputs: ${result.results.keyOutputs.length}`);
      }

      // Test 4: Check progress
      console.log('\n4️⃣ Checking task progress...');
      const progress = await this.resultsMerger.getTaskProgress(analyzedTask.id);
      console.log(`   Progress: ${progress.progressPercentage}%`);
      console.log(`   Completed: ${progress.completedSubtasks}/${progress.totalSubtasks}`);

      // Test 5: Merge results
      console.log('\n5️⃣ Merging subtask results...');
      const mergedResults = await this.resultsMerger.mergeSubtaskResults(analyzedTask.id);
      console.log(`   Final status: ${mergedResults.finalSummary.overallSuccess ? 'SUCCESS' : 'PARTIAL'}`);
      console.log(`   Total files affected: ${mergedResults.finalSummary.filesAffected}`);
      console.log(`   Key achievements: ${mergedResults.finalSummary.keyAchievements.length}`);

      console.log('\n✅ Basic workflow test completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Basic workflow test failed:', error.message);
      console.error(error.stack);
      return false;
    }
  }

  async testSimpleTask() {
    console.log('\n🧪 Testing Simple Task (Complexity Score 1 - Should NOT Break Down)\n');

    try {
      // Test jednoduchého úkolu se skóre 1
      const simpleTaskDescription = 'Fix typo';
      
      const analyzedTask = await this.orchestrator.analyzeTask(simpleTaskDescription);
      
      console.log(`   Task ID: ${analyzedTask.id}`);
      console.log(`   Description: "${simpleTaskDescription}"`);
      console.log(`   Should break down: ${analyzedTask.analysis.shouldBreakDown}`);
      console.log(`   Complexity score: ${analyzedTask.analysis.complexity}/10`);
      console.log(`   Reason: ${analyzedTask.analysis.reason}`);

      if (analyzedTask.analysis.shouldBreakDown) {
        console.log('❌ Simple task with score 1 should NOT be flagged for breakdown');
        return false;
      }

      console.log('✅ Simple task test completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Simple task test failed:', error.message);
      return false;
    }
  }

  async testMediumComplexityTask() {
    console.log('\n🎆 Testing Medium Complexity Task (Score 2+ - Should Break Down)\n');

    try {
      // Test úkolu se skóre 2
      const mediumTaskDescription = 'Update version number and create changelog';
      
      const analyzedTask = await this.orchestrator.analyzeTask(mediumTaskDescription);
      
      console.log(`   Task ID: ${analyzedTask.id}`);
      console.log(`   Description: "${mediumTaskDescription}"`);
      console.log(`   Should break down: ${analyzedTask.analysis.shouldBreakDown}`);
      console.log(`   Complexity score: ${analyzedTask.analysis.complexity}/10`);
      console.log(`   Reason: ${analyzedTask.analysis.reason}`);

      if (!analyzedTask.analysis.shouldBreakDown) {
        console.log('❌ Task with score 2+ should be flagged for breakdown');
        return false;
      }

      console.log('✅ Medium complexity task test completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Medium complexity task test failed:', error.message);
      return false;
    }
  }

  async testContextIsolation() {
    console.log('\n🧪 Testing Context Isolation\n');

    try {
      // Create a task with specific context
      const taskDescription = 'Implement a new API endpoint for user profile management';
      const analyzedTask = await this.orchestrator.analyzeTask(taskDescription, {
        apiVersion: 'v2',
        authentication: 'JWT',
        rateLimit: '100 req/min'
      });

      // Create subtask with context passing
      const subtaskConfig = {
        title: 'Design API Schema',
        description: 'Design the API schema for user profile endpoints',
        type: 'design',
        priority: 'high'
      };

      const contextToPass = {
        parentApiVersion: 'v2',
        authMethod: 'JWT',
        sensitiveData: 'user-passwords',
        allowedOperations: ['read', 'update']
      };

      const subtask = await this.subtaskManager.createSubtask(
        analyzedTask.id,
        subtaskConfig,
        contextToPass
      );

      // Verify context isolation
      const context = await this.storage.loadContext(subtask.context.id);
      
      console.log(`   Subtask ID: ${subtask.id}`);
      console.log(`   Context ID: ${subtask.context.id}`);
      console.log(`   Context has parent data: ${!!context.passedData.parentApiVersion}`);
      console.log(`   Context isolated: ${context.parentId === analyzedTask.id}`);

      if (!context.passedData.parentApiVersion) {
        console.log('❌ Context data not properly passed');
        return false;
      }

      console.log('✅ Context isolation test completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Context isolation test failed:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Boomerang MCP Server Tests\n');
    
    await this.setupTestEnvironment();
    
    const tests = [
      { name: 'Basic Workflow', test: () => this.testBasicWorkflow() },
      { name: 'Simple Task (Score 1)', test: () => this.testSimpleTask() },
      { name: 'Medium Complexity Task (Score 2+)', test: () => this.testMediumComplexityTask() },
      { name: 'Context Isolation', test: () => this.testContextIsolation() }
    ];

    let passedTests = 0;
    const totalTests = tests.length;

    for (const { name, test } of tests) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Testing: ${name}`);
      console.log(`${'='.repeat(50)}`);
      
      const result = await test();
      if (result) {
        passedTests++;
      }
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 TEST RESULTS');
    console.log(`${'='.repeat(50)}`);
    console.log(`Passed: ${passedTests}/${totalTests}`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Boomerang MCP Server is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the implementation.');
    }

    return passedTests === totalTests;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BoomerangTester();
  tester.runAllTests().catch(console.error);
}