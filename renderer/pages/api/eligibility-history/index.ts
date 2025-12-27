// API endpoint for managing eligibility history in Redis
import { NextApiRequest, NextApiResponse } from 'next';
import {
  eligibilityHistoryRedisService,
  EligibilityHistoryItem,
} from '../../../lib/redis-eligibility-history';
import { getClinicIdFromQuery } from '../clinic-config/_helpers';

// Re-export interface for backward compatibility
export type { EligibilityHistoryItem };

// Mantys API configuration
const MANTYS_API_BASE_URL =
  process.env.MANTYS_API_URL || 'https://aster.api.mantys.org';
const MANTYS_API_KEY =
  process.env.MANTYS_API_KEY ||
  'api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab';
const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || 'aster-clinic';
const MANTYS_CLINIC_ID =
  process.env.MANTYS_CLINIC_ID || '92d5da39-36af-4fa2-bde3-3828600d7871';

/**
 * Fetch current status from Mantys API
 */
async function fetchMantysStatus(taskId: string): Promise<{
  status: 'pending' | 'processing' | 'complete' | 'error';
  interimResults?: {
    screenshot?: string;
    documents?: Array<{ id: string; tag: string; url: string }>;
  };
  result?: any;
  error?: string;
  message?: string;
}> {
  try {
    console.log(`Fetching Mantys status for task: ${taskId}`);

    const resultResponse = await fetch(
      `${MANTYS_API_BASE_URL}/v2/api-integration-v2/eligibility-result/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': MANTYS_CLIENT_ID,
          'X-Clinic-ID': MANTYS_CLINIC_ID,
          'x-api-key': `Bearer ${MANTYS_API_KEY}`,
          Accept: 'application/json',
        },
      },
    );

    if (!resultResponse.ok) {
      console.error(`Mantys status check failed with HTTP ${resultResponse.status}`);
      return {
        status: 'error',
        error: `Failed to check status: ${resultResponse.statusText}`,
      };
    }

    const resultData: any = await resultResponse.json();
    console.log(`Mantys task status: ${resultData.status}`);

    // Check if this is a search_all task
    const isSearchAll = resultData.is_search_all === true;
    const searchAllStatus = resultData.search_all_status;
    const aggregatedResults = resultData.aggregated_results || [];

    // For search_all tasks
    if (isSearchAll) {
      if (searchAllStatus === 'SEARCH_ALL_COMPLETE') {
        return {
          status: 'complete',
          result: resultData,
          message: 'Search all complete!',
        };
      } else if (
        searchAllStatus === 'SEARCH_ALL_PROCESSING' ||
        resultData.status === 'EXTRACTING_DATA' ||
        resultData.status === 'NAVIGATING_WEBSITE'
      ) {
        return {
          status: 'processing',
          interimResults: resultData.interim_results
            ? {
              screenshot: resultData.interim_results.screenshot_key,
              documents:
                resultData.interim_results.referral_documents?.map(
                  (doc: any) => ({
                    id: doc.id,
                    tag: doc.tag,
                    url: doc.s3_url,
                  }),
                ) || [],
            }
            : undefined,
          message: 'Searching across all TPAs...',
        };
      } else {
        return {
          status: 'pending',
          message: 'Starting search across all TPAs...',
        };
      }
    }

    // Handle different states for regular (non-search_all) tasks
    if (resultData.status === 'EXTRACTING_DATA' && resultData.interim_results) {
      return {
        status: 'processing',
        interimResults: {
          screenshot: resultData.interim_results.screenshot_key,
          documents: resultData.interim_results.referral_documents?.map(
            (doc: any) => ({
              id: doc.id,
              tag: doc.tag,
              url: doc.s3_url,
            }),
          ) || [],
        },
        message: 'Extracting eligibility data...',
      };
    }

    if (
      resultData.status === 'PROCESS_COMPLETE' &&
      resultData.eligibility_result
    ) {
      const dataDump = resultData.eligibility_result.data_dump;

      // Determine if this is an error result
      const isError =
        !dataDump.data ||
        dataDump.error_type ||
        (dataDump.message &&
          (dataDump.message.toLowerCase().includes('invalid') ||
            dataDump.message.toLowerCase().includes('error') ||
            dataDump.message.toLowerCase().includes('failed') ||
            dataDump.message.toLowerCase().includes('credentials')));

      const finalStatus = isError ? 'error' : 'complete';
      let errorMessage: string;
      if (isError) {
        if (dataDump.message) {
          errorMessage = dataDump.message;
        } else if (dataDump.error_type) {
          errorMessage = dataDump.error_type;
        } else {
          errorMessage = 'Eligibility check failed';
        }
      } else {
        errorMessage =
          dataDump.status === 'member_not_found'
            ? 'Member not found'
            : 'Eligibility check complete';
      }

      return {
        status: finalStatus,
        result: {
          tpa: dataDump.tpa,
          data: dataDump.data,
          status: dataDump.status,
          job_task_id: dataDump.job_task_id,
          task_id: resultData.task_id,
          message: dataDump.message,
          error_type: dataDump.error_type,
        },
        error: isError ? errorMessage : undefined,
        message: errorMessage,
      };
    }

    // Task is still in queue or other state
    return {
      status: 'pending',
      message: 'Task is being processed...',
    };
  } catch (error: any) {
    console.error('Error fetching Mantys status:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to fetch status from Mantys API',
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET': {
        // Get all history or filter by status
        const { status, taskId, id, appointmentId, clinic_id } = req.query;

        // Get clinicId from query or use default
        const clinicId = clinic_id && typeof clinic_id === 'string'
          ? clinic_id
          : getClinicIdFromQuery(req) || '92d5da39-36af-4fa2-bde3-3828600d7871'; // Default clinic ID

        // Filter by taskId
        if (taskId && typeof taskId === 'string') {
          const item = await eligibilityHistoryRedisService.getHistoryByTaskId(taskId);
          return res.status(200).json(item || null);
        }

        // Filter by id
        if (id && typeof id === 'string') {
          const item = await eligibilityHistoryRedisService.getHistoryItem(id);
          return res.status(200).json(item || null);
        }

        // Filter by appointmentId
        if (appointmentId) {
          const appointmentIdNum = typeof appointmentId === 'string'
            ? parseInt(appointmentId, 10)
            : typeof appointmentId === 'number'
              ? appointmentId
              : null;

          if (appointmentIdNum && !isNaN(appointmentIdNum)) {
            const items = await eligibilityHistoryRedisService.getHistoryByAppointmentId(appointmentIdNum);
            return res.status(200).json(items);
          }
        }

        // Get all items for clinic
        let items = await eligibilityHistoryRedisService.getHistoryByClinicId(clinicId);

        // Filter by status
        if (status && typeof status === 'string') {
          if (status === 'active') {
            items = items.filter(
              (item) =>
                item.status === 'pending' || item.status === 'processing'
            );
          } else if (status === 'completed') {
            items = items.filter(
              (item) => item.status === 'complete' || item.status === 'error'
            );
          }
        }

        return res.status(200).json(items);
      }

      case 'POST': {
        // Add new history item
        const item = req.body as Omit<EligibilityHistoryItem, 'id' | 'createdAt'>;

        // Ensure clinicId is present
        const clinicId = item.clinicId || getClinicIdFromQuery(req) || req.query.clinic_id as string || '92d5da39-36af-4fa2-bde3-3828600d7871';

        if (!item.clinicId) {
          item.clinicId = clinicId;
        }

        const newItem = await eligibilityHistoryRedisService.addHistoryItem(item);

        return res.status(201).json(newItem);
      }

      case 'PUT': {
        // Update existing history item
        const { id, taskId, updates } = req.body;

        // Check if we need to fetch from Mantys API
        // This happens when status is set to "pending" with empty or missing interimResults
        const hasEmptyInterimResults =
          !updates.interimResults ||
          (typeof updates.interimResults === 'object' &&
            Object.keys(updates.interimResults).length === 0);
        const shouldFetchFromMantys =
          updates.status === 'pending' &&
          hasEmptyInterimResults &&
          (taskId || id);

        let itemToUpdate: EligibilityHistoryItem | null = null;
        let actualTaskId: string | null = null;

        // Get the existing item to get the taskId if needed
        if (id) {
          itemToUpdate = await eligibilityHistoryRedisService.getHistoryItem(id);
          if (itemToUpdate) {
            actualTaskId = itemToUpdate.taskId;
          }
        } else if (taskId) {
          itemToUpdate = await eligibilityHistoryRedisService.getHistoryByTaskId(taskId);
          actualTaskId = taskId;
        } else {
          return res.status(400).json({ error: 'Either id or taskId is required' });
        }

        if (!itemToUpdate) {
          return res.status(404).json({ error: 'History item not found' });
        }

        // If we need to fetch from Mantys, do it now
        if (shouldFetchFromMantys && actualTaskId) {
          console.log(`Fetching latest status from Mantys for task: ${actualTaskId}`);
          const mantysStatus = await fetchMantysStatus(actualTaskId);

          // Merge Mantys results with the updates
          updates.status = mantysStatus.status;
          if (mantysStatus.interimResults) {
            updates.interimResults = {
              screenshot: mantysStatus.interimResults.screenshot,
              documents: mantysStatus.interimResults.documents?.map((doc) => ({
                name: doc.tag || doc.id,
                url: doc.url,
                type: doc.tag || 'document',
              })),
            };
          }
          if (mantysStatus.result) {
            updates.result = mantysStatus.result;
          }
          if (mantysStatus.error) {
            updates.error = mantysStatus.error;
          }
          if (mantysStatus.status === 'complete' || mantysStatus.status === 'error') {
            updates.completedAt = new Date().toISOString();
          }
          if (mantysStatus.status === 'processing') {
            // Increment polling attempts if processing
            updates.pollingAttempts = (itemToUpdate.pollingAttempts || 0) + 1;
          }
        }

        // Apply the updates
        let updatedItem: EligibilityHistoryItem | null = null;
        if (id) {
          updatedItem = await eligibilityHistoryRedisService.updateHistoryItem(id, updates);
        } else if (taskId) {
          updatedItem = await eligibilityHistoryRedisService.updateHistoryByTaskId(taskId, updates);
        }

        if (!updatedItem) {
          return res.status(404).json({ error: 'History item not found' });
        }

        return res.status(200).json(updatedItem);
      }

      case 'DELETE': {
        // Delete history item or clear all
        const { id, clearAll, clinic_id } = req.query;

        if (clearAll === 'true') {
          const clinicId = clinic_id && typeof clinic_id === 'string'
            ? clinic_id
            : getClinicIdFromQuery(req) || '92d5da39-36af-4fa2-bde3-3828600d7871';

          await eligibilityHistoryRedisService.deleteHistoryByClinicId(clinicId);
          return res.status(200).json({ success: true });
        }

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'ID is required' });
        }

        await eligibilityHistoryRedisService.deleteHistoryItem(id);

        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error('Error in eligibility history API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
