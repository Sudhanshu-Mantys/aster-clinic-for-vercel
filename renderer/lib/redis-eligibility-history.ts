import Redis from "ioredis";

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

// Singleton Redis client
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      tls: {
        rejectUnauthorized: false,
      },
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });
  }
  return redisClient;
}

/**
 * Interface for eligibility history item stored in Redis
 */
export interface EligibilityHistoryItem {
  id: string;
  clinicId: string;
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

/**
 * Key patterns:
 * - eligibility:history:item:{historyId} → Full history item (JSON)
 * - eligibility:history:clinic:{clinicId} → Set of historyIds for this clinic
 * - eligibility:history:task:{taskId} → historyId (for quick lookup by taskId)
 * - eligibility:history:patient:{patientId} → Set of historyIds for this patient
 * - eligibility:history:appointment:{appointmentId} → Set of historyIds for this appointment
 */

export class EligibilityHistoryRedisService {
  private redis: Redis;
  private readonly TTL = 60 * 60 * 24 * 30; // 30 days
  private readonly MAX_HISTORY_ITEMS = 100; // Maximum items per clinic

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Add a new history item
   */
  async addHistoryItem(item: Omit<EligibilityHistoryItem, "id" | "createdAt">): Promise<EligibilityHistoryItem> {
    const historyId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: EligibilityHistoryItem = {
      ...item,
      id: historyId,
      createdAt: new Date().toISOString(),
    };

    const pipeline = this.redis.pipeline();

    // Store the full item
    const itemKey = `eligibility:history:item:${historyId}`;
    pipeline.setex(itemKey, this.TTL, JSON.stringify(newItem));

    // Add to clinic index
    const clinicKey = `eligibility:history:clinic:${newItem.clinicId}`;
    pipeline.sadd(clinicKey, historyId);
    pipeline.expire(clinicKey, this.TTL);

    // Add to task index (for quick lookup by taskId)
    const taskKey = `eligibility:history:task:${newItem.taskId}`;
    pipeline.setex(taskKey, this.TTL, historyId);

    // Add to patient index (optional, for faster patient-specific queries)
    if (newItem.patientId) {
      const patientKey = `eligibility:history:patient:${newItem.patientId}`;
      pipeline.sadd(patientKey, historyId);
      pipeline.expire(patientKey, this.TTL);
    }

    // Add to appointment index (optional, for faster appointment-specific queries)
    if (newItem.appointmentId) {
      const appointmentKey = `eligibility:history:appointment:${newItem.appointmentId}`;
      pipeline.sadd(appointmentKey, historyId);
      pipeline.expire(appointmentKey, this.TTL);
    }

    await pipeline.exec();

    // Enforce max history items per clinic by removing oldest items
    await this.enforceMaxHistoryItems(newItem.clinicId);

    return newItem;
  }

  /**
   * Get a history item by ID
   */
  async getHistoryItem(historyId: string): Promise<EligibilityHistoryItem | null> {
    const itemKey = `eligibility:history:item:${historyId}`;
    const data = await this.redis.get(itemKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Get a history item by task ID
   */
  async getHistoryByTaskId(taskId: string): Promise<EligibilityHistoryItem | null> {
    const taskKey = `eligibility:history:task:${taskId}`;
    const historyId = await this.redis.get(taskKey);

    if (!historyId) {
      return null;
    }

    return this.getHistoryItem(historyId);
  }

  /**
   * Get all history items for a clinic
   */
  async getHistoryByClinicId(clinicId: string): Promise<EligibilityHistoryItem[]> {
    const clinicKey = `eligibility:history:clinic:${clinicId}`;
    const historyIds = await this.redis.smembers(clinicKey);

    if (historyIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    historyIds.forEach((historyId) => {
      pipeline.get(`eligibility:history:item:${historyId}`);
    });

    const results = await pipeline.exec();
    const items: EligibilityHistoryItem[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          const item = JSON.parse(result[1] as string);
          if (item) {
            items.push(item);
          }
        } catch (err) {
          console.error("Error parsing history item:", err);
        }
      }
    });

    // Sort by createdAt descending (most recent first)
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get history items by patient ID
   */
  async getHistoryByPatientId(patientId: string): Promise<EligibilityHistoryItem[]> {
    const patientKey = `eligibility:history:patient:${patientId}`;
    const historyIds = await this.redis.smembers(patientKey);

    if (historyIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    historyIds.forEach((historyId) => {
      pipeline.get(`eligibility:history:item:${historyId}`);
    });

    const results = await pipeline.exec();
    const items: EligibilityHistoryItem[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          const item = JSON.parse(result[1] as string);
          if (item) {
            items.push(item);
          }
        } catch (err) {
          console.error("Error parsing history item:", err);
        }
      }
    });

    // Sort by createdAt descending (most recent first)
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get history items by appointment ID
   */
  async getHistoryByAppointmentId(appointmentId: number): Promise<EligibilityHistoryItem[]> {
    const appointmentKey = `eligibility:history:appointment:${appointmentId}`;
    const historyIds = await this.redis.smembers(appointmentKey);

    if (historyIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    historyIds.forEach((historyId) => {
      pipeline.get(`eligibility:history:item:${historyId}`);
    });

    const results = await pipeline.exec();
    const items: EligibilityHistoryItem[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          const item = JSON.parse(result[1] as string);
          if (item) {
            items.push(item);
          }
        } catch (err) {
          console.error("Error parsing history item:", err);
        }
      }
    });

    // Sort by createdAt descending (most recent first)
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Update an existing history item
   */
  async updateHistoryItem(
    historyId: string,
    updates: Partial<EligibilityHistoryItem>
  ): Promise<EligibilityHistoryItem | null> {
    const existing = await this.getHistoryItem(historyId);
    if (!existing) {
      return null;
    }

    const updated: EligibilityHistoryItem = {
      ...existing,
      ...updates,
    };

    const itemKey = `eligibility:history:item:${historyId}`;
    await this.redis.setex(itemKey, this.TTL, JSON.stringify(updated));

    return updated;
  }

  /**
   * Update history item by task ID
   */
  async updateHistoryByTaskId(
    taskId: string,
    updates: Partial<EligibilityHistoryItem>
  ): Promise<EligibilityHistoryItem | null> {
    const taskKey = `eligibility:history:task:${taskId}`;
    const historyId = await this.redis.get(taskKey);

    if (!historyId) {
      return null;
    }

    return this.updateHistoryItem(historyId, updates);
  }

  /**
   * Delete a history item
   */
  async deleteHistoryItem(historyId: string): Promise<void> {
    const item = await this.getHistoryItem(historyId);
    if (!item) {
      return;
    }

    const pipeline = this.redis.pipeline();

    // Remove from clinic index
    const clinicKey = `eligibility:history:clinic:${item.clinicId}`;
    pipeline.srem(clinicKey, historyId);

    // Remove from task index
    const taskKey = `eligibility:history:task:${item.taskId}`;
    pipeline.del(taskKey);

    // Remove from patient index
    if (item.patientId) {
      const patientKey = `eligibility:history:patient:${item.patientId}`;
      pipeline.srem(patientKey, historyId);
    }

    // Remove from appointment index
    if (item.appointmentId) {
      const appointmentKey = `eligibility:history:appointment:${item.appointmentId}`;
      pipeline.srem(appointmentKey, historyId);
    }

    // Delete the item itself
    const itemKey = `eligibility:history:item:${historyId}`;
    pipeline.del(itemKey);

    await pipeline.exec();
  }

  /**
   * Delete all history items for a clinic
   */
  async deleteHistoryByClinicId(clinicId: string): Promise<void> {
    const clinicKey = `eligibility:history:clinic:${clinicId}`;
    const historyIds = await this.redis.smembers(clinicKey);

    if (historyIds.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    // Get all items to clean up indexes
    const items: EligibilityHistoryItem[] = [];
    for (const historyId of historyIds) {
      const itemKey = `eligibility:history:item:${historyId}`;
      const data = await this.redis.get(itemKey);
      if (data) {
        try {
          items.push(JSON.parse(data));
        } catch (err) {
          console.error("Error parsing history item for deletion:", err);
        }
      }
    }

    // Delete all indexes and items
    for (const item of items) {
      // Remove from task index
      const taskKey = `eligibility:history:task:${item.taskId}`;
      pipeline.del(taskKey);

      // Remove from patient index
      if (item.patientId) {
        const patientKey = `eligibility:history:patient:${item.patientId}`;
        pipeline.srem(patientKey, item.id);
      }

      // Remove from appointment index
      if (item.appointmentId) {
        const appointmentKey = `eligibility:history:appointment:${item.appointmentId}`;
        pipeline.srem(appointmentKey, item.id);
      }

      // Delete the item itself
      const itemKey = `eligibility:history:item:${item.id}`;
      pipeline.del(itemKey);
    }

    // Delete clinic index
    pipeline.del(clinicKey);

    await pipeline.exec();
  }

  /**
   * Enforce maximum history items per clinic by removing oldest items
   */
  private async enforceMaxHistoryItems(clinicId: string): Promise<void> {
    const items = await this.getHistoryByClinicId(clinicId);

    if (items.length <= this.MAX_HISTORY_ITEMS) {
      return;
    }

    // Sort by createdAt ascending (oldest first)
    const sortedItems = items.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Delete oldest items
    const itemsToDelete = sortedItems.slice(0, items.length - this.MAX_HISTORY_ITEMS);
    for (const item of itemsToDelete) {
      await this.deleteHistoryItem(item.id);
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Export singleton instance
export const eligibilityHistoryRedisService = new EligibilityHistoryRedisService();

