// API endpoint for managing eligibility history in Redis
import { NextApiRequest, NextApiResponse } from 'next';
import {
  eligibilityHistoryRedisService,
  EligibilityHistoryItem,
} from '../../../lib/redis-eligibility-history';
import { getClinicIdFromQuery } from '../clinic-config/_helpers';

// Re-export interface for backward compatibility
export type { EligibilityHistoryItem };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET': {
        // Get all history or filter by status
        const { status, taskId, id, clinic_id } = req.query;

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

        let updatedItem: EligibilityHistoryItem | null = null;

        if (id) {
          updatedItem = await eligibilityHistoryRedisService.updateHistoryItem(id, updates);
        } else if (taskId) {
          updatedItem = await eligibilityHistoryRedisService.updateHistoryByTaskId(taskId, updates);
        } else {
          return res.status(400).json({ error: 'Either id or taskId is required' });
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
