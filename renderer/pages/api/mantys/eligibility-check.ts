/**
 * Mantys Eligibility Check API Endpoint
 * Two-step process: 1) Create task, 2) Poll for results
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import {
    MantysEligibilityRequest,
    MantysCreateTaskResponse,
} from '../../../types/mantys'

interface TaskCreatedResponse {
    task_id: string
    message: string
    status: string
}

const MANTYS_API_BASE_URL = process.env.MANTYS_API_URL || 'https://aster.api.mantys.org'
const MANTYS_API_KEY = process.env.MANTYS_API_KEY || 'api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab'
const MANTYS_CLIENT_ID = process.env.MANTYS_CLIENT_ID || 'aster-clinic'
const MANTYS_CLINIC_ID = process.env.MANTYS_CLINIC_ID || '92d5da39-36af-4fa2-bde3-3828600d7871'

// Note: This endpoint now returns immediately with task_id
// Frontend should poll /api/mantys/check-status for updates

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TaskCreatedResponse | { error: string; details?: any }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const payload: MantysEligibilityRequest = req.body

        // Validate required fields
        if (!payload.id_value || !payload.tpa_name || !payload.id_type || !payload.visit_type) {
            return res.status(400).json({
                error: 'Missing required fields: id_value, tpa_name, id_type, visit_type'
            })
        }

        console.log('Step 1: Creating Mantys task...', JSON.stringify(payload, null, 2))

        // Step 1: Create Task
        const createTaskResponse = await fetch(`${MANTYS_API_BASE_URL}/v2/api-integration/create-task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-ID': MANTYS_CLIENT_ID,
                'X-Clinic-ID': MANTYS_CLINIC_ID,
                'x-api-key': `Bearer ${MANTYS_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const createTaskData: MantysCreateTaskResponse = await createTaskResponse.json()

        console.log('Create task response data:', JSON.stringify(createTaskData, null, 2))

        if (!createTaskResponse.ok || !createTaskData.success) {
            console.error('Mantys Create Task Error:', createTaskData)
            return res.status(createTaskResponse.status).json({
                error: 'Failed to create Mantys task',
                details: createTaskData
            })
        }

        const taskId = createTaskData.data.task_id
        console.log('Step 2: Task created successfully, ID:', taskId)

        if (!taskId) {
            console.error('No task ID found in response:', createTaskData)
            return res.status(500).json({
                error: 'No task ID returned from Mantys API',
                details: createTaskData
            })
        }

        // Return task_id immediately - frontend will poll for status
        return res.status(202).json({
            task_id: taskId,
            message: 'Task created successfully',
            status: 'pending'
        })

    } catch (error: any) {
        console.error('Error in Mantys eligibility check:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        })
    }
}

