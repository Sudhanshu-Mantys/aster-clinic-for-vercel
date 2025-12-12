import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicIdFromQuery } from '../_helpers'
import { getPayersByTPA, deletePayersByTPA } from '../../../../lib/redis-config-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code } = req.query
    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }

    try {
        const payers = await getPayersByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({ payers, tpa_ins_code })
    } catch (error: any) {
        console.error('Error getting payers:', error)
        return res.status(500).json({
            error: 'Failed to get payers',
            details: error.message
        })
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code } = req.query
    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }

    try {
        await deletePayersByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({
            message: 'Payers deleted successfully',
            tpa_ins_code: tpa_ins_code
        })
    } catch (error: any) {
        console.error('Error deleting payers:', error)
        return res.status(500).json({
            error: 'Failed to delete payers',
            details: error.message
        })
    }
}

