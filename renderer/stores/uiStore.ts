import { create } from 'zustand';
import type { AppointmentData, InsuranceData, PatientData } from '../lib/api-client';
import type { EligibilityHistoryItem } from '../hooks/useEligibility';
import type { MantysEligibilityResponse } from '../types/mantys';

interface SelectedAppointment {
  appointment: AppointmentData;
  insuranceDetails: InsuranceData[];
  expandedInsurance: Set<number>;
  patientData: PatientData | null;
}

interface SelectedEligibility {
  item: EligibilityHistoryItem;
  result?: MantysEligibilityResponse;
}

interface UIState {
  appointmentDrawer: {
    isOpen: boolean;
    data: SelectedAppointment | null;
    isLoadingInsurance: boolean;
    insuranceError: string | null;
  };

  eligibilityDrawer: {
    isOpen: boolean;
    data: SelectedEligibility | null;
  };

  eligibilityModal: {
    isOpen: boolean;
    taskId: string | null;
  };

  openAppointmentDrawer: (appointment: AppointmentData) => void;
  closeAppointmentDrawer: () => void;
  setAppointmentInsurance: (insurance: InsuranceData[], expanded: Set<number>) => void;
  setAppointmentInsuranceLoading: (loading: boolean) => void;
  setAppointmentInsuranceError: (error: string | null) => void;
  toggleInsuranceExpanded: (insuranceId: number) => void;
  setAppointmentPatientData: (patientData: PatientData | null) => void;

  openEligibilityDrawer: (item: EligibilityHistoryItem, result?: MantysEligibilityResponse) => void;
  closeEligibilityDrawer: () => void;

  openEligibilityModal: (taskId: string) => void;
  closeEligibilityModal: () => void;

  resetAll: () => void;
}

const initialState = {
  appointmentDrawer: {
    isOpen: false,
    data: null,
    isLoadingInsurance: false,
    insuranceError: null,
  },
  eligibilityDrawer: {
    isOpen: false,
    data: null,
  },
  eligibilityModal: {
    isOpen: false,
    taskId: null,
  },
};

export const useUIStore = create<UIState>((set, get) => ({
  ...initialState,

  openAppointmentDrawer: (appointment) => {
    set({
      appointmentDrawer: {
        isOpen: true,
        data: {
          appointment,
          insuranceDetails: [],
          expandedInsurance: new Set(),
          patientData: null,
        },
        isLoadingInsurance: true,
        insuranceError: null,
      },
    });
  },

  closeAppointmentDrawer: () => {
    set({
      appointmentDrawer: {
        isOpen: false,
        data: null,
        isLoadingInsurance: false,
        insuranceError: null,
      },
    });
  },

  setAppointmentInsurance: (insuranceDetails, expanded) => {
    const current = get().appointmentDrawer;
    if (!current.data) return;

    set({
      appointmentDrawer: {
        ...current,
        data: {
          ...current.data,
          insuranceDetails,
          expandedInsurance: expanded,
        },
        isLoadingInsurance: false,
      },
    });
  },

  setAppointmentInsuranceLoading: (loading) => {
    const current = get().appointmentDrawer;
    set({
      appointmentDrawer: {
        ...current,
        isLoadingInsurance: loading,
      },
    });
  },

  setAppointmentInsuranceError: (error) => {
    const current = get().appointmentDrawer;
    set({
      appointmentDrawer: {
        ...current,
        insuranceError: error,
        isLoadingInsurance: false,
      },
    });
  },

  toggleInsuranceExpanded: (insuranceId) => {
    const current = get().appointmentDrawer;
    if (!current.data) return;

    const newExpanded = new Set(current.data.expandedInsurance);
    if (newExpanded.has(insuranceId)) {
      newExpanded.delete(insuranceId);
    } else {
      newExpanded.add(insuranceId);
    }

    set({
      appointmentDrawer: {
        ...current,
        data: {
          ...current.data,
          expandedInsurance: newExpanded,
        },
      },
    });
  },

  setAppointmentPatientData: (patientData) => {
    const current = get().appointmentDrawer;
    if (!current.data) return;

    set({
      appointmentDrawer: {
        ...current,
        data: {
          ...current.data,
          patientData,
        },
      },
    });
  },

  openEligibilityDrawer: (item, result) => {
    set({
      eligibilityDrawer: {
        isOpen: true,
        data: { item, result },
      },
    });
  },

  closeEligibilityDrawer: () => {
    set({
      eligibilityDrawer: {
        isOpen: false,
        data: null,
      },
    });
  },

  openEligibilityModal: (taskId) => {
    set({
      eligibilityModal: {
        isOpen: true,
        taskId,
      },
    });
  },

  closeEligibilityModal: () => {
    set({
      eligibilityModal: {
        isOpen: false,
        taskId: null,
      },
    });
  },

  resetAll: () => {
    set(initialState);
  },
}));
