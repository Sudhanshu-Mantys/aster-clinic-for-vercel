/**
 * Mantys Referral Document Upload API Endpoint
 * Uploads documents to Mantys S3 storage for eligibility checks
 */

import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadResponse {
  success: boolean;
  data?: {
    url: string;
    object_key: string;
  };
  error?: string;
}

const MANTYS_API_BASE_URL =
  process.env.MANTYS_API_URL || "https://aster.api.mantys.org";
const DEFAULT_MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
const DEFAULT_MANTYS_CLINIC_ID =
  process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Get authorization header and client/clinic IDs from request headers
  const authHeader = req.headers["authorization"] as string;
  const clientId = (req.headers["x-client-id"] as string) || DEFAULT_MANTYS_CLIENT_ID;
  const clinicId = (req.headers["x-clinic-id"] as string) || DEFAULT_MANTYS_CLINIC_ID;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Authorization header is required" });
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    const pathField = fields.path;
    const path = Array.isArray(pathField) ? pathField[0] : pathField;

    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    if (!path) {
      return res.status(400).json({
        success: false,
        error: "No path provided",
      });
    }

    // Validate PDF only
    const mimeType = file.mimetype || "application/pdf";
    if (mimeType !== "application/pdf") {
      return res.status(400).json({
        success: false,
        error: "Only PDF files are allowed",
      });
    }

    // Read the file from temp storage
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = file.originalFilename || file.newFilename || "document.pdf";

    console.log(`Uploading document to Mantys: ${path}/${fileName}`);
    console.log(`Using Client ID: ${clientId}, Clinic ID: ${clinicId}`);
    console.log(`File size: ${fileBuffer.length} bytes, MIME: ${mimeType}`);

    // Build multipart form data manually to match browser format exactly
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;

    // Build the multipart body exactly like the browser does
    const parts: Buffer[] = [];

    // Add path field
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="path"\r\n\r\n` +
      `${path}\r\n`
    ));

    // Add file field
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n`));

    // Add closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    // Upload to Mantys API
    const uploadResponse = await fetch(
      `${MANTYS_API_BASE_URL}/v2/eligibilities-v3/upload-document`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "X-Client-ID": clientId,
          "X-Clinic-ID": clinicId,
          "Accept": "application/json",
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      }
    );

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temp file:", cleanupError);
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Mantys upload error:", uploadResponse.status, errorText);
      return res.status(uploadResponse.status).json({
        success: false,
        error: `Upload failed: ${errorText || uploadResponse.statusText}`,
      });
    }

    const result = await uploadResponse.json();
    console.log("Upload successful:", result);

    // Extract URL and object_key from response
    const url = result?.data?.url || result?.url;
    const objectKey = result?.data?.object_key || result?.object_key || `${path}/${fileName}`;

    if (!url) {
      return res.status(500).json({
        success: false,
        error: "Upload succeeded but no URL was returned",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        url,
        object_key: objectKey,
      },
    });
  } catch (error: any) {
    console.error("Error uploading document:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
