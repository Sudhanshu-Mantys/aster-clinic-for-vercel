import React, { useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { getPatientDetails, searchPatientByMPI, searchPatientByPhone, getInsuranceDetails, PatientData, InsuranceData } from '../lib/api'
import { SearchType, Request } from '../types/dashboard'
import { DashboardHeader } from '../components/DashboardHeader'
import { PrefillEligibilityForm } from '../components/PrefillEligibilityForm'
import { RequestHistoryTab } from '../components/RequestHistoryTab'
import { ProfileTab } from '../components/ProfileTab'

export default function DashboardPage() {
    const { user, logout, isLoading, teams, switchTeam } = useAuth()
    const router = useRouter()
    const [isSwitchingTeam, setIsSwitchingTeam] = React.useState(false)
    const [showTeamList, setShowTeamList] = React.useState(false)

    // Prefill Eligibility Form state
    const [searchType, setSearchType] = React.useState<SearchType>('phoneNumber')
    const [searchValue, setSearchValue] = React.useState('')
    const [isSearching, setIsSearching] = React.useState(false)
    const [patientDetails, setPatientDetails] = React.useState<PatientData | null>(null)
    const [allPatients, setAllPatients] = React.useState<PatientData[]>([])
    const [searchError, setSearchError] = React.useState<string | null>(null)
    const [insuranceDetails, setInsuranceDetails] = React.useState<InsuranceData[]>([])
    const [isLoadingInsurance, setIsLoadingInsurance] = React.useState(false)
    const [insuranceError, setInsuranceError] = React.useState<string | null>(null)
    const [expandedInsurance, setExpandedInsurance] = React.useState<Set<number>>(new Set())

    // Redirect if not logged in or no team selected
    useEffect(() => {
        if (!isLoading && (!user || !user.selected_team_id)) {
            router.replace('/home')
        }
    }, [user, isLoading, router])

    // Mock data - replace with actual API calls later
    const newRequests: Request[] = [
        {
            id: '1',
            title: 'New patient intake form',
            description: 'Complete intake form for John Doe',
            status: 'pending',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
            id: '2',
            title: 'Lab results review',
            description: 'Review blood work results for patient #1234',
            status: 'in-progress',
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
        {
            id: '3',
            title: 'Prescription refill request',
            description: 'Process refill for medication ABC',
            status: 'pending',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
    ]

    const allHistory: Request[] = [
        ...newRequests,
        {
            id: '4',
            title: 'Insurance verification',
            description: 'Verify insurance for patient #5678',
            status: 'completed',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
            id: '5',
            title: 'Appointment scheduling',
            description: 'Schedule follow-up for patient #9012',
            status: 'completed',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
            id: '6',
            title: 'Medical records request',
            description: 'Process medical records request',
            status: 'completed',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
    ]

    const handlePrefillSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchValue.trim()) {
            setSearchError('Please enter a search value')
            return
        }

        setIsSearching(true)
        setSearchError(null)
        setPatientDetails(null)
        setAllPatients([])

        try {
            console.log('Searching with:', { searchType, searchValue })

            let response

            // Call appropriate API based on search type
            if (searchType === 'patientId') {
                const patientId = parseInt(searchValue.trim(), 10)
                if (isNaN(patientId)) {
                    throw new Error('Patient ID must be a valid number')
                }
                response = await getPatientDetails(patientId)
            } else if (searchType === 'mpi') {
                response = await searchPatientByMPI(searchValue.trim())
            } else if (searchType === 'phoneNumber') {
                response = await searchPatientByPhone(searchValue.trim())
            }

            console.log('✅ Patient details retrieved:', response)

            // Store all patient details
            if (response && response.body && response.body.Data && response.body.Data.length > 0) {
                // Deduplicate patients based on patient_id
                const uniquePatients = response.body.Data.reduce((acc: PatientData[], current: PatientData) => {
                    const existingPatient = acc.find(p => p.patient_id === current.patient_id)
                    if (!existingPatient) {
                        acc.push(current)
                    }
                    return acc
                }, [])

                console.log(`Deduplicated: ${response.body.Data.length} records → ${uniquePatients.length} unique patients`)

                setAllPatients(uniquePatients)
                // If only one patient, select it automatically
                if (uniquePatients.length === 1) {
                    setPatientDetails(uniquePatients[0])
                }
            } else {
                throw new Error('No patient data found')
            }
        } catch (error) {
            console.error('Search error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to search. Please try again.'
            setSearchError(errorMessage)
        } finally {
            setIsSearching(false)
        }
    }

    const fetchInsuranceDetails = async (patientId: number) => {
        setIsLoadingInsurance(true)
        setInsuranceError(null)
        setInsuranceDetails([])
        setExpandedInsurance(new Set())

        try {
            console.log('Fetching insurance details for patient:', patientId)
            const response = await getInsuranceDetails({
                patientId,
                apntId: null,
                encounterId: 0,
                customerId: 1,
                primaryInsPolicyId: null,
                siteId: 1,
                isDiscard: 0,
                hasTopUpCard: 0,
            })

            console.log('✅ Insurance details retrieved:', response)

            if (response && response.body && response.body.Data) {
                const insurances = response.body.Data
                setInsuranceDetails(insurances)

                // Auto-expand active insurance policies
                const activeIds = new Set(
                    insurances
                        .filter(ins => ins.insurance_status?.toLowerCase() === 'active')
                        .map(ins => ins.patient_insurance_tpa_policy_id)
                )
                setExpandedInsurance(activeIds)
            } else {
                setInsuranceDetails([])
            }
        } catch (error) {
            console.error('Insurance fetch error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch insurance details'
            setInsuranceError(errorMessage)
        } finally {
            setIsLoadingInsurance(false)
        }
    }

    const toggleInsuranceExpanded = (insuranceId: number) => {
        setExpandedInsurance(prev => {
            const newSet = new Set(prev)
            if (newSet.has(insuranceId)) {
                newSet.delete(insuranceId)
            } else {
                newSet.add(insuranceId)
            }
            return newSet
        })
    }

    const handleClear = () => {
        setSearchValue('')
        setPatientDetails(null)
        setAllPatients([])
        setSearchError(null)
    }

    const handleSwitchTeam = async (teamId: string) => {
        setIsSwitchingTeam(true)
        try {
            await switchTeam(teamId)
            setShowTeamList(false)
        } catch (error) {
            console.error('Failed to switch team:', error)
            throw error
        } finally {
            setIsSwitchingTeam(false)
        }
    }

    // Fetch insurance details when a patient is selected
    useEffect(() => {
        if (patientDetails && patientDetails.patient_id) {
            fetchInsuranceDetails(patientDetails.patient_id)
        } else {
            setInsuranceDetails([])
            setInsuranceError(null)
            setExpandedInsurance(new Set())
        }
    }, [patientDetails])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    if (!user || !user.selected_team_id) {
        return null // Will redirect
    }

    return (
        <React.Fragment>
            <Head>
                <title>Dashboard - Aster Clinics</title>
            </Head>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <DashboardHeader user={user} onLogout={logout} />

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Tabs defaultValue="new-requests" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="new-requests">New Requests</TabsTrigger>
                            <TabsTrigger value="all-history">All History</TabsTrigger>
                            <TabsTrigger value="profile">Profile</TabsTrigger>
                        </TabsList>

                        {/* Tab 1: New Requests */}
                        <TabsContent value="new-requests" className="space-y-4">
                            {/* Prefill Eligibility Form Section */}
                            <PrefillEligibilityForm
                                searchType={searchType}
                                searchValue={searchValue}
                                isSearching={isSearching}
                                patientDetails={patientDetails}
                                allPatients={allPatients}
                                searchError={searchError}
                                insuranceDetails={insuranceDetails}
                                isLoadingInsurance={isLoadingInsurance}
                                insuranceError={insuranceError}
                                expandedInsurance={expandedInsurance}
                                onSearchTypeChange={setSearchType}
                                onSearchValueChange={setSearchValue}
                                onSubmit={handlePrefillSearch}
                                onClear={handleClear}
                                onSelectPatient={setPatientDetails}
                                onBackToList={() => setPatientDetails(null)}
                                onToggleInsuranceExpanded={toggleInsuranceExpanded}
                            />

                            {/* Eligibility Requests Form - Placeholder */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Eligibility Requests</CardTitle>
                                    <CardDescription>
                                        View and manage eligibility verification requests
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-12 text-gray-500">
                                        <div className="mb-4">
                                            <svg
                                                className="mx-auto h-12 w-12 text-gray-400"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            Coming Soon
                                        </h3>
                                        <p className="text-sm">
                                            Eligibility requests form will be available here
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tab 2: All History */}
                        <TabsContent value="all-history" className="space-y-4">
                            <RequestHistoryTab requests={allHistory} />
                        </TabsContent>

                        {/* Tab 3: Profile */}
                        <TabsContent value="profile" className="space-y-4">
                            <ProfileTab
                                user={user}
                                teams={teams}
                                showTeamList={showTeamList}
                                isSwitchingTeam={isSwitchingTeam}
                                onToggleTeamList={() => setShowTeamList(!showTeamList)}
                                onSwitchTeam={handleSwitchTeam}
                                onLogout={logout}
                            />
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </React.Fragment>
    )
}
