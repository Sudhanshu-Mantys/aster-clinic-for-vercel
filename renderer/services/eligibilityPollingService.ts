import { eligibilityHistoryApi, mantysApi, ApiError } from '../lib/api-client';
import type { EligibilityHistoryItem } from '../hooks/useEligibility';

interface PollingTask {
  taskId: string;
  historyId: string;
  attempts: number;
  startedAt: number;
}

const MAX_ATTEMPTS = 400; // 150 attempts * 2 seconds = 5 minutes
const POLL_INTERVAL = 3000; // 2 seconds

class EligibilityPollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private activeTasks = new Map<string, PollingTask>();

  constructor() {
    // Load active tasks from Redis on initialization
    this.loadActiveTasks();
  }

  /**
   * Initialize the polling service - call this once at app startup
   */
  async initialize() {
    if (this.pollingInterval) {
      return; // Already initialized
    }

    console.log('[PollingService] Initializing background polling service');

    // Load any active tasks from Redis
    await this.loadActiveTasks();

    // Start polling loop
    this.startPolling();

    // Resume polling for any active history items
    await this.resumeActivePolls();
  }

  /**
   * Shutdown the polling service
   */
  shutdown() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[PollingService] Polling service shut down');
  }

  /**
   * Add a new task to poll
   */
  async addTask(taskId: string, historyId: string) {
    console.log(`[PollingService] Adding task ${taskId} to polling queue`);

    const task: PollingTask = {
      taskId,
      historyId,
      attempts: 0,
      startedAt: Date.now(),
    };

    this.activeTasks.set(taskId, task);
    await this.saveActiveTasks();

    // If polling isn't running, start it
    if (!this.isPolling) {
      this.startPolling();
    }
  }

  /**
   * Remove a task from polling
   */
  async removeTask(taskId: string) {
    console.log(`[PollingService] Removing task ${taskId} from polling queue`);
    this.activeTasks.delete(taskId);
    await this.saveActiveTasks();

    // Stop polling if no tasks remain
    if (this.activeTasks.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Get count of active polling tasks
   */
  getActiveCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Check if a specific task is being polled
   */
  isTaskActive(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  /**
   * Start the polling loop
   */
  private startPolling() {
    if (this.pollingInterval) {
      return; // Already polling
    }

    console.log('[PollingService] Starting polling loop');
    this.isPolling = true;

    this.pollingInterval = setInterval(() => {
      this.pollAllTasks();
    }, POLL_INTERVAL);

    // Poll immediately
    this.pollAllTasks();
  }

  /**
   * Stop the polling loop
   */
  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[PollingService] Polling loop stopped');
  }

  /**
   * Poll all active tasks
   */
  private async pollAllTasks() {
    if (this.activeTasks.size === 0) {
      return;
    }

    console.log(`[PollingService] Polling ${this.activeTasks.size} active task(s)`);

    // Create array of tasks to poll (to avoid modification during iteration)
    const tasksToCheck = Array.from(this.activeTasks.values());

    for (const task of tasksToCheck) {
      await this.pollTask(task);
    }
  }

  private async pollTask(task: PollingTask) {
    task.attempts++;

    try {
      const data = await mantysApi.checkStatus(task.taskId);

      if (data.status === 'pending') {
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'pending',
            pollingAttempts: task.attempts,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        this.activeTasks.set(task.taskId, task);
        await this.saveActiveTasks();
      } else if (data.status === 'processing') {
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'processing',
            pollingAttempts: task.attempts,
            interimResults: data.interimResults || undefined,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        this.activeTasks.set(task.taskId, task);
        await this.saveActiveTasks();
      } else if (data.status === 'complete') {
        console.log(`[PollingService] Task ${task.taskId} completed successfully`);
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'complete',
            completedAt: new Date().toISOString(),
            result: data.result,
            pollingAttempts: task.attempts,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        await this.removeTask(task.taskId);
        return;
      } else if (data.status === 'error') {
        console.error(`[PollingService] Task ${task.taskId} failed:`, data.message);
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'error',
            error: data.message || 'Eligibility check failed',
            completedAt: new Date().toISOString(),
            pollingAttempts: task.attempts,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        await this.removeTask(task.taskId);
        return;
      }

      if (task.attempts >= MAX_ATTEMPTS) {
        console.error(`[PollingService] Task ${task.taskId} timed out after ${MAX_ATTEMPTS} attempts`);
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'error',
            error: 'Eligibility check timed out after 10 minutes. Please try again.',
            completedAt: new Date().toISOString(),
            pollingAttempts: task.attempts,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        await this.removeTask(task.taskId);
        return;
      }
    } catch (error: unknown) {
      console.error(`[PollingService] Error polling task ${task.taskId}:`, error);

      const errorMessage = error instanceof ApiError ? error.message :
        error instanceof Error ? error.message : 'Unknown error';
      const isServerError = error instanceof ApiError && error.status === 500;
      const maxErrorAttempts = isServerError ? 5 : 3;

      if (task.attempts >= maxErrorAttempts) {
        try {
          await eligibilityHistoryApi.updateByTaskId(task.taskId, {
            status: 'error',
            error: errorMessage || 'Failed to check status',
            completedAt: new Date().toISOString(),
            pollingAttempts: task.attempts,
          });
        } catch (updateError: unknown) {
          const msg = updateError instanceof Error ? updateError.message : 'Unknown error';
          console.warn(`[PollingService] Failed to update history for task ${task.taskId}:`, msg);
        }
        await this.removeTask(task.taskId);
        return;
      }
      this.activeTasks.set(task.taskId, task);
      await this.saveActiveTasks();
    }
  }

  /**
   * Load active tasks from Redis
   */
  private async loadActiveTasks() {
    try {
      const response = await fetch('/api/eligibility-history/tasks');
      if (!response.ok) {
        throw new Error('Failed to load active tasks');
      }

      const tasks: PollingTask[] = await response.json();

      // Filter out tasks that are too old (> 10 minutes)
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      tasks.forEach(task => {
        if (now - task.startedAt < tenMinutes) {
          this.activeTasks.set(task.taskId, task);
        }
      });

      console.log(`[PollingService] Loaded ${this.activeTasks.size} active task(s) from storage`);
    } catch (error) {
      console.error('[PollingService] Error loading active tasks:', error);
    }
  }

  /**
   * Save active tasks to Redis
   */
  private async saveActiveTasks() {
    try {
      const tasks = Array.from(this.activeTasks.values());

      // Save all tasks using a single API call with all tasks
      for (const task of tasks) {
        await fetch('/api/eligibility-history/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
      }
    } catch (error) {
      console.error('[PollingService] Error saving active tasks:', error);
    }
  }

  private async resumeActivePolls() {
    try {
      const activeItems = await eligibilityHistoryApi.getActive();

      if (activeItems.length === 0) {
        return;
      }

      console.log(`[PollingService] Resuming polling for ${activeItems.length} active check(s)`);

      for (const item of activeItems) {
        if (!this.activeTasks.has(item.taskId) &&
          (item.status === 'pending' || item.status === 'processing')) {
          await this.addTask(item.taskId, item.id);
        }
      }
    } catch (error) {
      console.error('[PollingService] Error resuming active polls:', error);
    }
  }

  /**
   * Force refresh all active tasks
   */
  async refreshActiveTasks() {
    console.log('[PollingService] Force refreshing active tasks');
    await this.loadActiveTasks();
    await this.resumeActivePolls();
  }
}

// Create singleton instance
const pollingService = new EligibilityPollingService();

// Export singleton
export default pollingService;

// Also export the class for testing
export { EligibilityPollingService };
