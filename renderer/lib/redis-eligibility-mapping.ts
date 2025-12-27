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
 * Interface for eligibility check metadata stored in Redis
 */
export interface EligibilityCheckMetadata {
  taskId: string;
  mpi: string;
  patientId: string | number;
  patientName?: string;
  emiratesId?: string;
  memberId?: string;
  tpaCode: string;
  idType: string;
  visitType: string;
  appointmentId?: number;
  status: "pending" | "processing" | "complete" | "error";
  createdAt: string;
  completedAt?: string;
}

/**
 * Key patterns:
 * - eligibility:mpi:{mpi} → Set of taskIds for this MPI
 * - eligibility:task:{taskId} → Metadata for this eligibility check
 * - eligibility:patient:{patientId} → Set of taskIds for this patient
 * - eligibility:appointment:{appointmentId} → Set of taskIds for this appointment
 * - eligibility:emirates:{emiratesId} → Set of taskIds for this Emirates ID
 * - eligibility:member:{memberId} → Set of taskIds for this member ID (card number)
 */

export class EligibilityRedisService {
  private redis: Redis;
  private readonly TTL = 60 * 60 * 24 * 90; // 90 days

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Store a new eligibility check mapping
   */
  async addEligibilityCheck(metadata: EligibilityCheckMetadata): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Store the full metadata
    const metadataKey = `eligibility:task:${metadata.taskId}`;
    pipeline.setex(metadataKey, this.TTL, JSON.stringify(metadata));

    // Add to MPI set
    if (metadata.mpi) {
      const mpiKey = `eligibility:mpi:${metadata.mpi}`;
      pipeline.sadd(mpiKey, metadata.taskId);
      pipeline.expire(mpiKey, this.TTL);
    }

    // Add to patient ID set
    if (metadata.patientId) {
      const patientKey = `eligibility:patient:${metadata.patientId}`;
      pipeline.sadd(patientKey, metadata.taskId);
      pipeline.expire(patientKey, this.TTL);
    }

    // Add to appointment ID set
    if (metadata.appointmentId) {
      const appointmentKey = `eligibility:appointment:${metadata.appointmentId}`;
      pipeline.sadd(appointmentKey, metadata.taskId);
      pipeline.expire(appointmentKey, this.TTL);
    }

    // Add to Emirates ID set
    if (metadata.emiratesId) {
      const emiratesKey = `eligibility:emirates:${metadata.emiratesId}`;
      pipeline.sadd(emiratesKey, metadata.taskId);
      pipeline.expire(emiratesKey, this.TTL);
    }

    // Add to Member ID set
    if (metadata.memberId) {
      const memberKey = `eligibility:member:${metadata.memberId}`;
      pipeline.sadd(memberKey, metadata.taskId);
      pipeline.expire(memberKey, this.TTL);
    }

    await pipeline.exec();
  }

  /**
   * Update eligibility check status
   */
  async updateEligibilityStatus(
    taskId: string,
    status: "pending" | "processing" | "complete" | "error",
    completedAt?: string,
  ): Promise<void> {
    const metadataKey = `eligibility:task:${taskId}`;
    const metadataStr = await this.redis.get(metadataKey);

    if (metadataStr) {
      const metadata: EligibilityCheckMetadata = JSON.parse(metadataStr);
      metadata.status = status;
      if (completedAt) {
        metadata.completedAt = completedAt;
      }
      await this.redis.setex(metadataKey, this.TTL, JSON.stringify(metadata));
    }
  }

  /**
   * Get all eligibility checks for a given MPI
   */
  async getEligibilityChecksByMPI(
    mpi: string,
  ): Promise<EligibilityCheckMetadata[]> {
    const mpiKey = `eligibility:mpi:${mpi}`;
    const taskIds = await this.redis.smembers(mpiKey);

    if (taskIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    taskIds.forEach((taskId) => {
      pipeline.get(`eligibility:task:${taskId}`);
    });

    const results = await pipeline.exec();
    const eligibilityChecks: EligibilityCheckMetadata[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          eligibilityChecks.push(JSON.parse(result[1] as string));
        } catch (err) {
          console.error("Error parsing eligibility check metadata:", err);
        }
      }
    });

    // Sort by createdAt descending (most recent first)
    return eligibilityChecks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get all eligibility checks for a given patient ID
   */
  async getEligibilityChecksByPatientId(
    patientId: string | number,
  ): Promise<EligibilityCheckMetadata[]> {
    const patientKey = `eligibility:patient:${patientId}`;
    const taskIds = await this.redis.smembers(patientKey);

    if (taskIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    taskIds.forEach((taskId) => {
      pipeline.get(`eligibility:task:${taskId}`);
    });

    const results = await pipeline.exec();
    const eligibilityChecks: EligibilityCheckMetadata[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          eligibilityChecks.push(JSON.parse(result[1] as string));
        } catch (err) {
          console.error("Error parsing eligibility check metadata:", err);
        }
      }
    });

    return eligibilityChecks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get all eligibility checks for a given appointment ID
   */
  async getEligibilityChecksByAppointmentId(
    appointmentId: number,
  ): Promise<EligibilityCheckMetadata[]> {
    const appointmentKey = `eligibility:appointment:${appointmentId}`;
    const taskIds = await this.redis.smembers(appointmentKey);

    if (taskIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    taskIds.forEach((taskId) => {
      pipeline.get(`eligibility:task:${taskId}`);
    });

    const results = await pipeline.exec();
    const eligibilityChecks: EligibilityCheckMetadata[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          eligibilityChecks.push(JSON.parse(result[1] as string));
        } catch (err) {
          console.error("Error parsing eligibility check metadata:", err);
        }
      }
    });

    return eligibilityChecks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get all eligibility checks for a given Emirates ID
   */
  async getEligibilityChecksByEmiratesId(
    emiratesId: string,
  ): Promise<EligibilityCheckMetadata[]> {
    const emiratesKey = `eligibility:emirates:${emiratesId}`;
    const taskIds = await this.redis.smembers(emiratesKey);

    if (taskIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    taskIds.forEach((taskId) => {
      pipeline.get(`eligibility:task:${taskId}`);
    });

    const results = await pipeline.exec();
    const eligibilityChecks: EligibilityCheckMetadata[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          eligibilityChecks.push(JSON.parse(result[1] as string));
        } catch (err) {
          console.error("Error parsing eligibility check metadata:", err);
        }
      }
    });

    return eligibilityChecks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get all eligibility checks for a given member ID (card number)
   */
  async getEligibilityChecksByMemberId(
    memberId: string,
  ): Promise<EligibilityCheckMetadata[]> {
    const memberKey = `eligibility:member:${memberId}`;
    const taskIds = await this.redis.smembers(memberKey);

    if (taskIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    taskIds.forEach((taskId) => {
      pipeline.get(`eligibility:task:${taskId}`);
    });

    const results = await pipeline.exec();
    const eligibilityChecks: EligibilityCheckMetadata[] = [];

    results?.forEach((result) => {
      if (result && result[1]) {
        try {
          eligibilityChecks.push(JSON.parse(result[1] as string));
        } catch (err) {
          console.error("Error parsing eligibility check metadata:", err);
        }
      }
    });

    return eligibilityChecks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Get eligibility check metadata by task ID
   */
  async getEligibilityCheckByTaskId(
    taskId: string,
  ): Promise<EligibilityCheckMetadata | null> {
    const metadataKey = `eligibility:task:${taskId}`;
    const metadataStr = await this.redis.get(metadataKey);

    if (metadataStr) {
      return JSON.parse(metadataStr);
    }
    return null;
  }

  /**
   * Get the most recent eligibility check for a given MPI
   */
  async getLatestEligibilityCheckByMPI(
    mpi: string,
  ): Promise<EligibilityCheckMetadata | null> {
    const checks = await this.getEligibilityChecksByMPI(mpi);
    return checks.length > 0 ? checks[0] : null;
  }

  /**
   * Get the most recent completed eligibility check for a given MPI
   */
  async getLatestCompletedCheckByMPI(
    mpi: string,
  ): Promise<EligibilityCheckMetadata | null> {
    const checks = await this.getEligibilityChecksByMPI(mpi);
    const completedChecks = checks.filter(
      (check) => check.status === "complete",
    );
    return completedChecks.length > 0 ? completedChecks[0] : null;
  }

  /**
   * Delete an eligibility check mapping
   */
  async deleteEligibilityCheck(taskId: string): Promise<void> {
    const metadataKey = `eligibility:task:${taskId}`;
    const metadataStr = await this.redis.get(metadataKey);

    if (metadataStr) {
      const metadata: EligibilityCheckMetadata = JSON.parse(metadataStr);
      const pipeline = this.redis.pipeline();

      // Remove from all sets
      if (metadata.mpi) {
        pipeline.srem(`eligibility:mpi:${metadata.mpi}`, taskId);
      }
      if (metadata.patientId) {
        pipeline.srem(`eligibility:patient:${metadata.patientId}`, taskId);
      }
      if (metadata.appointmentId) {
        pipeline.srem(`eligibility:appointment:${metadata.appointmentId}`, taskId);
      }
      if (metadata.emiratesId) {
        pipeline.srem(`eligibility:emirates:${metadata.emiratesId}`, taskId);
      }
      if (metadata.memberId) {
        pipeline.srem(`eligibility:member:${metadata.memberId}`, taskId);
      }

      // Delete metadata
      pipeline.del(metadataKey);

      await pipeline.exec();
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
export const eligibilityRedisService = new EligibilityRedisService();
