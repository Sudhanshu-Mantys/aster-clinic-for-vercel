/**
 * API endpoint to update patient context in Redis
 * Used to add insurance details or other updates to existing context
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { patientContextRedisService } from '../../../../lib/redis-patient-context';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { appointmentId, patientId, mpi, updates } = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Updates object is required and must not be empty'
      });
    }

    // Try to update by appointment ID first (most reliable for adding insurance details)
    if (appointmentId) {
      await patientContextRedisService.updatePatientContextByAppointmentId(
        appointmentId,
        updates
      );
      return res.status(200).json({
        success: true,
        message: 'Patient context updated successfully',
        updatedBy: 'appointmentId',
        appointmentId,
      });
    }

    // Fall back to MPI
    if (mpi) {
      await patientContextRedisService.updatePatientContext(mpi, updates);
      return res.status(200).json({
        success: true,
        message: 'Patient context updated successfully',
        updatedBy: 'mpi',
        mpi,
      });
    }

    // Fall back to patient ID
    if (patientId) {
      // Get context by patient ID first, then update by MPI
      const context = await patientContextRedisService.getPatientContextByPatientId(
        Number(patientId)
      );
      if (context && context.mpi) {
        await patientContextRedisService.updatePatientContext(context.mpi, updates);
        return res.status(200).json({
          success: true,
          message: 'Patient context updated successfully',
          updatedBy: 'patientId',
          patientId,
        });
      }
    }

    return res.status(400).json({
      error: 'At least one of appointmentId, mpi, or patientId is required'
    });
  } catch (error) {
    console.error('Error updating patient context:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

