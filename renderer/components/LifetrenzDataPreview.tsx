import React from 'react'
import { type InsuranceData, type PatientData } from '../lib/api-client'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface LifetrenzDataPreviewProps {
    insuranceData: InsuranceData
    patientData?: PatientData | null
    onClose: () => void
}

export const LifetrenzDataPreview: React.FC<LifetrenzDataPreviewProps> = ({
    insuranceData,
    patientData,
    onClose,
}) => {
    // Format the data that would be sent to Lifetrenz
    const lifetrenzPayload = {
        // Patient Information
        patient: {
            mpi: patientData?.mpi || '',
            firstName: patientData?.firstname || '',
            middleName: patientData?.middlename || '',
            lastName: patientData?.lastname || '',
            dateOfBirth: patientData?.dob || '',
            gender: patientData?.gender || '',
            nationality: patientData?.nationality || '',
            emiratesId: patientData?.uid_value || '',
            phone: patientData?.phone || '',
            email: patientData?.email || '',
        },
        // Insurance Information
        insurance: {
            cardNumber: insuranceData.tpa_policy_id || '',
            receiverId: insuranceData.receiver_id || '',
            receiverName: insuranceData.receiver_name || '',
            receiverCode: insuranceData.receiver_code || '',
            payerId: insuranceData.payer_id || '',
            payerName: insuranceData.payer_name || '',
            payerCode: insuranceData.payer_code || '',
            network: insuranceData.tpa_name || '',
            plan: insuranceData.ins_plan || '',
            planCode: insuranceData.ins_plan_code || '',
            policyNumber: insuranceData.policy_number || '',
            corporateName: insuranceData.insurance_name || '',
            startDate: insuranceData.insurance_from || '',
            lastRenewalDate: insuranceData.insurance_renewal || '',
            expiryDate: insuranceData.ins_exp_date || '',
            status: insuranceData.insurance_status || '',
            rateCard: insuranceData.rate_card_name || '',
            authorizationLimit: insuranceData.authorization_limit || '',
        },
        // Coverage Details
        coverage: {
            copay: insuranceData.copay?.Default?.copay_details || [],
            deductible: insuranceData.copay?.Default?.Deduct_details || [],
        },
    }

    const handleSendToLifetrenz = () => {
        // This will be implemented when API is ready
        console.log('Data to be sent to Lifetrenz:', lifetrenzPayload)
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Send Data to Lifetrenz</h2>
                        <p className="text-blue-100 mt-1 text-sm">
                            Review the data before sending
                        </p>
                    </div>
                    <Badge className="bg-blue-500 text-white border-blue-400">
                        Preview Mode
                    </Badge>
                </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="space-y-6">
                    {/* Patient Information Section */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Patient Information
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <DataRow label="MPI" value={lifetrenzPayload.patient.mpi} />
                            <DataRow
                                label="Full Name"
                                value={`${lifetrenzPayload.patient.firstName} ${lifetrenzPayload.patient.middleName} ${lifetrenzPayload.patient.lastName}`.trim()}
                            />
                            <DataRow label="Date of Birth" value={lifetrenzPayload.patient.dateOfBirth} />
                            <DataRow label="Gender" value={lifetrenzPayload.patient.gender} />
                            <DataRow label="Nationality" value={lifetrenzPayload.patient.nationality} />
                            <DataRow label="Emirates ID" value={lifetrenzPayload.patient.emiratesId} />
                            <DataRow label="Phone" value={lifetrenzPayload.patient.phone} />
                            <DataRow label="Email" value={lifetrenzPayload.patient.email} />
                        </div>
                    </div>

                    {/* Insurance Information Section */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Insurance Details
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <DataRow label="Insurance Card #" value={lifetrenzPayload.insurance.cardNumber} highlighted />
                            <DataRow label="Receiver ID" value={lifetrenzPayload.insurance.receiverId} />
                            <DataRow label="Receiver Name" value={lifetrenzPayload.insurance.receiverName} />
                            <DataRow label="Receiver Code" value={lifetrenzPayload.insurance.receiverCode} />
                            <DataRow label="Payer ID" value={lifetrenzPayload.insurance.payerId} />
                            <DataRow label="Payer Name" value={lifetrenzPayload.insurance.payerName} />
                            <DataRow label="Payer Code" value={lifetrenzPayload.insurance.payerCode} />
                            <DataRow label="Network" value={lifetrenzPayload.insurance.network} />
                            <DataRow label="Plan" value={lifetrenzPayload.insurance.plan} />
                            <DataRow label="Plan Code" value={lifetrenzPayload.insurance.planCode} />
                            <DataRow label="Policy Number" value={lifetrenzPayload.insurance.policyNumber} />
                            <DataRow label="Corporate Name" value={lifetrenzPayload.insurance.corporateName} />
                            <DataRow label="Rate Card" value={lifetrenzPayload.insurance.rateCard} />
                            <DataRow label="Authorization Limit" value={`AED ${lifetrenzPayload.insurance.authorizationLimit}`} />
                            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                                <span className="font-medium text-gray-700">Status:</span>
                                <Badge className={`${lifetrenzPayload.insurance.status.toLowerCase() === 'active'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                    }`}>
                                    {lifetrenzPayload.insurance.status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Policy Dates Section */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Policy Dates
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <DataRow label="Start Date" value={lifetrenzPayload.insurance.startDate} />
                            <DataRow label="Last Renewal Date" value={lifetrenzPayload.insurance.lastRenewalDate} />
                            <DataRow label="Expiry Date" value={lifetrenzPayload.insurance.expiryDate} highlighted />
                        </div>
                    </div>

                    {/* Coverage Details Section */}
                    {(lifetrenzPayload.coverage.copay.length > 0 || lifetrenzPayload.coverage.deductible.length > 0) && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Patient Payable / Coverage Details
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Copay Details */}
                                {lifetrenzPayload.coverage.copay.length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2 text-sm">Copay Details:</h4>
                                        <div className="space-y-2">
                                            {lifetrenzPayload.coverage.copay.map((copay, idx) => (
                                                <div key={idx} className="bg-blue-50 rounded p-3 border border-blue-100">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-medium text-sm text-gray-900">
                                                            {copay.chargeGroupName}
                                                        </span>
                                                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                                            {copay.payableAmount}% {copay.payableAmountDesc}
                                                        </Badge>
                                                    </div>
                                                    {copay.payableAmountMax && (
                                                        <p className="text-xs text-gray-600">
                                                            Max: {copay.payableAmountMax}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Deductible Details */}
                                {lifetrenzPayload.coverage.deductible.length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2 text-sm">Deductible Details:</h4>
                                        <div className="space-y-2">
                                            {lifetrenzPayload.coverage.deductible.map((deduct, idx) => (
                                                <div key={idx} className="bg-orange-50 rounded p-3 border border-orange-100">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-medium text-sm text-gray-900">
                                                            {deduct.chargeGroupName || 'General'}
                                                        </span>
                                                        <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                                                            {deduct.payableAmount} {deduct.payableAmountDesc}
                                                        </Badge>
                                                    </div>
                                                    {deduct.payableAmountMax && (
                                                        <p className="text-xs text-gray-600">
                                                            Max: {deduct.payableAmountMax}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* API Integration Notice */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h4 className="font-semibold text-yellow-900 text-sm">API Integration Pending</h4>
                                <p className="text-yellow-800 text-xs mt-1">
                                    The Lifetrenz API integration is not yet complete. The "Send to Lifetrenz" button is currently disabled.
                                    Once the API is ready, this data will be sent automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
                <Button
                    onClick={onClose}
                    variant="outline"
                    className="px-6"
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSendToLifetrenz}
                    disabled={true}
                    className="px-6 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title="API integration pending"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send to Lifetrenz
                </Button>
            </div>
        </div>
    )
}

// Helper component for displaying data rows
const DataRow: React.FC<{ label: string; value: string | number; highlighted?: boolean }> = ({
    label,
    value,
    highlighted = false
}) => {
    if (!value) return null

    return (
        <div className={`flex items-center justify-between py-2 px-3 rounded ${highlighted ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
            }`}>
            <span className="font-medium text-gray-700 text-sm">{label}:</span>
            <span className={`text-gray-900 text-sm ${highlighted ? 'font-semibold' : ''}`}>
                {value}
            </span>
        </div>
    )
}
