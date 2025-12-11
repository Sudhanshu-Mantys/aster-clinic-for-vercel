// API endpoint for managing polling task_ids in Redis
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

const TASKS_KEY = 'eligibility:polling:tasks';
const TTL = 60 * 60; // 1 hour TTL for active tasks

export interface PollingTask {
  taskId: string;
  historyId: string;
  attempts: number;
  startedAt: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const redis = getRedisClient();

  try {
    switch (req.method) {
      case 'GET': {
        // Get all active tasks or a specific task
        const { taskId } = req.query;

        const data = await redis.get(TASKS_KEY);
        const tasks: PollingTask[] = data ? JSON.parse(data) : [];

        if (taskId && typeof taskId === 'string') {
          const task = tasks.find((t) => t.taskId === taskId);
          return res.status(200).json(task || null);
        }

        // Filter out tasks that are too old (> 10 minutes)
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        const activeTasks = tasks.filter(
          (task) => now - task.startedAt < tenMinutes
        );

        // Update Redis if we filtered out any tasks
        if (activeTasks.length !== tasks.length) {
          await redis.setex(TASKS_KEY, TTL, JSON.stringify(activeTasks));
        }

        return res.status(200).json(activeTasks);
      }

      case 'POST': {
        // Add new task
        const task = req.body as PollingTask;

        const data = await redis.get(TASKS_KEY);
        const tasks: PollingTask[] = data ? JSON.parse(data) : [];

        // Check if task already exists
        const existingIndex = tasks.findIndex((t) => t.taskId === task.taskId);
        if (existingIndex !== -1) {
          // Update existing task
          tasks[existingIndex] = task;
        } else {
          // Add new task
          tasks.push(task);
        }

        await redis.setex(TASKS_KEY, TTL, JSON.stringify(tasks));

        return res.status(201).json(task);
      }

      case 'PUT': {
        // Update existing task
        const { taskId, updates } = req.body;

        if (!taskId) {
          return res.status(400).json({ error: 'taskId is required' });
        }

        const data = await redis.get(TASKS_KEY);
        const tasks: PollingTask[] = data ? JSON.parse(data) : [];

        const index = tasks.findIndex((t) => t.taskId === taskId);
        if (index === -1) {
          return res.status(404).json({ error: 'Task not found' });
        }

        tasks[index] = { ...tasks[index], ...updates };
        await redis.setex(TASKS_KEY, TTL, JSON.stringify(tasks));

        return res.status(200).json(tasks[index]);
      }

      case 'DELETE': {
        // Delete a specific task
        const { taskId } = req.query;

        if (!taskId || typeof taskId !== 'string') {
          return res.status(400).json({ error: 'taskId is required' });
        }

        const data = await redis.get(TASKS_KEY);
        const tasks: PollingTask[] = data ? JSON.parse(data) : [];

        const filtered = tasks.filter((t) => t.taskId !== taskId);
        await redis.setex(TASKS_KEY, TTL, JSON.stringify(filtered));

        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error('Error in polling tasks API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
