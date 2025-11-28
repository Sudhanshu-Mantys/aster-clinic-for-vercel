// Background polling service for eligibility checks
// Runs independently of UI - continues even when tabs are closed

import { EligibilityHistoryService, EligibilityHistoryItem } from '../utils/eligibilityHistory';

interface PollingTask {
  taskId: string;
  historyId: string;
  attempts: number;
  startedAt: number;
}

const MAX_ATTEMPTS = 150; // 150 attempts * 2 seconds = 5 minutes
const POLL_INTERVAL = 2000; // 2 seconds
const STORAGE_KEY = 'eligibility_polling_tasks';

class EligibilityPollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private activeTasks = new Map<string, PollingTask>();

  constructor() {
    // Load active tasks from localStorage on initialization
    this.loadActiveTasks();
  }

  /**
   * Initialize the polling service - call this once at app startup
   */
  initialize() {
    if (this.pollingInterval) {
      return; // Already initialized
    }

    console.log('[PollingService] Initializing background polling service');

    // Load any active tasks from localStorage
    this.loadActiveTasks();

    // Start polling loop
    this.startPolling();

    // Resume polling for any active history items
    this.resumeActivePolls();
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
  addTask(taskId: string, historyId: string) {
    console.log(`[PollingService] Adding task ${taskId} to polling queue`);

    const task: PollingTask = {
      taskId,
      historyId,
      attempts: 0,
      startedAt: Date.now(),
    };

    this.activeTasks.set(taskId, task);
    this.saveActiveTasks();

    // If polling isn't running, start it
    if (!this.isPolling) {
      this.startPolling();
    }
  }

  /**
   * Remove a task from polling
   */
  removeTask(taskId: string) {
    console.log(`[PollingService] Removing task ${taskId} from polling queue`);
    this.activeTasks.delete(taskId);
    this.saveActiveTasks();

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

  /**
   * Poll a single task
   */
  private async pollTask(task: PollingTask) {
    task.attempts++;

    try {
      const response = await fetch('/api/mantys/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.taskId }),
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Update history based on status
      if (data.status === 'pending') {
        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'pending',
          pollingAttempts: task.attempts,
        });
      } else if (data.status === 'processing') {
        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'processing',
          pollingAttempts: task.attempts,
          interimResults: data.interimResults || undefined,
        });
      } else if (data.status === 'complete') {
        console.log(`[PollingService] Task ${task.taskId} completed successfully`);

        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'complete',
          completedAt: new Date().toISOString(),
          result: data.result,
          pollingAttempts: task.attempts,
        });

        // Remove from active tasks
        this.removeTask(task.taskId);
      } else if (data.status === 'error') {
        console.error(`[PollingService] Task ${task.taskId} failed:`, data.message);

        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'error',
          error: data.message || 'Eligibility check failed',
          completedAt: new Date().toISOString(),
          pollingAttempts: task.attempts,
        });

        // Remove from active tasks
        this.removeTask(task.taskId);
      }

      // Update task attempts
      this.activeTasks.set(task.taskId, task);
      this.saveActiveTasks();

      // Check if max attempts reached
      if (task.attempts >= MAX_ATTEMPTS) {
        console.error(`[PollingService] Task ${task.taskId} timed out after ${MAX_ATTEMPTS} attempts`);

        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'error',
          error: 'Eligibility check timed out after 5 minutes. Please try again.',
          completedAt: new Date().toISOString(),
          pollingAttempts: task.attempts,
        });

        // Remove from active tasks
        this.removeTask(task.taskId);
      }
    } catch (error: any) {
      console.error(`[PollingService] Error polling task ${task.taskId}:`, error);

      // Only mark as error if we've tried multiple times
      if (task.attempts >= 3) {
        EligibilityHistoryService.updateByTaskId(task.taskId, {
          status: 'error',
          error: error.message || 'Failed to check status',
          completedAt: new Date().toISOString(),
          pollingAttempts: task.attempts,
        });

        // Remove from active tasks
        this.removeTask(task.taskId);
      }
    }
  }

  /**
   * Load active tasks from localStorage
   */
  private loadActiveTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return;

      const tasks: PollingTask[] = JSON.parse(data);

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
   * Save active tasks to localStorage
   */
  private saveActiveTasks() {
    try {
      const tasks = Array.from(this.activeTasks.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error('[PollingService] Error saving active tasks:', error);
    }
  }

  /**
   * Resume polling for any active history items
   * Called on app startup to resume any in-progress checks
   */
  private resumeActivePolls() {
    const activeItems = EligibilityHistoryService.getActive();

    if (activeItems.length === 0) {
      return;
    }

    console.log(`[PollingService] Resuming polling for ${activeItems.length} active check(s)`);

    activeItems.forEach(item => {
      // Only resume if not already being polled
      if (!this.activeTasks.has(item.taskId)) {
        this.addTask(item.taskId, item.id);
      }
    });
  }

  /**
   * Force refresh all active tasks
   */
  refreshActiveTasks() {
    console.log('[PollingService] Force refreshing active tasks');
    this.loadActiveTasks();
    this.resumeActivePolls();
  }
}

// Create singleton instance
const pollingService = new EligibilityPollingService();

// Export singleton
export default pollingService;

// Also export the class for testing
export { EligibilityPollingService };
