import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { type PatientData, type InsuranceData } from '../lib/api-client'
import { SearchType } from '../types/dashboard'
import { PatientSearchForm } from './PatientSearchForm'
import { PatientSelectionList } from './PatientSelectionList'
import { PatientDetailsDisplay } from './PatientDetailsDisplay'

interface PrefillEligibilityFormProps {
    searchType: SearchType
    searchValue: string
    isSearching: boolean
    patientDetails: PatientData | null
    allPatients: PatientData[]
    searchError: string | null
    insuranceDetails: InsuranceData[]
    isLoadingInsurance: boolean
    insuranceError: string | null
    expandedInsurance: Set<number>
    onSearchTypeChange: (type: SearchType) => void
    onSearchValueChange: (value: string) => void
    onSubmit: (e: React.FormEvent) => void
    onClear: () => void
    onSelectPatient: (patient: PatientData) => void
    onBackToList: () => void
    onToggleInsuranceExpanded: (insuranceId: number) => void
}

export const PrefillEligibilityForm: React.FC<PrefillEligibilityFormProps> = ({
    searchType,
    searchValue,
    isSearching,
    patientDetails,
    allPatients,
    searchError,
    insuranceDetails,
    isLoadingInsurance,
    insuranceError,
    expandedInsurance,
    onSearchTypeChange,
    onSearchValueChange,
    onSubmit,
    onClear,
    onSelectPatient,
    onBackToList,
    onToggleInsuranceExpanded,
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Prefill Eligibility Form</CardTitle>
                <CardDescription>
                    Search for a patient to prefill the eligibility form
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PatientSearchForm
                    searchType={searchType}
                    searchValue={searchValue}
                    isSearching={isSearching}
                    onSearchTypeChange={onSearchTypeChange}
                    onSearchValueChange={onSearchValueChange}
                    onSubmit={onSubmit}
                    onClear={onClear}
                />

                {/* Error Message */}
                {searchError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start">
                            <svg
                                className="w-5 h-5 text-red-600 mt-0.5 mr-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <div>
                                <h4 className="text-sm font-medium text-red-900">Search Failed</h4>
                                <p className="text-sm text-red-700 mt-1">{searchError}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Multiple Patients Selection */}
                {allPatients.length > 1 && !patientDetails && (
                    <PatientSelectionList
                        patients={allPatients}
                        onSelectPatient={onSelectPatient}
                    />
                )}

                {/* Patient Details Result */}
                {patientDetails && (
                    <PatientDetailsDisplay
                        patientDetails={patientDetails}
                        allPatients={allPatients}
                        insuranceDetails={insuranceDetails}
                        isLoadingInsurance={isLoadingInsurance}
                        insuranceError={insuranceError}
                        expandedInsurance={expandedInsurance}
                        onToggleInsuranceExpanded={onToggleInsuranceExpanded}
                        onBackToList={onBackToList}
                    />
                )}
            </CardContent>
        </Card>
    )
}
