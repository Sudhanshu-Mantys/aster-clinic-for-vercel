import type { NextApiRequest, NextApiResponse } from "next";
import { patientContextRedisService } from "../../../lib/redis-patient-context";

/**
 * Next.js API Route - Today's Appointments
 * Fetches all appointments for the current date
 */

// Use tunnel by default (safer, works from any network)
const useTunnel = process.env.NEXT_USE_TUNNEL !== "false";

const API_BASE_URL = useTunnel
  ? "https://aster-clinics-dev.mantys.org/SCMS/web/app.php"
  : "https://prod.asterclinics.com/SCMS/web/app.php";

interface RequestHead {
  reqtime: string;
  srvseqno: string;
  reqtype: string;
}

interface AppointmentSearchRequestBody {
  type: null;
  payerId: number | null;
  visitTypeId: number | null;
  pageNo: number;
  patientName: string | null;
  recPerPage: number;
  groupByApntStatus: number;
  mpii1: string | null;
  referralUploadFilter: number;
  mobPhn: string | null;
  isFilterDate: number;
  appStatusId: string;
  filterByReferral: number;
  mcnNo: string | null;
  visitPurposeId: number | null;
  specialisationId: number | null;
  orderType: string | null;
  timeOrderBy: number;
  mpii2: string | null;
  physicianId: number | null;
  displayEncounterNumber: string | null;
  payerTypeId: number | null;
  insuranceType: string | null;
  isEmergencyAppointment: boolean | null;
  encounterType: number;
  customerSiteId: number;
  fromDate: string;
  toDate: string;
  roomId: number | null;
}

interface AppointmentSearchRequest {
  head: RequestHead;
  body: AppointmentSearchRequestBody;
}

/**
 * Format date to MM/DD/YYYY format
 */
function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Get current date/time in the format expected by the API
 */
function getRequestTime(): string {
  return new Date().toDateString(); // Format: "Wed Dec 10 2025"
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("=== Today's Appointments API Called ===");
  console.log("Method:", req.method);

  // Support both GET and POST requests
  if (req.method !== "GET" && req.method !== "POST") {
    console.error("❌ Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get filters from query params (GET) or body (POST)
  const filters = req.method === "GET" ? req.query : req.body;

  // Get today's date as default
  const today = new Date();
  const todayFormatted = formatDate(today);

  // Extract filter parameters with defaults
  const {
    fromDate = todayFormatted,
    toDate = todayFormatted,
    isFilterDate = 1,
    patientName = null,
    mpi = null,
    phoneNumber = null,
    displayEncounterNumber = null,
    appStatusId = "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27",
    physicianId = null,
    visitTypeId = null,
    specialisationId = null,
    roomId = null,
    payerId = null,
    payerTypeId = null,
    insuranceType = null,
    customerSiteId = 31,
    encounterType = 1,
    visitPurposeId = null,
    pageNo = 0,
    recPerPage = 200,
  } = filters;

  console.log("📅 Date range:", fromDate, "to", toDate);
  console.log("🔍 Filters:", {
    patientName,
    mpi,
    phoneNumber,
    displayEncounterNumber,
    appStatusId,
    physicianId,
    payerTypeId,
  });

  // Build the request body for the Aster Clinics API
  const requestBody: AppointmentSearchRequest = {
    head: {
      reqtime: getRequestTime(),
      srvseqno: "",
      reqtype: "POST",
    },
    body: {
      type: null,
      payerId: payerId ? Number(payerId) : null,
      visitTypeId: visitTypeId ? Number(visitTypeId) : null,
      pageNo: Number(pageNo),
      patientName: patientName || null,
      recPerPage: Number(recPerPage),
      groupByApntStatus: 0,
      mpii1: mpi || null,
      referralUploadFilter: 0,
      mobPhn: phoneNumber || null,
      isFilterDate: Number(isFilterDate),
      appStatusId: appStatusId,
      filterByReferral: 0,
      mcnNo: null,
      visitPurposeId: visitPurposeId ? Number(visitPurposeId) : null,
      specialisationId: specialisationId ? Number(specialisationId) : null,
      orderType: null,
      timeOrderBy: 2,
      mpii2: null,
      physicianId: physicianId ? Number(physicianId) : null,
      displayEncounterNumber: displayEncounterNumber || null,
      payerTypeId: payerTypeId ? Number(payerTypeId) : null,
      insuranceType: insuranceType || null,
      isEmergencyAppointment: null,
      encounterType: Number(encounterType),
      customerSiteId: Number(customerSiteId),
      fromDate: fromDate,
      toDate: toDate,
      roomId: roomId ? Number(roomId) : null,
    },
  };

  console.log("Request body to send:", JSON.stringify(requestBody, null, 2));

  try {
    console.log(
      "🚀 Making API request to:",
      `${API_BASE_URL}/apmgnt/patient/all/appointment/search/get`,
    );

    // Make the request to the Aster Clinics API
    const response = await fetch(
      `${API_BASE_URL}/apmgnt/patient/all/appointment/search/get`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log("📥 Response status:", response.status, response.statusText);

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error("Non-JSON response received:", textResponse.substring(0, 500));
      return res.status(500).json({
        error: "Couldn't fetch appointments",
      });
    }

    // Get the response data
    const data = await response.json();
    console.log("📦 Response data RecordCount:", data.body?.RecordCount);

    // Check if the response is ok
    if (!response.ok) {
      console.error("❌ API Response NOT OK:", {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return res.status(response.status).json({
        error: data.head?.StatusText || "Failed to fetch today's appointments",
        details: data,
      });
    }

    // Check if the API returned an error
    if (data.head && data.head.StatusValue !== 200) {
      console.error("❌ API returned error status:", data.head);
      return res.status(400).json({
        error: data.head.StatusText || "Failed to fetch today's appointments",
        details: data,
      });
    }

    console.log("✅ API response OK, RecordCount:", data.body?.RecordCount);

    // Store patient context in Redis in bulk (background task - fire and forget)
    // Store complete appointment data instead of just limited fields
    if (data.body?.Data && Array.isArray(data.body.Data)) {
      console.log(`📝 Preparing to store ${data.body.Data.length} appointments in Redis`);

      const contexts = data.body.Data
        .filter((appointmentData) => {
          const hasRequired = appointmentData.mpi && appointmentData.patient_id;
          if (!hasRequired) {
            console.warn(`⚠️ Skipping appointment ${appointmentData.appointment_id} - missing mpi or patient_id`);
          }
          return hasRequired;
        })
        .map((appointmentData) => {
          // Store all appointment data fields, ensuring required fields are present
          // Spread appointmentData first, then override with mapped field names
          const context: any = {
            // Include all appointment data fields first
            ...appointmentData,

            // Required fields (override to ensure they're present and correctly named)
            mpi: appointmentData.mpi,
            patientId: appointmentData.patient_id,
            patientName: appointmentData.full_name || "",
            lastUpdated: new Date().toISOString(),

            // Map field names to match our interface (override original field names)
            appointmentId: appointmentData.appointment_id,
            encounterId: appointmentData.encounter_id,
            phone: appointmentData.mobile_phone,
            email: appointmentData.email,
            // Explicitly ensure physician_id is included (from appointmentData or as physicianId)
            physician_id: appointmentData.physician_id || appointmentData.physicianId || undefined,
          };

          return context;
        });

      console.log(`📝 Filtered to ${contexts.length} valid contexts to store`);

      if (contexts.length > 0) {
        // Run as background task - don't await
        patientContextRedisService
          .storeBulkPatientContexts(contexts)
          .then(() => {
            console.log(
              `✅ Successfully bulk stored ${contexts.length} patient contexts in Redis`,
            );
            // Log a sample of what was stored
            if (contexts.length > 0) {
              const sample = contexts[0];
              console.log(`📋 Sample stored context - MPI: ${sample.mpi}, PatientId: ${sample.patientId}, AppointmentId: ${sample.appointmentId}`);
            }
          })
          .catch((redisError) => {
            console.error(
              "❌ Failed to bulk store appointment contexts in Redis (non-fatal):",
              redisError,
            );
            console.error("Error details:", redisError instanceof Error ? redisError.message : String(redisError));
            console.error("Error stack:", redisError instanceof Error ? redisError.stack : "No stack trace");
          });
      } else {
        console.warn("⚠️ No valid contexts to store in Redis");
      }
    } else {
      console.warn("⚠️ No appointment data found in response to store in Redis");
    }

    // Return the appointments immediately without waiting for Redis
    return res.status(200).json(data);
  } catch (error) {
    console.error("❌❌❌ PROXY ERROR ❌❌❌");
    console.error("Error type:", typeof error);
    console.error("Error object:", error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}
