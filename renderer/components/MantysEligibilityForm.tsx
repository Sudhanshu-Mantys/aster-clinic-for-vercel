import React, { useState, useMemo, useEffect } from "react"
import Select from "react-select"
import { PatientData, InsuranceData } from "../lib/api"
import { Button } from "./ui/button"

interface MantysEligibilityFormProps {
    patientData: PatientData | null
    insuranceData: InsuranceData | null
    onClose?: () => void
}

export const MantysEligibilityForm: React.FC<MantysEligibilityFormProps> = ({
    patientData,
    insuranceData,
    onClose
}) => {
    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    // Core Form Fields
    const [options, setOptions] = useState("BOTH") // Insurance Provider (TPA)
    const [idType, setIdType] = useState("EMIRATESID") // ID Type
    const [visitType, setVisitType] = useState("OUTPATIENT") // Visit Type
    const [emiratesId, setEmiratesId] = useState("") // ID Number (Emirates ID, Member ID, etc.)

    // Additional Fields (conditional based on TPA)
    const [name, setName] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [doctorName, setDoctorName] = useState("")
    const [referralCode, setReferralCode] = useState("")
    const [serviceType, setServiceType] = useState("")
    const [visitCategory, setVisitCategory] = useState("")

    // POD Fields (Daman/Thiqa)
    const [isPod, setIsPod] = useState(false)
    const [podId, setPodId] = useState("")
    const [isMaternity, setIsMaternity] = useState(false)
    const [notRelatedToChiefComplaint, setNotRelatedToChiefComplaint] = useState(false)

    // AXA Specific
    const [useDental, setUseDental] = useState("NO")

    // NextCare Policy Number specific
    const [payerName, setPayerName] = useState<string | null>(null)

    // Split phone for specific org (ADNIC at org1)
    const [phoneCode, setPhoneCode] = useState("")
    const [phoneSuffix, setPhoneSuffix] = useState("")

    // Maternity type
    const [maternityType, setMaternityType] = useState("")

    // Validation & UI State
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [emiratesIdInputWarning, setEmiratesIdInputWarning] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Organization/Clinic Context (would come from auth/context in real app)
    const selectedOrganizationId: string = "aster-clinics" // Example: "medcare", "al-noor", "healthhub", "kims", "org1"
    const selectedClinicId: string = "aster-clinic" // Example clinic ID

    // ============================================================================
    // PRE-FILL FORM WITH PATIENT DATA
    // ============================================================================

    useEffect(() => {
        if (patientData) {
            // Pre-fill name
            const fullName = [patientData.firstname, patientData.middlename, patientData.lastname]
                .filter(Boolean)
                .join(' ')
            setName(fullName)

            // Pre-fill phone
            const phone = patientData.phone || patientData.home_phone || patientData.phone_other || ""
            setPhoneNumber(phone)

            // Pre-fill Emirates ID (uid_value)
            if (patientData.uid_value) {
                setEmiratesId(patientData.uid_value)
            }
        }

        if (insuranceData) {
            // Try to map insurance TPA name to options
            // This is a simplified mapping - you may need to enhance this
            const tpaMapping: Record<string, string> = {
                "Neuron": "TPA001",
                "NextCare": "TPA002",
                "Al Madallah": "TPA003",
                "NAS": "TPA004",
                "First Med": "TPA010",
                "FMC": "TPA010",
                "Daman": "INS026",
                "Daman Thiqa": "TPA023",
                "AXA": "INS010",
                "ADNIC": "INS017"
            }

            const tpaName = insuranceData.tpa_name
            const mappedTpa = Object.entries(tpaMapping).find(([key]) =>
                tpaName.toLowerCase().includes(key.toLowerCase())
            )

            if (mappedTpa) {
                setOptions(mappedTpa[1])
            }

            // Pre-fill member ID if available
            if (insuranceData.tpa_policy_id) {
                setIdType("CARDNUMBER")
                setEmiratesId(insuranceData.tpa_policy_id)
            }

            // Pre-fill payer name
            if (insuranceData.payer_name) {
                setPayerName(insuranceData.payer_name)
            }
        }
    }, [patientData, insuranceData])

    // ============================================================================
    // INSURANCE PROVIDER OPTIONS (50+ TPAs)
    // ============================================================================

    const INSURANCE_OPTIONS = [
        { value: "BOTH", label: "All Insurance Providers" },
        { value: "DHPO", label: "DHPO - Dubai Health Insurance" },
        { value: "RIYATI", label: "RIYATI" },

        // Major TPAs
        { value: "TPA001", label: "TPA001 - Neuron" },
        { value: "TPA002", label: "TPA002 - NextCare" },
        { value: "TPA003", label: "TPA003 - Al Madallah" },
        { value: "TPA004", label: "TPA004 - NAS" },
        { value: "TPA008", label: "TPA008 - Inayah" },
        { value: "TPA010", label: "TPA010 - FMC (First Med)" },
        { value: "TPA013", label: "TPA013 - Penta" },
        { value: "TPA016", label: "TPA016 - MSH" },
        { value: "TPA021", label: "TPA021 - Vidal" },
        { value: "TPA023", label: "TPA023 - Daman Thiqa" },
        { value: "TPA025", label: "TPA025 - Sehteq" },
        { value: "TPA026", label: "TPA026 - Aafiya" },
        { value: "TPA027", label: "TPA027 - Starwell" },
        { value: "TPA029", label: "TPA029 - eCare" },
        { value: "TPA030", label: "TPA030 - Iris" },
        { value: "TPA032", label: "TPA032 - Whealth" },
        { value: "TPA036", label: "TPA036 - Mednet" },
        { value: "TPA037", label: "TPA037 - Lifeline (Khat Al Haya)" },
        { value: "TPA038", label: "TPA038 - Enet" },
        { value: "D004", label: "D004 - Daman (Variant)" },

        // Insurance Companies
        { value: "INS005", label: "INS005 - Dubai Insurance" },
        { value: "INS010", label: "INS010 - AXA Gulf Insurance" },
        { value: "INS012", label: "INS012 - Oman Insurance" },
        { value: "INS013", label: "INS013 - Metlife" },
        { value: "INS015", label: "INS015 - Saico" },
        { value: "INS017", label: "INS017 - ADNIC" },
        { value: "INS020", label: "INS020 - Al Buhaira" },
        { value: "INS026", label: "INS026 - Daman" },
        { value: "INS028", label: "INS028 - Interglobal" },
        { value: "INS029", label: "INS029 - Al Dhafra" },
        { value: "INS038", label: "INS038 - NGI (National General)" },
        { value: "INS041", label: "INS041 - Fidelity" },
        { value: "INS044", label: "INS044 - National Life" },
        { value: "INS053", label: "INS053 - Allianz" }
    ]

    // ============================================================================
    // ID TYPE OPTIONS (Dynamic based on TPA)
    // ============================================================================

    const BASE_ID_TYPES = [
        { label: "Emirates ID", value: "EMIRATESID" },
        { label: "Member ID", value: "CARDNUMBER" }
    ]

    const dynamicIdTypeOptions = useMemo(() => {
        // FMC: Supports DHA Member ID and Passport
        if (options === "TPA010") {
            return [
                ...BASE_ID_TYPES,
                { label: "DHA Member ID", value: "DHAMEMBERID" },
                { label: "Passport", value: "Passport" }
            ]
        }

        // Lifeline/NextCare: Supports DHA Member ID and Policy Number
        if (["TPA037", "TPA002"].includes(options)) {
            return [
                ...BASE_ID_TYPES,
                { label: "DHA Member ID", value: "DHAMEMBERID" },
                { label: "Policy Number", value: "POLICYNUMBER" }
            ]
        }

        // Multiple TPAs: Only DHA Member ID
        if ([
            "TPA001", "TPA004", "TPA036", "INS038",
            "INS017", "INS010"
        ].includes(options)) {
            return [
                ...BASE_ID_TYPES,
                { label: "DHA Member ID", value: "DHAMEMBERID" }
            ]
        }

        return BASE_ID_TYPES
    }, [options])

    // ============================================================================
    // VISIT TYPE OPTIONS (Dynamic based on TPA)
    // ============================================================================

    const VISIT_TYPES: Record<string, Array<{ label: string; value: string; extraArgs?: any }>> = {
        "BOTH": [
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "DHPO": [
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "RIYATI": [
            { label: "Outpatient", value: "OUTPATIENT" }
        ],
        "TPA001": [ // Neuron
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" },
            {
                label: "Maternity",
                value: "MATERNITY",
                extraArgs: {
                    title: "maternity_type",
                    titleLabel: "Maternity Type",
                    options: [
                        { label: "Normal Delivery", value: "normal_delivery" },
                        { label: "C-Section", value: "c_section" },
                        { label: "Prenatal", value: "prenatal" },
                        { label: "Postnatal", value: "postnatal" }
                    ]
                }
            }
        ],
        "TPA002": [ // NextCare
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Chronic Out", value: "CHRONIC_OUT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "TPA003": [ // Al Madallah
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "TPA004": [ // NAS
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" },
            {
                label: "Maternity",
                value: "MATERNITY",
                extraArgs: {
                    title: "maternity_type",
                    titleLabel: "Maternity Type",
                    options: [
                        { label: "Normal Delivery", value: "normal_delivery" },
                        { label: "C-Section", value: "c_section" },
                        { label: "Prenatal", value: "prenatal" },
                        { label: "Postnatal", value: "postnatal" }
                    ]
                }
            }
        ],
        "TPA010": [ // FMC
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "TPA023": [ // Daman Thiqa
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "TPA026": [ // Aafiya
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "TPA029": [ // eCare
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "INS010": [ // AXA
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Dental", value: "DENTAL" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "INS017": [ // ADNIC
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "INS026": [ // Daman
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ],
        "D004": [ // Daman Variant
            { label: "Outpatient", value: "OUTPATIENT" },
            { label: "Emergency", value: "EMERGENCY" }
        ]
    }

    const visitTypeOptions = useMemo(
        () => VISIT_TYPES[options] || VISIT_TYPES["BOTH"] || [],
        [options]
    )

    // ============================================================================
    // DOCTOR LIST (Mock - would come from API)
    // ============================================================================

    const DOCTORS_LIST = [
        { label: "Dr. Ahmed Hassan", value: "DR001" },
        { label: "Dr. Sarah Johnson", value: "DR002" },
        { label: "Dr. Mohammed Ali", value: "DR003" },
        { label: "Dr. Emily Chen", value: "DR004" },
        { label: "Dr. Fatima Al Zaabi", value: "DR005" }
    ]

    // ============================================================================
    // PAYER OPTIONS (for NextCare Policy Number)
    // ============================================================================

    const payerOptions = {
        "ADNOC": "ADNOC Distribution",
        "EMIRATES_AIRLINE": "Emirates Airline",
        "ETISALAT": "Etisalat",
        "DU": "du Telecommunications",
        "RAK_BANK": "RAK Bank",
        "NBAD": "National Bank of Abu Dhabi"
    }

    // ============================================================================
    // CONDITIONAL FIELD LOGIC
    // ============================================================================

    // POD eligible locations (example for Daman/Thiqa)
    const isPodEligible = ["medcare", "healthhub"].includes(selectedOrganizationId)
    const shouldShowPodFields =
        (options === "TPA023" || options === "INS026" || options === "D004") && isPodEligible

    // Doctor name field requirement
    const showDoctorsNameField =
        options === "INS026" || // Daman
        options === "TPA029" || // eCare
        options === "D004" || // Daman variant
        options === "TPA023" || // Daman Thiqa
        options === "BOTH" ||
        options === "DHPO" ||
        options === "RIYATI" ||
        (options === "TPA037" && selectedOrganizationId === "al-noor") || // Lifeline at Al Noor
        (options === "TPA001" && selectedOrganizationId === "org1") || // Neuron at Org1
        (options === "INS017" && selectedOrganizationId === "org1") || // ADNIC at Org1
        (options === "TPA004" && selectedOrganizationId === "org1") // NAS at Org1

    // Name field requirement
    const showNameField =
        (["TPA003", "BOTH", "RIYATI", "DHPO"].includes(options) && idType !== "EMIRATESID") ||
        options === "TPA016" || // MSH
        (options === "TPA002" && idType === "POLICYNUMBER") // NextCare with Policy Number

    // Phone number field
    const showPhoneField =
        options === "TPA029" || // eCare
        options === "TPA023" || // Daman Thiqa
        options === "D004" || // Daman variant
        (options === "TPA037" && selectedOrganizationId === "al-noor") || // Lifeline at Al Noor
        options === "INS026" || // Daman
        (options === "INS010" && idType !== "EMIRATESID" && useDental === "YES") // AXA Dental

    // Split phone fields (ADNIC at Org1)
    const isOrg1Ins017 = selectedOrganizationId === "org1" && options === "INS017"

    // Service type field
    const showServiceTypeField =
        options === "TPA029" || // eCare
        (options === "TPA037" && selectedOrganizationId === "al-noor") // Lifeline at Al Noor

    // Referral code field
    const showReferralCodeField = options === "TPA026" // Aafiya

    // AXA Dental options
    const showDentalOptions = options === "INS010" && idType !== "EMIRATESID"

    // Payer name field (NextCare with Policy Number)
    const showPayerNameField = options === "TPA002" && idType === "POLICYNUMBER"

    // Visit category (ADNIC at Org1)
    const showVisitCategoryField = isOrg1Ins017

    const visitCategoryOptions = [
        { label: "FIRST VISIT", value: "FIRST_VISIT" },
        { label: "VISIT WITHOUT REFERRAL", value: "VISIT_WITHOUT_REFERRAL" }
    ]

    // Maternity extra args (NAS, Neuron)
    const showMaternityExtraArgs =
        visitType === "MATERNITY" && (options === "TPA004" || options === "TPA001")

    const maternityExtraArgs = visitTypeOptions?.find(
        (item) => item.value === "MATERNITY"
    )?.extraArgs

    // ============================================================================
    // VISIT TYPE AUTO-SELECTION LOGIC
    // ============================================================================

    // Auto-select visit type when insurance provider changes
    useEffect(() => {
        if (options && VISIT_TYPES[options]) {
            let newDefaultVisitType = "OUTPATIENT"

            // Special logic for NextCare based on organization
            if (options === "TPA002") {
                if (["healthhub", "medcare", "al-noor"].includes(selectedOrganizationId)) {
                    newDefaultVisitType = "OUTPATIENT"
                } else {
                    // Use CHRONIC_OUT for other organizations
                    const chronicOutOption = VISIT_TYPES[options]?.find(
                        (opt) => opt.value === "CHRONIC_OUT"
                    )
                    newDefaultVisitType = chronicOutOption ? "CHRONIC_OUT" : "OUTPATIENT"
                }
            } else {
                // For other TPAs, use OUTPATIENT if available
                const outpatientOption = VISIT_TYPES[options]?.find(
                    (opt) => opt.value === "OUTPATIENT"
                )
                newDefaultVisitType = outpatientOption
                    ? "OUTPATIENT"
                    : VISIT_TYPES[options][0]?.value || "OUTPATIENT"
            }

            setVisitType(newDefaultVisitType)
        }
    }, [options, selectedOrganizationId])

    // AXA: Auto-switch to Member ID when DENTAL is selected
    useEffect(() => {
        if (options === "INS010" && visitType === "DENTAL") {
            if (idType === "EMIRATESID") {
                setIdType("CARDNUMBER") // Switch to Member ID
            }
        }
    }, [options, visitType, idType])

    // ============================================================================
    // ID NUMBER INPUT HANDLING & VALIDATION
    // ============================================================================

    const handleEmiratesIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.trim()
        const digits = rawValue.replace(/\D/g, "")
        const containsLetters = /[a-zA-Z]/.test(rawValue)

        // Clear warnings
        setEmiratesIdInputWarning(null)

        // ========== EMIRATES ID HANDLING ==========
        if (idType === "EMIRATESID") {
            // If letters detected, show warning
            if (containsLetters) {
                setEmiratesIdInputWarning(
                    "Emirates ID contains numbers and dashes only. Please switch to Member ID if needed."
                )
                // Format only the digits found
                let formattedId = digits
                if (digits.length > 3) {
                    formattedId = `${digits.slice(0, 3)}-${digits.slice(3)}`
                }
                if (digits.length > 7) {
                    formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
                }
                setEmiratesId(formattedId.slice(0, 18))
                return
            }

            // If too many digits
            if (digits.length > 15) {
                setEmiratesIdInputWarning("Emirates ID has only 15 digits.")
                const limitedDigits = digits.slice(0, 15)
                const formattedId = `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 7)}-${limitedDigits.slice(7, 14)}-${limitedDigits.slice(14, 15)}`
                setEmiratesId(formattedId.slice(0, 18))
                return
            }

            // Format progressively: XXX-XXXX-XXXXXXX-X
            let formattedId = digits
            if (digits.length > 3) {
                formattedId = `${digits.slice(0, 3)}-${digits.slice(3)}`
            }
            if (digits.length > 7) {
                formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
            }
            if (digits.length > 14) {
                formattedId = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14, 15)}`
            }
            setEmiratesId(formattedId.slice(0, 18))
        }
        // ========== DHA MEMBER ID HANDLING ==========
        else if (idType === "DHAMEMBERID") {
            // DHA Member ID format: XXXX-XXX-XXXXXXXXX-XX (alphanumeric)
            const alphanumericOnly = rawValue
                .replace(/[^A-Za-z0-9]/g, "")
                .toUpperCase()

            let formattedDhaId = ""

            if (alphanumericOnly.length > 0) {
                formattedDhaId += alphanumericOnly.substring(0, Math.min(4, alphanumericOnly.length))
            }
            if (alphanumericOnly.length > 4) {
                formattedDhaId += "-" + alphanumericOnly.substring(4, Math.min(7, alphanumericOnly.length))
            }
            if (alphanumericOnly.length > 7) {
                formattedDhaId += "-" + alphanumericOnly.substring(7, Math.min(16, alphanumericOnly.length))
            }
            if (alphanumericOnly.length > 16) {
                formattedDhaId += "-" + alphanumericOnly.substring(16, Math.min(18, alphanumericOnly.length))
            }

            setEmiratesId(formattedDhaId.slice(0, 21)) // Max 21 chars with dashes

            // Validation warning
            const dhaMemberIdRegex = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{3}-[A-Za-z0-9]{9}-[A-Za-z0-9]{2}$/
            if (
                formattedDhaId.length > 0 &&
                alphanumericOnly.length <= 18 &&
                !dhaMemberIdRegex.test(formattedDhaId)
            ) {
                setEmiratesIdInputWarning(
                    "Please ensure the DHA Member ID is in the format XXXX-XXX-XXXXXXXXX-XX."
                )
            }
        }
        // ========== OTHER ID TYPES (Member ID, Policy Number, etc.) ==========
        else {
            setEmiratesId(rawValue)
        }
    }

    // Split phone number handler (for ADNIC Org1)
    const setPhoneNumberParts = (code: string, suffix: string) => {
        setPhoneCode(code)
        setPhoneSuffix(suffix)
        setPhoneNumber(`971-${code}-${suffix}`)
    }

    // ============================================================================
    // FORM VALIDATION
    // ============================================================================

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        // Emirates ID / Member ID validation
        if (!emiratesId) {
            newErrors.emiratesId = "This field is required"
        } else if (idType === "EMIRATESID") {
            const emiratesIdRegex = /^\d{3}-\d{4}-\d{7}-\d{1}$/
            if (!emiratesIdRegex.test(emiratesId)) {
                newErrors.emiratesId = "Invalid Emirates ID format (must be XXX-XXXX-XXXXXXX-X)"
            }
        }

        // Visit type validation
        if (!visitType) {
            newErrors.visitType = "Visit type is required"
        }

        // Doctor name validation
        if (showDoctorsNameField && !doctorName) {
            newErrors.doctorName = "Doctor name is required"
        }

        // Name validation
        if (showNameField && !name) {
            newErrors.name = "Name is required"
        }

        // Phone validation
        if (showPhoneField && !phoneNumber) {
            newErrors.phoneNumber = "Phone number is required"
        }

        if (isOrg1Ins017 && (!phoneCode || !phoneSuffix || phoneSuffix.length !== 7)) {
            newErrors.phoneNumber = "Please enter a valid mobile number (code + 7 digits)"
        }

        // POD validation
        if (shouldShowPodFields && isPod && !podId) {
            newErrors.pod = "POD ID is required when POD is Yes"
        }

        // Payer name validation (NextCare Policy Number)
        if (showPayerNameField && !payerName) {
            newErrors.payerName = "Payer name is required"
        }

        // Visit category validation (ADNIC Org1)
        if (showVisitCategoryField && !visitCategory) {
            newErrors.visitCategory = "Visit category is required"
        }

        // Maternity extra args validation
        if (showMaternityExtraArgs && !maternityType) {
            newErrors.maternityType = "Maternity type is required"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // ============================================================================
    // FORM SUBMISSION
    // ============================================================================

    const handleSubmit = async () => {
        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)

        try {
            // Build request payload
            const payload = {
                emirates_id: emiratesId,
                tpa_name: options,
                id_type: idType,
                visit_type: visitType,
                phone: phoneNumber || "971-50-1234567", // Default if empty
                practice_id: selectedClinicId,

                // Conditional fields
                ...(name && { name }),
                ...(doctorName && { doctor_name: doctorName }),
                ...(referralCode && { referral_code: referralCode }),
                ...(serviceType && { service_type: serviceType }),
                ...(visitCategory && { visit_category: visitCategory }),
                ...(payerName && { payer_name: payerName }),
                ...(podId && { pod_id: podId }),
                ...(isPod !== undefined && { is_pod: isPod }),
                ...(isMaternity !== undefined && { is_maternity: isMaternity }),
                ...(notRelatedToChiefComplaint && { not_related_to_chief_complaint: true }),
                ...(maternityType && { maternity_type: maternityType })
            }

            console.log("Submitting eligibility check to Mantys:", payload)

            // Here you would call your Mantys API
            // await fetch('/api/mantys/eligibility-check', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify(payload)
            // })

            alert("Eligibility check submitted successfully!\n\nPayload: " + JSON.stringify(payload, null, 2))
        } catch (error) {
            console.error("Error submitting eligibility check:", error)
            alert("Error submitting eligibility check. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Patient Information
                </h3>
                <div className="space-y-1 text-sm text-blue-800">
                    {patientData && (
                        <>
                            {name && <p><span className="font-medium">Name:</span> {name}</p>}
                            {phoneNumber && <p><span className="font-medium">Phone:</span> {phoneNumber}</p>}
                            {emiratesId && <p><span className="font-medium">ID:</span> {emiratesId}</p>}
                        </>
                    )}
                    {insuranceData && (
                        <>
                            <p><span className="font-medium">Insurance:</span> {insuranceData.tpa_name}</p>
                            {insuranceData.ins_plan && (
                                <p><span className="font-medium">Plan:</span> {insuranceData.ins_plan}</p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Form Fields */}
            <div>
                <div className="space-y-4">
                    {/* Insurance Provider */}
                    <div>
                        <label className="block font-semibold text-gray-700 mb-2">
                            Insurance Provider
                        </label>
                        <Select
                            value={INSURANCE_OPTIONS.find((opt) => opt.value === options)}
                            onChange={(selected) => setOptions(selected?.value || "BOTH")}
                            options={INSURANCE_OPTIONS}
                            placeholder="Select an insurance provider"
                            isSearchable
                        />
                    </div>

                    {/* ID Type and Visit Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                ID Type
                            </label>
                            <Select
                                value={dynamicIdTypeOptions.find((opt) => opt.value === idType)}
                                onChange={(selected) => setIdType(selected?.value || "EMIRATESID")}
                                options={dynamicIdTypeOptions}
                                placeholder="Select ID type"
                                isSearchable
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Visit Type <span className="text-red-600">*</span>
                            </label>
                            <Select
                                value={visitTypeOptions.find((opt) => opt.value === visitType)}
                                onChange={(selected) => setVisitType(selected?.value || "")}
                                options={visitTypeOptions}
                                placeholder={visitTypeOptions.length > 0 ? "Select visit type" : "TPA has no visit type"}
                                isDisabled={visitTypeOptions.length === 0}
                                isSearchable
                            />
                            {errors.visitType && (
                                <span className="text-red-500 text-sm mt-1">{errors.visitType}</span>
                            )}
                        </div>
                    </div>

                    {/* Visit Category (ADNIC at Org1) */}
                    {showVisitCategoryField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Visit Category <span className="text-red-600">*</span>
                            </label>
                            <Select
                                value={visitCategoryOptions.find((opt) => opt.value === visitCategory)}
                                onChange={(selected) => setVisitCategory(selected?.value || "")}
                                options={visitCategoryOptions}
                                placeholder="Select visit category"
                            />
                            {errors.visitCategory && (
                                <span className="text-red-500 text-sm mt-1">{errors.visitCategory}</span>
                            )}
                        </div>
                    )}

                    {/* Maternity Extra Args (NAS, Neuron) */}
                    {showMaternityExtraArgs && maternityExtraArgs && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                {maternityExtraArgs.titleLabel} <span className="text-red-600">*</span>
                            </label>
                            <Select
                                value={maternityExtraArgs.options.find((opt: any) => opt.value === maternityType)}
                                onChange={(selected) => setMaternityType(selected?.value || "")}
                                options={maternityExtraArgs.options}
                                placeholder="Select maternity type"
                                isSearchable
                            />
                            {errors.maternityType && (
                                <span className="text-red-500 text-sm mt-1">{errors.maternityType}</span>
                            )}
                        </div>
                    )}

                    {/* Name Field (Al Madallah, DHPO, RIYATI, MSH, NextCare Policy) */}
                    {showNameField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Name <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter patient's name"
                                className={`w-full border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md p-3`}
                            />
                            {errors.name && (
                                <span className="text-red-500 text-sm mt-1">{errors.name}</span>
                            )}
                        </div>
                    )}

                    {/* Doctor Name */}
                    {showDoctorsNameField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Doctor's Name <span className="text-red-600">*</span>
                            </label>
                            <Select
                                value={DOCTORS_LIST.find((opt) => opt.value === doctorName)}
                                onChange={(selected) => setDoctorName(selected?.value || "")}
                                options={DOCTORS_LIST}
                                placeholder="Select doctor's name"
                                isSearchable
                            />
                            {errors.doctorName && (
                                <span className="text-red-500 text-sm mt-1">{errors.doctorName}</span>
                            )}
                        </div>
                    )}

                    {/* Emirates ID / Member ID / DHA Member ID */}
                    <div>
                        <label className="block font-semibold text-gray-700 mb-2">
                            {idType === "EMIRATESID"
                                ? "Emirates ID"
                                : idType === "DHAMEMBERID"
                                    ? "DHA Member ID"
                                    : idType === "POLICYNUMBER"
                                        ? "Policy Number"
                                        : "Member ID"}
                            <span className="text-red-600 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            value={emiratesId}
                            onChange={handleEmiratesIdChange}
                            placeholder={
                                idType === "EMIRATESID"
                                    ? "Enter Emirates ID (e.g., 784-1234-1234567-1)"
                                    : idType === "DHAMEMBERID"
                                        ? "Enter DHA Member ID"
                                        : idType === "POLICYNUMBER"
                                            ? "Enter Policy Number"
                                            : "Enter Member ID"
                            }
                            className={`w-full border ${errors.emiratesId || emiratesIdInputWarning ? 'border-red-500' : 'border-gray-300'} rounded-md p-3`}
                        />
                        {emiratesIdInputWarning && (
                            <span className="text-orange-600 text-sm mt-1 block">{emiratesIdInputWarning}</span>
                        )}
                        {errors.emiratesId && !emiratesIdInputWarning && (
                            <span className="text-red-500 text-sm mt-1 block">{errors.emiratesId}</span>
                        )}
                        <small className="text-gray-500 mt-1 block">
                            {idType === "EMIRATESID"
                                ? "Your Emirates ID is a 15-digit number."
                                : idType === "DHAMEMBERID"
                                    ? "Enter your DHA Member ID number."
                                    : idType === "POLICYNUMBER"
                                        ? "Enter your Policy Number."
                                        : ""}
                        </small>
                    </div>

                    {/* Split Phone (ADNIC at Org1) */}
                    {isOrg1Ins017 && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Mobile Number <span className="text-red-600">*</span>
                            </label>
                            <div className="flex gap-2">
                                <Select
                                    value={phoneCode ? { value: phoneCode, label: phoneCode } : null}
                                    onChange={(selected) => setPhoneNumberParts(selected?.value || "", phoneSuffix)}
                                    options={[
                                        { value: "50", label: "50" },
                                        { value: "52", label: "52" },
                                        { value: "54", label: "54" },
                                        { value: "55", label: "55" },
                                        { value: "56", label: "56" },
                                        { value: "57", label: "57" },
                                        { value: "58", label: "58" }
                                    ]}
                                    placeholder="Code"
                                    styles={{ container: (base) => ({ ...base, minWidth: "120px" }) }}
                                />
                                <input
                                    type="text"
                                    value={phoneSuffix}
                                    onChange={(e) => setPhoneNumberParts(phoneCode, e.target.value)}
                                    placeholder="7 digit number"
                                    maxLength={7}
                                    className="flex-1 border border-gray-300 rounded-md p-3"
                                />
                            </div>
                            {errors.phoneNumber && (
                                <span className="text-red-500 text-sm mt-1">{errors.phoneNumber}</span>
                            )}
                        </div>
                    )}

                    {/* Phone Number (eCare, Daman Thiqa, Daman, D004, Lifeline@AlNoor) */}
                    {showPhoneField && !isOrg1Ins017 && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, "")
                                    setPhoneNumber(digits)
                                }}
                                placeholder="Enter patient's phone number"
                                maxLength={15}
                                className={`w-full border ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'} rounded-md p-3`}
                            />
                            {errors.phoneNumber && (
                                <span className="text-red-500 text-sm mt-1">{errors.phoneNumber}</span>
                            )}
                        </div>
                    )}

                    {/* Service Type (eCare, Lifeline@AlNoor) */}
                    {showServiceTypeField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Service Type
                            </label>
                            <Select
                                value={serviceType ? { label: serviceType, value: serviceType } : null}
                                onChange={(selected) => setServiceType(selected?.value || "")}
                                options={[
                                    { label: "Consultation GP", value: "Consultation GP" },
                                    { label: "Consultation Specialist", value: "Consultation Specialist" }
                                ]}
                                placeholder="Select service type"
                            />
                        </div>
                    )}

                    {/* AXA Dental Options */}
                    {showDentalOptions && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Dental
                            </label>
                            <Select
                                value={[
                                    { label: "Yes", value: "YES" },
                                    { label: "No", value: "NO" }
                                ].find((opt) => opt.value === useDental)}
                                onChange={(selected) => setUseDental(selected?.value || "NO")}
                                options={[
                                    { label: "Yes", value: "YES" },
                                    { label: "No", value: "NO" }
                                ]}
                                placeholder="Should use Dental?"
                            />
                        </div>
                    )}

                    {/* Referral Code (Aafiya) */}
                    {showReferralCodeField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Referral Code <span className="text-gray-400 text-xs">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={referralCode}
                                onChange={(e) => setReferralCode(e.target.value)}
                                placeholder="Enter referral code"
                                className="w-full border border-gray-300 rounded-md p-3"
                            />
                        </div>
                    )}

                    {/* POD Fields (Daman, Daman Thiqa, D004) */}
                    {shouldShowPodFields && (
                        <>
                            {/* Maternity Flag */}
                            <div>
                                <label className="block font-semibold text-gray-700 mb-2">
                                    Maternity? <span className="text-gray-400 text-xs">(optional)</span>
                                </label>
                                <Select
                                    value={isMaternity ? { value: "1", label: "True" } : { value: "0", label: "False" }}
                                    onChange={(selected) => setIsMaternity(selected?.value === "1")}
                                    options={[
                                        { value: "1", label: "True" },
                                        { value: "0", label: "False" }
                                    ]}
                                    placeholder="Select True or False"
                                    isSearchable={false}
                                />
                            </div>

                            {/* Not Related to Chief Complaint */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={notRelatedToChiefComplaint}
                                    onChange={(e) => setNotRelatedToChiefComplaint(e.target.checked)}
                                    className="w-5 h-5 cursor-pointer"
                                />
                                <label className="font-semibold text-gray-700 cursor-pointer">
                                    Visit not related to same chief complaint
                                </label>
                            </div>

                            {/* POD Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-gray-700 mb-2">
                                        POD? <span className="text-gray-400 text-xs">(optional)</span>
                                    </label>
                                    <Select
                                        value={isPod ? { value: "1", label: "Yes" } : { value: "0", label: "No" }}
                                        onChange={(selected) => {
                                            const isYes = selected?.value === "1"
                                            setIsPod(isYes)
                                            if (!isYes) setPodId("")
                                        }}
                                        options={[
                                            { value: "1", label: "Yes" },
                                            { value: "0", label: "No" }
                                        ]}
                                        placeholder="Select Yes or No"
                                        isSearchable={false}
                                    />
                                </div>

                                {isPod && (
                                    <div>
                                        <label className="block font-semibold text-gray-700 mb-2">
                                            POD ID <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={podId}
                                            onChange={(e) => setPodId(e.target.value)}
                                            placeholder="Enter POD ID"
                                            className={`w-full border ${errors.pod ? 'border-red-500' : 'border-gray-300'} rounded-md p-3`}
                                        />
                                        {errors.pod && (
                                            <span className="text-red-500 text-sm mt-1">{errors.pod}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Payer Name (NextCare with Policy Number) */}
                    {showPayerNameField && (
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">
                                Payer Name <span className="text-red-600">*</span>
                            </label>
                            <Select
                                value={payerName ? { value: payerName, label: payerName } : null}
                                onChange={(selected) => setPayerName(selected?.value || null)}
                                options={Object.values(payerOptions).map((name) => ({
                                    value: name,
                                    label: name
                                }))}
                                placeholder="Select a payer name"
                                isSearchable
                            />
                            {errors.payerName && (
                                <span className="text-red-500 text-sm mt-1">{errors.payerName}</span>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-6 flex gap-3 sticky bottom-0 bg-white pb-4 border-t border-gray-200 -mx-6 px-6 mt-6">
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Checking...
                                </span>
                            ) : (
                                "✓ Check Eligibility"
                            )}
                        </Button>
                        {onClose && (
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-6"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

