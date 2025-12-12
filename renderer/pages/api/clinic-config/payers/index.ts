import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicIdFromQuery } from '../_helpers'
import { getPayersByTPA, setPayersByTPA, getTPAsWithPayers, getTPAConfigByCode, getClinicConfig, type LTPayer } from '../../../../lib/redis-config-store'

// Use tunnel by default (safer, works from any network)
const useTunnel = process.env.NEXT_USE_TUNNEL !== 'false'
const API_BASE_URL = useTunnel
    ? 'https://aster-clinics-dev.mantys.org/SCMS/web/app.php'
    : 'https://prod.asterclinics.com/SCMS/web/app.php'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, fetch_from_api } = req.query

    // If fetching from API for a specific TPA
    if (fetch_from_api === 'true' && tpa_ins_code && typeof tpa_ins_code === 'string') {
        return handleFetchFromAPI(req, res, clinicId, tpa_ins_code)
    }

    // If requesting payers for a specific TPA
    if (tpa_ins_code && typeof tpa_ins_code === 'string') {
        const payers = await getPayersByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({ payers, tpa_ins_code })
    }

    // Return all TPAs with their payers
    const tpaCodes = await getTPAsWithPayers(clinicId)
    const result: Record<string, LTPayer[]> = {}

    for (const tpaCode of tpaCodes) {
        result[tpaCode] = await getPayersByTPA(clinicId, tpaCode)
    }

    return res.status(200).json({ payers_by_tpa: result })
}

async function handleFetchFromAPI(
    req: NextApiRequest,
    res: NextApiResponse,
    clinicId: string,
    tpaInsCode: string
) {
    try {
        console.log(`=== Fetch Payers API Called for TPA: ${tpaInsCode} ===`)

        // Get TPA config to get receiverId
        const tpaConfig = await getTPAConfigByCode(clinicId, tpaInsCode)
        if (!tpaConfig) {
            console.error(`❌ TPA config not found for: ${tpaInsCode}`)
            return res.status(404).json({ error: 'TPA configuration not found' })
        }

        console.log(`📋 TPA Config:`, {
            ins_code: tpaConfig.ins_code,
            insurance_id: tpaConfig.insurance_id,
            insurance_type: tpaConfig.insurance_type,
            insurance_name: tpaConfig.insurance_name
        })

        // Get clinic config for siteId, customerId, etc.
        const clinicConfig = await getClinicConfig(clinicId)
        if (!clinicConfig) {
            console.error(`❌ Clinic config not found for: ${clinicId}`)
            return res.status(404).json({ error: 'Clinic configuration not found' })
        }

        // Extract receiverId from TPA config
        // The receiverId should be in the TPA config or we need to derive it
        // For now, let's assume it's in config_data or we use insurance_id
        const receiverId = tpaConfig.insurance_id || tpaConfig.config_data?.receiverId
        if (!receiverId) {
            console.error(`❌ Receiver ID not found for TPA: ${tpaInsCode}`)
            return res.status(400).json({ error: 'Receiver ID not found in TPA configuration' })
        }

        const siteId = tpaConfig.lt_site_id || clinicConfig.lt_site_id
        if (!siteId) {
            console.error(`❌ Site ID not found for clinic: ${clinicId}`)
            return res.status(400).json({ error: 'Site ID not found in configuration' })
        }

        // Determine receiverType based on ins_code prefix
        // Codes starting with "INS" (Insurance) → receiverType: 1
        // Codes starting with "TPA" → receiverType: 2
        const receiverType = tpaInsCode.startsWith('INS') ? 1 : 2

        console.log(`🔍 Parameters:`, {
            receiverId,
            siteId,
            ins_code: tpaInsCode,
            insurance_type: tpaConfig.insurance_type,
            receiverType
        })

        // Format date as "Fri Dec 12 2025"
        const formatDate = (date: Date): string => {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const day = days[date.getDay()]
            const month = months[date.getMonth()]
            const dayNum = date.getDate()
            const year = date.getFullYear()
            return `${day} ${month} ${dayNum} ${year}`
        }

        // Prepare request body
        // For Insurance (insurance_type: 1), use receiverType: 2
        // For TPA (insurance_type: 2), use receiverType: 1
        const requestBody = {
            head: {
                reqtime: formatDate(new Date()),
                srvseqno: '',
                reqtype: 'POST'
            },
            body: {
                receiverType: receiverType,
                siteId: Number(siteId),
                recieverId: Number(receiverId),
                isInsurance: 0,
                regionId: 3
            }
        }

        console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2))

        // Make API call to fetch payers with headers matching the curl command
        const apiUrl = `${API_BASE_URL}/master/receivers/list`
        console.log(`🚀 Making API request to: ${apiUrl}`)

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Referer': 'app:/TrendEHR.swf',
                'Accept': 'text/xml, application/xml, application/xhtml+xml, text/html;q=0.9, text/plain;q=0.8, text/css, image/png, image/jpeg, image/gif;q=0.8, application/x-shockwave-flash, video/mp4;q=0.9, flv-application/octet-stream;q=0.8, video/x-flv;q=0.7, audio/mp4, application/futuresplash, */*;q=0.5, application/x-mpegURL',
                'x-flash-version': '32,0,0,182',
                'Content-Type': 'application/json',
                'srvseqno': '',
                'api-key': '',
                'Accept-Encoding': 'gzip,deflate',
                'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
                'Connection': 'Keep-Alive'
            },
            body: JSON.stringify(requestBody)
        })

        console.log(`📥 Response status: ${response.status} ${response.statusText}`)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ API Response NOT OK:', errorText)
            return res.status(response.status).json({
                error: 'Failed to fetch payers from Lifetrenz API',
                details: errorText
            })
        }

        const apiResponse = await response.json()
        console.log(`📦 API Response:`, JSON.stringify(apiResponse, null, 2))

        // Parse the response
        if (apiResponse.head?.StatusValue !== 200) {
            console.error('❌ API returned error status:', apiResponse.head)
            return res.status(400).json({
                error: apiResponse.head?.StatusText || 'Failed to fetch payers',
                response: apiResponse
            })
        }

        const payersData = apiResponse.body?.Data || []
        console.log(`✅ API response OK, RecordCount: ${apiResponse.body?.RecordCount || 0}, Data length: ${payersData.length}`)

        // Transform to LTPayer format
        const payers: LTPayer[] = payersData.map((item: any) => ({
            ins_tpaid: item.ins_tpaid,
            ins_tpa_name: item.ins_tpa_name,
            ins_tpa_code: item.ins_tpa_code,
            ins_tpa_type: item.ins_tpa_type,
            reciver_payer_map_id: item.reciver_payer_map_id,
            reciever_payer_id: item.reciever_payer_id
        }))

        console.log(`💾 Saving ${payers.length} payers to Redis for TPA: ${tpaInsCode}`)

        // Save to Redis
        await setPayersByTPA(clinicId, tpaInsCode, payers)

        return res.status(200).json({
            payers,
            tpa_ins_code: tpaInsCode,
            fetched_from_api: true,
            record_count: payers.length
        })
    } catch (error: any) {
        console.error('❌❌❌ ERROR FETCHING PAYERS ❌❌❌')
        console.error('Error type:', typeof error)
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return res.status(500).json({
            error: 'Failed to fetch payers from API',
            details: error.message
        })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, payers } = req.body

    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }

    if (!Array.isArray(payers)) {
        return res.status(400).json({ error: 'payers must be an array' })
    }

    try {
        // Validate payer structure
        const validPayers: LTPayer[] = payers.filter((p: any) =>
            p.ins_tpaid !== undefined &&
            p.ins_tpa_name &&
            p.ins_tpa_code &&
            p.reciver_payer_map_id !== undefined
        )

        if (validPayers.length === 0) {
            return res.status(400).json({ error: 'No valid payers provided' })
        }

        await setPayersByTPA(clinicId, tpa_ins_code, validPayers)
        return res.status(201).json({
            message: 'Payers saved successfully',
            payers: validPayers,
            tpa_ins_code: tpa_ins_code
        })
    } catch (error: any) {
        console.error('Error saving payers:', error)
        return res.status(500).json({
            error: 'Failed to save payers',
            details: error.message
        })
    }
}

