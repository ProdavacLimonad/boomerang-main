import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class Storage {
  constructor(basePath = './storage') {
    this.basePath = basePath;
    this.tasksPath = path.join(basePath, 'tasks');
    this.contextsPath = path.join(basePath, 'contexts');
    this.metadataPath = path.join(basePath, 'metadata.json');
    this.initPromise = this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [
      this.basePath,
      this.tasksPath,
      this.contextsPath
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error.message);
      }
    }
  }

  async saveTask(task) {
    await this.initPromise; // Počkat na vytvoření adresářů
    const taskId = task.id || this.generateId();
    const taskPath = path.join(this.tasksPath, `${taskId}.json`);
    await fs.writeFile(taskPath, JSON.stringify({ ...task, id: taskId }, null, 2));
    return taskId;
  }

  async loadTask(taskId) {
    const taskPath = path.join(this.tasksPath, `${taskId}.json`);
    try {
      const data = await fs.readFile(taskPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveContext(contextId, context) {
    await this.initPromise; // Počkat na vytvoření adresářů
    const contextPath = path.join(this.contextsPath, `${contextId}.json`);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  async loadContext(contextId) {
    const contextPath = path.join(this.contextsPath, `${contextId}.json`);
    try {
      const data = await fs.readFile(contextPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveMetadata(metadata) {
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { tasks: {}, relationships: {} };
    }
  }

  generateId() {
    // Bezpečné generování ID pomocí crypto
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(6).toString('hex');
    return `${timestamp}-${randomPart}`;
  }
}