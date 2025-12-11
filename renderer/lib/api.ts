/**
 * API utilities for making requests to Aster Clinics backend
 * Uses Next.js API routes as a proxy to avoid CORS issues
 */

export interface PatientData {
  relationshipid: number;
  relationshipname: string;
  firstname: string;
  middlename: string;
  lastname: string;
  address1: string;
  address2: string;
  city: string | null;
  stateid: number | null;
  statename: string | null;
  zip: string | null;
  phone: string | null;
  callnotes: string | null;
  email: string | null;
  self: number;
  home_phone: string | null;
  phone_other: string | null;
  patient_demog_id: number;
  patient_id: number;
  uid_value: string;
  driver_lic: string;
  dob: string;
  marital_status_id: number | null;
  sex_id: number;
  blood_type_id: number | null;
  calculated_age: string;
  is_estimated: string;
  age: string;
  pan_no: string;
  passport_no: string;
  education_level: string | null;
  mother_tongue: string | null;
  identification_mark: string;
  smoking_status_id: number | null;
  alcohol_status_id: number | null;
  dom: string;
  other_mother_tongue: string;
  other_education: string;
  country_id: number;
  is_vip: number | null;
  comments: string | null;
  is_deceased: number;
  has_id: number;
  reason: string | null;
  visa: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  pat_nationality: number;
  po_box_num: string;
  gender: string;
  mpi: string;
  nationality: string;
  mar_status: string | null;
  area: string | null;
  is_phone_overrided: number;
  is_alternate_phoneno_overrided: number;
  printed_on: string;
  iso_code: string;
  sponser_org_name: string | null;
  pat_arabic_name: string | null;
  has_image: string;
  occupation_id: number;
  is_nabidh_private: number | null;
  nabidh_consent: number | null;
  visa_type: string | null;
  gcc_id: string | null;
  relationship_type: string | null;
  associated_nationality_id: number | null;
  appointment_id?: number;
  encounter_id?: number;
}

interface PatientDetailsResponse {
  head: {
    StatusValue: number;
    StatusText: string;
  };
  body: {
    Data: PatientData[];
    RecordCount: number;
    TotalRecords: number | null;
  };
}

/**
 * Fetch patient details by patient ID
 * @param patientId - The patient ID to search for
 * @param customerId - Customer ID (default: 1)
 * @param siteId - Site ID (default: 1)
 * @param encounterId - Encounter ID (default: 0)
 * @param appointmentId - Appointment ID (optional)
 */
export async function getPatientDetails(
  patientId: number,
  customerId: number = 1,
  siteId: number = 1,
  encounterId: number = 0,
  appointmentId?: number,
): Promise<PatientDetailsResponse> {
  try {
    // Call our Next.js API route (proxy) to avoid CORS issues
    const response = await fetch("/api/patient/details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId,
        customerId,
        siteId,
        encounterId,
        appointmentId: appointmentId || 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Error fetching patient details:", error);
    throw error;
  }
}

/**
 * Search for patient by MPI (Master Patient Index)
 * @param mpi - The MPI to search for
 * @param customerSiteId - Customer Site ID (default: 1)
 */
export async function searchPatientByMPI(
  mpi: string,
  customerSiteId: number = 31,
): Promise<PatientDetailsResponse> {
  try {
    // Call our Next.js API route (proxy) to avoid CORS issues
    const response = await fetch("/api/patient/search-mpi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mpi,
        customerSiteId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Error searching patient by MPI:", error);
    throw error;
  }
}

/**
 * Search for patient by phone number
 * @param phoneNumber - The phone number to search for
 * @param customerSiteId - Customer Site ID (default: 1)
 */
export async function searchPatientByPhone(
  phoneNumber: string,
  customerSiteId: number = 1,
): Promise<PatientDetailsResponse> {
  try {
    // Call our Next.js API route (proxy) to avoid CORS issues
    const response = await fetch("/api/patient/search-phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
        customerSiteId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Error searching patient by phone number:", error);
    throw error;
  }
}

/**
 * Search parameters for appointment search
 */
export interface AppointmentSearchParams {
  // Search filters
  mpi?: string;
  phoneNumber?: string | number;
  patientName?: string;
  mcnNo?: string;
  displayEncounterNumber?: string;

  // Date filters
  fromDate?: string; // Format: MM/DD/YYYY
  toDate?: string; // Format: MM/DD/YYYY
  isFilterDate?: number;

  // Pagination
  pageNo?: number;
  recPerPage?: number;

  // IDs and filters
  customerSiteId?: number;
  payerId?: number | null;
  visitTypeId?: number | null;
  physicianId?: number | null;
  specialisationId?: number | null;
  roomId?: number | null;
  visitPurposeId?: number | null;
  payerTypeId?: number | null;

  // Status and type filters
  appStatusId?: string;
  encounterType?: number;
  isEmergencyAppointment?: number | null;
  insuranceType?: string | null;

  // Other filters
  groupByApntStatus?: number;
  referralUploadFilter?: number;
  filterByReferral?: number;
  timeOrderBy?: number;
  orderType?: string | null;
  type?: string | null;
}

/**
 * Appointment data from the API
 */
export interface AppointmentData {
  appointment_id: number;
  patient_id: number;
  mpi: string;
  full_name: string;
  mobile_phone: string;
  email: string;
  dob: string;
  age: string;
  gender: string;
  gender_id: number;
  nationality_id: string;
  is_estimated: string;
  appointment_date: string;
  appointment_time: string;
  appointment_status: string;
  appointment_status_id: number;
  physician_name: string;
  specialisation_name: string;
  [key: string]: any; // For any additional fields
}

/**
 * Response for appointment search
 */
export interface AppointmentSearchResponse {
  head: {
    StatusValue: number;
    StatusText: string;
  };
  body: {
    Data: AppointmentData[];
    RecordCount: number;
    TotalRecords: number | null;
  };
}

/**
 * Search for appointments with flexible filters
 * @param params - Search parameters
 */
export async function searchAppointments(
  params: AppointmentSearchParams,
): Promise<AppointmentSearchResponse> {
  try {
    // Call our Next.js API route (proxy) to avoid CORS issues
    const response = await fetch("/api/patient/search-appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Error searching appointments:", error);
    throw error;
  }
}

/**
 * Insurance details data structure (based on actual API response)
 */
export interface InsuranceData {
  patient_insurance_tpa_policy_id: number;
  tpa_name: string;
  tpa_id: number;
  tpa_policy_id: string;
  tpa_group_policy_id: string | null;
  tpa_valid_till: string;
  insurance_company_id: number | null;
  insurance_name: string | null;
  insurance_policy_id: string;
  insurance_group_policy_id: string | null;
  insurance_valid_till: string;
  tpa_company_id: number;
  is_current: number;
  receiver_id: number;
  receiver_name: string;
  receiver_code: string;
  payer_valid_till: string | null;
  is_valid: number;
  proposer_rel_id: number;
  patient_id: number;
  patient_fname: string | null;
  patient_mname: string | null;
  patient_lname: string | null;
  patient_dob: string | null;
  patient_mpi: string;
  insurance_from: string;
  insurance_renewal: string | null;
  type: number;
  relation_id: number;
  plan_id: number;
  ins_plan: string;
  ins_plan_code: string;
  relation: string;
  ins_holderid: string | null;
  insurance_status_id: number;
  insurance_status: string;
  payer_id: number;
  payer_name: string;
  payer_code: string;
  rate_card_name: string;
  rate_card_id: number;
  policy_number: string | null;
  priority_patient_applicable: number;
  payer_type: number;
  description: string;
  site_id: number;
  insurance_type: number;
  authorization_limit: string;
  ins_exp_date: string;
  is_turbo_care: string;
  is_teleconsultation_available: string;
  copay: {
    Default: {
      copay_details?: Array<{
        payableAmount: string;
        payableAmountType: number;
        payableAmountDesc: string;
        chargeGroupId: number | null;
        chargeGroupName: string;
        copayDeductId: number;
        isDeductable: number;
        isMaternity: number;
        isDefault: number;
        payableAmountMax: string | null;
        isAcrossChargeGroup: number;
      }>;
      Deduct_details?: Array<{
        payableAmount: string;
        payableAmountType: number;
        payableAmountDesc: string;
        chargeGroupId: number | null;
        chargeGroupName: string;
        copayDeductId: number;
        isDefault: number;
        isDeductable: number;
        isMaternity: number;
        payableAmountMax: string | null;
        isAcrossChargeGroup: number;
      }>;
    };
  };
  [key: string]: any; // For any additional fields
}

/**
 * Response for insurance details
 */
export interface InsuranceDetailsResponse {
  head: {
    StatusValue: number;
    StatusText: string;
  };
  body: {
    Data: InsuranceData[];
    RecordCount: number;
    TotalRecords: number | null;
  };
}

/**
 * Parameters for fetching insurance details
 */
export interface InsuranceDetailsParams {
  patientId: number;
  apntId?: number | null;
  encounterId?: number;
  customerId?: number;
  primaryInsPolicyId?: number | null;
  siteId?: number;
  isDiscard?: number;
  hasTopUpCard?: number;
}

/**
 * Get insurance details for a patient
 * @param params - Insurance details parameters
 */
export async function getInsuranceDetails(
  params: InsuranceDetailsParams,
): Promise<InsuranceDetailsResponse> {
  try {
    // Call our Next.js API route (proxy) to avoid CORS issues
    const response = await fetch("/api/patient/insurance-details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId: params.patientId,
        apntId: params.apntId ?? null,
        encounterId: params.encounterId ?? 0,
        customerId: params.customerId ?? 1,
        primaryInsPolicyId: params.primaryInsPolicyId ?? null,
        siteId: params.siteId ?? 1,
        isDiscard: params.isDiscard ?? 0,
        hasTopUpCard: params.hasTopUpCard ?? 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `API request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("Error fetching insurance details:", error);
    throw error;
  }
}

// ============================================================================
// MANTYS API INTEGRATION
// ============================================================================

// Re-export Mantys types and functions for convenience
export type {
  MantysEligibilityRequest,
  MantysEligibilityResponse,
  MantysKeyFields,
  TPACode,
  IDType,
  VisitType,
} from "../types/mantys";

export {
  buildMantysPayload,
  checkMantysEligibility,
  extractMantysKeyFields,
  formatEmiratesId,
  formatDhaMemberId,
  isValidEmiratesId,
  isValidDhaMemberId,
  getTPARequirements,
} from "./mantys-utils";

export { CLINIC_IDS } from "../types/mantys";

// ============================================================================
// LIFTRENZ AUTHENTICATION
// ============================================================================

// NOTE: LifeTrenz auth utilities are NOT re-exported here because they use
// Redis (ioredis) which is a Node.js-only module and cannot run in the browser.
// These utilities should only be imported and used in API routes (server-side).
// Import them directly in your API routes:
// import { getLifeTrenzAuthToken } from '../lib/liftrenz-auth-token';
