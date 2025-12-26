/**
 * Mantys Eligibility Result (v3) API Endpoint
 * Fetches the final eligibility result from Mantys v3 API
 */

import type { NextApiRequest, NextApiResponse } from "next";

const MANTYS_API_BASE_URL =
  process.env.MANTYS_API_URL || "https://aster.api.mantys.org";
const MANTYS_API_KEY =
  process.env.MANTYS_API_KEY ||
  "api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab";
const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
const MANTYS_CLINIC_ID =
  process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task_id } = req.query;

    if (!task_id || typeof task_id !== "string") {
      return res.status(400).json({ error: "Missing task_id" });
    }

    const resultResponse = await fetch(
      `${MANTYS_API_BASE_URL}/v2/api-integration-v3/eligibility-result/${task_id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": MANTYS_CLIENT_ID,
          "X-Clinic-ID": MANTYS_CLINIC_ID,
          "x-api-key": `Bearer ${MANTYS_API_KEY}`,
          Accept: "application/json",
        },
      },
    );

    if (!resultResponse.ok) {
      return res.status(resultResponse.status).json({
        error: `Failed to fetch eligibility result: ${resultResponse.statusText}`,
      });
    }

    const resultData = await resultResponse.json();
    return res.status(200).json(resultData);
  } catch (error: any) {
    console.error("Error fetching Mantys eligibility result (v3):", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
