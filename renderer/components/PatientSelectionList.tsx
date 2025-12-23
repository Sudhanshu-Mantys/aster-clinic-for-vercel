import React from 'react'
import { type PatientData } from '../lib/api-client'

interface PatientSelectionListProps {
    patients: PatientData[]
    onSelectPatient: (patient: PatientData) => void
}

export const PatientSelectionList: React.FC<PatientSelectionListProps> = ({
    patients,
    onSelectPatient,
}) => {
    return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start mb-3">
                <svg
                    className="w-5 h-5 text-blue-600 mt-0.5 mr-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
                <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900">
                        Multiple Patients Found
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Found {patients.length} patients. Please select one:
                    </p>
                </div>
            </div>
            <div className="ml-8 space-y-2">
                {patients.map((patient, index) => (
                    <button
                        key={`${patient.patient_id}-${index}`}
                        onClick={() => onSelectPatient(patient)}
                        className="w-full text-left p-4 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                    {[patient.firstname, patient.middlename, patient.lastname]
                                        .filter(Boolean)
                                        .join(' ')}
                                </p>
                                <div className="mt-2 space-y-1">
                                    {patient.mpi && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">MPI:</span> {patient.mpi}
                                        </p>
                                    )}
                                    {patient.patient_id && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Patient ID:</span>{' '}
                                            {patient.patient_id}
                                        </p>
                                    )}
                                    {patient.dob && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">DOB:</span> {patient.dob}
                                        </p>
                                    )}
                                    {patient.phone && (
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Phone:</span> {patient.phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <svg
                                className="w-5 h-5 text-blue-600 ml-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}
