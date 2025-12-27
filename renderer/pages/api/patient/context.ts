/**
 * API endpoint to fetch patient context from Redis
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { patientContextRedisService } from '../../../lib/redis-patient-context';

// Timeout wrapper for Redis operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string = 'Redis operation'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
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
    const REDIS_TIMEOUT = 10000; // 10 seconds timeout for Redis operations (allows for connection + 2-step lookup)

    // Try by appointment ID first (most reliable)
    if (appointmentId) {
      try {
        context = await withTimeout(
          patientContextRedisService.getPatientContextByAppointmentId(appointmentId),
          REDIS_TIMEOUT,
          'Fetch context by appointmentId'
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
          REDIS_TIMEOUT,
          'Fetch context by MPI'
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
          REDIS_TIMEOUT,
          'Fetch context by patientId'
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

    // Fetch insurance details from separate key if available
    try {
      const insuranceDetails = await withTimeout(
        patientContextRedisService.getInsuranceDetails(context.patientId),
        REDIS_TIMEOUT,
        'Fetch insurance details'
      );

      if (insuranceDetails) {
        // Include insurance details in the response
        return res.status(200).json({
          ...context,
          insuranceDetails,
        });
      }
    } catch (error) {
      // If insurance details fetch fails, just return context without it
      console.warn('Failed to fetch insurance details:', error);
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
