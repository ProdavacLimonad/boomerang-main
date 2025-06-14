/**
 * Approval systém pro Boomerang úkoly inspirovaný Roo Code
 * Umožňuje manuální nebo automatické schvalování subtasků
 */

import { getLogger } from '../utils/logger.js';
import { sendWebhookNotification } from '../utils/webhooks.js';

export class ApprovalSystem {
  constructor(storage) {
    this.storage = storage;
    this.logger = getLogger();
    this.pendingApprovals = new Map(); // subtaskId -> approval request
  }

  /**
   * Vytvoří žádost o schválení pro subtask
   */
  async requestApproval(subtaskId, approvalType = 'creation', metadata = {}) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    const approvalRequest = {
      id: this.storage.generateId(),
      subtaskId,
      approvalType, // 'creation', 'execution', 'completion'
      status: 'pending',
      requestedAt: new Date().toISOString(),
      metadata: {
        taskTitle: subtask.title,
        taskDescription: subtask.description,
        mode: subtask.mode?.name || 'Unknown',
        priority: subtask.priority,
        estimatedImpact: this.assessImpact(subtask),
        ...metadata
      },
      approvedBy: null,
      approvedAt: null,
      reason: null
    };

    // Uložit žádost
    await this.storage.saveApprovalRequest(approvalRequest);
    this.pendingApprovals.set(subtaskId, approvalRequest);

    // Zalogovat žádost
    this.logger.info('Approval request created', {
      approvalId: approvalRequest.id,
      subtaskId,
      type: approvalType,
      impact: approvalRequest.metadata.estimatedImpact
    });

    // Odeslat notifikaci pokud je nakonfigurována
    await this.sendApprovalNotification(approvalRequest);

    return approvalRequest;
  }

  /**
   * Schválí nebo zamítne subtask
   */
  async processApproval(approvalId, decision, approvedBy = 'system', reason = '') {
    const approval = await this.storage.loadApprovalRequest(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval request ${approvalId} is already ${approval.status}`);
    }

    // Aktualizuj approval
    approval.status = decision; // 'approved', 'rejected'
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date().toISOString();
    approval.reason = reason;

    await this.storage.saveApprovalRequest(approval);
    this.pendingApprovals.delete(approval.subtaskId);

    // Aktualizuj subtask status
    const subtask = await this.storage.loadTask(approval.subtaskId);
    if (subtask) {
      subtask.approvalStatus = decision;
      subtask.approvalReason = reason;
      
      if (decision === 'approved') {
        subtask.status = 'approved';
      } else {
        subtask.status = 'rejected';
      }
      
      await this.storage.saveTask(subtask);
    }

    this.logger.info('Approval processed', {
      approvalId,
      subtaskId: approval.subtaskId,
      decision,
      approvedBy,
      reason
    });

    // Odeslat notifikaci o rozhodnutí
    await this.sendApprovalDecisionNotification(approval);

    return approval;
  }

  /**
   * Automatické schválení na základě pravidel
   */
  async autoApprove(subtaskId, rules = {}) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    const autoApprovalRules = {
      // Výchozí pravidla pro auto-approval
      maxImpact: 'low',
      allowedModes: ['code', 'test', 'docs'],
      maxEstimatedTime: 30, // minuty
      requiresManualReview: false,
      ...rules
    };

    const impact = this.assessImpact(subtask);
    const shouldAutoApprove = this.evaluateAutoApprovalRules(subtask, impact, autoApprovalRules);

    if (shouldAutoApprove.approved) {
      // Vytvoř approval request a okamžitě schval
      const approval = await this.requestApproval(subtaskId, 'creation', {
        autoApprovalRules,
        evaluationResult: shouldAutoApprove
      });

      return await this.processApproval(
        approval.id, 
        'approved', 
        'auto-approval-system',
        shouldAutoApprove.reason
      );
    } else {
      // Vytvoř approval request pro manuální review
      const approval = await this.requestApproval(subtaskId, 'creation', {
        autoApprovalRules,
        evaluationResult: shouldAutoApprove,
        requiresManualReview: true
      });

      this.logger.info('Manual approval required', {
        subtaskId,
        reason: shouldAutoApprove.reason
      });

      return approval;
    }
  }

  /**
   * Vyhodnotí pravidla pro automatické schválení
   */
  evaluateAutoApprovalRules(subtask, impact, rules) {
    const reasons = [];

    // Zkontroluj impact level
    if (this.compareImpact(impact, rules.maxImpact) > 0) {
      reasons.push(`Impact ${impact} exceeds maximum ${rules.maxImpact}`);
    }

    // Zkontroluj povolené módy
    if (subtask.mode && !rules.allowedModes.includes(subtask.mode.id)) {
      reasons.push(`Mode ${subtask.mode.id} not in allowed modes: ${rules.allowedModes.join(', ')}`);
    }

    // Zkontroluj estimovaný čas
    const estimatedMinutes = this.parseEstimatedTime(subtask.estimatedDuration);
    if (estimatedMinutes > rules.maxEstimatedTime) {
      reasons.push(`Estimated time ${estimatedMinutes}min exceeds maximum ${rules.maxEstimatedTime}min`);
    }

    // Manual review requirement
    if (rules.requiresManualReview) {
      reasons.push('Manual review explicitly required');
    }

    const approved = reasons.length === 0;

    return {
      approved,
      reason: approved 
        ? 'All auto-approval criteria met'
        : reasons.join('; ')
    };
  }

  /**
   * Posoudí dopad úkolu
   */
  assessImpact(subtask) {
    let score = 0;

    // Faktor priority
    switch (subtask.priority) {
      case 'high': score += 3; break;
      case 'medium': score += 2; break;
      case 'low': score += 1; break;
    }

    // Faktor typu úkolu
    switch (subtask.taskType) {
      case 'deployment': score += 3; break;
      case 'implementation': score += 2; break;
      case 'testing': score += 1; break;
      case 'design': score += 1; break;
    }

    // Faktor módu
    if (subtask.mode) {
      switch (subtask.mode.id) {
        case 'architect': score += 2; break;
        case 'code': score += 2; break;
        case 'debug': score += 1; break;
        case 'test': score += 1; break;
        case 'review': score += 1; break;
        case 'docs': score += 0; break;
      }
    }

    // Klasifikace dopadu
    if (score <= 2) return 'low';
    if (score <= 4) return 'medium';
    return 'high';
  }

  /**
   * Porovná úrovně dopadu
   */
  compareImpact(impact1, impact2) {
    const levels = { 'low': 1, 'medium': 2, 'high': 3 };
    return levels[impact1] - levels[impact2];
  }

  /**
   * Parsuje estimovaný čas na minuty
   */
  parseEstimatedTime(duration) {
    if (!duration) return 30; // default
    
    const match = duration.match(/(\d+)-(\d+)/);
    if (match) {
      return (parseInt(match[1]) + parseInt(match[2])) / 2;
    }
    
    const singleMatch = duration.match(/(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1]);
    }
    
    return 30; // fallback
  }

  /**
   * Odešle notifikaci o žádosti o schválení
   */
  async sendApprovalNotification(approvalRequest) {
    try {
      const message = {
        title: '🔔 Žádost o schválení subtask',
        description: `**${approvalRequest.metadata.taskTitle}**\n` +
                    `Mód: ${approvalRequest.metadata.mode}\n` +
                    `Priorita: ${approvalRequest.metadata.priority}\n` +
                    `Dopad: ${approvalRequest.metadata.estimatedImpact}\n` +
                    `Typ: ${approvalRequest.approvalType}`,
        color: 'warning',
        fields: [
          {
            name: 'Approval ID',
            value: approvalRequest.id,
            inline: true
          },
          {
            name: 'Subtask ID',
            value: approvalRequest.subtaskId,
            inline: true
          }
        ]
      };

      await sendWebhookNotification(message);
    } catch (error) {
      this.logger.warn('Failed to send approval notification', {
        approvalId: approvalRequest.id,
        error: error.message
      });
    }
  }

  /**
   * Odešle notifikaci o rozhodnutí
   */
  async sendApprovalDecisionNotification(approval) {
    try {
      const isApproved = approval.status === 'approved';
      const message = {
        title: isApproved ? '✅ Subtask schválen' : '❌ Subtask zamítnut',
        description: `**${approval.metadata.taskTitle}**\n` +
                    `Rozhodnutí: ${approval.status}\n` +
                    `Schválil: ${approval.approvedBy}\n` +
                    `Důvod: ${approval.reason || 'Bez uvedení důvodu'}`,
        color: isApproved ? 'success' : 'error'
      };

      await sendWebhookNotification(message);
    } catch (error) {
      this.logger.warn('Failed to send approval decision notification', {
        approvalId: approval.id,
        error: error.message
      });
    }
  }

  /**
   * Získá všechny čekající schválení
   */
  async getPendingApprovals() {
    const approvals = [];
    for (const [subtaskId, approval] of this.pendingApprovals) {
      approvals.push(approval);
    }
    return approvals;
  }

  /**
   * Získá historii schválení pro subtask
   */
  async getApprovalHistory(subtaskId) {
    return await this.storage.loadApprovalHistory(subtaskId);
  }

  /**
   * Vymaže staré approval requests
   */
  async cleanupOldApprovals(maxAgeDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    let cleaned = 0;
    for (const [subtaskId, approval] of this.pendingApprovals) {
      if (new Date(approval.requestedAt) < cutoffDate) {
        await this.storage.deleteApprovalRequest(approval.id);
        this.pendingApprovals.delete(subtaskId);
        cleaned++;
      }
    }

    this.logger.info('Cleaned up old approval requests', { 
      cleaned, 
      maxAgeDays 
    });

    return cleaned;
  }
}