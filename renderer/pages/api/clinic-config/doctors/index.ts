import type { NextApiRequest, NextApiResponse } from 'next'
import { getDoctorConfigs, setDoctorConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const configs = await getDoctorConfigs(clinicId)
    return res.status(200).json({ configs })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const {
        clinic_id,
        doctor_id,
        doctor_name,
        doctor_code,
        specialization,
        lt_user_id,
        dha_id,
        moh_id,
        lt_role_id,
        lt_specialisation_id
    } = req.body || {}
    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }
    if (!doctor_id || typeof doctor_id !== 'string') {
        return res.status(400).json({ error: 'doctor_id is required' })
    }
    if (!doctor_name || typeof doctor_name !== 'string') {
        return res.status(400).json({ error: 'doctor_name is required' })
    }

    const config = {
        doctor_id,
        doctor_name,
        doctor_code: doctor_code || '',
        specialization: specialization || '',
        lt_user_id: lt_user_id || '',
        dha_id: dha_id || '',
        moh_id: moh_id || '',
        lt_role_id: lt_role_id || '',
        lt_specialisation_id: lt_specialisation_id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    await setDoctorConfig(clinic_id, doctor_id, config)
    return res.status(201).json({ config })
}
