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
  payerId: null;
  visitTypeId: null;
  pageNo: number;
  patientName: null;
  recPerPage: number;
  groupByApntStatus: number;
  mpii1: null;
  referralUploadFilter: number;
  mobPhn: null;
  isFilterDate: number;
  appStatusId: string;
  filterByReferral: number;
  mcnNo: null;
  visitPurposeId: null;
  specialisationId: null;
  orderType: null;
  timeOrderBy: number;
  mpii2: null;
  physicianId: null;
  displayEncounterNumber: null;
  payerTypeId: null;
  insuranceType: null;
  isEmergencyAppointment: null;
  encounterType: number;
  customerSiteId: number;
  fromDate: string;
  toDate: string;
  roomId: null;
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

  // Only allow GET requests
  if (req.method !== "GET") {
    console.error("❌ Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get today's date
  const today = new Date();
  const todayFormatted = formatDate(today);

  console.log("📅 Today's date:", todayFormatted);

  // Build the request body for the Aster Clinics API
  const requestBody: AppointmentSearchRequest = {
    head: {
      reqtime: getRequestTime(),
      srvseqno: "",
      reqtype: "POST",
    },
    body: {
      type: null,
      payerId: null,
      visitTypeId: null,
      pageNo: 0,
      patientName: null,
      recPerPage: 200, // Fetch more appointments for today
      groupByApntStatus: 0,
      mpii1: null,
      referralUploadFilter: 0,
      mobPhn: null,
      isFilterDate: 1,
      appStatusId: "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27",
      filterByReferral: 0,
      mcnNo: null,
      visitPurposeId: null,
      specialisationId: null,
      orderType: null,
      timeOrderBy: 2,
      mpii2: null,
      physicianId: null,
      displayEncounterNumber: null,
      payerTypeId: null,
      insuranceType: null,
      isEmergencyAppointment: null,
      encounterType: 1,
      customerSiteId: 31,
      fromDate: todayFormatted,
      toDate: todayFormatted,
      roomId: null,
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

    // Store patient context in Redis for each appointment
    try {
      if (data.body?.Data && Array.isArray(data.body.Data)) {
        for (const appointmentData of data.body.Data) {
          if (appointmentData.mpi && appointmentData.patient_id) {
            await patientContextRedisService.storePatientContext({
              mpi: appointmentData.mpi,
              patientId: appointmentData.patient_id,
              patientName: appointmentData.full_name || "",
              appointmentId: appointmentData.appointment_id,
              encounterId: appointmentData.encounter_id,
              phone: appointmentData.mobile_phone,
              email: appointmentData.email,
              dob: appointmentData.dob,
              gender: appointmentData.gender,
              lastUpdated: new Date().toISOString(),
            });
            console.log(
              `  📝 Stored context for appointment: ${appointmentData.appointment_id}, MPI: ${appointmentData.mpi}`,
            );
          }
        }
      }
    } catch (redisError) {
      console.error(
        "⚠️ Failed to store appointment context in Redis (non-fatal):",
        redisError,
      );
      // Continue even if Redis fails
    }

    // Return the appointments even if there are none (let the frontend handle empty state)
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
