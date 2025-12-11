/**
 * API endpoint to fetch patient context from Redis
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { patientContextRedisService } from '../../../lib/redis-patient-context';

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

    // Try by appointment ID first (most reliable)
    if (appointmentId) {
      context = await patientContextRedisService.getPatientContextByAppointmentId(appointmentId);
    }

    // Fall back to MPI
    if (!context && mpi) {
      context = await patientContextRedisService.getPatientContextByMPI(mpi);
    }

    // Fall back to patient ID
    if (!context && patientId) {
      context = await patientContextRedisService.getPatientContextByPatientId(Number(patientId));
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
