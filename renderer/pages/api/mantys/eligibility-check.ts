/**
 * Mantys Eligibility Check API Endpoint
 * Two-step process: 1) Create task, 2) Poll for results
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  MantysEligibilityRequest,
  MantysCreateTaskResponse,
} from "../../../types/mantys";
import { eligibilityRedisService } from "../../../lib/redis-eligibility-mapping";
import { patientContextRedisService } from "../../../lib/redis-patient-context";

interface TaskCreatedResponse {
  task_id: string;
  message: string;
  status: string;
}

interface ExtendedEligibilityRequest extends MantysEligibilityRequest {
  mpi?: string;
  patientId?: string | number;
  patientName?: string;
  appointmentId?: number;
  encounterId?: number;
}

const MANTYS_API_BASE_URL =
  process.env.MANTYS_API_URL || "https://aster.api.mantys.org";
const MANTYS_API_KEY =
  process.env.MANTYS_API_KEY ||
  "api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab";
const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
const MANTYS_CLINIC_ID =
  process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

// Note: This endpoint now returns immediately with task_id
// Frontend should poll /api/mantys/check-status for updates

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TaskCreatedResponse | { error: string; details?: any }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requestBody: ExtendedEligibilityRequest = req.body;

    // Validate required fields
    if (
      !requestBody.id_value ||
      !requestBody.tpa_name ||
      !requestBody.id_type ||
      !requestBody.visit_type
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: id_value, tpa_name, id_type, visit_type",
      });
    }

    // Extract patient metadata (not sent to Mantys API)
    let { mpi, patientId, patientName, appointmentId, encounterId, ...payload } = requestBody;

    // Try to enrich patient metadata from Redis
    // Priority: 1) appointmentId, 2) MPI, 3) patientId
    try {
      let storedContext = null;

      // First try by appointment ID (most reliable source from Redis)
      if (appointmentId) {
        storedContext = await patientContextRedisService.getPatientContextByAppointmentId(appointmentId);
        if (storedContext) {
          console.log(`  📥 Retrieved patient context from Redis for Appointment ID: ${appointmentId}`);
        }
      }

      // Then try by MPI if not found
      if (!storedContext && mpi) {
        storedContext = await patientContextRedisService.getPatientContextByMPI(mpi);
        if (storedContext) {
          console.log(`  📥 Retrieved patient context from Redis for MPI: ${mpi}`);
        }
      }

      // Finally try by patient ID if still not found
      if (!storedContext && patientId) {
        storedContext = await patientContextRedisService.getPatientContextByPatientId(Number(patientId));
        if (storedContext) {
          console.log(`  📥 Retrieved patient context from Redis for Patient ID: ${patientId}`);
        }
      }

      // Enrich with stored data if found
      if (storedContext) {
        patientId = patientId || storedContext.patientId?.toString();
        mpi = mpi || storedContext.mpi;
        patientName = patientName || storedContext.patientName;
        appointmentId = appointmentId || storedContext.appointmentId;
        encounterId = encounterId || storedContext.encounterId;
        console.log(`  ✅ Enriched patient data - Patient ID: ${patientId}, MPI: ${mpi}, Appointment: ${appointmentId}, Encounter: ${encounterId}`);
      }
    } catch (redisError) {
      console.error(
        "⚠️ Failed to retrieve patient context from Redis (non-fatal):",
        redisError,
      );
      // Continue even if Redis fails
    }

    console.log(
      "Step 1: Creating Mantys task...",
      JSON.stringify(payload, null, 2),
    );

    // Step 1: Create Task
    const createTaskResponse = await fetch(
      `${MANTYS_API_BASE_URL}/v2/api-integration/create-task`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": MANTYS_CLIENT_ID,
          "X-Clinic-ID": MANTYS_CLINIC_ID,
          "x-api-key": `Bearer ${MANTYS_API_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const createTaskData: MantysCreateTaskResponse =
      await createTaskResponse.json();

    console.log(
      "Create task response data:",
      JSON.stringify(createTaskData, null, 2),
    );

    if (!createTaskResponse.ok || !createTaskData.success) {
      console.error("Mantys Create Task Error:", createTaskData);
      return res.status(createTaskResponse.status).json({
        error: "Failed to create Mantys task",
        details: createTaskData,
      });
    }

    const taskId = createTaskData.data.task_id;
    console.log("Step 2: Task created successfully, ID:", taskId);

    if (!taskId) {
      console.error("No task ID found in response:", createTaskData);
      return res.status(500).json({
        error: "No task ID returned from Mantys API",
        details: createTaskData,
      });
    }

    // Store eligibility check metadata in Redis
    try {
      await eligibilityRedisService.addEligibilityCheck({
        taskId,
        mpi: mpi || "",
        patientId: patientId || "",
        patientName: patientName,
        emiratesId:
          payload.id_type === "EMIRATESID" ? payload.id_value : undefined,
        memberId:
          payload.id_type === "CARDNUMBER" ? payload.id_value : undefined,
        tpaCode: payload.tpa_name,
        idType: payload.id_type,
        visitType: payload.visit_type,
        appointmentId: appointmentId || undefined,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      console.log("Step 3: Stored eligibility check in Redis");

      // Also store/update patient context in Redis (important for manual searches)
      if (mpi && patientId) {
        try {
          await patientContextRedisService.storePatientContext({
            mpi: mpi,
            patientId: Number(patientId),
            patientName: patientName || "",
            appointmentId: appointmentId || undefined,
            encounterId: encounterId || undefined,
            lastUpdated: new Date().toISOString(),
          });
          console.log(`  ✅ Stored/updated patient context - MPI: ${mpi}, Patient ID: ${patientId}, Appointment: ${appointmentId || 'N/A'}`);
        } catch (contextError) {
          console.error("Failed to store patient context (non-fatal):", contextError);
        }
      }
    } catch (redisError) {
      console.error("Failed to store in Redis (non-fatal):", redisError);
      // Continue even if Redis fails - don't block the eligibility check
    }

    // Return task_id immediately - frontend will poll for status
    return res.status(202).json({
      task_id: taskId,
      message: "Task created successfully",
      status: "pending",
    });
  } catch (error: any) {
    console.error("Error in Mantys eligibility check:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
}
