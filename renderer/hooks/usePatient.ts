import { useQuery } from '@tanstack/react-query';
import {
  patientApi,
  type PatientData,
  type PatientContext,
  type InsuranceData,
  type InsuranceDetailsParams,
} from '../lib/api-client';

export const patientKeys = {
  all: ['patient'] as const,
  details: (patientId: number) => [...patientKeys.all, 'details', patientId] as const,
  byMPI: (mpi: string) => [...patientKeys.all, 'mpi', mpi] as const,
  byPhone: (phone: string) => [...patientKeys.all, 'phone', phone] as const,
  context: (params: { patientId?: string; mpi?: string; appointmentId?: string }) =>
    [...patientKeys.all, 'context', params] as const,
  insurance: (patientId: number, apntId?: number | null) =>
    [...patientKeys.all, 'insurance', patientId, apntId] as const,
};

export function usePatientDetails(
  patientId: number,
  options?: {
    enabled?: boolean;
    customerId?: number;
    siteId?: number;
    encounterId?: number;
    appointmentId?: number;
  }
) {
  return useQuery({
    queryKey: patientKeys.details(patientId),
    queryFn: () =>
      patientApi.getDetails({
        patientId,
        customerId: options?.customerId,
        siteId: options?.siteId,
        encounterId: options?.encounterId,
        appointmentId: options?.appointmentId,
      }),
    enabled: options?.enabled !== false && patientId > 0,
    select: (data) => data.body.Data[0] as PatientData | undefined,
  });
}

export function usePatientByMPI(mpi: string, options?: { enabled?: boolean; customerSiteId?: number }) {
  return useQuery({
    queryKey: patientKeys.byMPI(mpi),
    queryFn: () => patientApi.searchByMPI(mpi, options?.customerSiteId),
    enabled: options?.enabled !== false && !!mpi,
    select: (data) => data.body.Data[0] as PatientData | undefined,
  });
}

export function usePatientByPhone(
  phoneNumber: string,
  options?: { enabled?: boolean; customerSiteId?: number }
) {
  return useQuery({
    queryKey: patientKeys.byPhone(phoneNumber),
    queryFn: () => patientApi.searchByPhone(phoneNumber, options?.customerSiteId),
    enabled: options?.enabled !== false && !!phoneNumber,
    select: (data) => data.body.Data,
  });
}

export function usePatientContext(
  params: { patientId?: string; mpi?: string; appointmentId?: string },
  options?: { enabled?: boolean }
) {
  const hasParams = !!params.patientId || !!params.mpi || !!params.appointmentId;

  return useQuery({
    queryKey: patientKeys.context(params),
    queryFn: () => patientApi.getContext(params),
    enabled: options?.enabled !== false && hasParams,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInsuranceDetails(
  params: InsuranceDetailsParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: patientKeys.insurance(params.patientId, params.apntId),
    queryFn: () => patientApi.getInsuranceDetails(params),
    enabled: options?.enabled !== false && params.patientId > 0,
    select: (data) => data.body.Data,
  });
}

export type { PatientData, PatientContext, InsuranceData, InsuranceDetailsParams };
