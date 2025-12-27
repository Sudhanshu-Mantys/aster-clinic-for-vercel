import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
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

export function useEligibilityHistoryItem(
  id: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: any) => number | false);
  }
) {
  return useQuery({
    queryKey: eligibilityKeys.historyItem(id),
    queryFn: () => eligibilityHistoryApi.getById(id),
    enabled: options?.enabled !== false && !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useEligibilityHistoryByTaskId(taskId: string, enabled = true) {
  return useQuery({
    queryKey: eligibilityKeys.historyByTask(taskId),
    queryFn: () => eligibilityHistoryApi.getByTaskId(taskId),
    enabled: enabled && !!taskId,
  });
}

export function useActiveEligibilityChecks(
  clinicId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: eligibilityKeys.active(clinicId),
    queryFn: () => eligibilityHistoryApi.getActive(clinicId),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval ?? 5000,
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
  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<EligibilityHistoryItem> }) =>
      eligibilityHistoryApi.updateByTaskId(taskId, updates),
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
  patientId?: string,
  patientMPI?: string,
  options?: {
    enabled?: boolean;
    onComplete?: (result: MantysStatusResponse) => void;
    onError?: (error: MantysStatusResponse) => void;
  }
) {
  const queryClient = useQueryClient();
  const updateHistory = useUpdateEligibilityHistoryByTaskId();
  const lastUpdateRef = useRef<{ status?: string; interimKey?: string; resultKey?: string; error?: string } | null>(null);
  const hasCompletedRef = useRef(false);
  const hasErroredRef = useRef(false);
  const [isQueryEnabled, setIsQueryEnabled] = useState(true);

  const { data } = useQuery({
    queryKey: eligibilityKeys.taskStatus(taskId),
    queryFn: () => mantysApi.checkStatus(taskId),
    enabled: (options?.enabled !== false && !!taskId && isQueryEnabled),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if task is complete or error
      if (data?.status === 'complete' || data?.status === 'error') {
        // Disable the query entirely to prevent any further requests
        setIsQueryEnabled(false);
        return false;
      }
      return 10000;
    },
  });

  useEffect(() => {
    if (!data) return;

    if (data.status === 'processing' || data.status === 'pending') {
      const interimKey = JSON.stringify({
        screenshot: data.screenshot ?? null,
        documents: data.documents ?? null,
      });
      const shouldUpdate =
        lastUpdateRef.current?.status !== data.status ||
        lastUpdateRef.current?.interimKey !== interimKey;

      if (shouldUpdate) {
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
        lastUpdateRef.current = { status: data.status, interimKey };
      }
      return;
    }

    if (data.status === 'complete' && !hasCompletedRef.current) {
      const resultKey = JSON.stringify(data.result ?? null);
      // Disable query immediately to stop polling
      setIsQueryEnabled(false);
      updateHistory.mutate({
        taskId,
        updates: {
          status: 'complete',
          result: data.result,
          completedAt: new Date().toISOString(),
        },
      });
      lastUpdateRef.current = { status: 'complete', resultKey };
      hasCompletedRef.current = true;
      // Invalidate active checks query so it removes this task from the active list
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.active(clinicId) });
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.history(clinicId) });
      if (patientId) {
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.byPatient(patientId) });
      }
      if (patientMPI) {
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.byMPI(patientMPI) });
      }
      options?.onComplete?.(data);
    }

    if (data.status === 'error' && !hasErroredRef.current) {
      // Disable query immediately to stop polling
      setIsQueryEnabled(false);
      updateHistory.mutate({
        taskId,
        updates: {
          status: 'error',
          error: data.error,
          completedAt: new Date().toISOString(),
        },
      });
      lastUpdateRef.current = { status: 'error', error: data.error };
      hasErroredRef.current = true;
      // Invalidate active checks query so it removes this task from the active list
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.active(clinicId) });
      queryClient.invalidateQueries({ queryKey: eligibilityKeys.history(clinicId) });
      if (patientId) {
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.byPatient(patientId) });
      }
      if (patientMPI) {
        queryClient.invalidateQueries({ queryKey: eligibilityKeys.byMPI(patientMPI) });
      }
      options?.onError?.(data);
    }
  }, [data, taskId, clinicId, patientId, patientMPI, updateHistory, queryClient, options]);
}
