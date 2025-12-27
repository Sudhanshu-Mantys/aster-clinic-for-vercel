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

    // Extract insurance details if present
    const { insuranceDetails, ...contextUpdates } = updates;
    
    // Determine patient ID for insurance details storage
    let resolvedPatientId: number | null = null;

    // Try to update by appointment ID first (most reliable for adding insurance details)
    if (appointmentId) {
      const context = await patientContextRedisService.getPatientContextByAppointmentId(
        appointmentId
      );
      if (context) {
        resolvedPatientId = context.patientId;
        
        // Store insurance details separately if provided
        if (insuranceDetails) {
          await patientContextRedisService.storeInsuranceDetails(
            context.patientId,
            insuranceDetails
          );
        }
        
        // Update context with remaining updates (excluding insuranceDetails)
        if (Object.keys(contextUpdates).length > 0) {
          await patientContextRedisService.updatePatientContextByAppointmentId(
            appointmentId,
            contextUpdates
          );
        }
        
        return res.status(200).json({
          success: true,
          message: 'Patient context updated successfully',
          updatedBy: 'appointmentId',
          appointmentId,
          insuranceDetailsStored: !!insuranceDetails,
        });
      }
    }

    // Fall back to MPI
    if (mpi) {
      const context = await patientContextRedisService.getPatientContextByMPI(mpi);
      if (context) {
        resolvedPatientId = context.patientId;
        
        // Store insurance details separately if provided
        if (insuranceDetails) {
          await patientContextRedisService.storeInsuranceDetails(
            context.patientId,
            insuranceDetails
          );
        }
        
        // Update context with remaining updates (excluding insuranceDetails)
        if (Object.keys(contextUpdates).length > 0) {
          await patientContextRedisService.updatePatientContext(mpi, contextUpdates);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Patient context updated successfully',
          updatedBy: 'mpi',
          mpi,
          insuranceDetailsStored: !!insuranceDetails,
        });
      }
    }

    // Fall back to patient ID
    if (patientId) {
      resolvedPatientId = Number(patientId);
      
      // Store insurance details separately if provided
      if (insuranceDetails) {
        await patientContextRedisService.storeInsuranceDetails(
          resolvedPatientId,
          insuranceDetails
        );
      }
      
      // Get context by patient ID first, then update by MPI
      const context = await patientContextRedisService.getPatientContextByPatientId(
        resolvedPatientId
      );
      if (context && context.mpi) {
        // Update context with remaining updates (excluding insuranceDetails)
        if (Object.keys(contextUpdates).length > 0) {
          await patientContextRedisService.updatePatientContext(context.mpi, contextUpdates);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Patient context updated successfully',
          updatedBy: 'patientId',
          patientId,
          insuranceDetailsStored: !!insuranceDetails,
        });
      } else if (insuranceDetails) {
        // If only insurance details were provided and context doesn't exist, that's okay
        return res.status(200).json({
          success: true,
          message: 'Insurance details stored successfully',
          updatedBy: 'patientId',
          patientId,
          insuranceDetailsStored: true,
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

