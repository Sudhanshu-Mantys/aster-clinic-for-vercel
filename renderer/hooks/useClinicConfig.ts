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
  specialisations: (clinicId: string) =>
    [...clinicConfigKeys.all, 'specialisations', clinicId] as const,
};

export function useClinicSettings(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.settings(clinicId),
    queryFn: () => clinicConfigApi.getSettings(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
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
  });
}

export function usePlans(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.plans(clinicId),
    queryFn: () => clinicConfigApi.getPlans(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNetworks(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.networks(clinicId),
    queryFn: () => clinicConfigApi.getNetworks(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayers(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.payers(clinicId),
    queryFn: () => clinicConfigApi.getPayers(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSpecialisations(clinicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicConfigKeys.specialisations(clinicId),
    queryFn: () => clinicConfigApi.getSpecialisations(clinicId),
    enabled: options?.enabled !== false && !!clinicId,
    staleTime: 5 * 60 * 1000,
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
