/**
 * API endpoint to fetch patient context from Redis
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { patientContextRedisService } from '../../../lib/redis-patient-context';

// Timeout wrapper for Redis operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mpi, patientId, appointmentId } = req.body;

    if (!mpi && !patientId && !appointmentId) {
      return res.status(400).json({
        error: 'At least one of mpi, patientId, or appointmentId is required'
      });
    }

    let context = null;
    const REDIS_TIMEOUT = 2000; // 2 seconds timeout for Redis operations

    // Try by appointment ID first (most reliable)
    if (appointmentId) {
      try {
        context = await withTimeout(
          patientContextRedisService.getPatientContextByAppointmentId(appointmentId),
          REDIS_TIMEOUT
        );
      } catch (error) {
        console.warn('Failed to fetch context by appointmentId:', error);
      }
    }

    // Fall back to MPI
    if (!context && mpi) {
      try {
        context = await withTimeout(
          patientContextRedisService.getPatientContextByMPI(mpi),
          REDIS_TIMEOUT
        );
      } catch (error) {
        console.warn('Failed to fetch context by MPI:', error);
      }
    }

    // Fall back to patient ID
    if (!context && patientId) {
      try {
        context = await withTimeout(
          patientContextRedisService.getPatientContextByPatientId(Number(patientId)),
          REDIS_TIMEOUT
        );
      } catch (error) {
        console.warn('Failed to fetch context by patientId:', error);
      }
    }

    if (!context) {
      return res.status(404).json({
        error: 'Patient context not found in Redis'
      });
    }

    return res.status(200).json(context);
  } catch (error) {
    console.error('Error fetching patient context:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
