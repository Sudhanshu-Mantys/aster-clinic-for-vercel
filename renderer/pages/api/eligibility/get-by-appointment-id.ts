/**
 * API endpoint to retrieve eligibility checks by appointment ID
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  eligibilityRedisService,
  EligibilityCheckMetadata,
} from "../../../lib/redis-eligibility-mapping";

interface GetByAppointmentIdResponse {
  success: boolean;
  data?: EligibilityCheckMetadata[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetByAppointmentIdResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { appointmentId } = req.query;

    if (!appointmentId || typeof appointmentId !== "string") {
      return res.status(400).json({
        success: false,
        error: "appointmentId parameter is required",
      });
    }

    console.log("Fetching eligibility checks for appointment ID:", appointmentId);

    const eligibilityChecks = await eligibilityRedisService.getEligibilityChecksByAppointmentId(
      parseInt(appointmentId, 10)
    );

    return res.status(200).json({
      success: true,
      data: eligibilityChecks,
    });
  } catch (error: any) {
    console.error("Error fetching eligibility checks by appointment ID:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
