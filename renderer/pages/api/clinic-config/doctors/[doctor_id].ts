import type { NextApiRequest, NextApiResponse } from 'next'
import { setDoctorConfig, deleteDoctorConfig } from '../../../../lib/redis-config-store'
import { getClinicIdFromQuery } from '../_helpers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return handlePut(req, res)
    if (req.method === 'DELETE') return handleDelete(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { doctor_id } = req.query
    if (!doctor_id || typeof doctor_id !== 'string') {
        return res.status(400).json({ error: 'doctor_id is required' })
    }

    const {
        clinic_id,
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

    const updated = {
        doctor_id,
        doctor_name: doctor_name || '',
        doctor_code: doctor_code || '',
        specialization: specialization || '',
        lt_user_id: lt_user_id || '',
        dha_id: dha_id || '',
        moh_id: moh_id || '',
        lt_role_id: lt_role_id || '',
        lt_specialisation_id: lt_specialisation_id || '',
        updated_at: new Date().toISOString(),
    }

    await setDoctorConfig(clinic_id, doctor_id, updated)
    return res.status(200).json({ config: updated })
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { doctor_id } = req.query
    const clinicId = getClinicIdFromQuery(req)

    if (!doctor_id || typeof doctor_id !== 'string') {
        return res.status(400).json({ error: 'doctor_id is required' })
    }
    if (!clinicId) {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    await deleteDoctorConfig(clinicId, doctor_id)
    return res.status(200).json({ message: 'Doctor config deleted successfully' })
}
