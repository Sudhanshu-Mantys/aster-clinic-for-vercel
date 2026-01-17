import type { NextApiRequest, NextApiResponse } from "next";
import { getLifeTrenzAuthorizationHeader } from "../../../lib/liftrenz-auth-token";
import { patientContextRedisService } from "../../../lib/redis-patient-context";
import FormData from "form-data";
import https from "https";

/**
 * Next.js API Route - Upload Attachment to Aster
 * Uploads files (e.g., eligibility screenshots) to the Aster attachment system
 */

// Use tunnel by default (safer, works from any network)
const useTunnel = process.env.NEXT_USE_TUNNEL !== "false";

// const API_BASE_URL = useTunnel
//   ? "https://aster-clinics-dev.mantys.org/SCMS/web/app.php"
//   : "https://prod.asterclinics.com/SCMS/web/app.php";

const API_BASE_URL = "https://stage.asterclinics.com/SCMS/web/app_sbox.php"

interface UploadMetadata {
  recType: null;
  isActive: number;
  patientId: number;
  encounterId: number | null; // Can be null for document uploads
  fbType: number;
  siteId: number;
  uploadDate: string; // Format: YYYY-MM-DD
  expiryDate: string; // Format: YYYY-MM-DD
  insTpaPatId: number;
  fileName: string;
  reportDate: string; // Format: YYYY-MM-DD
  isInterSite: number;
  createdBy: number;
  customerId: number;
  type: number;
  reqId: string;
  appointmentId: number;
  fileId: number;
}

interface UploadRequest {
  patientId: number;
  encounterId?: number | null; // Optional, can be null for document uploads
  appointmentId: number;
  insTpaPatId: number;
  fileName: string;
  fileUrl?: string; // URL to fetch the file from (e.g., S3, external URL)
  fileBase64?: string; // Or base64 encoded file data
  uploadDate?: string; // Optional, defaults to today
  expiryDate?: string; // Optional, defaults to 2 months from uploadDate
  reportDate?: string; // Optional, defaults to today
  createdBy?: number; // Optional, defaults to 13295
  reqId?: string | number; // Optional, reqid from save-eligibility-order response
}

/**
 * Format date to YYYY-MM-DD format
 */
function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add months to a date
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Fetch file from URL and return as Buffer
 */
async function fetchFileFromUrl(url: string): Promise<Buffer> {
  console.log("🌐 Fetching file from URL:", url);
  try {
    const response = await fetch(url);
    console.log(
      "📡 File fetch response status:",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Unable to read error body");
      console.error("❌ File fetch failed:", {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      throw new Error(
        `Failed to fetch file from ${url}: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(
      "✅ File fetched successfully, size:",
      arrayBuffer.byteLength,
      "bytes",
    );
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("❌ Exception while fetching file:", error);
    throw error;
  }
}

/**
 * Upload file to Aster attachment system using multipart/form-data
 */
async function uploadToAster(
  fileBuffer: Buffer,
  filename: string,
  metadata: UploadMetadata,
  authHeader: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    // Add form fields in the exact order as the curl command
    form.append("Filename", filename);
    form.append("body", JSON.stringify(metadata));
    form.append("fileName", fileBuffer, {
      filename: filename,
      contentType: "application/octet-stream",
    });
    form.append("Upload", "Submit Query");

    // Build the full URL
    const uploadUrl = `${API_BASE_URL}/eligibity/auth/attachment/upload/add`;
    console.log("🚀 Uploading to:", uploadUrl);

    // Parse URL
    const url = new URL(uploadUrl);

    // Create HTTPS agent that accepts self-signed certificates (equivalent to curl -k)
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    const options = {
      method: "POST",
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        ...form.getHeaders(),
        Accept: "text/*",
        "User-Agent":
          "Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0",
        Authorization: authHeader,
        "Cache-Control": "no-cache",
        Connection: "Keep-Alive",
      },
      agent: agent,
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log("📥 Upload response status:", res.statusCode);
        console.log("📦 Upload response body:", data);

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        } else {
          reject(
            new Error(`Upload failed with status ${res.statusCode}: ${data}`),
          );
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ Upload request error:", error);
      reject(error);
    });

    form.pipe(req);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("=== Upload Attachment API Called ===");
  console.log("Method:", req.method);

  // Only allow POST requests
  if (req.method !== "POST") {
    console.error("❌ Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse request body
    const uploadRequest: UploadRequest = req.body;

    // Validate required fields
    if (!uploadRequest.patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }
    // encounterId is optional - can be null for document uploads
    if (!uploadRequest.appointmentId) {
      return res.status(400).json({ error: "appointmentId is required" });
    }
    if (!uploadRequest.insTpaPatId) {
      return res.status(400).json({ error: "insTpaPatId is required" });
    }
    if (!uploadRequest.fileName) {
      return res.status(400).json({ error: "fileName is required" });
    }
    if (!uploadRequest.fileUrl && !uploadRequest.fileBase64) {
      return res
        .status(400)
        .json({ error: "Either fileUrl or fileBase64 is required" });
    }

    console.log("📋 Upload request:", {
      patientId: uploadRequest.patientId,
      encounterId: uploadRequest.encounterId,
      appointmentId: uploadRequest.appointmentId,
      fileName: uploadRequest.fileName,
    });

    // Fetch encounter ID from Redis appointment store (same logic as save-eligibility-order)
    let encounterId = uploadRequest.encounterId;
    if (uploadRequest.appointmentId) {
      try {
        const appointmentContext = await patientContextRedisService.getPatientContextByAppointmentId(
          uploadRequest.appointmentId
        );

        // Fetch encounter_id (check both snake_case and camelCase) - same as save-eligibility-order
        if (true) {
          const redisEncounterId = appointmentContext?.encounter_id || appointmentContext?.encounterId || undefined;
          if (redisEncounterId) {
            encounterId = redisEncounterId;
            console.log(`✅ Fetched encounter_id ${encounterId} from Redis appointment key for appointment ${uploadRequest.appointmentId}`);
          } else {
            console.warn(`⚠️ No encounter_id found in Redis appointment key for appointment ${uploadRequest.appointmentId}`);
            // Keep the original value if Redis doesn't have it
          }
        }
      } catch (error) {
        console.error('❌ Error fetching appointment context from Redis:', error);
        // Continue with existing value if Redis fetch fails
      }
    }

    // Get the JWT token
    console.log("🔑 Fetching JWT token...");
    // const authHeader = await getLifeTrenzAuthorizationHeader();
    const authHeader = "Bearer ";

    // Get file buffer
    let fileBuffer: Buffer;
    if (uploadRequest.fileUrl) {
      console.log("📥 Fetching file from URL:", uploadRequest.fileUrl);
      fileBuffer = await fetchFileFromUrl(uploadRequest.fileUrl);
    } else if (uploadRequest.fileBase64) {
      console.log("📥 Decoding base64 file data");
      fileBuffer = Buffer.from(uploadRequest.fileBase64, "base64");
    } else {
      throw new Error("No file data provided");
    }

    console.log("📦 File buffer size:", fileBuffer.length, "bytes");

    // Prepare dates
    const today = new Date();
    const uploadDate = uploadRequest.uploadDate || formatDateYYYYMMDD(today);
    const expiryDate =
      uploadRequest.expiryDate ||
      formatDateYYYYMMDD(addMonths(new Date(uploadDate), 2));
    const reportDate = uploadRequest.reportDate || formatDateYYYYMMDD(today);

    // Build metadata
    const metadata: UploadMetadata = {
      recType: null,
      isActive: 1,
      patientId: uploadRequest.patientId,
      encounterId: encounterId ?? null, // Use encounterId from request or Redis (same as save-eligibility-order)
      fbType: 3, // File type - 3 seems to be for eligibility/insurance docs
      siteId: 31, // Default site ID from your curl example
      uploadDate,
      expiryDate,
      insTpaPatId: uploadRequest.insTpaPatId,
      fileName: uploadRequest.fileName,
      reportDate,
      isInterSite: 0,
      createdBy: uploadRequest.createdBy || 13295, // Default user ID
      customerId: 1, // Default customer ID
      type: 1, // Document type
      reqId: uploadRequest.reqId ? String(uploadRequest.reqId) : String(uploadRequest.patientId), // Use reqid from order creation if provided, otherwise patient ID
      appointmentId: uploadRequest.appointmentId,
      fileId: 0, // 0 for new uploads
    };

    console.log("📋 Upload metadata:", JSON.stringify(metadata, null, 2));

    // Detect actual file extension from URL if provided
    let actualExtension = "pdf";
    if (uploadRequest.fileUrl) {
      const urlPath = uploadRequest.fileUrl.split("?")[0]; // Remove query params
      const urlExtension = urlPath.split(".").pop()?.toLowerCase();
      if (
        urlExtension &&
        ["pdf", "png", "jpg", "jpeg", "gif", "bmp"].includes(urlExtension)
      ) {
        actualExtension = urlExtension;
        console.log("🔍 Detected file type from URL:", actualExtension);
      }
    }

    // Use detected extension or keep the original if specified
    const requestedExtension = uploadRequest.fileName.split(".").pop() || "pdf";
    const fileExtension = actualExtension;
    const baseFilename = uploadRequest.fileName.replace(/\.[^.]+$/, ""); // Remove any extension
    const dateStr = uploadDate.replace(/-/g, "_");
    const fullFilename = `${baseFilename}_${dateStr}.${fileExtension}`;

    console.log(
      "📄 Full filename:",
      fullFilename,
      "(original requested extension:",
      requestedExtension + ")",
    );

    // Upload to Aster
    const uploadResult = await uploadToAster(
      fileBuffer,
      fullFilename,
      metadata,
      authHeader,
    );

    console.log("✅ Upload successful:", uploadResult);

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      result: uploadResult,
      metadata,
    });
  } catch (error) {
    console.error("❌❌❌ UPLOAD ERROR ❌❌❌");
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
