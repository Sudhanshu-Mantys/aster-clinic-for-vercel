/**
 * API endpoint to retrieve eligibility checks by MPI
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  eligibilityRedisService,
  EligibilityCheckMetadata,
} from "../../../lib/redis-eligibility-mapping";

interface GetByMPIResponse {
  success: boolean;
  data?: EligibilityCheckMetadata[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetByMPIResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { mpi } = req.query;

    if (!mpi || typeof mpi !== "string") {
      return res.status(400).json({
        success: false,
        error: "MPI parameter is required",
      });
    }

    console.log("Fetching eligibility checks for MPI:", mpi);

    const eligibilityChecks = await eligibilityRedisService.getEligibilityChecksByMPI(mpi);

    return res.status(200).json({
      success: true,
      data: eligibilityChecks,
    });
  } catch (error: any) {
    console.error("Error fetching eligibility checks by MPI:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
