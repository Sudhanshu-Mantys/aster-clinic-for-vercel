import React from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  useActiveEligibilityChecks,
  useEligibilityPolling,
  type EligibilityHistoryItem,
} from "../hooks/useEligibility";

interface PollingTaskProps {
  taskId: string;
  historyId: string;
  clinicId: string;
  patientId?: string;
  patientMPI?: string;
  appointmentId?: number;
  status: EligibilityHistoryItem["status"];
}

const PollingTask: React.FC<PollingTaskProps> = ({
  taskId,
  historyId,
  clinicId,
  patientId,
  patientMPI,
  appointmentId,
  status,
}) => {
  // Only enable polling if the task is still pending or processing
  // This prevents polling for tasks that are already complete/error
  const isActive = status === "pending" || status === "processing";

  useEligibilityPolling(
    taskId,
    historyId,
    clinicId,
    patientId,
    patientMPI,
    appointmentId,
    {
      enabled: isActive,
    },
  );
  return null;
};

export const EligibilityPollingManager: React.FC = () => {
  const { user } = useAuth();
  const clinicId = user?.selected_team_id || "";

  const { data: activeChecks = [] } = useActiveEligibilityChecks(clinicId, {
    enabled: !!clinicId,
  });

  if (!clinicId || activeChecks.length === 0) {
    return null;
  }

  return (
    <>
      {activeChecks.map((item) => (
        <PollingTask
          key={item.taskId}
          taskId={item.taskId}
          historyId={item.id}
          clinicId={clinicId}
          patientId={item.patientId}
          patientMPI={item.patientMPI}
          appointmentId={item.appointmentId}
          status={item.status}
        />
      ))}
    </>
  );
};
