// Utility for managing eligibility check history in localStorage

export interface EligibilityHistoryItem {
  id: string; // unique ID for this check
  patientId: string;
  taskId: string;
  patientName?: string;
  dateOfBirth?: string;
  insurancePayer?: string;
  patientMPI?: string;
  appointmentId?: number;
  encounterId?: number;
  status: "pending" | "processing" | "complete" | "error";
  createdAt: string;
  completedAt?: string;
  result?: any;
  interimResults?: {
    screenshot?: string;
    documents?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
  error?: string;
  pollingAttempts?: number;
}

const STORAGE_KEY = "mantys_eligibility_history";
const MAX_HISTORY_ITEMS = 100; // Limit to prevent localStorage overflow

export class EligibilityHistoryService {
  /**
   * Get all history items
   */
  static getAll(): EligibilityHistoryItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading eligibility history:", error);
      return [];
    }
  }

  /**
   * Get a specific history item by ID
   */
  static getById(id: string): EligibilityHistoryItem | null {
    const items = this.getAll();
    return items.find((item) => item.id === id) || null;
  }

  /**
   * Get a history item by task ID
   */
  static getByTaskId(taskId: string): EligibilityHistoryItem | null {
    const items = this.getAll();
    return items.find((item) => item.taskId === taskId) || null;
  }

  /**
   * Add a new history item
   */
  static add(
    item: Omit<EligibilityHistoryItem, "id" | "createdAt">,
  ): EligibilityHistoryItem {
    const items = this.getAll();

    const newItem: EligibilityHistoryItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    items.unshift(newItem); // Add to beginning of array

    // Limit history size
    if (items.length > MAX_HISTORY_ITEMS) {
      items.splice(MAX_HISTORY_ITEMS);
    }

    this.saveAll(items);
    return newItem;
  }

  /**
   * Update an existing history item
   */
  static update(id: string, updates: Partial<EligibilityHistoryItem>): void {
    const items = this.getAll();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      console.warn(`History item with id ${id} not found`);
      return;
    }

    items[index] = { ...items[index], ...updates };
    this.saveAll(items);
  }

  /**
   * Update by task ID
   */
  static updateByTaskId(
    taskId: string,
    updates: Partial<EligibilityHistoryItem>,
  ): void {
    const items = this.getAll();
    const index = items.findIndex((item) => item.taskId === taskId);

    if (index === -1) {
      console.warn(`History item with taskId ${taskId} not found`);
      return;
    }

    items[index] = { ...items[index], ...updates };
    this.saveAll(items);
  }

  /**
   * Delete a history item
   */
  static delete(id: string): void {
    const items = this.getAll();
    const filtered = items.filter((item) => item.id !== id);
    this.saveAll(filtered);
  }

  /**
   * Clear all history
   */
  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get active (pending or processing) checks
   */
  static getActive(): EligibilityHistoryItem[] {
    const items = this.getAll();
    return items.filter(
      (item) => item.status === "pending" || item.status === "processing",
    );
  }

  /**
   * Get completed checks
   */
  static getCompleted(): EligibilityHistoryItem[] {
    const items = this.getAll();
    return items.filter(
      (item) => item.status === "complete" || item.status === "error",
    );
  }

  /**
   * Search history by patient name or ID
   */
  static search(query: string): EligibilityHistoryItem[] {
    const items = this.getAll();
    const lowerQuery = query.toLowerCase();

    return items.filter(
      (item) =>
        item.patientId.toLowerCase().includes(lowerQuery) ||
        item.patientName?.toLowerCase().includes(lowerQuery) ||
        item.insurancePayer?.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Save all items to localStorage
   */
  private static saveAll(items: EligibilityHistoryItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Error saving eligibility history:", error);
      // If localStorage is full, try removing old items
      if (error instanceof Error && error.name === "QuotaExceededError") {
        const reducedItems = items.slice(0, Math.floor(items.length / 2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedItems));
      }
    }
  }

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old completed items (older than 30 days)
   */
  static cleanup(daysToKeep: number = 30): void {
    const items = this.getAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = items.filter((item) => {
      // Always keep active items
      if (item.status === "pending" || item.status === "processing") {
        return true;
      }

      // Keep completed items within the cutoff date
      const itemDate = new Date(item.createdAt);
      return itemDate > cutoffDate;
    });

    this.saveAll(filtered);
  }

  /**
   * Export history as JSON (for backup/download)
   */
  static export(): string {
    const items = this.getAll();
    return JSON.stringify(items, null, 2);
  }

  /**
   * Import history from JSON
   */
  static import(jsonData: string): boolean {
    try {
      const items = JSON.parse(jsonData);
      if (!Array.isArray(items)) {
        throw new Error("Invalid data format");
      }
      this.saveAll(items);
      return true;
    } catch (error) {
      console.error("Error importing history:", error);
      return false;
    }
  }
}
