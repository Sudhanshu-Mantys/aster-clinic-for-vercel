import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicIdFromQuery } from '../_helpers'
import {
    getPlansByTPA,
    setPlansByTPA,
    getTPAsWithPlans,
    getTPAConfigByCode,
    getClinicConfig,
    getMantysNetworksByTPA,
    type LTPlan
} from '../../../../lib/redis-config-store'

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

    const { tpa_ins_code, fetch_from_api, export_format } = req.query

    // If fetching from API for a specific TPA
    if (fetch_from_api === 'true' && tpa_ins_code && typeof tpa_ins_code === 'string') {
        return handleFetchFromAPI(req, res, clinicId, tpa_ins_code)
    }

    // Export plans as template for mapping
    if (export_format === 'mapping_template' && tpa_ins_code && typeof tpa_ins_code === 'string') {
        const plans = await getPlansByTPA(clinicId, tpa_ins_code)
        const networks = await getMantysNetworksByTPA(clinicId, tpa_ins_code)
        const availableNetworks = networks.map(n => n.name)

        // Create template with plan details and empty mapping fields
        const template = plans.map(plan => ({
            tpa_ins_code: tpa_ins_code,
            lt_plan_id: plan.plan_id,
            lt_plan_name: plan.insurance_plan_name,
            lt_plan_code: plan.plan_code,
            mantys_network_name: '', // Empty - to be filled in (must match one of the available_networks)
            is_default: false // Set to true for the default mapping of each plan
        }))

        // Create sample entries showing how to fill it out
        const sampleEntries = plans.length > 0 ? [
            {
                tpa_ins_code: tpa_ins_code,
                lt_plan_id: plans[0].plan_id,
                lt_plan_name: plans[0].insurance_plan_name,
                lt_plan_code: plans[0].plan_code,
                mantys_network_name: availableNetworks[0] || 'EXAMPLE_NETWORK',
                is_default: true
            },
            ...(plans.length > 1 && availableNetworks.length > 1 ? [{
                tpa_ins_code: tpa_ins_code,
                lt_plan_id: plans[0].plan_id, // Same plan, different network (many-to-many example)
                lt_plan_name: plans[0].insurance_plan_name,
                lt_plan_code: plans[0].plan_code,
                mantys_network_name: availableNetworks[1] || 'EXAMPLE_NETWORK_2',
                is_default: false
            }] : []),
            ...(plans.length > 1 ? [{
                tpa_ins_code: tpa_ins_code,
                lt_plan_id: plans[1].plan_id,
                lt_plan_name: plans[1].insurance_plan_name,
                lt_plan_code: plans[1].plan_code,
                mantys_network_name: availableNetworks[0] || 'EXAMPLE_NETWORK',
                is_default: true
            }] : [])
        ] : []

        return res.status(200).json({
            tpa_ins_code,
            tpa_name: 'TPA Name', // Will be filled by frontend if needed
            plans_count: plans.length,
            available_networks: availableNetworks,
            instructions: [
                'INSTRUCTIONS FOR FILLING OUT MAPPINGS:',
                '1. Fill in the "mantys_network_name" field for each plan entry.',
                '2. The mantys_network_name MUST match exactly one of the networks listed in "available_networks" above.',
                '3. For many-to-many mappings: Create multiple entries with the same lt_plan_id but different mantys_network_name values.',
                '4. Set "is_default" to true for ONE mapping per plan (the default network for that plan).',
                '5. You can delete entries you don\'t want to map (plans without mappings will be skipped).',
                '6. After filling, send back the entire JSON object with the "mappings" array filled in.',
                '',
                'EXAMPLE:',
                '- Plan "RN3 (PCP) – NEXTCARE" can map to both "RN3" and "PCP" networks (create 2 entries).',
                '- Mantys "Restricted Network" can map to multiple LT plans like "RN - NAS" and "RN (LAND MARK GROUP - NLGIC) -NAS" (create separate entries for each).',
                '',
                'RETURN FORMAT:',
                'Send back this JSON with the "mappings" array filled in. You can either:',
                '- Replace the "template" array with your filled "mappings" array, OR',
                '- Keep the structure and just fill in the mantys_network_name fields in the template array.'
            ],
            sample_entries: sampleEntries,
            template: template,
            // Expected return format
            expected_return_format: {
                tpa_ins_code: tpa_ins_code,
                mappings: sampleEntries // This is what should be returned - array of filled mappings
            }
        })
    }

    // If requesting plans for a specific TPA
    if (tpa_ins_code && typeof tpa_ins_code === 'string') {
        const plans = await getPlansByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({ plans, tpa_ins_code })
    }

    // Return all TPAs with their plans
    const tpaCodes = await getTPAsWithPlans(clinicId)
    const result: Record<string, LTPlan[]> = {}

    for (const tpaCode of tpaCodes) {
        result[tpaCode] = await getPlansByTPA(clinicId, tpaCode)
    }

    return res.status(200).json({ plans_by_tpa: result })
}

async function handleFetchFromAPI(
    req: NextApiRequest,
    res: NextApiResponse,
    clinicId: string,
    tpaInsCode: string
) {
    try {
        console.log(`=== Fetch Plans API Called for TPA: ${tpaInsCode} ===`)

        // Get TPA config to get insurance_id, insurance_mapping_id, etc.
        const tpaConfig = await getTPAConfigByCode(clinicId, tpaInsCode)
        if (!tpaConfig) {
            console.error(`❌ TPA config not found for: ${tpaInsCode}`)
            return res.status(404).json({ error: 'TPA configuration not found' })
        }

        console.log(`📋 TPA Config:`, {
            ins_code: tpaConfig.ins_code,
            insurance_id: tpaConfig.insurance_id,
            insurance_type: tpaConfig.insurance_type,
            insurance_name: tpaConfig.insurance_name,
            hospital_insurance_mapping_id: tpaConfig.hospital_insurance_mapping_id
        })

        // Get clinic config for siteId, customerId, etc.
        const clinicConfig = await getClinicConfig(clinicId)
        if (!clinicConfig) {
            console.error(`❌ Clinic config not found for: ${clinicId}`)
            return res.status(404).json({ error: 'Clinic configuration not found' })
        }

        // Extract required parameters
        const insuranceId = tpaConfig.insurance_id
        if (!insuranceId) {
            console.error(`❌ Insurance ID not found for TPA: ${tpaInsCode}`)
            return res.status(400).json({ error: 'Insurance ID not found in TPA configuration' })
        }

        const insuranceMappingId = tpaConfig.hospital_insurance_mapping_id
        if (!insuranceMappingId) {
            console.error(`❌ Insurance Mapping ID not found for TPA: ${tpaInsCode}`)
            return res.status(400).json({ error: 'Insurance Mapping ID not found in TPA configuration' })
        }

        const insuranceType = tpaConfig.insurance_type || 1
        const siteId = tpaConfig.lt_site_id || clinicConfig.lt_site_id
        if (!siteId) {
            console.error(`❌ Site ID not found for clinic: ${clinicId}`)
            return res.status(400).json({ error: 'Site ID not found in configuration' })
        }

        const customerId = tpaConfig.lt_customer_id || clinicConfig.customer_id || 1

        console.log(`🔍 Parameters:`, {
            siteId,
            insuranceType,
            insuranceMappingId,
            insuranceId,
            customerId,
            ins_code: tpaInsCode
        })

        // Format date as "Wed Dec 10 2025"
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
        const requestBody = {
            head: {
                reqtime: formatDate(new Date()),
                srvseqno: '',
                reqtype: 'POST'
            },
            body: {
                siteId: Number(siteId),
                insuranceType: Number(insuranceType),
                insuranceMappingId: Number(insuranceMappingId),
                insuranceId: Number(insuranceId),
                customerId: Number(customerId)
            }
        }

        console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2))

        // Make API call to fetch plans
        const apiUrl = `${API_BASE_URL}/claim/insurance/plansget`
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
                'Content-length': String(JSON.stringify(requestBody).length),
                'Accept-Encoding': 'gzip,deflate',
                'User-Agent': 'Mozilla/5.0 (Windows; U; en-US) AppleWebKit/533.19.4 (KHTML, like Gecko) AdobeAIR/32.0',
                'Host': 'prod.asterclinics.com',
                'Connection': 'Keep-Alive'
            },
            body: JSON.stringify(requestBody)
        })

        console.log(`📥 Response status: ${response.status} ${response.statusText}`)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ API Response NOT OK:', errorText)
            return res.status(response.status).json({
                error: 'Failed to fetch plans from Lifetrenz API',
                details: errorText
            })
        }

        const apiResponse = await response.json()
        console.log(`📦 API Response:`, JSON.stringify(apiResponse, null, 2))

        // Parse the response
        if (apiResponse.head?.StatusValue !== 200) {
            console.error('❌ API returned error status:', apiResponse.head)
            return res.status(400).json({
                error: apiResponse.head?.StatusText || 'Failed to fetch plans',
                response: apiResponse
            })
        }

        const plansData = apiResponse.body?.Data || []
        console.log(`✅ API response OK, RecordCount: ${apiResponse.body?.RecordCount || 0}, Data length: ${plansData.length}`)

        // Transform to LTPlan format
        const plans: LTPlan[] = plansData.map((item: any) => ({
            plan_id: item.plan_id,
            insurance_mapping_id: item.insurance_mapping_id,
            plan_no: item.plan_no,
            insurance_plan_name: item.insurance_plan_name,
            plan_code: item.plan_code,
            insurance_name: item.insurance_name,
            auth_expiry_in_days: item.auth_expiry_in_days,
            authorization_limit: item.authorization_limit,
            contract_name: item.contract_name,
            cm_contract_id: item.cm_contract_id,
            priority_patient_applicable: item.priority_patient_applicable,
            refer_ltr_reqired_type: item.refer_ltr_reqired_type,
            is_nw_emp_exclude_exist: item.is_nw_emp_exclude_exist,
            is_network_deactivated: item.is_network_deactivated,
            type_name: item.type_name,
            class_name: item.class_name,
            has_top_up: item.has_top_up
        }))

        console.log(`💾 Saving ${plans.length} plans to Redis for TPA: ${tpaInsCode}`)

        // Save to Redis
        await setPlansByTPA(clinicId, tpaInsCode, plans)

        return res.status(200).json({
            plans,
            tpa_ins_code: tpaInsCode,
            fetched_from_api: true,
            record_count: plans.length
        })
    } catch (error: any) {
        console.error('❌❌❌ ERROR FETCHING PLANS ❌❌❌')
        console.error('Error type:', typeof error)
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return res.status(500).json({
            error: 'Failed to fetch plans from API',
            details: error.message
        })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, plans } = req.body

    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }

    if (!Array.isArray(plans)) {
        return res.status(400).json({ error: 'plans must be an array' })
    }

    try {
        // Validate plan structure
        const validPlans: LTPlan[] = plans.filter((p: any) =>
            p.plan_id !== undefined &&
            p.insurance_plan_name &&
            p.plan_code !== undefined
        )

        if (validPlans.length === 0) {
            return res.status(400).json({ error: 'No valid plans provided' })
        }

        await setPlansByTPA(clinicId, tpa_ins_code, validPlans)
        return res.status(201).json({
            message: 'Plans saved successfully',
            plans: validPlans,
            tpa_ins_code: tpa_ins_code
        })
    } catch (error: any) {
        console.error('Error saving plans:', error)
        return res.status(500).json({
            error: 'Failed to save plans',
            details: error.message
        })
    }
}
