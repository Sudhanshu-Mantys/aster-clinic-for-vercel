/**
 * API endpoint to retrieve eligibility checks by patient ID
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  eligibilityRedisService,
  EligibilityCheckMetadata,
} from "../../../lib/redis-eligibility-mapping";

interface GetByPatientIdResponse {
  success: boolean;
  data?: EligibilityCheckMetadata[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetByPatientIdResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { patientId } = req.query;

    if (!patientId || typeof patientId !== "string") {
      return res.status(400).json({
        success: false,
        error: "patientId parameter is required",
      });
    }

    console.log("Fetching eligibility checks for patient ID:", patientId);

    const eligibilityChecks = await eligibilityRedisService.getEligibilityChecksByPatientId(patientId);

    return res.status(200).json({
      success: true,
      data: eligibilityChecks,
    });
  } catch (error: any) {
    console.error("Error fetching eligibility checks by patient ID:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
