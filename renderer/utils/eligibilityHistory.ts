// Utility for managing eligibility check history in Redis

export interface EligibilityHistoryItem {
  id: string; // unique ID for this check
  clinicId: string; // Clinic ID for clinic-wide storage
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

// Cache for reducing API calls
let cachedItems: EligibilityHistoryItem[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000; // 1 second cache

export class EligibilityHistoryService {
  /**
   * Get all history items
   */
  static async getAll(clinicId?: string): Promise<EligibilityHistoryItem[]> {
    try {
      // Use cache if available and recent
      if (cachedItems && Date.now() - lastFetchTime < CACHE_DURATION) {
        return cachedItems;
      }

      const url = clinicId 
        ? `/api/eligibility-history?clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      const items = await response.json();

      cachedItems = items;
      lastFetchTime = Date.now();

      return items;
    } catch (error) {
      console.error("Error reading eligibility history:", error);
      return [];
    }
  }

  /**
   * Get a specific history item by ID
   */
  static async getById(id: string): Promise<EligibilityHistoryItem | null> {
    try {
      const response = await fetch(`/api/eligibility-history?id=${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history item');
      }
      return await response.json();
    } catch (error) {
      console.error("Error reading eligibility history item:", error);
      return null;
    }
  }

  /**
   * Get a history item by task ID
   */
  static async getByTaskId(taskId: string): Promise<EligibilityHistoryItem | null> {
    try {
      const response = await fetch(`/api/eligibility-history?taskId=${taskId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history item');
      }
      return await response.json();
    } catch (error) {
      console.error("Error reading eligibility history item:", error);
      return null;
    }
  }

  /**
   * Add a new history item
   */
  static async add(
    item: Omit<EligibilityHistoryItem, "id" | "createdAt">,
  ): Promise<EligibilityHistoryItem> {
    try {
      const response = await fetch('/api/eligibility-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        throw new Error('Failed to add history item');
      }

      const newItem = await response.json();
      cachedItems = null; // Invalidate cache
      return newItem;
    } catch (error) {
      console.error("Error adding eligibility history item:", error);
      throw error;
    }
  }

  /**
   * Update an existing history item
   */
  static async update(id: string, updates: Partial<EligibilityHistoryItem>): Promise<void> {
    try {
      const response = await fetch('/api/eligibility-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to update history item');
      }

      cachedItems = null; // Invalidate cache
    } catch (error) {
      console.error("Error updating eligibility history item:", error);
    }
  }

  /**
   * Update by task ID
   */
  static async updateByTaskId(
    taskId: string,
    updates: Partial<EligibilityHistoryItem>,
  ): Promise<void> {
    try {
      const response = await fetch('/api/eligibility-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, updates }),
      });

      if (!response.ok) {
        // If item not found (404), log but don't throw - item may have been deleted
        if (response.status === 404) {
          console.warn(`[EligibilityHistory] History item with taskId ${taskId} not found. Skipping update.`);
          return;
        }

        // Try to get error message from response
        let errorMessage = `Failed to update history item: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If JSON parsing fails, use the default message
        }

        console.error(`[EligibilityHistory] Update failed:`, errorMessage);
        throw new Error(errorMessage);
      }

      cachedItems = null; // Invalidate cache
    } catch (error: any) {
      // Only log if it's not a 404 (which we already handled)
      if (error.message && !error.message.includes('not found')) {
        console.error("[EligibilityHistory] Error updating eligibility history item:", error);
      }
      // Re-throw to allow caller to handle if needed
      throw error;
    }
  }

  /**
   * Delete a history item
   */
  static async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/eligibility-history?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete history item');
      }

      cachedItems = null; // Invalidate cache
    } catch (error) {
      console.error("Error deleting eligibility history item:", error);
    }
  }

  /**
   * Clear all history
   */
  static async clearAll(): Promise<void> {
    try {
      const response = await fetch('/api/eligibility-history?clearAll=true', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      cachedItems = null; // Invalidate cache
    } catch (error) {
      console.error("Error clearing eligibility history:", error);
    }
  }

  /**
   * Get active (pending or processing) checks
   */
  static async getActive(clinicId?: string): Promise<EligibilityHistoryItem[]> {
    try {
      const url = clinicId
        ? `/api/eligibility-history?status=active&clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history?status=active';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch active history items');
      }
      return await response.json();
    } catch (error) {
      console.error("Error reading active eligibility history:", error);
      return [];
    }
  }

  /**
   * Get completed checks
   */
  static async getCompleted(clinicId?: string): Promise<EligibilityHistoryItem[]> {
    try {
      const url = clinicId
        ? `/api/eligibility-history?status=completed&clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history?status=completed';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch completed history items');
      }
      return await response.json();
    } catch (error) {
      console.error("Error reading completed eligibility history:", error);
      return [];
    }
  }

  /**
   * Search history by patient name or ID
   */
  static async search(query: string): Promise<EligibilityHistoryItem[]> {
    const items = await this.getAll();
    const lowerQuery = query.toLowerCase();

    return items.filter(
      (item) =>
        item.patientId.toLowerCase().includes(lowerQuery) ||
        item.patientName?.toLowerCase().includes(lowerQuery) ||
        item.insurancePayer?.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Export history as JSON (for backup/download)
   */
  static async export(): Promise<string> {
    const items = await this.getAll();
    return JSON.stringify(items, null, 2);
  }

  /**
   * Invalidate cache manually
   */
  static invalidateCache(): void {
    cachedItems = null;
    lastFetchTime = 0;
  }
}
