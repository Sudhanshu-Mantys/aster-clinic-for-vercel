import React from 'react'
import { Button } from './ui/button'
import { type PatientData, type InsuranceData } from '../lib/api-client'
import { InsuranceDetailsSection } from './InsuranceDetailsSection'

interface PatientDetailsDisplayProps {
    patientDetails: PatientData
    allPatients: PatientData[]
    insuranceDetails: InsuranceData[]
    isLoadingInsurance: boolean
    insuranceError: string | null
    expandedInsurance: Set<number>
    onToggleInsuranceExpanded: (insuranceId: number) => void
    onBackToList: () => void
}

export const PatientDetailsDisplay: React.FC<PatientDetailsDisplayProps> = ({
    patientDetails,
    allPatients,
    insuranceDetails,
    isLoadingInsurance,
    insuranceError,
    expandedInsurance,
    onToggleInsuranceExpanded,
    onBackToList,
}) => {
    return (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start mb-3">
                <svg
                    className="w-5 h-5 text-green-600 mt-0.5 mr-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <div className="flex-1">
                    <h4 className="text-sm font-medium text-green-900">Patient Found</h4>
                    <p className="text-sm text-green-700 mt-1">
                        Patient details retrieved successfully
                    </p>
                </div>
            </div>
            <div className="ml-8 mt-3 space-y-2">
                {patientDetails.patient_id && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Patient ID:</span>
                        <span className="text-gray-900">{patientDetails.patient_id}</span>
                    </div>
                )}
                {patientDetails.mpi && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">MPI:</span>
                        <span className="text-gray-900">{patientDetails.mpi}</span>
                    </div>
                )}
                {(patientDetails.firstname || patientDetails.lastname) && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Name:</span>
                        <span className="text-gray-900">
                            {[patientDetails.firstname, patientDetails.middlename, patientDetails.lastname]
                                .filter(Boolean)
                                .join(' ')}
                        </span>
                    </div>
                )}
                {patientDetails.uid_value && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">UID:</span>
                        <span className="text-gray-900">{patientDetails.uid_value}</span>
                    </div>
                )}
                {(patientDetails.phone || patientDetails.home_phone || patientDetails.phone_other) && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Phone:</span>
                        <span className="text-gray-900">
                            {patientDetails.phone || patientDetails.home_phone || patientDetails.phone_other}
                        </span>
                    </div>
                )}
                {patientDetails.email && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Email:</span>
                        <span className="text-gray-900">{patientDetails.email}</span>
                    </div>
                )}
                {patientDetails.dob && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Date of Birth:</span>
                        <span className="text-gray-900">{patientDetails.dob}</span>
                    </div>
                )}
                {patientDetails.calculated_age && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Age:</span>
                        <span className="text-gray-900">{patientDetails.calculated_age}</span>
                    </div>
                )}
                {patientDetails.gender && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Gender:</span>
                        <span className="text-gray-900">{patientDetails.gender}</span>
                    </div>
                )}
                {patientDetails.nationality && (
                    <div className="flex items-center text-sm">
                        <span className="font-medium text-gray-700 w-32">Nationality:</span>
                        <span className="text-gray-900">{patientDetails.nationality} ({patientDetails.iso_code})</span>
                    </div>
                )}
                {(patientDetails.address1 || patientDetails.address2) && (
                    <div className="flex items-start text-sm">
                        <span className="font-medium text-gray-700 w-32">Address:</span>
                        <span className="text-gray-900 flex-1">
                            {[patientDetails.address1, patientDetails.address2, patientDetails.city]
                                .filter(Boolean)
                                .join(', ')}
                        </span>
                    </div>
                )}
            </div>

            {/* Insurance Details Section */}
            <InsuranceDetailsSection
                isLoadingInsurance={isLoadingInsurance}
                insuranceError={insuranceError}
                insuranceDetails={insuranceDetails}
                expandedInsurance={expandedInsurance}
                onToggleExpanded={onToggleInsuranceExpanded}
                patientData={patientDetails}
            />

            {allPatients.length > 1 && (
                <div className="ml-8 mt-4 pt-4 border-t border-green-200">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onBackToList}
                        className="text-green-700 border-green-300 hover:bg-green-100"
                    >
                        ← Back to Patient List
                    </Button>
                </div>
            )}
        </div>
    )
}
