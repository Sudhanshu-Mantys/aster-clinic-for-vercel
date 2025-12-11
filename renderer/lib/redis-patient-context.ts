import Redis from "ioredis";

// Redis connection configuration from environment
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
 * Interface for patient context stored in Redis
 */
export interface PatientContext {
  mpi: string;
  patientId: number;
  patientName: string;
  appointmentId?: number;
  encounterId?: number;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;
  lastUpdated: string;
}

/**
 * Key patterns:
 * - patient:mpi:{mpi} → Patient context
 * - patient:id:{patientId} → Patient context
 * - appointment:{appointmentId} → Appointment context with patient info
 */

export class PatientContextRedisService {
  private redis: Redis;
  private readonly TTL = 60 * 60 * 24 * 30; // 30 days

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Store patient context by MPI
   */
  async storePatientContext(context: PatientContext): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Store by MPI
    const mpiKey = `patient:mpi:${context.mpi}`;
    pipeline.setex(mpiKey, this.TTL, JSON.stringify(context));

    // Store by patient ID
    const patientIdKey = `patient:id:${context.patientId}`;
    pipeline.setex(patientIdKey, this.TTL, JSON.stringify(context));

    // If appointment ID exists, store by appointment ID
    if (context.appointmentId) {
      const appointmentKey = `appointment:${context.appointmentId}`;
      pipeline.setex(appointmentKey, this.TTL, JSON.stringify(context));
    }

    await pipeline.exec();
  }

  /**
   * Get patient context by MPI
   */
  async getPatientContextByMPI(mpi: string): Promise<PatientContext | null> {
    const mpiKey = `patient:mpi:${mpi}`;
    const data = await this.redis.get(mpiKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Get patient context by patient ID
   */
  async getPatientContextByPatientId(
    patientId: number
  ): Promise<PatientContext | null> {
    const patientIdKey = `patient:id:${patientId}`;
    const data = await this.redis.get(patientIdKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Get patient context by appointment ID
   */
  async getPatientContextByAppointmentId(
    appointmentId: number
  ): Promise<PatientContext | null> {
    const appointmentKey = `appointment:${appointmentId}`;
    const data = await this.redis.get(appointmentKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Update patient context (only updates provided fields)
   */
  async updatePatientContext(
    mpi: string,
    updates: Partial<PatientContext>
  ): Promise<void> {
    const existing = await this.getPatientContextByMPI(mpi);

    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      await this.storePatientContext(updated);
    }
  }

  /**
   * Delete patient context
   */
  async deletePatientContext(mpi: string): Promise<void> {
    const context = await this.getPatientContextByMPI(mpi);

    if (context) {
      const pipeline = this.redis.pipeline();

      pipeline.del(`patient:mpi:${context.mpi}`);
      pipeline.del(`patient:id:${context.patientId}`);

      if (context.appointmentId) {
        pipeline.del(`appointment:${context.appointmentId}`);
      }

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
export const patientContextRedisService = new PatientContextRedisService();
