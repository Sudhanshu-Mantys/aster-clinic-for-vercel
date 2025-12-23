import { useQuery } from '@tanstack/react-query';
import {
  appointmentApi,
  type AppointmentSearchParams,
  type AppointmentData,
} from '../lib/api-client';

export const appointmentKeys = {
  all: ['appointments'] as const,
  search: (params: AppointmentSearchParams) => [...appointmentKeys.all, 'search', params] as const,
  today: (fromDate: string, toDate: string, customerSiteId?: number) =>
    [...appointmentKeys.all, 'today', fromDate, toDate, customerSiteId] as const,
};

export function useAppointmentSearch(
  params: AppointmentSearchParams,
  options?: { enabled?: boolean }
) {
  const hasSearchCriteria =
    !!params.mpi ||
    !!params.phoneNumber ||
    !!params.patientName ||
    !!params.mcnNo ||
    !!params.displayEncounterNumber;

  return useQuery({
    queryKey: appointmentKeys.search(params),
    queryFn: () => appointmentApi.search(params),
    enabled: options?.enabled !== false && hasSearchCriteria,
    select: (data) => data.body.Data,
  });
}

export function useTodaysAppointments(
  fromDate: string,
  toDate: string,
  customerSiteId?: number,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: appointmentKeys.today(fromDate, toDate, customerSiteId),
    queryFn: () => appointmentApi.getToday({ fromDate, toDate, customerSiteId }),
    enabled: options?.enabled !== false && !!fromDate && !!toDate,
    refetchInterval: options?.refetchInterval,
    select: (data) => data.body.Data,
  });
}

export function formatDateForApi(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function useTodaysAppointmentsAutoRefresh(
  customerSiteId?: number,
  options?: { enabled?: boolean }
) {
  const today = new Date();
  const dateStr = formatDateForApi(today);

  return useTodaysAppointments(dateStr, dateStr, customerSiteId, {
    enabled: options?.enabled,
    refetchInterval: 60000,
  });
}

export type { AppointmentData, AppointmentSearchParams };
