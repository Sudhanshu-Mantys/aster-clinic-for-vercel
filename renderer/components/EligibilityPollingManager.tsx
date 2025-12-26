import React from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  useActiveEligibilityChecks,
  useEligibilityPolling,
} from "../hooks/useEligibility";

interface PollingTaskProps {
  taskId: string;
  historyId: string;
  clinicId: string;
  patientId?: string;
  patientMPI?: string;
}

const PollingTask: React.FC<PollingTaskProps> = ({
  taskId,
  historyId,
  clinicId,
  patientId,
  patientMPI,
}) => {
  useEligibilityPolling(taskId, historyId, clinicId, patientId, patientMPI, { enabled: true });
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
        />
      ))}
    </>
  );
};
