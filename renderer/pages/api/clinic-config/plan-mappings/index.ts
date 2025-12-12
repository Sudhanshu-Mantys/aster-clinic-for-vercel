import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicIdFromQuery } from '../_helpers'
import { 
    getPlanMappingsByTPA,
    getAllPlanMappings,
    setPlanMapping,
    deletePlanMapping,
    setDefaultMapping,
    bulkImportMappings,
    generateId,
    type PlanNetworkMapping 
} from '../../../../lib/redis-config-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    if (req.method === 'PUT') return handlePut(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, export_format } = req.query

    // Export mappings
    if (export_format === 'json' || export_format === 'csv') {
        const mappings = tpa_ins_code && typeof tpa_ins_code === 'string'
            ? await getPlanMappingsByTPA(clinicId, tpa_ins_code)
            : await getAllPlanMappings(clinicId)

        if (export_format === 'csv') {
            // Convert to CSV
            const headers = ['tpa_ins_code', 'lt_plan_id', 'lt_plan_name', 'lt_plan_code', 'mantys_network_name', 'is_default']
            const csvRows = [
                headers.join(','),
                ...mappings.map(m => [
                    m.tpa_ins_code,
                    m.lt_plan_id,
                    `"${m.lt_plan_name.replace(/"/g, '""')}"`,
                    `"${m.lt_plan_code.replace(/"/g, '""')}"`,
                    `"${m.mantys_network_name.replace(/"/g, '""')}"`,
                    m.is_default ? 'true' : 'false'
                ].join(','))
            ]
            
            res.setHeader('Content-Type', 'text/csv')
            res.setHeader('Content-Disposition', `attachment; filename="plan-mappings-${clinicId}-${Date.now()}.csv"`)
            return res.status(200).send(csvRows.join('\n'))
        } else {
            // Return JSON
            return res.status(200).json({ mappings })
        }
    }

    // If requesting mappings for a specific TPA
    if (tpa_ins_code && typeof tpa_ins_code === 'string') {
        const mappings = await getPlanMappingsByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({ mappings, tpa_ins_code })
    }

    // Return all mappings for the clinic
    const mappings = await getAllPlanMappings(clinicId)
    return res.status(200).json({ mappings })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, lt_plan_id, lt_plan_name, lt_plan_code, mantys_network_name } = req.body

    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }
    if (!lt_plan_id || typeof lt_plan_id !== 'number') {
        return res.status(400).json({ error: 'lt_plan_id is required and must be a number' })
    }
    if (!lt_plan_name || typeof lt_plan_name !== 'string') {
        return res.status(400).json({ error: 'lt_plan_name is required' })
    }
    if (!lt_plan_code || typeof lt_plan_code !== 'string') {
        return res.status(400).json({ error: 'lt_plan_code is required' })
    }
    if (!mantys_network_name || typeof mantys_network_name !== 'string') {
        return res.status(400).json({ error: 'mantys_network_name is required' })
    }

    try {
        const mapping: PlanNetworkMapping = {
            id: generateId(),
            clinic_id: clinicId,
            tpa_ins_code,
            lt_plan_id,
            lt_plan_name,
            lt_plan_code,
            mantys_network_name
        }

        await setPlanMapping(clinicId, mapping)
        return res.status(201).json({
            message: 'Mapping created successfully',
            mapping
        })
    } catch (error: any) {
        console.error('Error creating mapping:', error)
        return res.status(500).json({
            error: 'Failed to create mapping',
            details: error.message
        })
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, mapping_id } = req.query

    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }
    if (!mapping_id || typeof mapping_id !== 'string') {
        return res.status(400).json({ error: 'mapping_id is required' })
    }

    try {
        await deletePlanMapping(clinicId, tpa_ins_code, mapping_id)
        return res.status(200).json({
            message: 'Mapping deleted successfully'
        })
    } catch (error: any) {
        console.error('Error deleting mapping:', error)
        return res.status(500).json({
            error: 'Failed to delete mapping',
            details: error.message
        })
    }
}

