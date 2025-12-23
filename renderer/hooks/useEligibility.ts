import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  eligibilityHistoryApi,
  mantysApi,
  type EligibilityHistoryItem,
  type MantysEligibilityRequest,
  type MantysStatusResponse,
} from '../lib/api-client';

export type { EligibilityHistoryItem, MantysEligibilityRequest, MantysStatusResponse };

export const eligibilityKeys = {
  all: ['eligibility'] as const,
  history: (clinicId?: string) => [...eligibilityKeys.all, 'history', clinicId] as const,
  historyItem: (id: string) => [...eligibilityKeys.all, 'history', 'item', id] as const,
  historyByTask: (taskId: string) => [...eligibilityKeys.all, 'history', 'task', taskId] as const,
  active: (clinicId?: string) => [...eligibilityKeys.all, 'active', clinicId] as const,
  completed: (clinicId?: string) => [...eligibilityKeys.all, 'completed', clinicId] as const,
  byPatient: (patientId: string) => [...eligibilityKeys.all, 'patient', patientId] as const,
  byMPI: (mpi: string) => [...eligibilityKeys.all, 'mpi', mpi] as const,
  taskStatus: (taskId: string) => [...eligibilityKeys.all, 'task', taskId] as const,
};

export function useEligibilityHistory(clinicId?: string) {
  return useQuery({
    queryKey: eligibilityKeys.history(clinicId),
    queryFn: () => eligibilityHistoryApi.getAll(clinicId),
    staleTime: 30 * 1000,
  });
}

export function useEligibilityHistoryItem(id: string, enabled = true) {
  return useQuery({
    queryKey: eligibilityKeys.historyItem(id),
    queryFn: () => eligibilityHistoryApi.getById(id),
    enabled: enabled && !!id,
  });
}

export function useEligibilityHistoryByTaskId(taskId: string, enabled = true) {
  return useQuery({
    queryKey: eligibilityKeys.historyByTask(taskId),
    queryFn: () => eligibilityHistoryApi.getByTaskId(taskId),
    enabled: enabled && !!taskId,
  });
}

export function useActiveEligibilityChecks(clinicId?: string) {
  return useQuery({
    queryKey: eligibilityKeys.active(clinicId),
    queryFn: () => eligibilityHistoryApi.getActive(clinicId),
    refetchInterval: 5000,
  });
}

export function useCompletedEligibilityChecks(clinicId?: string) {
  return useQuery({
    queryKey: eligibilityKeys.completed(clinicId),
    queryFn: () => eligibilityHistoryApi.getCompleted(clinicId),
  });
}

export function useEligibilityByPatient(patientId: string, enabled = true) {
  return useQuery({
    queryKey: eligibilityKeys.byPatient(patientId),
    queryFn: () => eligibilityHistoryApi.getByPatientId(patientId),
    enabled: enabled && !!patientId,
  });
}

export function useEligibilityByMPI(mpi: string, enabled = true) {
  return useQuery({
    queryKey: eligibilityKeys.byMPI(mpi),
    queryFn: () => eligibilityHistoryApi.getByMPI(mpi),
    enabled: enabled && !!mpi,
  });
}

export function useEligibilityTaskStatus(
  taskId: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
    onSuccess?: (data: MantysStatusResponse) => void;
  }
) {
  const isActive = options?.enabled !== false && !!taskId;

  return useQuery({
    queryKey: eligibilityKeys.taskStatus(taskId),
    queryFn: () => mantysApi.checkStatus(taskId),
    enabled: isActive,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'complete' || data?.status === 'error') {
        return false;
      }
      return options?.refetchInterval ?? 3000;
    },
  });
}

export function useCreateEligibilityCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MantysEligibilityRequest) => {
      const response = await mantysApi.createEligibilityCheck(payload);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.all });
    },
  });
}

export function useCreateEligibilityHistoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: Omit<EligibilityHistoryItem, 'id' | 'createdAt'>) =>
      eligibilityHistoryApi.create(item),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.history(variables.clinicId) });
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.active(variables.clinicId) });
    },
  });
}

export function useUpdateEligibilityHistoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<EligibilityHistoryItem> }) =>
      eligibilityHistoryApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.all });
    },
  });
}

export function useUpdateEligibilityHistoryByTaskId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<EligibilityHistoryItem> }) =>
      eligibilityHistoryApi.updateByTaskId(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.all });
    },
  });
}

export function useDeleteEligibilityHistoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => eligibilityHistoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.all });
    },
  });
}

export function useClearEligibilityHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => eligibilityHistoryApi.clearAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.all });
    },
  });
}

export function useEligibilityPolling(
  taskId: string,
  historyId: string,
  clinicId: string,
  options?: {
    enabled?: boolean;
    onComplete?: (result: MantysStatusResponse) => void;
    onError?: (error: MantysStatusResponse) => void;
  }
) {
  const queryClient = useQueryClient();
  const updateHistory = useUpdateEligibilityHistoryByTaskId();

  return useQuery({
    queryKey: eligibilityKeys.taskStatus(taskId),
    queryFn: () => mantysApi.checkStatus(taskId),
    enabled: options?.enabled !== false && !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'complete' || data?.status === 'error') {
        return false;
      }
      return 3000;
    },
    select: (data) => {
      if (data.status === 'processing' || data.status === 'pending') {
        updateHistory.mutate({
          taskId,
          updates: {
            status: data.status,
            interimResults: {
              screenshot: data.screenshot,
              documents: data.documents,
            },
          },
        });
      }

      if (data.status === 'complete') {
        updateHistory.mutate({
          taskId,
          updates: {
            status: 'complete',
            result: data.result,
            completedAt: new Date().toISOString(),
          },
        });
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.history(clinicId) });
        options?.onComplete?.(data);
      }

      if (data.status === 'error') {
        updateHistory.mutate({
          taskId,
          updates: {
            status: 'error',
            error: data.error,
            completedAt: new Date().toISOString(),
          },
        });
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.history(clinicId) });
        options?.onError?.(data);
      }

      return data;
    },
  });
}
