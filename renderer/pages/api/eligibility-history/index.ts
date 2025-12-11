// API endpoint for managing eligibility history in Redis
import { NextApiRequest, NextApiResponse } from 'next';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set');
}

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      tls: {
        rejectUnauthorized: false,
      },
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  }
  return redisClient;
}

const HISTORY_KEY = 'eligibility:history';
const MAX_HISTORY_ITEMS = 100;
const TTL = 60 * 60 * 24 * 30; // 30 days

export interface EligibilityHistoryItem {
  id: string;
  patientId: string;
  taskId: string;
  patientName?: string;
  dateOfBirth?: string;
  insurancePayer?: string;
  patientMPI?: string;
  appointmentId?: number;
  encounterId?: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  createdAt: string;
  completedAt?: string;
  result?: any;
  interimResults?: {
    screenshot?: string;
    documents?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
  error?: string;
  pollingAttempts?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const redis = getRedisClient();

  try {
    switch (req.method) {
      case 'GET': {
        // Get all history or filter by status
        const { status, taskId, id } = req.query;

        const data = await redis.get(HISTORY_KEY);
        let items: EligibilityHistoryItem[] = data ? JSON.parse(data) : [];

        // Filter by taskId
        if (taskId && typeof taskId === 'string') {
          const item = items.find((item) => item.taskId === taskId);
          return res.status(200).json(item || null);
        }

        // Filter by id
        if (id && typeof id === 'string') {
          const item = items.find((item) => item.id === id);
          return res.status(200).json(item || null);
        }

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

        const data = await redis.get(HISTORY_KEY);
        const items: EligibilityHistoryItem[] = data ? JSON.parse(data) : [];

        const newItem: EligibilityHistoryItem = {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        };

        items.unshift(newItem);

        // Limit history size
        if (items.length > MAX_HISTORY_ITEMS) {
          items.splice(MAX_HISTORY_ITEMS);
        }

        await redis.setex(HISTORY_KEY, TTL, JSON.stringify(items));

        return res.status(201).json(newItem);
      }

      case 'PUT': {
        // Update existing history item
        const { id, taskId, updates } = req.body;

        const data = await redis.get(HISTORY_KEY);
        const items: EligibilityHistoryItem[] = data ? JSON.parse(data) : [];

        let index = -1;
        if (id) {
          index = items.findIndex((item) => item.id === id);
        } else if (taskId) {
          index = items.findIndex((item) => item.taskId === taskId);
        }

        if (index === -1) {
          return res.status(404).json({ error: 'History item not found' });
        }

        items[index] = { ...items[index], ...updates };
        await redis.setex(HISTORY_KEY, TTL, JSON.stringify(items));

        return res.status(200).json(items[index]);
      }

      case 'DELETE': {
        // Delete history item or clear all
        const { id, clearAll } = req.query;

        if (clearAll === 'true') {
          await redis.del(HISTORY_KEY);
          return res.status(200).json({ success: true });
        }

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'ID is required' });
        }

        const data = await redis.get(HISTORY_KEY);
        const items: EligibilityHistoryItem[] = data ? JSON.parse(data) : [];

        const filtered = items.filter((item) => item.id !== id);
        await redis.setex(HISTORY_KEY, TTL, JSON.stringify(filtered));

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
