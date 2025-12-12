import type { NextApiRequest, NextApiResponse } from 'next'
import { getTPAConfig, setTPAConfig, deleteTPAConfig, type TPAConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return handlePut(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { tpa_id } = req.query
    if (!tpa_id || typeof tpa_id !== 'string') {
        return res.status(400).json({ error: 'tpa_id is required' })
    }

    const {
        clinic_id,
        tpa_name,
        api_url,
        credentials,
        config_data,
        ins_code,
        lt_site_id,
        lt_customer_id,
        lt_hospital_id,
        lt_other_config,
        extra_form_fields
    } = req.body || {}

    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const existing = await getTPAConfig(clinic_id, tpa_id)
    if (!existing) {
        return res.status(404).json({ error: 'TPA config not found' })
    }

    const updated: TPAConfig = {
        ...existing,
        ins_code: ins_code || existing.ins_code || tpa_id,
        tpa_id: tpa_id,
        tpa_name: tpa_name !== undefined ? tpa_name : existing.tpa_name || '',
        api_url: api_url !== undefined ? api_url : existing.api_url || '',
        credentials: credentials !== undefined ? credentials : existing.credentials || '',
        config_data: config_data !== undefined ? config_data : existing.config_data || {},
        lt_site_id: lt_site_id !== undefined ? lt_site_id : existing.lt_site_id,
        lt_customer_id: lt_customer_id !== undefined ? lt_customer_id : existing.lt_customer_id,
        lt_hospital_id: lt_hospital_id !== undefined ? lt_hospital_id : existing.lt_hospital_id,
        lt_other_config: lt_other_config !== undefined ? lt_other_config : existing.lt_other_config,
        extra_form_fields: extra_form_fields !== undefined ? extra_form_fields : existing.extra_form_fields,
        updated_at: new Date().toISOString(),
    }

    await setTPAConfig(clinic_id, updated)
    return res.status(200).json({ config: updated })
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { tpa_id } = req.query
    const clinicId = getClinicIdFromQuery(req)

    if (!tpa_id || typeof tpa_id !== 'string') {
        return res.status(400).json({ error: 'tpa_id is required' })
    }
    if (!clinicId) {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    await deleteTPAConfig(clinicId, tpa_id)
    return res.status(200).json({ message: 'TPA config deleted successfully' })
}
