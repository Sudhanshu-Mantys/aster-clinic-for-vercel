/**
 * Shared API client with consistent error handling, timeout, and abort support
 * This replaces the scattered fetch calls throughout the codebase
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  timeout?: number;
  body?: unknown;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Core fetch function with timeout, error handling, and JSON parsing
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, body, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    clearTimeout(timeoutId);

    // Parse response body
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Request failed with status ${response.status}`;

      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeout}ms`, 408);
      }
      throw new ApiError(error.message, 0);
    }

    throw new ApiError('Unknown error occurred', 0);
  }
}

// ============================================================================
// API ENDPOINT FUNCTIONS
// ============================================================================

// Patient APIs
export const patientApi = {
  getDetails: (params: {
    patientId: number;
    customerId?: number;
    siteId?: number;
    encounterId?: number;
    appointmentId?: number;
  }) => fetchJson<PatientDetailsResponse>('/api/patient/details', {
    method: 'POST',
    body: {
      patientId: params.patientId,
      customerId: params.customerId ?? 1,
      siteId: params.siteId ?? 1,
      encounterId: params.encounterId ?? 0,
      appointmentId: params.appointmentId ?? 0,
    },
  }),

  searchByMPI: (mpi: string, customerSiteId = 31) =>
    fetchJson<PatientDetailsResponse>('/api/patient/search-mpi', {
      method: 'POST',
      body: { mpi, customerSiteId },
    }),

  searchByPhone: (phoneNumber: string, customerSiteId = 1) =>
    fetchJson<PatientDetailsResponse>('/api/patient/search-phone', {
      method: 'POST',
      body: { phoneNumber, customerSiteId },
    }),

  getInsuranceDetails: (params: InsuranceDetailsParams) =>
    fetchJson<InsuranceDetailsResponse>('/api/patient/insurance-details', {
      method: 'POST',
      body: {
        patientId: params.patientId,
        apntId: params.apntId ?? null,
        encounterId: params.encounterId ?? 0,
        customerId: params.customerId ?? 1,
        primaryInsPolicyId: params.primaryInsPolicyId ?? null,
        siteId: params.siteId ?? 1,
        isDiscard: params.isDiscard ?? 0,
        hasTopUpCard: params.hasTopUpCard ?? 0,
      },
    }),

  getContext: (params: { patientId?: string; mpi?: string; appointmentId?: string }) =>
    fetchJson<PatientContext>('/api/patient/context', {
      method: 'POST',
      body: params,
      timeout: 5000,
    }),

  updateContext: (params: {
    appointmentId?: number;
    patientId?: number;
    mpi?: string;
    updates: Record<string, unknown>;
  }) =>
    fetchJson<{ success: boolean; message?: string }>('/api/patient/context/update', {
      method: 'POST',
      body: {
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        mpi: params.mpi,
        updates: params.updates,
      },
    }),
};

// Appointment APIs
export const appointmentApi = {
  search: (params: AppointmentSearchParams) =>
    fetchJson<AppointmentSearchResponse>('/api/patient/search-appointments', {
      method: 'POST',
      body: params,
    }),

  getToday: (params: { fromDate: string; toDate: string; customerSiteId?: number }) =>
    fetchJson<AppointmentSearchResponse>(
      `/api/appointments/today?fromDate=${params.fromDate}&toDate=${params.toDate}${
        params.customerSiteId ? `&customerSiteId=${params.customerSiteId}` : ''
      }`
    ),
};

// Eligibility History APIs
export const eligibilityHistoryApi = {
  getAll: (clinicId?: string) =>
    fetchJson<EligibilityHistoryItem[]>(
      clinicId
        ? `/api/eligibility-history?clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history'
    ),

  getById: (id: string) =>
    fetchJson<EligibilityHistoryItem>(`/api/eligibility-history?id=${id}`),

  getByTaskId: (taskId: string) =>
    fetchJson<EligibilityHistoryItem>(`/api/eligibility-history?taskId=${taskId}`),

  getActive: (clinicId?: string) =>
    fetchJson<EligibilityHistoryItem[]>(
      clinicId
        ? `/api/eligibility-history?status=active&clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history?status=active'
    ),

  getCompleted: (clinicId?: string) =>
    fetchJson<EligibilityHistoryItem[]>(
      clinicId
        ? `/api/eligibility-history?status=completed&clinic_id=${encodeURIComponent(clinicId)}`
        : '/api/eligibility-history?status=completed'
    ),

  getByPatientId: async (patientId: string) => {
    const response = await fetchJson<
      EligibilityHistoryItem[] | { success: boolean; data?: EligibilityHistoryItem[] }
    >(`/api/eligibility/get-by-patient-id?patientId=${patientId}`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.data ?? [];
  },

  getByMPI: async (mpi: string) => {
    const response = await fetchJson<
      EligibilityHistoryItem[] | { success: boolean; data?: EligibilityHistoryItem[] }
    >(`/api/eligibility/get-by-mpi?mpi=${mpi}`);

    if (Array.isArray(response)) {
      return response;
    }

    return response.data ?? [];
  },

  create: (item: Omit<EligibilityHistoryItem, 'id' | 'createdAt'>) =>
    fetchJson<EligibilityHistoryItem>('/api/eligibility-history', {
      method: 'POST',
      body: item,
    }),

  update: (id: string, updates: Partial<EligibilityHistoryItem>) =>
    fetchJson<void>('/api/eligibility-history', {
      method: 'PUT',
      body: { id, updates },
    }),

  updateByTaskId: (taskId: string, updates: Partial<EligibilityHistoryItem>) =>
    fetchJson<void>('/api/eligibility-history', {
      method: 'PUT',
      body: { taskId, updates },
    }),

  delete: (id: string) =>
    fetchJson<void>(`/api/eligibility-history?id=${id}`, {
      method: 'DELETE',
    }),

  clearAll: () =>
    fetchJson<void>('/api/eligibility-history?clearAll=true', {
      method: 'DELETE',
    }),
};

// Mantys API
export const mantysApi = {
  checkStatus: (taskId: string) =>
    fetchJson<MantysStatusResponse>('/api/mantys/check-status', {
      method: 'POST',
      body: { task_id: taskId },
    }),

  createEligibilityCheck: (payload: MantysEligibilityRequest) =>
    fetchJson<MantysEligibilityResponse>('/api/mantys/eligibility-check', {
      method: 'POST',
      body: payload,
    }),
};

function extractConfigList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data && typeof data === 'object' && 'configs' in data) {
    return ((data as { configs?: T[] }).configs) ?? [];
  }
  return [];
}

function extractSingleConfig<T>(data: unknown): T | null {
  if (data && typeof data === 'object' && 'config' in data) {
    return (data as { config?: T }).config ?? null;
  }
  return (data as T) ?? null;
}

function extractPlans(data: unknown, tpaInsCode?: string): Plan[] {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === 'object') {
    if ('plans' in data && Array.isArray((data as { plans?: Plan[] }).plans)) {
      return (data as { plans?: Plan[] }).plans || [];
    }
    if ('plans_by_tpa' in data) {
      const byTpa = (data as { plans_by_tpa?: Record<string, Plan[]> }).plans_by_tpa || {};
      if (tpaInsCode && byTpa[tpaInsCode]) {
        return byTpa[tpaInsCode];
      }
      return Object.values(byTpa).flat();
    }
  }
  return [];
}

function extractPlansByTPA(data: unknown): Record<string, Plan[]> {
  if (data && typeof data === 'object' && 'plans_by_tpa' in data) {
    return (data as { plans_by_tpa?: Record<string, Plan[]> }).plans_by_tpa || {};
  }
  if (data && typeof data === 'object' && 'plans' in data && 'tpa_ins_code' in data) {
    const plans = (data as { plans?: Plan[] }).plans || [];
    const tpaInsCode = (data as { tpa_ins_code?: string }).tpa_ins_code;
    if (tpaInsCode) {
      return { [tpaInsCode]: plans };
    }
  }
  return {};
}

function extractPayers(data: unknown, tpaInsCode?: string): Payer[] {
  if (Array.isArray(data)) return data as Payer[];
  if (data && typeof data === 'object') {
    if ('payers' in data && Array.isArray((data as { payers?: Payer[] }).payers)) {
      return (data as { payers?: Payer[] }).payers || [];
    }
    if ('payers_by_tpa' in data) {
      const byTpa = (data as { payers_by_tpa?: Record<string, Payer[]> }).payers_by_tpa || {};
      if (tpaInsCode && byTpa[tpaInsCode]) {
        return byTpa[tpaInsCode];
      }
      return Object.values(byTpa).flat();
    }
  }
  return [];
}

function extractPayersByTPA(data: unknown): Record<string, Payer[]> {
  if (data && typeof data === 'object' && 'payers_by_tpa' in data) {
    return (data as { payers_by_tpa?: Record<string, Payer[]> }).payers_by_tpa || {};
  }
  if (data && typeof data === 'object' && 'payers' in data && 'tpa_ins_code' in data) {
    const payers = (data as { payers?: Payer[] }).payers || [];
    const tpaInsCode = (data as { tpa_ins_code?: string }).tpa_ins_code;
    if (tpaInsCode) {
      return { [tpaInsCode]: payers };
    }
  }
  return {};
}

function extractMantysNetworks(data: unknown, tpaInsCode?: string): MantysNetwork[] {
  if (Array.isArray(data)) return data as MantysNetwork[];
  if (data && typeof data === 'object') {
    if ('networks' in data && Array.isArray((data as { networks?: MantysNetwork[] }).networks)) {
      return (data as { networks?: MantysNetwork[] }).networks || [];
    }
    if ('networks_by_tpa' in data) {
      const byTpa = (data as { networks_by_tpa?: Record<string, MantysNetwork[]> }).networks_by_tpa || {};
      if (tpaInsCode && byTpa[tpaInsCode]) {
        return byTpa[tpaInsCode];
      }
      return Object.values(byTpa).flat();
    }
  }
  return [];
}

function extractMantysNetworksByTPA(data: unknown): Record<string, MantysNetwork[]> {
  if (data && typeof data === 'object' && 'networks_by_tpa' in data) {
    return (data as { networks_by_tpa?: Record<string, MantysNetwork[]> }).networks_by_tpa || {};
  }
  if (data && typeof data === 'object' && 'networks' in data && 'tpa_ins_code' in data) {
    const networks = (data as { networks?: MantysNetwork[] }).networks || [];
    const tpaInsCode = (data as { tpa_ins_code?: string }).tpa_ins_code;
    if (tpaInsCode) {
      return { [tpaInsCode]: networks };
    }
  }
  return {};
}

function extractPlanMappings(data: unknown): PlanNetworkMapping[] {
  if (Array.isArray(data)) return data as PlanNetworkMapping[];
  if (data && typeof data === 'object' && 'mappings' in data) {
    return ((data as { mappings?: PlanNetworkMapping[] }).mappings) ?? [];
  }
  return [];
}

function extractSpecialisations(data: unknown): Specialisation[] {
  if (Array.isArray(data)) return data as Specialisation[];
  if (data && typeof data === 'object' && 'specialisations' in data) {
    return ((data as { specialisations?: Specialisation[] }).specialisations) ?? [];
  }
  return [];
}

// Clinic Config APIs
export const clinicConfigApi = {
  getSettings: async (clinicId: string) => {
    const response = await fetchJson<ClinicConfigSettings | { config?: ClinicConfigSettings }>(
      `/api/clinic-config/clinic?clinic_id=${clinicId}`
    );
    return extractSingleConfig<ClinicConfigSettings>(response);
  },

  updateSettings: async (clinicId: string, settings: Partial<ClinicConfigSettings>) => {
    const response = await fetchJson<ClinicConfigSettings | { config?: ClinicConfigSettings }>(
      '/api/clinic-config/clinic',
      {
        method: 'POST',
        body: { clinic_id: clinicId, ...settings },
      }
    );
    return extractSingleConfig<ClinicConfigSettings>(response);
  },

  getTPA: async (clinicId: string) => {
    const response = await fetchJson<TPAConfig[] | { configs?: TPAConfig[] }>(
      `/api/clinic-config/tpa?clinic_id=${clinicId}`
    );
    return extractConfigList<TPAConfig>(response);
  },

  getTPAByName: async (clinicId: string, tpaName: string) => {
    const configs = await clinicConfigApi.getTPA(clinicId);
    return configs.find((config) => config.tpa_name === tpaName) || null;
  },

  createTPA: (clinicId: string, config: Partial<TPAConfig> & { tpa_id?: string; ins_code?: string }) =>
    fetchJson<{ config?: TPAConfig }>('/api/clinic-config/tpa', {
      method: 'POST',
      body: { clinic_id: clinicId, ...config },
    }),

  bulkImportTPAMappings: (clinicId: string, mappings: unknown[]) =>
    fetchJson<{ imported?: number; errors?: number }>('/api/clinic-config/tpa', {
      method: 'POST',
      body: { clinic_id: clinicId, bulk_import: true, mappings },
    }),

  updateTPA: (clinicId: string, tpaId: string, config: Partial<TPAConfig>) =>
    fetchJson<{ config?: TPAConfig }>(`/api/clinic-config/tpa/${encodeURIComponent(tpaId)}`, {
      method: 'PUT',
      body: { clinic_id: clinicId, ...config },
    }),

  deleteTPA: (clinicId: string, tpaId: string) =>
    fetchJson<void>(`/api/clinic-config/tpa/${encodeURIComponent(tpaId)}?clinic_id=${clinicId}`, {
      method: 'DELETE',
    }),

  getDoctors: async (clinicId: string) => {
    const response = await fetchJson<Doctor[] | { configs?: Doctor[] }>(
      `/api/clinic-config/doctors?clinic_id=${clinicId}`
    );
    return extractConfigList<Doctor>(response);
  },

  getPlans: async (clinicId: string, tpaInsCode?: string) => {
    const url = tpaInsCode
      ? `/api/clinic-config/plans?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}`
      : `/api/clinic-config/plans?clinic_id=${clinicId}`;
    const response = await fetchJson<unknown>(url);
    return extractPlans(response, tpaInsCode);
  },

  getPlansByTPA: async (clinicId: string) => {
    const response = await fetchJson<unknown>(`/api/clinic-config/plans?clinic_id=${clinicId}`);
    return extractPlansByTPA(response);
  },

  fetchPlansFromApi: async (clinicId: string, tpaInsCode: string) =>
    fetchJson<{ plans?: Plan[]; record_count?: number }>(
      `/api/clinic-config/plans?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&fetch_from_api=true`
    ),

  exportPlansTemplate: async (clinicId: string, tpaInsCode: string) =>
    fetchJson<unknown>(
      `/api/clinic-config/plans?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&export_format=mapping_template`
    ),

  getMantysNetworks: async (clinicId: string, tpaInsCode?: string) => {
    const url = tpaInsCode
      ? `/api/clinic-config/mantys-networks?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}`
      : `/api/clinic-config/mantys-networks?clinic_id=${clinicId}`;
    const response = await fetchJson<unknown>(url);
    return extractMantysNetworks(response, tpaInsCode);
  },

  getMantysNetworksByTPA: async (clinicId: string) => {
    const response = await fetchJson<unknown>(`/api/clinic-config/mantys-networks?clinic_id=${clinicId}`);
    return extractMantysNetworksByTPA(response);
  },

  importMantysNetworks: async (clinicId: string, tpaInsCode: string) =>
    fetchJson<{ networks?: MantysNetwork[]; record_count?: number }>(
      `/api/clinic-config/mantys-networks?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&import_from_mapping=true`
    ),

  getNetworks: async (clinicId: string) => {
    const response = await fetchJson<Network[] | { configs?: Network[] }>(
      `/api/clinic-config/networks?clinic_id=${clinicId}`
    );
    return extractConfigList<Network>(response);
  },

  getPlanMappings: async (clinicId: string, tpaInsCode?: string) => {
    const url = tpaInsCode
      ? `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}`
      : `/api/clinic-config/plan-mappings?clinic_id=${clinicId}`;
    const response = await fetchJson<unknown>(url);
    return extractPlanMappings(response);
  },

  createPlanMapping: (
    clinicId: string,
    mapping: Omit<PlanNetworkMapping, 'id' | 'clinic_id'>
  ) =>
    fetchJson<{ mapping?: PlanNetworkMapping }>(`/api/clinic-config/plan-mappings?clinic_id=${clinicId}`, {
      method: 'POST',
      body: mapping,
    }),

  bulkImportPlanMappings: (
    clinicId: string,
    mappings: Array<Omit<PlanNetworkMapping, 'id' | 'clinic_id'>>
  ) =>
    fetchJson<{ imported?: number; errors?: number; defaults_fixed?: number }>(
      `/api/clinic-config/plan-mappings?clinic_id=${clinicId}`,
      {
        method: 'POST',
        body: { bulk_import: true, mappings },
      }
    ),

  setDefaultPlanMapping: (clinicId: string, tpaInsCode: string, mappingId: string) =>
    fetchJson<void>(
      `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}&set_default=true`,
      { method: 'PUT' }
    ),

  unsetDefaultPlanMapping: (clinicId: string, tpaInsCode: string, mappingId: string) =>
    fetchJson<void>(
      `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}&unset_default=true`,
      { method: 'PUT' }
    ),

  deletePlanMapping: (clinicId: string, tpaInsCode: string, mappingId: string) =>
    fetchJson<void>(
      `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}`,
      { method: 'DELETE' }
    ),

  getPayers: async (clinicId: string, tpaInsCode?: string) => {
    const url = tpaInsCode
      ? `/api/clinic-config/payers?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}`
      : `/api/clinic-config/payers?clinic_id=${clinicId}`;
    const response = await fetchJson<unknown>(url);
    return extractPayers(response, tpaInsCode);
  },

  getPayersByTPA: async (clinicId: string) => {
    const response = await fetchJson<unknown>(`/api/clinic-config/payers?clinic_id=${clinicId}`);
    return extractPayersByTPA(response);
  },

  fetchPayersFromApi: async (clinicId: string, tpaInsCode: string) =>
    fetchJson<{ payers?: Payer[]; record_count?: number }>(
      `/api/clinic-config/payers?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&fetch_from_api=true`
    ),

  deletePayersByTPA: (clinicId: string, tpaInsCode: string) =>
    fetchJson<void>(`/api/clinic-config/payers/${encodeURIComponent(tpaInsCode)}?clinic_id=${clinicId}`, {
      method: 'DELETE',
    }),

  getSpecialisations: async () => {
    const response = await fetchJson<unknown>('/api/clinic-config/specialisations');
    return extractSpecialisations(response);
  },

  getSpecialisationsMapping: async () => {
    const response = await fetchJson<{ mapping?: Record<string, string> }>('/api/clinic-config/specialisations');
    return response.mapping || {};
  },

  updateSpecialisations: (payload: unknown) =>
    fetchJson<{ mapping?: Record<string, string> }>('/api/clinic-config/specialisations', {
      method: 'POST',
      body: payload,
    }),

  createDoctor: (clinicId: string, doctor: Partial<Doctor>) =>
    fetchJson<{ config?: Doctor }>('/api/clinic-config/doctors', {
      method: 'POST',
      body: { clinic_id: clinicId, ...doctor },
    }),

  updateDoctor: (clinicId: string, doctorId: string, doctor: Partial<Doctor>) =>
    fetchJson<{ config?: Doctor }>(`/api/clinic-config/doctors/${encodeURIComponent(doctorId)}`, {
      method: 'PUT',
      body: { clinic_id: clinicId, ...doctor },
    }),

  deleteDoctor: (clinicId: string, doctorId: string) =>
    fetchJson<void>(`/api/clinic-config/doctors/${encodeURIComponent(doctorId)}?clinic_id=${clinicId}`, {
      method: 'DELETE',
    }),
};

export const asterApi = {
  savePolicy: (payload: {
    policyData: unknown;
    patientId: number;
    appointmentId?: number;
    encounterId?: number;
    payerId?: number;
  }) =>
    fetchJson<unknown>('/api/aster/save-policy', {
      method: 'POST',
      body: payload,
    }),

  saveEligibilityOrder: (payload: Record<string, unknown>) =>
    fetchJson<unknown>('/api/aster/save-eligibility-order', {
      method: 'POST',
      body: payload,
    }),

  uploadAttachment: (payload: {
    patientId: number;
    encounterId?: number | null;
    appointmentId: number;
    insTpaPatId: number;
    fileName: string;
    fileUrl?: string;
    fileBase64?: string;
    uploadDate?: string;
    expiryDate?: string;
    reportDate?: string;
    createdBy?: number;
  }) =>
    fetchJson<unknown>('/api/aster/upload-attachment', {
      method: 'POST',
      body: payload,
    }),
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

export interface PatientDetailsResponse {
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

export interface PatientContext {
  patientId: string;
  mpi?: string;
  appointmentId?: string;
  encounterId?: string;
  patientName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  nationality_id?: string;
  physician_id?: number;
  insuranceDetails?: {
    body?: {
      Data?: InsuranceData[];
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AppointmentSearchParams {
  mpi?: string;
  phoneNumber?: string | number;
  patientName?: string;
  mcnNo?: string;
  displayEncounterNumber?: string;
  fromDate?: string;
  toDate?: string;
  isFilterDate?: number;
  pageNo?: number;
  recPerPage?: number;
  customerSiteId?: number;
  payerId?: number | null;
  visitTypeId?: number | null;
  physicianId?: number | null;
  specialisationId?: number | null;
  roomId?: number | null;
  visitPurposeId?: number | null;
  payerTypeId?: number | null;
  appStatusId?: string;
  encounterType?: number;
  isEmergencyAppointment?: number | null;
  insuranceType?: string | null;
  groupByApntStatus?: number;
  referralUploadFilter?: number;
  filterByReferral?: number;
  timeOrderBy?: number;
  orderType?: string | null;
  type?: string | null;
}

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
  physician_id?: number;
  provider?: string;
  specialisation_name: string;
  payer_type?: string;
  payer_name?: string;
  receiver_name?: string;
  network_name?: string;
  payer_id?: number;
  [key: string]: unknown;
}

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
  [key: string]: unknown;
}

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

export interface EligibilityHistoryItem {
  id: string;
  clinicId: string;
  patientId: string;
  taskId: string;
  patientName?: string;
  dateOfBirth?: string;
  insurancePayer?: string;
  patientMPI?: string;
  appointmentId?: number;
  encounterId?: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  createdAt: string;
  completedAt?: string;
  result?: unknown;
  interimResults?: {
    screenshot?: string;
    documents?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
  error?: string;
  pollingAttempts?: number;
}

export interface MantysEligibilityRequest {
  id_value: string;
  id_type: string;
  tpa_name: string;
  visit_type: string;
  doctorName?: string;
  payerName?: string;
  extra_args?: {
    title: string;
    value: string;
  };
  mpi?: string;
  patientId?: string | number;
  patientName?: string;
  appointmentId?: number;
  encounterId?: number;
  [key: string]: unknown;
}

export interface MantysEligibilityResponse {
  task_id: string;
  status: string;
  message?: string;
}

export interface MantysStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  result?: unknown;
  error?: string;
  message?: string;
  screenshot?: string;
  documents?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  interimResults?: {
    screenshot?: string;
    documents?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  };
}

export interface ClinicConfigSettings {
  clinic_id: string;
  clinic_name?: string;
  customer_site_id?: number;
  default_tpa?: string;
  [key: string]: unknown;
}

export interface TPAConfig {
  tpa_name: string;
  tpa_code: string;
  is_enabled: boolean;
  extra_form_fields?: string[];
  id_types?: string[];
  visit_types?: string[];
  requires_doctor?: boolean;
  [key: string]: unknown;
}

export interface Doctor {
  id?: string;
  doctor_id?: string;
  doctor_name?: string;
  name?: string;
  dha_id?: string;
  lt_user_id?: string;
  specialisation?: string;
  specialization?: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  name: string;
  payer_id?: string;
  [key: string]: unknown;
}

export interface PlanNetworkMapping {
  id: string;
  clinic_id: string;
  tpa_ins_code: string;
  lt_plan_id: number;
  lt_plan_name: string;
  lt_plan_code: string;
  mantys_network_name: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MantysNetwork {
  name: string;
  tpa_ins_code: string;
  clinic_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Network {
  id: string;
  name: string;
  payer_id?: string;
  [key: string]: unknown;
}

export interface Payer {
  id: string;
  name: string;
  code?: string;
  [key: string]: unknown;
}

export interface Specialisation {
  id: string;
  name: string;
  [key: string]: unknown;
}
