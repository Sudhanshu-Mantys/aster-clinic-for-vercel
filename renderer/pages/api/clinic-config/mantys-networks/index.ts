import type { NextApiRequest, NextApiResponse } from 'next'
import { getClinicIdFromQuery } from '../_helpers'
import { 
    getMantysNetworksByTPA, 
    setMantysNetworksByTPA, 
    getTPAsWithMantysNetworks,
    type MantysNetwork 
} from '../../../../lib/redis-config-store'

// Hardcoded Mantys network mappings
const FULL_NETWORK_NAME_MAPPINGS: Record<string, string[]> = {
    // Saico
    "INS017": ["PLATINUM", "GOLD", "GOLD +", "SILVER", "BRONZE", "BLUE"],
    // AAFIYA
    "TPA026": [
        "Elite",
        "Diamond",
        "Gold",
        "APN Plus",
        "APN Edge",
        "Essential",
        "APN",
        "APN-Tele",
        "Premier",
        "Silver",
        "Smile",
        "Bright",
        "Elite",
        "Delight",
    ],
    // Al Madallah
    "TPA003": ["RN5", "RN4", "RN", "GN", "GN+", "RN3", "RN2", "Enaya", "Enaya Gold", "Enaya Silver", "Enaya Platinum"],
    // ECARE
    "TPA029": [
        "PREFERRED",
        "STANDARD",
        "REGULAR",
        "BLUE",
        "GREEN",
        "CLASSIC",
        "GP",
        "GP_H",
        "SPECIALIST",
        "SPECIALIST_H",
        "CLASSIC",
        "CLASSIC_H",
        "PLATINUM",
        "DIAMOND",
        "SILVER",
        "GOLD",
        "General",
    ],
    // Inayah
    "TPA008": [
        "Platinum",
        "Diamond",
        "Premier",
        "Gold",
        "Silver",
        "Bronze",
        "Chrome",
        "SAPPHIRE",
        "Opal",
    ],
    // Nextcare
    "TPA002": [
        "RN3",
        "PCP",
        "PCP-C",
        "GN",
        "RN2",
        "RN",
        "RN Enhanced",
        "Restricted Network",
        "GN+",
        "CN",
        "SN",
        "ENAYA Gold",
        "ENAYA Platinum",
        "ENAYA Silver",
        "EK Network - Cat A",
        "EK Network - Cat B",
        "EK Network - Cat C",
        "EK Network - Cat D",
    ],
    // Neuron
    "TPA001": [
        "SILVER",
        "GOLD",
        "PLATINUM",
        "Comprehensive Network",
        "General Network",
        "General Network +",
        "ADV+",
        "BASIC",
        "CHOICE",
        "DIAMOND",
        "ESSENTIAL",
        "Executive Network",
        "Advantage Network",
        "Restricted Network",
        "Super-Restricted Network",
        "Workers Network",
        "Value Network",
        "Value Lite Network",
        "Workers Lite Network",
        "Restricted Network 1",
        "ADVANTAGE PLUS",
        "PREMIUM",
        "ENAYA",
    ],
    // Nas
    "TPA004": [
        "Executive Network",
        "Comprehensive Network",
        "General Network",
        "Restricted Network",
        "Super-Restricted Network",
        "Workers Network",
        "Value Network",
        "Value Lite Network",
        "Workers Lite Network",
        "ENAYA",
        "Platinum",
        "Gold",
        "Silver",
    ],
    // Mednet
    "TPA036": [
        "GOLD",
        "Silver Premium",
        "Silver Classic",
        "Green",
        "Silk Road",
        "GIBCA",
        "PEARL",
        "EMERALD",
        "EBP",
        "N5",
        "N4",
        "N3",
        "N2",
        "N1",
        "N0",
        "CARE NETWORK",
        "Silver",
        "City",
        "Standard",
        "Bronze plus",
        "Basic",
        "ML - VIP",
        "ML - GOLD",
        "ML - SILVER",
        "ML - BRONZE",
        "ML - BLUE",
        "ML - GREEN",
        "ML - RESTRICTED",
        "ML - PLATINUM",
        "ML - VIP LIGHT",
        "ML - GREY",
        "ALICO"
    ],
    // Life line
    "TPA037": [
        "EMPIRE",
        "PEARL",
        "EMPIRE-EBP",
        "PEARL-EBP",
        "OPAL",
        "SAPPHIRE",
        "RUBY",
        "CRYSTAL",
        "DIAMOND",
        "EMERALD",
    ],
    // NGI
    "INS038": [
        "HN BASIC",
        "HN BASIC PLUS",
        "HN STANDARD",
        "HN STANDARD PLUS",
        "HN ADVANTAGE",
        "HN PREMIER",
        "HN EXCLUSIVE",
        "HN BASIC PLUS - REMEDY",
    ],
    // FMC
    "TPA010": [
        "General Network 1",
        "Standard Network",
        "Standard Network 2",
        "Standard Network 3",
        "General Network 2",
        "General Network 3",
        "General Network 4",
        "General Network Plus",
        "Standard Network",
        "Restricted Network",
        "Basic Network",
        "SAPPHIRE",
        "NW5",
    ],
    // AXA
    "INS010": [
        "A.1",
        "A.1 PLUS",
        "A.2",
        "A.3",
        "A.4",
        "A.5",
        "A.6",
        "A.ECO",
        "A.ECO 1",
        "A.ECO 2",
        "Enaya",
        "Eco DXB",
    ],
    // AL BUHIRA
    "INS020": [
        "COMPREHENSIVE PLUS",
        "COMPREHENSIVE",
        "STANDARD",
        "LIMITED",
        "RESTRICTED",
    ],
    // OMAN
    "INS012": [
        "DHA Plus",
        "Restricted",
        "Classic",
        "Essential",
        "Basic",
        "Standard",
        "Comprehensive",
        "Comprehensive Plus",
        "Premium/OlC Bupa Network",
        "Premium",
        "OIC Bupa",
        "Vital",
        "Vital Eco",
        "Signature",
        "Secure",
        "Advance",
        "Edge",
        "Elite",
        "Northern Emirates",
    ],
    // MSH
    "TPA016": ["Covered", "Not Covered"],
    // METLIFE
    "INS115": ["In Network", "Out of Network"],
    // Saico
    "INS015": [
        "GOLD",
        "AMBER+",
        "AMBER",
        "BRONZE+",
        "BRONZE",
        "EMERALD",
        "JADE",
        "SILVER",
        "PREMIUM",
    ],
    // METLIFE
    "INS013": ["VIP/Gold/Silver", "Blue/Green"],
    // Daman
    "INS026": [
        "NW1",
        "NW2",
        "NW3",
        "NW4",
        "NW5",
        "NW6",
        "NW7",
        "NW8"
    ],
    "D004": ["Basic"],
    "TPA023": ["TC 1"]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'POST') return handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, import_from_mapping } = req.query

    // If importing from hardcoded mapping for a specific TPA
    if (import_from_mapping === 'true' && tpa_ins_code && typeof tpa_ins_code === 'string') {
        return handleImportFromMapping(req, res, clinicId, tpa_ins_code)
    }

    // If requesting networks for a specific TPA
    if (tpa_ins_code && typeof tpa_ins_code === 'string') {
        const networks = await getMantysNetworksByTPA(clinicId, tpa_ins_code)
        return res.status(200).json({ networks, tpa_ins_code })
    }

    // Return all TPAs with their networks
    const tpaCodes = await getTPAsWithMantysNetworks(clinicId)
    const result: Record<string, MantysNetwork[]> = {}

    for (const tpaCode of tpaCodes) {
        result[tpaCode] = await getMantysNetworksByTPA(clinicId, tpaCode)
    }

    return res.status(200).json({ networks_by_tpa: result })
}

async function handleImportFromMapping(
    req: NextApiRequest,
    res: NextApiResponse,
    clinicId: string,
    tpaInsCode: string
) {
    try {
        console.log(`=== Import Mantys Networks from Mapping for TPA: ${tpaInsCode} ===`)

        // Get networks from hardcoded mapping
        const networkNames = FULL_NETWORK_NAME_MAPPINGS[tpaInsCode]
        if (!networkNames || networkNames.length === 0) {
            return res.status(404).json({ 
                error: `No Mantys networks found in mapping for TPA: ${tpaInsCode}` 
            })
        }

        // Transform to MantysNetwork format
        const networks: MantysNetwork[] = networkNames.map(name => ({
            name: name.trim(),
            tpa_ins_code: tpaInsCode
        }))

        console.log(`💾 Saving ${networks.length} Mantys networks to Redis for TPA: ${tpaInsCode}`)

        // Save to Redis
        await setMantysNetworksByTPA(clinicId, tpaInsCode, networks)

        return res.status(200).json({
            networks,
            tpa_ins_code: tpaInsCode,
            imported_from_mapping: true,
            record_count: networks.length
        })
    } catch (error: any) {
        console.error('❌❌❌ ERROR IMPORTING MANTYS NETWORKS ❌❌❌')
        console.error('Error type:', typeof error)
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return res.status(500).json({
            error: 'Failed to import Mantys networks',
            details: error.message
        })
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const clinicId = getClinicIdFromQuery(req)
    if (!clinicId) return res.status(400).json({ error: 'clinic_id is required' })

    const { tpa_ins_code, networks } = req.body

    if (!tpa_ins_code || typeof tpa_ins_code !== 'string') {
        return res.status(400).json({ error: 'tpa_ins_code is required' })
    }

    if (!Array.isArray(networks)) {
        return res.status(400).json({ error: 'networks must be an array' })
    }

    try {
        // Validate network structure
        const validNetworks: MantysNetwork[] = networks.filter((n: any) =>
            n.name && typeof n.name === 'string'
        )

        if (validNetworks.length === 0) {
            return res.status(400).json({ error: 'No valid networks provided' })
        }

        await setMantysNetworksByTPA(clinicId, tpa_ins_code, validNetworks)
        return res.status(201).json({
            message: 'Networks saved successfully',
            networks: validNetworks,
            tpa_ins_code: tpa_ins_code
        })
    } catch (error: any) {
        console.error('Error saving networks:', error)
        return res.status(500).json({
            error: 'Failed to save networks',
            details: error.message
        })
    }
}

