import React, { useState, useEffect, useMemo } from "react";
import { StickyEligibilityToolbar } from "./StickyEligibilityToolbar";
import { ModernMantysEligibilityForm } from "./ModernMantysEligibilityForm";
import { EligibilityHistorySection } from "./EligibilityHistorySection";
import { InsuranceCardGrid } from "./InsuranceCardGrid";
import { useAuth } from "../contexts/AuthContext";
import { useTPAConfigs } from "../hooks/useClinicConfig";
import type { InsuranceData, PatientData } from "../lib/api-client";
import type { EligibilityHistoryItem } from "../hooks/useEligibility";

interface EligibilityDrawerContentProps {
  insuranceDetails: InsuranceData[];
  isLoadingInsurance: boolean;
  insuranceError: string | null;
  previousSearches: EligibilityHistoryItem[];
  patientData: PatientData | null;
  onPreviousSearchClick: (search: EligibilityHistoryItem) => void;
}

export const EligibilityDrawerContent: React.FC<
  EligibilityDrawerContentProps
> = ({
  insuranceDetails,
  isLoadingInsurance,
  insuranceError,
  previousSearches,
  patientData,
  onPreviousSearchClick,
}) => {
    const { user } = useAuth();
    const clinicId = user?.selected_team_id || "";
    const { data: tpaConfigs = [] } = useTPAConfigs(clinicId, {
      enabled: !!clinicId,
    });

    const [selectedInsurance, setSelectedInsurance] =
      useState<InsuranceData | null>(null);

    // Split searches into today vs older
    const { todaySearches, olderSearches } = useMemo(() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayItems: EligibilityHistoryItem[] = [];
      const olderItems: EligibilityHistoryItem[] = [];

      previousSearches.forEach((search) => {
        if (!search.createdAt) {
          olderItems.push(search);
          return;
        }
        const searchDate = new Date(search.createdAt);
        searchDate.setHours(0, 0, 0, 0);
        if (searchDate.getTime() === todayStart.getTime()) {
          todayItems.push(search);
        } else {
          olderItems.push(search);
        }
      });

      return { todaySearches: todayItems, olderSearches: olderItems };
    }, [previousSearches]);

    // Auto-select first active+valid insurance on mount/change
    useEffect(() => {
      if (insuranceDetails.length > 0 && !selectedInsurance) {
        // Priority 1: Active + Valid
        const activeValid = insuranceDetails.find(
          (ins) =>
            ins.insurance_status?.toLowerCase() === "active" && ins.is_valid === 1
        );
        if (activeValid) {
          setSelectedInsurance(activeValid);
          return;
        }

        // Priority 2: Just Active
        const firstActive = insuranceDetails.find(
          (ins) => ins.insurance_status?.toLowerCase() === "active"
        );
        if (firstActive) {
          setSelectedInsurance(firstActive);
          return;
        }

        // Priority 3: First non-expired
        const firstNonExpired = insuranceDetails.find(
          (ins) => ins.insurance_status?.toLowerCase() !== "expired"
        );
        if (firstNonExpired) {
          setSelectedInsurance(firstNonExpired);
        }
      }
    }, [insuranceDetails, selectedInsurance]);

    // Reset selection when drawer closes (insurance details change)
    useEffect(() => {
      if (insuranceDetails.length === 0) {
        setSelectedInsurance(null);
      }
    }, [insuranceDetails.length]);

    const handleSelectInsurance = (insurance: InsuranceData) => {
      setSelectedInsurance(insurance);
    };

    const hasActiveInsurance = insuranceDetails.some(
      (ins) => ins.insurance_status?.toLowerCase() === "active"
    );

    const hasAnyInsurance = insuranceDetails.length > 0;

    const selectedInsuranceId =
      selectedInsurance?.patient_insurance_tpa_policy_id || null;

    const hasTodaySearches = todaySearches.length > 0;

    return (
      <div className="flex flex-col h-full min-h-0 overflow-y-auto">
        {hasTodaySearches && (
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <EligibilityHistorySection
              todaySearches={todaySearches}
              olderSearches={[]}
              onSearchClick={onPreviousSearchClick}
            />
          </div>
        )}

        {/* Sticky Toolbar - Insurance Details */}
        <StickyEligibilityToolbar
          selectedInsurance={selectedInsurance}
          isLoading={isLoadingInsurance}
          hasActiveInsurance={hasActiveInsurance}
          hasAnyInsurance={hasAnyInsurance}
          tpaConfigs={tpaConfigs}
        />

        {/* Eligibility Form - Visible Immediately Below Toolbar */}
        <div className="border-b border-gray-200">
          <ModernMantysEligibilityForm
            patientData={patientData}
            insuranceData={selectedInsurance}
            isLoadingInsurance={isLoadingInsurance}
          />
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Previous Eligibility Searches */}
          <EligibilityHistorySection
            todaySearches={hasTodaySearches ? [] : todaySearches}
            olderSearches={olderSearches}
            onSearchClick={onPreviousSearchClick}
          />

          {/* Insurance Cards Grid */}
          <InsuranceCardGrid
            insuranceDetails={insuranceDetails}
            isLoading={isLoadingInsurance}
            error={insuranceError}
            selectedInsuranceId={selectedInsuranceId}
            onSelectInsurance={handleSelectInsurance}
            tpaConfigs={tpaConfigs}
          />
        </div>
      </div>
    );
  };
