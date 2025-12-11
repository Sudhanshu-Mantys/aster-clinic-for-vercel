/**
 * API endpoint to retrieve eligibility checks by member ID (card number)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  eligibilityRedisService,
  EligibilityCheckMetadata,
} from "../../../lib/redis-eligibility-mapping";

interface GetByMemberIdResponse {
  success: boolean;
  data?: EligibilityCheckMetadata[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetByMemberIdResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { memberId } = req.query;

    if (!memberId || typeof memberId !== "string") {
      return res.status(400).json({
        success: false,
        error: "memberId parameter is required",
      });
    }

    console.log("Fetching eligibility checks for member ID:", memberId);

    const eligibilityChecks = await eligibilityRedisService.getEligibilityChecksByMemberId(memberId);

    return res.status(200).json({
      success: true,
      data: eligibilityChecks,
    });
  } catch (error: any) {
    console.error("Error fetching eligibility checks by member ID:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
