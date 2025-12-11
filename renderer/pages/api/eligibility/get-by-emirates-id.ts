/**
 * API endpoint to retrieve eligibility checks by Emirates ID
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  eligibilityRedisService,
  EligibilityCheckMetadata,
} from "../../../lib/redis-eligibility-mapping";

interface GetByEmiratesIdResponse {
  success: boolean;
  data?: EligibilityCheckMetadata[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetByEmiratesIdResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { emiratesId } = req.query;

    if (!emiratesId || typeof emiratesId !== "string") {
      return res.status(400).json({
        success: false,
        error: "emiratesId parameter is required",
      });
    }

    console.log("Fetching eligibility checks for Emirates ID:", emiratesId);

    const eligibilityChecks = await eligibilityRedisService.getEligibilityChecksByEmiratesId(emiratesId);

    return res.status(200).json({
      success: true,
      data: eligibilityChecks,
    });
  } catch (error: any) {
    console.error("Error fetching eligibility checks by Emirates ID:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
