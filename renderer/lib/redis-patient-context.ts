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
 * Includes all appointment data fields for complete appointment information
 */
export interface PatientContext {
  // Core patient identifiers
  mpi: string;
  patientId: number;
  patientName: string;
  appointmentId?: number;
  encounterId?: number;

  // Contact information
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;

  // Full appointment data (all fields from AppointmentData)
  age?: string;
  gender_id?: number;
  nationality_id?: string;
  is_estimated?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_status?: string;
  appointment_status_id?: number;
  physician_name?: string;
  physician_id?: number;
  provider?: string;
  specialisation_name?: string;
  payer_type?: string;
  payer_name?: string;
  receiver_name?: string;
  network_name?: string;
  payer_id?: number;

  // Insurance details from claim/insurance/details/replicate/get API
  insuranceDetails?: {
    body?: {
      Data?: Array<{
        patient_insurance_tpa_policy_id?: number;
        patient_insurance_tpa_policy_id_sites?: number; // Equivalent to insTpaPatId
        tpa_name?: string;
        tpa_id?: number;
        tpa_policy_id?: string;
        insurance_status?: string;
        [key: string]: any;
      }>;
    };
    [key: string]: any;
  };

  // Additional fields that may be present in appointment data
  [key: string]: any;

  // Metadata
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
   * Store multiple patient contexts in bulk using a single pipeline
   */
  async storeBulkPatientContexts(contexts: PatientContext[]): Promise<void> {
    if (contexts.length === 0) {
      console.log("⚠️ storeBulkPatientContexts called with empty array");
      return;
    }

    console.log(`📦 Starting bulk store of ${contexts.length} contexts in Redis`);

    const pipeline = this.redis.pipeline();
    let keysToStore = 0;

    for (const context of contexts) {
      try {
        // Validate required fields
        if (!context.mpi || !context.patientId) {
          console.warn(`⚠️ Skipping context - missing mpi or patientId:`, {
            mpi: context.mpi,
            patientId: context.patientId,
            appointmentId: context.appointmentId,
          });
          continue;
        }

        // Store by MPI
        const mpiKey = `patient:mpi:${context.mpi}`;
        pipeline.setex(mpiKey, this.TTL, JSON.stringify(context));
        keysToStore++;

        // Store by patient ID
        const patientIdKey = `patient:id:${context.patientId}`;
        pipeline.setex(patientIdKey, this.TTL, JSON.stringify(context));
        keysToStore++;

        // If appointment ID exists, store by appointment ID
        if (context.appointmentId) {
          const appointmentKey = `appointment:${context.appointmentId}`;
          pipeline.setex(appointmentKey, this.TTL, JSON.stringify(context));
          keysToStore++;
          console.log(`  📝 Queued appointment:${context.appointmentId} for MPI: ${context.mpi}`);
        } else {
          console.warn(`  ⚠️ Context missing appointmentId for MPI: ${context.mpi}, PatientId: ${context.patientId}`);
        }
      } catch (error) {
        console.error(`❌ Error preparing context for storage:`, error);
        console.error(`  Context:`, {
          mpi: context.mpi,
          patientId: context.patientId,
          appointmentId: context.appointmentId,
        });
      }
    }

    if (keysToStore === 0) {
      console.warn("⚠️ No valid keys to store after processing contexts");
      return;
    }

    console.log(`📤 Executing Redis pipeline with ${keysToStore} SETEX operations`);

    try {
      const results = await pipeline.exec();

      if (results) {
        const errors = results.filter(([err]) => err !== null);
        const successes = results.filter(([err]) => err === null);

        if (errors.length > 0) {
          console.error(`❌ Redis pipeline had ${errors.length} errors out of ${results.length} operations`);
          errors.forEach(([err, result], index) => {
            console.error(`  Error ${index + 1}:`, err);
          });
        }

        console.log(`✅ Redis pipeline completed: ${successes.length} successful, ${errors.length} failed`);
      } else {
        console.warn("⚠️ Pipeline exec returned null/undefined");
      }
    } catch (error) {
      console.error("❌ Redis pipeline execution failed:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      throw error; // Re-throw so caller can handle it
    }
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
   * Update patient context by appointment ID (useful for adding insurance details)
   */
  async updatePatientContextByAppointmentId(
    appointmentId: number,
    updates: Partial<PatientContext>
  ): Promise<void> {
    const existing = await this.getPatientContextByAppointmentId(appointmentId);

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
