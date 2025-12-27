import Redis from "ioredis";

// Redis connection configuration from environment
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

// Singleton Redis client
let redisClient: Redis | null = null;
let isConnecting = false;
let connectionPromise: Promise<Redis> | null = null;

async function getRedisClient(): Promise<Redis> {
  // If client exists and is ready, return it immediately
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  // If already connecting, wait for that connection
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  isConnecting = true;
  connectionPromise = new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null;
    let resolved = false;

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      isConnecting = false;
    };

    const resolveOnce = (client: Redis) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(client);
      }
    };

    const rejectOnce = (error: Error) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        connectionPromise = null;
        reject(error);
      }
    };

    try {
      redisClient = new Redis(REDIS_URL, {
        tls: {
          rejectUnauthorized: false,
        },
        retryStrategy(times) {
          if (times > 10) {
            console.error('Redis: Too many retry attempts');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 500);
          return delay;
        },
        maxRetriesPerRequest: 3,
        connectTimeout: 5000, // 5 second connection timeout
        commandTimeout: 5000, // 5 second timeout for individual commands
        lazyConnect: false, // Connect immediately
      });

      redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
        // Don't reject on error if we're still connecting - let timeout handle it
        if (redisClient && redisClient.status === 'end') {
          rejectOnce(new Error(`Redis connection failed: ${err.message}`));
        }
      });

      redisClient.on("connect", () => {
        console.log("✅ Redis patient context client connected");
      });

      redisClient.on("ready", () => {
        console.log("✅ Redis patient context client ready");
        if (redisClient) {
          resolveOnce(redisClient);
        }
      });

      // Handle connection timeout
      timeout = setTimeout(() => {
        if (redisClient && redisClient.status !== 'ready') {
          console.error("Redis connection timeout after 5 seconds");
          rejectOnce(new Error("Redis connection timeout after 5 seconds"));
        }
      }, 5000);

      // If already ready, resolve immediately
      if (redisClient.status === 'ready') {
        resolveOnce(redisClient);
      }
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return connectionPromise;
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
 * - patient:id:{patientId} → Full patient context (JSON)
 * - patient:id:{patientId}:insurance-details → Insurance details (JSON)
 * - patient:mpi:{mpi} → Mapping to patient ID: {patientId: <ID>}
 * - patient:appointment1:{appointmentId} → Full patient context with appointment details (JSON)
 */

export class PatientContextRedisService {
  private readonly TTL = 60 * 60 * 24 * 30; // 30 days

  /**
   * Get Redis client, ensuring it's connected
   */
  private async getRedis(): Promise<Redis> {
    return await getRedisClient();
  }

  /**
   * Store patient context
   * Stores full context by patient ID and appointment ID (if present), and lightweight mapping for MPI
   */
  async storePatientContext(context: PatientContext): Promise<void> {
    const redis = await this.getRedis();
    const pipeline = redis.pipeline();

    // Store full context by patient ID (single source of truth)
    const patientIdKey = `patient:id:${context.patientId}`;
    pipeline.setex(patientIdKey, this.TTL, JSON.stringify(context));
    console.log(`✅ Storing full context in: ${patientIdKey}`);

    // Store lightweight mapping: MPI → patient ID
    const mpiKey = `patient:mpi:${context.mpi}`;
    const mpiMapping = JSON.stringify({ patientId: context.patientId });
    pipeline.setex(mpiKey, this.TTL, mpiMapping);
    console.log(`✅ Storing MPI mapping in: ${mpiKey} → {patientId: ${context.patientId}}`);

    // If appointment ID exists, store full context by appointment ID
    if (context.appointmentId) {
      const appointmentKey = `patient:appointment1:${context.appointmentId}`;
      pipeline.setex(appointmentKey, this.TTL, JSON.stringify(context));
      console.log(`✅ Storing full appointment context in: ${appointmentKey}`);
    }

    const results = await pipeline.exec();
    if (results) {
      const errors = results.filter(([err]) => err !== null);
      if (errors.length > 0) {
        console.error(`❌ Redis pipeline errors:`, errors);
      } else {
        console.log(`✅ Successfully stored patient context for Patient ID: ${context.patientId}, MPI: ${context.mpi}`);
      }
    }
  }

  /**
   * Store multiple patient contexts in bulk using a single pipeline
   * Stores full context by patient ID and appointment ID (if present), and lightweight mapping for MPI
   */
  async storeBulkPatientContexts(contexts: PatientContext[]): Promise<void> {
    if (contexts.length === 0) {
      console.log("⚠️ storeBulkPatientContexts called with empty array");
      return;
    }

    console.log(`📦 Starting bulk store of ${contexts.length} contexts in Redis`);

    try {
      const redis = await this.getRedis();

      // Test Redis connection
      try {
        await redis.ping();
        console.log("✅ Redis connection verified");
      } catch (pingError) {
        console.error("❌ Redis ping failed:", pingError);
        throw pingError;
      }

      const pipeline = redis.pipeline();
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

          // Store full context by patient ID (single source of truth)
          const patientIdKey = `patient:id:${context.patientId}`;
          pipeline.setex(patientIdKey, this.TTL, JSON.stringify(context));
          keysToStore++;

          // Store lightweight mapping: MPI → patient ID
          const mpiKey = `patient:mpi:${context.mpi}`;
          const mpiMapping = JSON.stringify({ patientId: context.patientId });
          pipeline.setex(mpiKey, this.TTL, mpiMapping);
          keysToStore++;

          // If appointment ID exists, store full context by appointment ID
          if (context.appointmentId) {
            const appointmentKey = `patient:appointment1:${context.appointmentId}`;
            pipeline.setex(appointmentKey, this.TTL, JSON.stringify(context));
            keysToStore++;
            console.log(`  📝 Queued keys: patient:id:${context.patientId}, patient:mpi:${context.mpi}, patient:appointment1:${context.appointmentId}`);
          } else {
            console.warn(`  ⚠️ Context missing appointmentId for MPI: ${context.mpi}, PatientId: ${context.patientId}`);
            console.log(`  📝 Queued keys: patient:id:${context.patientId}, patient:mpi:${context.mpi}`);
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
          console.log(`📊 Storage summary: ${contexts.length} contexts stored as ${keysToStore} Redis keys`);
          console.log(`   - ${contexts.length} full contexts in patient:id:* keys`);
          console.log(`   - ${contexts.length} MPI mappings in patient:mpi:* keys`);
          const appointmentCount = contexts.filter(c => c.appointmentId).length;
          if (appointmentCount > 0) {
            console.log(`   - ${appointmentCount} full appointment contexts in patient:appointment1:* keys`);
          }

          // Log sample keys that were created
          if (contexts.length > 0) {
            const sample = contexts[0];
            console.log(`🔑 Sample keys created:`);
            console.log(`   - patient:id:${sample.patientId}`);
            console.log(`   - patient:mpi:${sample.mpi}`);
            if (sample.appointmentId) {
              console.log(`   - patient:appointment1:${sample.appointmentId}`);
            }
          }
        } else {
          console.warn("⚠️ Pipeline exec returned null/undefined");
        }
      } catch (error) {
        console.error("❌ Redis pipeline execution failed:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
        throw error; // Re-throw so caller can handle it
      }
    } catch (error) {
      console.error("❌❌❌ CRITICAL: Failed to store patient contexts in Redis:", error);
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Full error:", error);
      throw error; // Re-throw so caller can see the error
    }
  }

  /**
   * Get patient context by MPI
   * Two-step lookup: MPI mapping → patient ID → full context
   */
  async getPatientContextByMPI(mpi: string): Promise<PatientContext | null> {
    const redis = await this.getRedis();

    // Step 1: Get patient ID from MPI mapping
    const mpiKey = `patient:mpi:${mpi}`;
    const mappingData = await redis.get(mpiKey);

    if (!mappingData) {
      return null;
    }

    try {
      const mapping = JSON.parse(mappingData);
      const patientId = mapping.patientId;

      if (!patientId) {
        return null;
      }

      // Step 2: Get full context by patient ID
      return await this.getPatientContextByPatientId(patientId);
    } catch (error) {
      console.error("Error parsing MPI mapping:", error);
      return null;
    }
  }

  /**
   * Get patient context by patient ID
   */
  async getPatientContextByPatientId(
    patientId: number
  ): Promise<PatientContext | null> {
    const redis = await this.getRedis();
    const patientIdKey = `patient:id:${patientId}`;
    const data = await redis.get(patientIdKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Get patient context by appointment ID
   * Direct lookup: appointment ID → full context
   */
  async getPatientContextByAppointmentId(
    appointmentId: number
  ): Promise<PatientContext | null> {
    const redis = await this.getRedis();

    // Get full context directly from appointment key
    const appointmentKey = `patient:appointment1:${appointmentId}`;
    const data = await redis.get(appointmentKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing appointment context:", error);
      return null;
    }
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
   * Store insurance details for a patient
   * Stores insurance details in a separate key: patient:id:{patientId}:insurance-details
   */
  async storeInsuranceDetails(
    patientId: number,
    insuranceDetails: any
  ): Promise<void> {
    const redis = await this.getRedis();
    const insuranceKey = `patient:id:${patientId}:insurance-details`;

    await redis.setex(
      insuranceKey,
      this.TTL,
      JSON.stringify(insuranceDetails)
    );

    console.log(`✅ Stored insurance details in: ${insuranceKey}`);
  }

  /**
   * Get insurance details for a patient
   */
  async getInsuranceDetails(patientId: number): Promise<any | null> {
    const redis = await this.getRedis();
    const insuranceKey = `patient:id:${patientId}:insurance-details`;
    const data = await redis.get(insuranceKey);

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  /**
   * Update insurance details for a patient
   */
  async updateInsuranceDetails(
    patientId: number,
    insuranceDetails: any
  ): Promise<void> {
    await this.storeInsuranceDetails(patientId, insuranceDetails);
  }

  /**
   * Delete insurance details for a patient
   */
  async deleteInsuranceDetails(patientId: number): Promise<void> {
    const redis = await this.getRedis();
    const insuranceKey = `patient:id:${patientId}:insurance-details`;
    await redis.del(insuranceKey);
    console.log(`✅ Deleted insurance details key: ${insuranceKey}`);
  }

  /**
   * Delete patient context
   * Gets context first to find all related keys, then deletes them
   */
  async deletePatientContext(mpi: string): Promise<void> {
    const context = await this.getPatientContextByMPI(mpi);

    if (context) {
      const redis = await this.getRedis();
      const pipeline = redis.pipeline();

      // Delete full context
      pipeline.del(`patient:id:${context.patientId}`);

      // Delete insurance details
      pipeline.del(`patient:id:${context.patientId}:insurance-details`);

      // Delete MPI mapping
      pipeline.del(`patient:mpi:${context.mpi}`);

      // Delete appointment ID mapping if exists
      if (context.appointmentId) {
        pipeline.del(`patient:appointment1:${context.appointmentId}`);
      }

      await pipeline.exec();
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      isConnecting = false;
      connectionPromise = null;
    }
  }
}

// Export singleton instance
export const patientContextRedisService = new PatientContextRedisService();

