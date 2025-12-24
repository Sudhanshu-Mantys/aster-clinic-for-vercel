import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clinicConfigApi,
  type ClinicConfigSettings,
  type TPAConfig,
  type Doctor,
  type Plan,
  type Network,
  type Payer,
  type Specialisation,
} from '../lib/api-client';

export const clinicConfigKeys = {
  all: ['clinicConfig'] as const,
  settings: (clinicId: string) => [...clinicConfigKeys.all, 'settings', clinicId] as const,
  tpa: (clinicId: string) => [...clinicConfigKeys.all, 'tpa', clinicId] as const,
  tpaByName: (clinicId: string, tpaName: string) =>
    [...clinicConfigKeys.all, 'tpa', clinicId, tpaName] as const,
  doctors: (clinicId: string) => [...clinicConfigKeys.all, 'doctors', clinicId] as const,
  plans: (clinicId: string) => [...clinicConfigKeys.all, 'plans', clinicId] as const,
  networks: (clinicId: string) => [...clinicConfigKeys.all, 'networks', clinicId] as const,
  payers: (clinicId: string) => [...clinicConfigKeys.all, 'payers', clinicId] as const,
  specialisations: () => [...clinicConfigKeys.all, 'specialisations'] as const,
};

function extractConfigs<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data && typeof data === 'object' && 'configs' in data) {
    return ((data as { configs?: T[] }).configs) ?? [];
  }
  return [];
}

function extractConfig<T>(data: unknown): T | null {
  if (data && typeof data === 'object' && 'config' in data) {
    return (data as { config?: T }).config ?? null;
  }
  return (data as T) ?? null;
}

function extractPlanList(data: unknown): Plan[] {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === 'object') {
    if ('plans' in data && Array.isArray((data as { plans?: Plan[] }).plans)) {
      return (data as { plans?: Plan[] }).plans || [];
    }
    if ('plans_by_tpa' in data) {
      const byTpa = (data as { plans_by_tpa?: Record<string, Plan[]> }).plans_by_tpa || {};
      return Object.values(byTpa).flat();
    }
  }
  return [];
}

function extractPayerList(data: unknown): Payer[] {
  if (Array.isArray(data)) return data as Payer[];
  if (data && typeof data === 'object') {
    if ('payers' in data && Array.isArray((data as { payers?: Payer[] }).payers)) {
      return (data as { payers?: Payer[] }).payers || [];
    }
    if ('payers_by_tpa' in data) {
      const byTpa = (data as { payers_by_tpa?: Record<string, Payer[]> }).payers_by_tpa || {};
      return Object.values(byTpa).flat();
    }
  }
  return [];
}

export function useClinicSettings(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.settings(clinicId),
    queryFn: () => clinicConfigApi.getSettings(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractConfig<ClinicConfigSettings>,
  });
}

export function useUpdateClinicSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clinicId,
      settings,
    }: {
      clinicId: string;
      settings: Partial<ClinicConfigSettings>;
    }) => clinicConfigApi.updateSettings(clinicId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: clinicConfigKeys.settings(variables.clinicId),
      });
    },
  });
}

export function useTPAConfigs(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.tpa(clinicId),
    queryFn: () => clinicConfigApi.getTPA(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractConfigs<TPAConfig>,
  });
}

export function useTPAConfigByName(
  clinicId: string,
  tpaName: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: clinicConfigKeys.tpaByName(clinicId, tpaName),
    queryFn: () => clinicConfigApi.getTPAByName(clinicId, tpaName),
    enabled: options?.enabled !== false && !!clinicId && !!tpaName,
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      if (data && typeof data === 'object' && 'config' in data) {
        return (data as { config?: TPAConfig }).config ?? null;
      }
      if (Array.isArray(data)) {
        return data.find((item) => item.tpa_name === tpaName) || null;
      }
      if (data && typeof data === 'object' && 'configs' in data) {
        const configs = (data as { configs?: TPAConfig[] }).configs || [];
        return configs.find((item) => item.tpa_name === tpaName) || null;
      }
      return null;
    },
  });
}

export function useUpdateTPAConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clinicId,
      tpaName,
      config,
    }: {
      clinicId: string;
      tpaName: string;
      config: Partial<TPAConfig>;
    }) => clinicConfigApi.updateTPA(clinicId, tpaName, config),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: clinicConfigKeys.tpa(variables.clinicId),
      });
      queryClient.invalidateQueries({
        queryKey: clinicConfigKeys.tpaByName(variables.clinicId, variables.tpaName),
      });
    },
  });
}

export function useDoctors(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.doctors(clinicId),
    queryFn: () => clinicConfigApi.getDoctors(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractConfigs<Doctor>,
  });
}

export function usePlans(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.plans(clinicId),
    queryFn: () => clinicConfigApi.getPlans(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractPlanList,
  });
}

export function useNetworks(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.networks(clinicId),
    queryFn: () => clinicConfigApi.getNetworks(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractConfigs<Network>,
  });
}

export function usePayers(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.payers(clinicId),
    queryFn: () => clinicConfigApi.getPayers(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
    select: extractPayerList,
  });
}

export function useSpecialisations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.specialisations(),
    queryFn: () => clinicConfigApi.getSpecialisations(),
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
    select: extractConfigs<Specialisation>,
  });
}

export type {
  ClinicConfigSettings,
  TPAConfig,
  Doctor,
  Plan,
  Network,
  Payer,
  Specialisation,
};
