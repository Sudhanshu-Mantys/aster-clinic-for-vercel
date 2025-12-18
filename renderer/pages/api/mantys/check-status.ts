/**
 * Mantys Status Check API Endpoint
 * Checks the status of an eligibility check task
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { MantysTaskResultResponse } from "../../../types/mantys";
import { eligibilityRedisService } from "../../../lib/redis-eligibility-mapping";

const MANTYS_API_BASE_URL =
  process.env.MANTYS_API_URL || "https://aster.api.mantys.org";
const MANTYS_API_KEY =
  process.env.MANTYS_API_KEY ||
  "api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab";
const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || "aster-clinic";
const MANTYS_CLINIC_ID =
  process.env.MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";

interface StatusResponse {
  status: "pending" | "processing" | "complete" | "error";
  taskStatus: string;
  message: string;
  interimResults?: {
    screenshot?: string;
    documents?: Array<{ id: string; tag: string; url: string }>;
  };
  result?: any;
  isSearchAll?: boolean;
  searchAllStatus?: string;
  aggregatedResults?: any[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse | { error: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task_id } = req.body;

    if (!task_id) {
      return res.status(400).json({ error: "Missing task_id" });
    }

    console.log(`Checking status for task: ${task_id}`);

    const resultResponse = await fetch(
      `${MANTYS_API_BASE_URL}/v2/api-integration-v2/eligibility-result/${task_id}`,
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
      console.error(`Status check failed with HTTP ${resultResponse.status}`);
      return res.status(resultResponse.status).json({
        error: `Failed to check status: ${resultResponse.statusText}`,
      });
    }

    const resultData: any = await resultResponse.json();
    console.log(`Task status: ${resultData.status}`);

    // Check if this is a search_all task
    const isSearchAll = resultData.is_search_all === true;
    const searchAllStatus = resultData.search_all_status;
    const aggregatedResults = resultData.aggregated_results || [];

    // For search_all tasks, check search_all_status instead of status
    if (isSearchAll) {
      if (searchAllStatus === "SEARCH_ALL_COMPLETE") {
        // Search all is complete
        return res.status(200).json({
          status: "complete",
          taskStatus: resultData.status,
          message: "Search all complete!",
          isSearchAll: true,
          searchAllStatus: searchAllStatus,
          aggregatedResults: aggregatedResults,
          result: resultData,
        });
      } else if (searchAllStatus === "SEARCH_ALL_PROCESSING" || resultData.status === "EXTRACTING_DATA" || resultData.status === "NAVIGATING_WEBSITE") {
        // Search all is processing
        return res.status(200).json({
          status: "processing",
          taskStatus: resultData.status,
          message: "Searching across all TPAs...",
          interimResults: resultData.interim_results ? {
            screenshot: resultData.interim_results.screenshot_key,
            documents: resultData.interim_results.referral_documents?.map(
              (doc: any) => ({
                id: doc.id,
                tag: doc.tag,
                url: doc.s3_url,
              }),
            ) || [],
          } : undefined,
          isSearchAll: true,
          searchAllStatus: searchAllStatus,
          aggregatedResults: aggregatedResults,
        });
      } else {
        // Search all is pending
        return res.status(200).json({
          status: "pending",
          taskStatus: resultData.status,
          message: "Starting search across all TPAs...",
          isSearchAll: true,
          searchAllStatus: searchAllStatus,
          aggregatedResults: aggregatedResults,
        });
      }
    }

    // Handle different states for regular (non-search_all) tasks
    if (resultData.status === "EXTRACTING_DATA" && resultData.interim_results) {
      // Task is processing - update Redis status
      try {
        await eligibilityRedisService.updateEligibilityStatus(
          task_id,
          "processing",
        );
      } catch (redisError) {
        console.error("Failed to update Redis status (non-fatal):", redisError);
      }

      // Task is processing - return interim results
      return res.status(200).json({
        status: "processing",
        taskStatus: resultData.status,
        message: "Extracting eligibility data...",
        interimResults: {
          screenshot: resultData.interim_results.screenshot_key,
          documents: resultData.interim_results.referral_documents.map(
            (doc) => ({
              id: doc.id,
              tag: doc.tag,
              url: doc.s3_url,
            }),
          ),
        },
      });
    }

    if (
      resultData.status === "PROCESS_COMPLETE" &&
      resultData.eligibility_result
    ) {
      // Only process PROCESS_COMPLETE for non-search_all tasks
      // (search_all tasks are handled above)
      // Task is complete - check if result contains an error
      const dataDump = resultData.eligibility_result.data_dump;

      // Determine if this is an error result
      const isError =
        !dataDump.data || // Missing data indicates error
        dataDump.error_type || // Has error_type
        (dataDump.message && (
          dataDump.message.toLowerCase().includes('invalid') ||
          dataDump.message.toLowerCase().includes('error') ||
          dataDump.message.toLowerCase().includes('failed') ||
          dataDump.message.toLowerCase().includes('credentials')
        )); // Error message keywords

      const finalStatus = isError ? "error" : "complete";
      // Extract error message - prioritize message, then error_type, then construct from available info
      let errorMessage: string;
      if (isError) {
        if (dataDump.message) {
          errorMessage = dataDump.message;
        } else if (dataDump.error_type) {
          errorMessage = dataDump.error_type;
        } else {
          errorMessage = "Eligibility check failed";
        }
      } else {
        errorMessage = dataDump.status === "member_not_found"
          ? "Member not found"
          : "Eligibility check complete";
      }

      // Update Redis status with correct status
      try {
        await eligibilityRedisService.updateEligibilityStatus(
          task_id,
          finalStatus,
          new Date().toISOString(),
        );
      } catch (redisError) {
        console.error("Failed to update Redis status (non-fatal):", redisError);
      }

      return res.status(200).json({
        status: finalStatus,
        taskStatus: resultData.status,
        message: errorMessage,
        result: {
          tpa: dataDump.tpa,
          data: dataDump.data,
          status: dataDump.status,
          job_task_id: dataDump.job_task_id,
          task_id: resultData.task_id,
          message: dataDump.message,
          error_type: dataDump.error_type,
        },
      });
    }

    // Task is still in queue or other state
    return res.status(200).json({
      status: "pending",
      taskStatus: resultData.status,
      message: "Task is being processed...",
      isSearchAll: isSearchAll,
      searchAllStatus: searchAllStatus,
      aggregatedResults: aggregatedResults,
    });
  } catch (error: any) {
    console.error("Error checking Mantys status:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
