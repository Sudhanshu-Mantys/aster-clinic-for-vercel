import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicConfig, setClinicConfig } from '../../../lib/redis-config-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

function mustGetClinicId(req: NextApiRequest): string | null {
    const clinic_id = req.query.clinic_id
    if (!clinic_id || typeof clinic_id !== 'string') return null
    return clinic_id
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = mustGetClinicId(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const existing = await getClinicConfig(clinicId)
    if (!existing) {
        return res.status(200).json({
            config: {
                clinic_id: clinicId,
                location: '',
                lt_site_id: '',
                customer_id: '',
                hospital_or_clinic: 'clinic',
                updated_at: new Date().toISOString(),
            },
        })
    }

    return res.status(200).json({ config: existing })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { clinic_id, location, lt_site_id, customer_id, hospital_or_clinic } = req.body || {}

    if (!clinic_id || typeof clinic_id !== 'string') {
        return res.status(400).json({ error: 'clinic_id is required' })
    }

    const updated = {
        clinic_id,
        location: typeof location === 'string' ? location : '',
        lt_site_id: typeof lt_site_id === 'string' ? lt_site_id : '',
        customer_id: typeof customer_id === 'string' ? customer_id : '',
        hospital_or_clinic: typeof hospital_or_clinic === 'string' ? hospital_or_clinic : 'clinic',
        updated_at: new Date().toISOString(),
    }

    await setClinicConfig(clinic_id, updated)
    return res.status(200).json({ config: updated })
}


