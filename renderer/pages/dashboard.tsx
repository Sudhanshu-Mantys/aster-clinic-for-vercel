import React, { useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Image from 'next/image'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { getPatientDetails, searchPatientByMPI, searchPatientByPhone, PatientData } from '../lib/api'

// Mock data types
interface Request {
    id: string
    title: string
    description: string
    status: 'pending' | 'in-progress' | 'completed'
    createdAt: Date
    updatedAt: Date
}

export default function DashboardPage() {
    const { user, logout, isLoading, teams, switchTeam } = useAuth()
    const router = useRouter()
    const [isSwitchingTeam, setIsSwitchingTeam] = React.useState(false)
    const [showTeamList, setShowTeamList] = React.useState(false)

    // Prefill Eligibility Form state
    const [searchType, setSearchType] = React.useState<'mpi' | 'patientId' | 'phoneNumber'>('patientId')
    const [searchValue, setSearchValue] = React.useState('')
    const [isSearching, setIsSearching] = React.useState(false)
    const [patientDetails, setPatientDetails] = React.useState<PatientData | null>(null)
    const [allPatients, setAllPatients] = React.useState<PatientData[]>([])
    const [searchError, setSearchError] = React.useState<string | null>(null)

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

    const formatDate = (date: Date) => {
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
        } else {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
        }
    }

    const getStatusBadge = (status: string) => {
        const label = status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

        switch (status) {
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">{label}</Badge>
            case 'in-progress':
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">{label}</Badge>
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">{label}</Badge>
            default:
                return <Badge variant="outline">{label}</Badge>
        }
    }

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
                setAllPatients(response.body.Data)
                // If only one patient, select it automatically
                if (response.body.Data.length === 1) {
                    setPatientDetails(response.body.Data[0])
                }
                // TODO: Navigate to prefill form or display the data in the UI
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
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Image
                                    src="/images/logo.png"
                                    alt="Logo"
                                    width={40}
                                    height={40}
                                />
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Aster Clinics</h1>
                                    {user.selected_team && (
                                        <p className="text-sm text-gray-500">{user.selected_team.display_name}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">
                                        {user.display_name || user.primary_email}
                                    </p>
                                    <p className="text-xs text-gray-500">{user.primary_email}</p>
                                </div>
                                <Button onClick={logout} variant="outline" size="sm">
                                    Sign Out
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Prefill Eligibility Form</CardTitle>
                                    <CardDescription>
                                        Search for a patient to prefill the eligibility form
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handlePrefillSearch} className="space-y-6">
                                        {/* Search Type Selection */}
                                        <div className="space-y-3">
                                            <Label className="text-base">Search By</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchType('mpi')}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${searchType === 'mpi'
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${searchType === 'mpi'
                                                                ? 'border-blue-500'
                                                                : 'border-gray-300'
                                                                }`}
                                                        >
                                                            {searchType === 'mpi' && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                            )}
                                                        </div>
                                                        <span className="font-medium text-sm">MPI</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 ml-6">
                                                        Master Patient Index
                                                    </p>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setSearchType('patientId')}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${searchType === 'patientId'
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${searchType === 'patientId'
                                                                ? 'border-blue-500'
                                                                : 'border-gray-300'
                                                                }`}
                                                        >
                                                            {searchType === 'patientId' && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                            )}
                                                        </div>
                                                        <span className="font-medium text-sm">Patient ID</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 ml-6">
                                                        Unique patient identifier
                                                    </p>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setSearchType('phoneNumber')}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${searchType === 'phoneNumber'
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${searchType === 'phoneNumber'
                                                                ? 'border-blue-500'
                                                                : 'border-gray-300'
                                                                }`}
                                                        >
                                                            {searchType === 'phoneNumber' && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                            )}
                                                        </div>
                                                        <span className="font-medium text-sm">Phone Number</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 ml-6">
                                                        Patient's phone number
                                                    </p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Search Input */}
                                        <div className="space-y-2">
                                            <Label htmlFor="searchValue">
                                                {searchType === 'mpi' && 'Enter MPI'}
                                                {searchType === 'patientId' && 'Enter Patient ID'}
                                                {searchType === 'phoneNumber' && 'Enter Phone Number'}
                                            </Label>
                                            <Input
                                                id="searchValue"
                                                type={searchType === 'phoneNumber' ? 'tel' : 'text'}
                                                placeholder={
                                                    searchType === 'mpi'
                                                        ? 'e.g., MPI123456'
                                                        : searchType === 'patientId'
                                                            ? 'e.g., PT123456'
                                                            : 'e.g., +1 (555) 123-4567'
                                                }
                                                value={searchValue}
                                                onChange={(e) => setSearchValue(e.target.value)}
                                                disabled={isSearching}
                                                className="max-w-md"
                                            />
                                            <p className="text-xs text-gray-500">
                                                This will search for the patient and prefill the eligibility form with their information
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex space-x-3 pt-2">
                                            <Button
                                                type="submit"
                                                disabled={isSearching || !searchValue.trim()}
                                                className="min-w-32"
                                            >
                                                {isSearching ? 'Searching...' : 'Search & Prefill'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setSearchValue('')
                                                    setPatientDetails(null)
                                                    setAllPatients([])
                                                    setSearchError(null)
                                                }}
                                                disabled={isSearching}
                                            >
                                                Clear
                                            </Button>
                                        </div>

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
                                                            Found {allPatients.length} patients. Please select one:
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="ml-8 space-y-2">
                                                    {allPatients.map((patient, index) => (
                                                        <button
                                                            key={`${patient.patient_id}-${index}`}
                                                            onClick={() => setPatientDetails(patient)}
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
                                        )}

                                        {/* Patient Details Result */}
                                        {patientDetails && (
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
                                                {allPatients.length > 1 && (
                                                    <div className="ml-8 mt-4 pt-4 border-t border-green-200">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setPatientDetails(null)}
                                                            className="text-green-700 border-green-300 hover:bg-green-100"
                                                        >
                                                            ← Back to Patient List
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </form>
                                </CardContent>
                            </Card>

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
                            <Card>
                                <CardHeader>
                                    <CardTitle>All Request History</CardTitle>
                                    <CardDescription>
                                        Complete history of all requests
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {allHistory.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                No request history available
                                            </div>
                                        ) : (
                                            allHistory.map((request) => (
                                                <div
                                                    key={request.id}
                                                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold text-gray-900">
                                                                {request.title}
                                                            </h3>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {request.description}
                                                            </p>
                                                            <div className="flex items-center space-x-4 mt-2">
                                                                <p className="text-xs text-gray-500">
                                                                    Created {formatDate(request.createdAt)}
                                                                </p>
                                                                {request.updatedAt !== request.createdAt && (
                                                                    <p className="text-xs text-gray-500">
                                                                        Updated {formatDate(request.updatedAt)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="ml-4">
                                                            {getStatusBadge(request.status)}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4">
                                                        <Button size="sm" variant="outline">
                                                            View Details
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Tab 3: Profile */}
                        <TabsContent value="profile" className="space-y-4">
                            <div className="grid gap-6 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Profile Information</CardTitle>
                                        <CardDescription>
                                            Your account details
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-500">Email</p>
                                            <p className="font-medium">{user.primary_email}</p>
                                            {user.primary_email_verified && (
                                                <span className="text-xs text-green-600">✓ Verified</span>
                                            )}
                                        </div>
                                        {user.display_name && (
                                            <div className="space-y-2">
                                                <p className="text-sm text-gray-500">Display Name</p>
                                                <p className="font-medium">{user.display_name}</p>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-500">User ID</p>
                                            <p className="font-mono text-xs text-gray-600">{user.id}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-500">Member Since</p>
                                            <p className="font-medium">
                                                {new Date(user.signed_up_at_millis).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <div className="pt-4">
                                            <Button variant="outline" className="w-full">
                                                Edit Profile
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Team Information</CardTitle>
                                        <CardDescription>
                                            Your current team
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {user.selected_team ? (
                                            <>
                                                <div className="space-y-2">
                                                    <p className="text-sm text-gray-500">Team Name</p>
                                                    <p className="font-medium">
                                                        {user.selected_team.display_name}
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-sm text-gray-500">Team ID</p>
                                                    <p className="font-mono text-xs text-gray-600">
                                                        {user.selected_team.id}
                                                    </p>
                                                </div>

                                                {showTeamList && teams.length > 1 && (
                                                    <div className="pt-4 border-t space-y-3">
                                                        <p className="text-sm font-medium text-gray-700">Available Teams</p>
                                                        <div className="space-y-2">
                                                            {teams.map((team) => (
                                                                <button
                                                                    key={team.id}
                                                                    onClick={async () => {
                                                                        if (team.id !== user.selected_team_id) {
                                                                            setIsSwitchingTeam(true)
                                                                            try {
                                                                                await switchTeam(team.id)
                                                                                setShowTeamList(false)
                                                                            } catch (error) {
                                                                                console.error('Failed to switch team:', error)
                                                                                alert('Failed to switch team. Please try again.')
                                                                            } finally {
                                                                                setIsSwitchingTeam(false)
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={isSwitchingTeam || team.id === user.selected_team_id}
                                                                    className={`w-full text-left p-3 rounded-lg border transition-all ${team.id === user.selected_team_id
                                                                        ? 'border-blue-500 bg-blue-50'
                                                                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                                                        } ${isSwitchingTeam ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <p className="font-medium text-sm">
                                                                                {team.display_name}
                                                                            </p>
                                                                            <p className="text-xs text-gray-500 font-mono mt-1">
                                                                                {team.id}
                                                                            </p>
                                                                        </div>
                                                                        {team.id === user.selected_team_id && (
                                                                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                                                                                Current
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {isSwitchingTeam && (
                                                            <p className="text-sm text-gray-500 text-center">
                                                                Switching team...
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="pt-4">
                                                    {teams.length > 1 ? (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => setShowTeamList(!showTeamList)}
                                                        >
                                                            {showTeamList ? 'Hide Teams' : 'Switch Team'}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => router.push('/home')}
                                                        >
                                                            Switch Team
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-gray-500 mb-4">No team selected</p>
                                                <Button onClick={() => router.push('/home')}>
                                                    Select a Team
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Account Settings</CardTitle>
                                    <CardDescription>
                                        Manage your account preferences
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button variant="outline" className="w-full justify-start">
                                        Change Password
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start">
                                        Notification Preferences
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start">
                                        Privacy Settings
                                    </Button>
                                    <div className="pt-4 border-t">
                                        <Button variant="destructive" className="w-full" onClick={logout}>
                                            Sign Out
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </React.Fragment>
    )
}

