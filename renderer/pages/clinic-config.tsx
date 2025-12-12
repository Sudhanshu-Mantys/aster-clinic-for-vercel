import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { DashboardHeader } from '../components/DashboardHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

// Type definitions
interface ClinicConfig {
    clinic_id: string
    location?: string
    lt_site_id?: string
    customer_id?: string
    hospital_or_clinic?: 'hospital' | 'clinic'
    updated_at?: string
}

interface TPAConfig {
    tpa_id: string
    clinic_id: string
    tpa_name: string
    api_url?: string
    credentials?: string
    config_data?: any
    created_at: string
    updated_at: string
}

interface PlanConfig {
    plan_id: string
    clinic_id: string
    plan_name: string
    plan_code?: string
    description?: string
    created_at: string
    updated_at: string
}

interface DoctorConfig {
    doctor_id: string
    clinic_id: string
    doctor_name: string
    doctor_code?: string
    specialization?: string
    lt_user_id?: string
    dha_id?: string
    moh_id?: string
    lt_role_id?: string
    lt_specialisation_id?: string
    created_at: string
    updated_at: string
}

export default function ClinicConfigPage() {
    const { user, logout, isLoading } = useAuth()
    const router = useRouter()
    const [showProfile, setShowProfile] = useState(false)
    const [activeTab, setActiveTab] = useState('clinic')

    // Get clinic_id from user's selected team
    const clinicId = user?.selected_team_id || ''

    // Redirect if not logged in
    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/home')
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    return (
        <React.Fragment>
            <Head>
                <title>Clinic Configuration - Aster Clinics</title>
            </Head>
            <div className="min-h-screen bg-gray-50">
                <DashboardHeader
                    user={user}
                    onLogout={logout}
                    onShowProfile={() => setShowProfile(true)}
                />

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Active Clinic Info */}
                    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-gray-500 mb-1">Active Clinic</div>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="text-lg font-semibold text-gray-900">
                                            {user.selected_team?.display_name || 'No Team Selected'}
                                        </div>
                                        <div className="text-sm text-gray-600 font-mono mt-0.5">
                                            ID: {clinicId || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm text-gray-600">Active Configuration</span>
                            </div>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Clinic Configuration</CardTitle>
                            <CardDescription>
                                Manage clinic settings, TPA configurations, plans, payers, and doctors
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-6">
                                    <TabsTrigger value="clinic">Clinic Config</TabsTrigger>
                                    <TabsTrigger value="tpa">TPA Config</TabsTrigger>
                                    <TabsTrigger value="plans">Plans / Networks</TabsTrigger>
                                    <TabsTrigger value="payer">Payer</TabsTrigger>
                                    <TabsTrigger value="doctors">Doctors</TabsTrigger>
                                    <TabsTrigger value="specialisations">Specialisations</TabsTrigger>
                                </TabsList>

                                <TabsContent value="clinic" className="mt-6">
                                    <ClinicConfigTab clinicId={clinicId} />
                                </TabsContent>

                                <TabsContent value="tpa" className="mt-6">
                                    <TPAConfigTab clinicId={clinicId} />
                                </TabsContent>

                                <TabsContent value="plans" className="mt-6">
                                    <PlansConfigTab clinicId={clinicId} />
                                </TabsContent>

                                <TabsContent value="payer" className="mt-6">
                                    <PayerConfigTab clinicId={clinicId} />
                                </TabsContent>

                                <TabsContent value="doctors" className="mt-6">
                                    <DoctorsConfigTab clinicId={clinicId} />
                                </TabsContent>

                                <TabsContent value="specialisations" className="mt-6">
                                    <SpecialisationsConfigTab />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </React.Fragment>
    )
}

// Clinic Config Tab Component
function ClinicConfigTab({ clinicId }: { clinicId: string }) {
    const [config, setConfig] = useState<ClinicConfig | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        location: '',
        lt_site_id: '',
        customer_id: '',
        hospital_or_clinic: 'clinic' as 'hospital' | 'clinic'
    })

    useEffect(() => {
        loadConfig()
    }, [clinicId])

    const loadConfig = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/clinic-config/clinic?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                if (data.config) {
                    setConfig(data.config)
                    setFormData({
                        location: data.config.location || '',
                        lt_site_id: data.config.lt_site_id || '',
                        customer_id: data.config.customer_id || '',
                        hospital_or_clinic: data.config.hospital_or_clinic || 'clinic'
                    })
                }
            }
        } catch (error) {
            console.error('Failed to load config:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const response = await fetch('/api/clinic-config/clinic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clinic_id: clinicId,
                    ...formData
                })
            })

            if (response.ok) {
                const data = await response.json()
                setConfig(data.config)
                alert('Configuration saved successfully!')
            } else {
                alert('Failed to save configuration')
            }
        } catch (error) {
            console.error('Failed to save config:', error)
            alert('Failed to save configuration')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading configuration...</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <Label htmlFor="location">Location</Label>
                <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Dubai, Abu Dhabi"
                />
            </div>

            <div>
                <Label htmlFor="lt_site_id">Liftrenz Site ID</Label>
                <Input
                    id="lt_site_id"
                    value={formData.lt_site_id}
                    onChange={(e) => setFormData({ ...formData, lt_site_id: e.target.value })}
                    placeholder="LT Site ID"
                />
            </div>

            <div>
                <Label htmlFor="customer_id">Customer ID</Label>
                <Input
                    id="customer_id"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    placeholder="Customer/Organization ID"
                />
            </div>

            <div>
                <Label htmlFor="hospital_or_clinic">Type</Label>
                <select
                    id="hospital_or_clinic"
                    value={formData.hospital_or_clinic}
                    onChange={(e) => setFormData({ ...formData, hospital_or_clinic: e.target.value as 'hospital' | 'clinic' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="clinic">Clinic</option>
                    <option value="hospital">Hospital</option>
                </select>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </div>

            {config?.updated_at && (
                <div className="text-sm text-gray-500">
                    Last updated: {new Date(config.updated_at).toLocaleString()}
                </div>
            )}
        </div>
    )
}

// TPA Config Tab Component
function TPAConfigTab({ clinicId }: { clinicId: string }) {
    const [tpaConfigs, setTpaConfigs] = useState<any[]>([])
    const [clinicConfig, setClinicConfig] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showBulkImportModal, setShowBulkImportModal] = useState(false)
    const [editingTPA, setEditingTPA] = useState<any | null>(null)
    const [bulkImportJson, setBulkImportJson] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [formData, setFormData] = useState({
        ins_code: '',
        tpa_id: '',
        tpa_name: '',
        api_url: '',
        credentials: '',
        config_data: '',
        lt_site_id: '',
        lt_customer_id: '',
        lt_hospital_id: '',
        lt_other_config: '',
        extra_form_fields: {
            doctor: undefined,
            phoneNumber: undefined,
            name: undefined
        } as Record<string, boolean | undefined>
    })

    useEffect(() => {
        loadTPAConfigs()
        loadClinicConfig()
    }, [clinicId])

    const loadClinicConfig = async () => {
        try {
            const response = await fetch(`/api/clinic-config/clinic?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                if (data.config) {
                    setClinicConfig(data.config)
                }
            }
        } catch (error) {
            console.error('Failed to load clinic config:', error)
        }
    }

    const loadTPAConfigs = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/clinic-config/tpa?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                setTpaConfigs(data.configs || [])
            }
        } catch (error) {
            console.error('Failed to load TPA configs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleBulkImport = async () => {
        if (!bulkImportJson.trim()) {
            alert('Please paste the JSON data')
            return
        }

        setIsImporting(true)
        try {
            let mappingsData
            try {
                const parsed = JSON.parse(bulkImportJson)
                // Handle the API response format
                if (parsed.body && parsed.body.Data) {
                    mappingsData = parsed.body.Data
                } else if (Array.isArray(parsed)) {
                    mappingsData = parsed
                } else {
                    throw new Error('Invalid JSON format')
                }
            } catch (error) {
                alert('Invalid JSON format. Please check your data.')
                setIsImporting(false)
                return
            }

            const response = await fetch('/api/clinic-config/tpa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clinic_id: clinicId,
                    bulk_import: true,
                    mappings: mappingsData
                })
            })

            if (response.ok) {
                const result = await response.json()
                alert(`Successfully imported ${result.imported} TPA mappings${result.errors > 0 ? ` (${result.errors} errors)` : ''}`)
                setBulkImportJson('')
                setShowBulkImportModal(false)
                await loadTPAConfigs()
            } else {
                const error = await response.json()
                alert(`Failed to import: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to import TPA mappings:', error)
            alert('Failed to import TPA mappings')
        } finally {
            setIsImporting(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const method = editingTPA ? 'PUT' : 'POST'
            const identifier = editingTPA?.tpa_id || editingTPA?.ins_code
            const url = editingTPA && identifier
                ? `/api/clinic-config/tpa/${identifier}`
                : '/api/clinic-config/tpa'

            // Prepare extra_form_fields array - only include fields that are explicitly set (not undefined/null)
            const extraFormFields = Object.entries(formData.extra_form_fields)
                .filter(([_, required]) => required !== undefined && required !== null)
                .map(([field, required]) => ({
                    field: field as 'doctor' | 'phoneNumber' | 'name',
                    required: required === true
                }))

            const requestBody: any = {
                ...formData,
                clinic_id: clinicId,
                config_data: formData.config_data ? JSON.parse(formData.config_data) : {},
                lt_other_config: formData.lt_other_config ? JSON.parse(formData.lt_other_config) : {},
                extra_form_fields: extraFormFields.length > 0 ? extraFormFields : undefined
            }

            // Remove empty LT fields
            if (!requestBody.lt_site_id) delete requestBody.lt_site_id
            if (!requestBody.lt_customer_id) delete requestBody.lt_customer_id
            if (!requestBody.lt_hospital_id) delete requestBody.lt_hospital_id
            if (Object.keys(requestBody.lt_other_config || {}).length === 0) delete requestBody.lt_other_config

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })

            if (response.ok) {
                await loadTPAConfigs()
                setShowAddModal(false)
                setEditingTPA(null)
                setFormData({
                    ins_code: '',
                    tpa_id: '',
                    tpa_name: '',
                    api_url: '',
                    credentials: '',
                    config_data: '',
                    lt_site_id: '',
                    lt_customer_id: '',
                    lt_hospital_id: '',
                    lt_other_config: '',
                    extra_form_fields: { doctor: undefined, phoneNumber: undefined, name: undefined }
                })
            } else {
                alert('Failed to save TPA configuration')
            }
        } catch (error) {
            console.error('Failed to save TPA config:', error)
            alert('Failed to save TPA configuration')
        }
    }

    const handleEdit = (tpa: any) => {
        setEditingTPA(tpa)

        // Build extra_form_fields object from array - default to undefined (hidden) if not in array
        const extraFields: Record<string, boolean | undefined> = {
            doctor: undefined,
            phoneNumber: undefined,
            name: undefined
        }
        if (tpa.extra_form_fields && Array.isArray(tpa.extra_form_fields)) {
            tpa.extra_form_fields.forEach((field: any) => {
                if (field.field && field.hasOwnProperty('required')) {
                    extraFields[field.field] = field.required === true
                }
            })
        }

        // Prefill LT values from TPA config, fallback to clinic config
        const ltSiteId = tpa.lt_site_id || clinicConfig?.lt_site_id || ''
        const ltCustomerId = tpa.lt_customer_id || clinicConfig?.customer_id || ''
        const ltHospitalId = tpa.lt_hospital_id || ''

        setFormData({
            ins_code: tpa.ins_code || '',
            tpa_id: tpa.tpa_id || tpa.ins_code || '',
            tpa_name: tpa.tpa_name || tpa.insurance_name || '',
            api_url: tpa.api_url || '',
            credentials: tpa.credentials || '',
            config_data: tpa.config_data ? JSON.stringify(tpa.config_data, null, 2) : '',
            lt_site_id: ltSiteId,
            lt_customer_id: ltCustomerId,
            lt_hospital_id: ltHospitalId,
            lt_other_config: tpa.lt_other_config ? JSON.stringify(tpa.lt_other_config, null, 2) : '',
            extra_form_fields: extraFields
        })
        setShowAddModal(true)
    }

    const handleDelete = async (identifier: string) => {
        if (!confirm('Are you sure you want to delete this TPA configuration?')) return

        try {
            const response = await fetch(`/api/clinic-config/tpa/${identifier}?clinic_id=${clinicId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await loadTPAConfigs()
            } else {
                alert('Failed to delete TPA configuration')
            }
        } catch (error) {
            console.error('Failed to delete TPA config:', error)
            alert('Failed to delete TPA configuration')
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading TPA configurations...</div>
    }

    // Separate configs with mapping data from those without
    const configsWithMapping = tpaConfigs.filter(c => c.insurance_id !== undefined)
    const configsWithoutMapping = tpaConfigs.filter(c => c.insurance_id === undefined)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                    Manage TPA (Third Party Administrator) configurations and mappings.
                    All data is stored using ins_code as the primary identifier for Lifetrenz API lookups.
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowBulkImportModal(true)}>
                        Bulk Import Mappings
                    </Button>
                    <Button onClick={() => {
                        setEditingTPA(null)
                        // Prefill LT values from clinic config when adding new TPA
                        setFormData({
                            ins_code: '',
                            tpa_id: '',
                            tpa_name: '',
                            api_url: '',
                            credentials: '',
                            config_data: '',
                            lt_site_id: clinicConfig?.lt_site_id || '',
                            lt_customer_id: clinicConfig?.customer_id || '',
                            lt_hospital_id: '',
                            lt_other_config: '',
                            extra_form_fields: { doctor: undefined, phoneNumber: undefined, name: undefined }
                        })
                        setShowAddModal(true)
                    }}>
                        Add TPA Config
                    </Button>
                </div>
            </div>

            {/* Unified TPA Table */}
            {tpaConfigs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    <p className="mb-2">No TPA configurations found.</p>
                    <p className="text-sm">Click "Bulk Import Mappings" to import from API response, or "Add TPA Config" to create one manually.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Ins Code</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Insurance ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Mapping ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">API URL</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tpaConfigs.map((tpa) => {
                                const identifier = tpa.ins_code || tpa.tpa_id || ''
                                return (
                                    <tr key={identifier} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4 font-mono text-sm font-semibold">
                                            {tpa.ins_code || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {tpa.insurance_name || tpa.tpa_name || '-'}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-sm">
                                            {tpa.insurance_id !== undefined ? tpa.insurance_id : '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {tpa.insurance_type !== undefined ? (
                                                <span className={`px-2 py-1 rounded text-xs ${tpa.insurance_type === 1
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    {tpa.insurance_type === 1 ? 'Insurance' : 'TPA'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-sm text-gray-600">
                                            {tpa.hospital_insurance_mapping_id || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {tpa.api_url || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(tpa)}>
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDelete(identifier)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">
                                {editingTPA ? 'Edit TPA Configuration' : 'Add TPA Configuration'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="ins_code">Ins Code (Primary Identifier)</Label>
                                <Input
                                    id="ins_code"
                                    value={formData.ins_code}
                                    onChange={(e) => setFormData({ ...formData, ins_code: e.target.value })}
                                    placeholder="e.g., TPA036, INS026, DHA"
                                    required
                                    disabled={!!editingTPA}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This is the primary identifier used for Lifetrenz API lookups
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="tpa_id">TPA ID (Optional - legacy)</Label>
                                <Input
                                    id="tpa_id"
                                    value={formData.tpa_id}
                                    onChange={(e) => setFormData({ ...formData, tpa_id: e.target.value })}
                                    placeholder="e.g., TPA001, TPA004"
                                    disabled={!!editingTPA}
                                />
                            </div>

                            <div>
                                <Label htmlFor="tpa_name">TPA/Insurance Name</Label>
                                <Input
                                    id="tpa_name"
                                    value={formData.tpa_name}
                                    onChange={(e) => setFormData({ ...formData, tpa_name: e.target.value })}
                                    placeholder="e.g., Neuron, NAS, Daman"
                                    required
                                />
                            </div>

                            {/* Lifetrenz (LT) Values Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-semibold mb-4">Lifetrenz (LT) Values</h3>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="lt_site_id">LT Site ID</Label>
                                        <Input
                                            id="lt_site_id"
                                            value={formData.lt_site_id}
                                            onChange={(e) => setFormData({ ...formData, lt_site_id: e.target.value })}
                                            placeholder="e.g., 31"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="lt_customer_id">LT Customer ID</Label>
                                        <Input
                                            id="lt_customer_id"
                                            value={formData.lt_customer_id}
                                            onChange={(e) => setFormData({ ...formData, lt_customer_id: e.target.value })}
                                            placeholder="Customer ID"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="lt_hospital_id">LT Hospital ID</Label>
                                        <Input
                                            id="lt_hospital_id"
                                            value={formData.lt_hospital_id}
                                            onChange={(e) => setFormData({ ...formData, lt_hospital_id: e.target.value })}
                                            placeholder="Hospital ID"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="lt_other_config">LT Other Config (JSON, Optional)</Label>
                                        <textarea
                                            id="lt_other_config"
                                            value={formData.lt_other_config}
                                            onChange={(e) => setFormData({ ...formData, lt_other_config: e.target.value })}
                                            placeholder='{"key": "value"}'
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Extra Form Fields Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-lg font-semibold mb-4">Extra Form Fields</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Configure which fields should be shown and whether they are compulsory or optional
                                </p>

                                <div className="space-y-3">
                                    {(['doctor', 'phoneNumber', 'name'] as const).map((fieldName) => {
                                        const fieldValue = formData.extra_form_fields[fieldName]
                                        const fieldLabel = fieldName === 'phoneNumber' ? 'Phone Number' : fieldName.charAt(0).toUpperCase() + fieldName.slice(1)

                                        return (
                                            <div key={fieldName} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                                                <div>
                                                    <Label className="font-medium">{fieldLabel}</Label>
                                                    <p className="text-xs text-gray-500">Show {fieldLabel} field in eligibility form</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`${fieldName}_required`}
                                                            checked={fieldValue === false}
                                                            onChange={() => setFormData({
                                                                ...formData,
                                                                extra_form_fields: {
                                                                    ...formData.extra_form_fields,
                                                                    [fieldName]: false
                                                                }
                                                            })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm">Optional</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`${fieldName}_required`}
                                                            checked={fieldValue === true}
                                                            onChange={() => setFormData({
                                                                ...formData,
                                                                extra_form_fields: {
                                                                    ...formData.extra_form_fields,
                                                                    [fieldName]: true
                                                                }
                                                            })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm">Compulsory</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`${fieldName}_required`}
                                                            checked={fieldValue === undefined || fieldValue === null}
                                                            onChange={() => setFormData({
                                                                ...formData,
                                                                extra_form_fields: {
                                                                    ...formData.extra_form_fields,
                                                                    [fieldName]: undefined as any
                                                                }
                                                            })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm">Hidden</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="config_data">Config Data (JSON, Optional)</Label>
                                <textarea
                                    id="config_data"
                                    value={formData.config_data}
                                    onChange={(e) => setFormData({ ...formData, config_data: e.target.value })}
                                    placeholder='{"key": "value"}'
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={4}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddModal(false)
                                        setEditingTPA(null)
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editingTPA ? 'Update' : 'Create'}
                                </Button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">Bulk Import TPA Mappings</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Paste the JSON response from the hospital insurance mapping API
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="bulk_json">JSON Data</Label>
                                <textarea
                                    id="bulk_json"
                                    value={bulkImportJson}
                                    onChange={(e) => setBulkImportJson(e.target.value)}
                                    placeholder='Paste the full API response JSON here, e.g., {"head": {...}, "body": {"Data": [...]}}'
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    rows={12}
                                />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                                <strong>Expected format:</strong> The JSON should contain a <code>body.Data</code> array
                                with objects containing: <code>hospital_insurance_mapping_id</code>, <code>insurance_id</code>,
                                <code>insurance_type</code>, <code>insurance_name</code>, and <code>ins_code</code>.
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowBulkImportModal(false)
                                        setBulkImportJson('')
                                    }}
                                    disabled={isImporting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleBulkImport}
                                    disabled={isImporting || !bulkImportJson.trim()}
                                >
                                    {isImporting ? 'Importing...' : 'Import Mappings'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Plans Config Tab Component
interface LTPlan {
    plan_id: number
    insurance_mapping_id: number
    plan_no: string | null
    insurance_plan_name: string
    plan_code: string
    insurance_name: string
    auth_expiry_in_days: number
    authorization_limit: string
    contract_name: string
    cm_contract_id: number
    priority_patient_applicable: number
    refer_ltr_reqired_type: string | null
    is_nw_emp_exclude_exist: number
    is_network_deactivated: string
    type_name: string
    class_name: string
    has_top_up: number
}

interface MantysNetwork {
    name: string
    tpa_ins_code: string
}

interface PlanNetworkMapping {
    id: string
    clinic_id: string
    tpa_ins_code: string
    lt_plan_id: number
    lt_plan_name: string
    lt_plan_code: string
    mantys_network_name: string
    is_default?: boolean
}

function PlansConfigTab({ clinicId }: { clinicId: string }) {
    const [plansByTPA, setPlansByTPA] = useState<Record<string, LTPlan[]>>({})
    const [networksByTPA, setNetworksByTPA] = useState<Record<string, MantysNetwork[]>>({})
    const [mappingsByTPA, setMappingsByTPA] = useState<Record<string, PlanNetworkMapping[]>>({})
    const [tpaConfigs, setTpaConfigs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [fetchingTPA, setFetchingTPA] = useState<string | null>(null)
    const [importingTPA, setImportingTPA] = useState<string | null>(null)
    const [showMappingModal, setShowMappingModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [selectedTPA, setSelectedTPA] = useState<string | null>(null)
    const [mappingForm, setMappingForm] = useState({
        lt_plan_id: '',
        mantys_network_names: [] as string[],
        is_default: false
    })
    const [importJson, setImportJson] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({})
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const [defaultDropdownOpen, setDefaultDropdownOpen] = useState<Record<string, boolean>>({})
    const [collapsedTPAs, setCollapsedTPAs] = useState<Record<string, boolean>>({})

    useEffect(() => {
        loadTPAs()
        loadPlans()
        loadNetworks()
        loadMappings()
    }, [clinicId])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Handle TPA dropdowns
            Object.keys(dropdownOpen).forEach((tpaInsCode) => {
                if (dropdownOpen[tpaInsCode] && dropdownRefs.current[tpaInsCode] && !dropdownRefs.current[tpaInsCode]?.contains(event.target as Node)) {
                    setDropdownOpen(prev => ({ ...prev, [tpaInsCode]: false }))
                }
            })

            // Handle default dropdowns
            Object.keys(defaultDropdownOpen).forEach((mappingId) => {
                if (defaultDropdownOpen[mappingId]) {
                    const element = document.querySelector(`[data-default-dropdown="${mappingId}"]`)
                    if (element && !element.contains(event.target as Node)) {
                        setDefaultDropdownOpen(prev => ({ ...prev, [mappingId]: false }))
                    }
                }
            })
        }

        if (Object.values(dropdownOpen).some(open => open) || Object.values(defaultDropdownOpen).some(open => open)) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [dropdownOpen, defaultDropdownOpen])

    const loadTPAs = async () => {
        try {
            const response = await fetch(`/api/clinic-config/tpa?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                const configs = data.configs || []
                setTpaConfigs(configs)
                // Initialize all TPAs as collapsed (closed) by default
                const initialCollapsed: Record<string, boolean> = {}
                configs.forEach((tpa: any) => {
                    if (tpa.ins_code) {
                        initialCollapsed[tpa.ins_code] = true
                    }
                })
                setCollapsedTPAs(initialCollapsed)
            }
        } catch (error) {
            console.error('Failed to load TPAs:', error)
        }
    }

    const loadPlans = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/clinic-config/plans?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                setPlansByTPA(data.plans_by_tpa || {})
            } else if (response.status === 404) {
                setPlansByTPA({})
            }
        } catch (error) {
            console.error('Failed to load plans:', error)
            setPlansByTPA({})
        } finally {
            setIsLoading(false)
        }
    }

    const loadNetworks = async () => {
        try {
            const response = await fetch(`/api/clinic-config/mantys-networks?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                setNetworksByTPA(data.networks_by_tpa || {})
            } else if (response.status === 404) {
                setNetworksByTPA({})
            }
        } catch (error) {
            console.error('Failed to load networks:', error)
            setNetworksByTPA({})
        }
    }

    const loadMappings = async () => {
        try {
            const response = await fetch(`/api/clinic-config/plan-mappings?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                const mappings = data.mappings || []
                // Group mappings by TPA
                const grouped: Record<string, PlanNetworkMapping[]> = {}
                mappings.forEach((m: PlanNetworkMapping) => {
                    if (!grouped[m.tpa_ins_code]) {
                        grouped[m.tpa_ins_code] = []
                    }
                    grouped[m.tpa_ins_code].push(m)
                })
                setMappingsByTPA(grouped)
            }
        } catch (error) {
            console.error('Failed to load mappings:', error)
            setMappingsByTPA({})
        }
    }

    const handleFetchPlansFromAPI = async (tpaInsCode: string) => {
        setFetchingTPA(tpaInsCode)
        try {
            const response = await fetch(
                `/api/clinic-config/plans?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&fetch_from_api=true`
            )

            if (response.ok) {
                const data = await response.json()
                setPlansByTPA(prev => ({
                    ...prev,
                    [tpaInsCode]: data.plans || []
                }))
                alert(`Successfully fetched ${data.record_count || 0} plans for ${tpaInsCode}`)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to fetch plans: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to fetch plans from API:', error)
            alert('Failed to fetch plans from API')
        } finally {
            setFetchingTPA(null)
        }
    }

    const handleImportNetworks = async (tpaInsCode: string) => {
        setImportingTPA(tpaInsCode)
        try {
            const response = await fetch(
                `/api/clinic-config/mantys-networks?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&import_from_mapping=true`
            )

            if (response.ok) {
                const data = await response.json()
                setNetworksByTPA(prev => ({
                    ...prev,
                    [tpaInsCode]: data.networks || []
                }))
                alert(`Successfully imported ${data.record_count || 0} networks for ${tpaInsCode}`)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to import networks: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to import networks:', error)
            alert('Failed to import networks')
        } finally {
            setImportingTPA(null)
        }
    }

    const handleCreateMapping = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTPA) return

        const plan = plansByTPA[selectedTPA]?.find(p => p.plan_id === Number(mappingForm.lt_plan_id))
        if (!plan) {
            alert('Plan not found')
            return
        }

        if (mappingForm.mantys_network_names.length === 0) {
            alert('Please select at least one Mantys network')
            return
        }

        try {
            // Create multiple mappings (many-to-many)
            const promises = mappingForm.mantys_network_names.map((networkName, index) => {
                const isDefault = mappingForm.is_default && index === 0
                return fetch(`/api/clinic-config/plan-mappings?clinic_id=${clinicId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tpa_ins_code: selectedTPA,
                        lt_plan_id: plan.plan_id,
                        lt_plan_name: plan.insurance_plan_name,
                        lt_plan_code: plan.plan_code,
                        mantys_network_name: networkName,
                        is_default: isDefault
                    })
                })
            })

            const results = await Promise.all(promises)
            const errors = results.filter(r => !r.ok)

            if (errors.length > 0) {
                const error = await errors[0].json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to create some mappings: ${error.error || 'Unknown error'}`)
            } else {
                await loadMappings()
                setShowMappingModal(false)
                setMappingForm({ lt_plan_id: '', mantys_network_names: [], is_default: false })
                setSelectedTPA(null)
                alert(`Successfully created ${mappingForm.mantys_network_names.length} mapping(s)`)
            }
        } catch (error) {
            console.error('Failed to create mapping:', error)
            alert('Failed to create mapping')
        }
    }

    const handleSetDefault = async (tpaInsCode: string, mappingId: string) => {
        // Find the mapping to get the network name
        const mapping = mappingsByTPA[tpaInsCode]?.find(m => m.id === mappingId)
        if (!mapping) {
            alert('Mapping not found')
            return
        }

        // Check if there's already a default for this network
        const existingDefault = mappingsByTPA[tpaInsCode]?.find(
            m => m.mantys_network_name === mapping.mantys_network_name && m.is_default && m.id !== mappingId
        )

        if (existingDefault) {
            if (!confirm(`There is already a default mapping for "${mapping.mantys_network_name}" (Plan: ${existingDefault.lt_plan_name}). Setting this as default will replace it. Continue?`)) {
                return
            }
        }

        try {
            const response = await fetch(
                `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}&set_default=true`,
                { method: 'PUT' }
            )

            if (response.ok) {
                await loadMappings()
                alert(`Default mapping set successfully for "${mapping.mantys_network_name}"`)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to set default mapping: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to set default mapping:', error)
            alert('Failed to set default mapping')
        }
    }

    const handleUnsetDefault = async (tpaInsCode: string, mappingId: string) => {
        // Find the mapping to get the network name
        const mapping = mappingsByTPA[tpaInsCode]?.find(m => m.id === mappingId)
        if (!mapping) {
            alert('Mapping not found')
            return
        }

        if (!confirm(`Are you sure you want to unset the default for "${mapping.mantys_network_name}"?`)) {
            return
        }

        try {
            const response = await fetch(
                `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}&unset_default=true`,
                { method: 'PUT' }
            )

            if (response.ok) {
                await loadMappings()
                alert(`Default mapping unset successfully for "${mapping.mantys_network_name}"`)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to unset default mapping: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to unset default mapping:', error)
            alert('Failed to unset default mapping')
        }
    }

    const handleExportPlansTemplate = async (tpaInsCode: string) => {
        try {
            const plansResponse = await fetch(
                `/api/clinic-config/plans?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&export_format=mapping_template`
            )

            if (!plansResponse.ok) {
                alert('Failed to export plans template')
                return
            }

            const plansData = await plansResponse.json()
            const tpaName = getTPAName(tpaInsCode)
            const mappings = mappingsByTPA[tpaInsCode] || []

            // Fetch mappings if they exist
            let mappingsData = null
            if (mappings.length > 0) {
                try {
                    const mappingsResponse = await fetch(
                        `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&export_format=json`
                    )
                    if (mappingsResponse.ok) {
                        mappingsData = await mappingsResponse.json()
                    }
                } catch (error) {
                    console.error('Failed to fetch mappings for export:', error)
                }
            }

            // Create a comprehensive export format with all information
            const exportData = {
                tpa_ins_code: plansData.tpa_ins_code,
                tpa_name: tpaName,
                plans_count: plansData.plans_count,
                available_networks: plansData.available_networks || [],
                instructions: plansData.instructions || [],
                sample_entries: plansData.sample_entries || [],
                template: plansData.template || [],
                expected_return_format: plansData.expected_return_format || {
                    tpa_ins_code: plansData.tpa_ins_code,
                    mappings: mappingsData?.mappings || []
                },
                ...(mappingsData?.mappings && mappingsData.mappings.length > 0 && {
                    current_mappings: mappingsData.mappings
                })
            }

            const jsonString = JSON.stringify(exportData, null, 2)
            const blob = new Blob([jsonString], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `plan-mapping-template-${tpaInsCode}-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)

            // Also copy to clipboard for easy sharing
            const mappingsCount = mappingsData?.mappings?.length || 0
            navigator.clipboard.writeText(jsonString).then(() => {
                alert(`✅ Template exported and copied to clipboard!\n\n📋 TPA: ${tpaName} (${tpaInsCode})\n📊 Plans: ${plansData.plans_count}\n🌐 Available Networks: ${plansData.available_networks?.length || 0}${mappingsCount > 0 ? `\n🔗 Current Mappings: ${mappingsCount}` : ''}\n\nShare this JSON on Slack for mapping.`)
            }).catch(() => {
                alert(`✅ Template exported!\n\n📋 TPA: ${tpaName} (${tpaInsCode})\n📊 Plans: ${plansData.plans_count}\n🌐 Available Networks: ${plansData.available_networks?.length || 0}${mappingsCount > 0 ? `\n🔗 Current Mappings: ${mappingsCount}` : ''}`)
            })
        } catch (error) {
            console.error('Failed to export plans template:', error)
            alert('Failed to export plans template')
        }
    }

    const handleExportMappings = async (tpaInsCode: string, format: 'json' | 'csv') => {
        try {
            const response = await fetch(
                `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&export_format=${format}`
            )

            if (response.ok) {
                if (format === 'json') {
                    const data = await response.json()
                    const blob = new Blob([JSON.stringify(data.mappings, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `plan-mappings-${tpaInsCode}-${Date.now()}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    const blob = await response.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `plan-mappings-${tpaInsCode}-${Date.now()}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                }
            } else {
                alert('Failed to export mappings')
            }
        } catch (error) {
            console.error('Failed to export mappings:', error)
            alert('Failed to export mappings')
        }
    }

    const handleImportMappings = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTPA || !importJson.trim()) return

        try {
            let mappings: PlanNetworkMapping[] = []

            // Try to parse as JSON
            try {
                const parsed = JSON.parse(importJson)
                // Handle different formats:
                // 1. Array of mappings directly
                // 2. Object with mappings array (from expected_return_format)
                // 3. Object with template array (from export - filter empty ones)
                // 4. Object with expected_return_format.mappings
                if (Array.isArray(parsed)) {
                    mappings = parsed
                } else if (parsed.mappings && Array.isArray(parsed.mappings)) {
                    mappings = parsed.mappings
                } else if (parsed.expected_return_format && parsed.expected_return_format.mappings && Array.isArray(parsed.expected_return_format.mappings)) {
                    mappings = parsed.expected_return_format.mappings
                } else if (parsed.template && Array.isArray(parsed.template)) {
                    mappings = parsed.template
                } else {
                    mappings = []
                }

                // Filter out entries without mantys_network_name (empty templates)
                mappings = mappings.filter(m => m.mantys_network_name && m.mantys_network_name.trim() !== '')

                // Validate network names against available networks if provided
                if (parsed.available_networks && Array.isArray(parsed.available_networks)) {
                    const invalidNetworks = mappings.filter(m => !parsed.available_networks.includes(m.mantys_network_name))
                    if (invalidNetworks.length > 0) {
                        const invalidNames = Array.from(new Set(invalidNetworks.map(m => m.mantys_network_name)))
                        alert(`Warning: Some network names don't match available networks:\n${invalidNames.join(', ')}\n\nAvailable networks: ${parsed.available_networks.join(', ')}\n\nProceeding with import, but please verify.`)
                    }
                }

                // Ensure all mappings have the correct tpa_ins_code
                mappings = mappings.map(m => ({
                    ...m,
                    tpa_ins_code: m.tpa_ins_code || selectedTPA
                }))
            } catch {
                // Try to parse as CSV
                const lines = importJson.trim().split('\n')
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
                mappings = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                    const mapping: any = {}
                    headers.forEach((header, index) => {
                        mapping[header] = values[index]
                    })
                    return {
                        tpa_ins_code: selectedTPA,
                        lt_plan_id: Number(mapping.lt_plan_id),
                        lt_plan_name: mapping.lt_plan_name,
                        lt_plan_code: mapping.lt_plan_code,
                        mantys_network_name: mapping.mantys_network_name,
                        is_default: mapping.is_default === 'true' || mapping.is_default === true
                    } as PlanNetworkMapping
                }).filter(m => m.lt_plan_id && m.mantys_network_name && m.mantys_network_name.trim() !== '')
            }

            if (mappings.length === 0) {
                alert('No valid mappings found in the import data. Make sure mantys_network_name fields are filled in.')
                return
            }

            const response = await fetch(`/api/clinic-config/plan-mappings?clinic_id=${clinicId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bulk_import: true,
                    mappings
                })
            })

            if (response.ok) {
                const data = await response.json()
                await loadMappings()
                setShowImportModal(false)
                setImportJson('')
                setSelectedTPA(null)

                let message = `Successfully imported ${data.imported} mapping(s).`
                if (data.errors > 0) {
                    message += ` ${data.errors} error(s).`
                }
                if (data.defaults_fixed > 0) {
                    message += `\n\nNote: ${data.defaults_fixed} duplicate default(s) were automatically fixed (only 1 default allowed per Mantys network).`
                }
                alert(message)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to import mappings: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to import mappings:', error)
            alert('Failed to import mappings. Please check the format.')
        }
    }

    const handleDeleteMapping = async (tpaInsCode: string, mappingId: string) => {
        if (!confirm('Are you sure you want to delete this mapping?')) return

        try {
            const response = await fetch(
                `/api/clinic-config/plan-mappings?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&mapping_id=${mappingId}`,
                { method: 'DELETE' }
            )

            if (response.ok) {
                await loadMappings()
                alert('Mapping deleted successfully')
            } else {
                alert('Failed to delete mapping')
            }
        } catch (error) {
            console.error('Failed to delete mapping:', error)
            alert('Failed to delete mapping')
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading plans and networks...</div>
    }

    // Get TPA names for display
    const getTPAName = (insCode: string) => {
        const tpa = tpaConfigs.find(t => t.ins_code === insCode)
        return tpa?.insurance_name || tpa?.tpa_name || insCode
    }

    const allTPACodes = tpaConfigs.map(t => t.ins_code).filter(Boolean)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                    Manage LT plans, Mantys networks, and create mappings between them. Plans are fetched from Lifetrenz API, networks are imported from the hardcoded mapping.
                </p>
            </div>

            {allTPACodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    <p className="mb-2">No TPAs found.</p>
                    <p className="text-sm">Please configure TPAs first in the TPA Config tab.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {allTPACodes.map((tpaInsCode) => {
                        const plans = plansByTPA[tpaInsCode] || []
                        const networks = networksByTPA[tpaInsCode] || []
                        const mappings = mappingsByTPA[tpaInsCode] || []
                        const tpaName = getTPAName(tpaInsCode)
                        const isFetching = fetchingTPA === tpaInsCode
                        const isImporting = importingTPA === tpaInsCode

                        return (
                            <div key={tpaInsCode} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <button
                                                onClick={() => setCollapsedTPAs(prev => ({ ...prev, [tpaInsCode]: !prev[tpaInsCode] }))}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                aria-label={collapsedTPAs[tpaInsCode] ? 'Expand' : 'Collapse'}
                                            >
                                                <svg
                                                    className={`w-5 h-5 text-gray-600 transition-transform ${collapsedTPAs[tpaInsCode] ? '' : 'rotate-90'}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{tpaName}</h3>
                                                <p className="text-sm text-gray-600 font-mono mt-1">Ins Code: {tpaInsCode}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center flex-wrap">
                                            {/* Show Fetch LT Plans as standalone if no plans exist */}
                                            {plans.length === 0 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleFetchPlansFromAPI(tpaInsCode)}
                                                    disabled={isFetching}
                                                >
                                                    {isFetching ? 'Fetching...' : 'Fetch LT Plans'}
                                                </Button>
                                            )}
                                            {/* Show Import Mantys Networks as standalone if no networks exist */}
                                            {networks.length === 0 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleImportNetworks(tpaInsCode)}
                                                    disabled={isImporting}
                                                >
                                                    {isImporting ? 'Importing...' : 'Import Mantys Networks'}
                                                </Button>
                                            )}
                                            {/* Show Export Plans Template when plans exist */}
                                            {plans.length > 0 && (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleExportPlansTemplate(tpaInsCode)}
                                                        title="Export plans template and mappings to share on Slack"
                                                    >
                                                        Export Plans Template
                                                    </Button>
                                                    {networks.length > 0 && (
                                                        <>
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedTPA(tpaInsCode)
                                                                    setShowMappingModal(true)
                                                                }}
                                                            >
                                                                Create Mapping
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedTPA(tpaInsCode)
                                                                    setShowImportModal(true)
                                                                }}
                                                            >
                                                                Import Mappings
                                                            </Button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {/* Dropdown button - only show if there are items to put in dropdown */}
                                            {(plans.length > 0 || networks.length > 0) && (
                                                <div className="relative" ref={(el) => { dropdownRefs.current[tpaInsCode] = el }}>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setDropdownOpen(prev => ({ ...prev, [tpaInsCode]: !prev[tpaInsCode] }))}
                                                    >
                                                        <svg
                                                            className="w-4 h-4 mr-1"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                                            />
                                                        </svg>
                                                        More
                                                    </Button>
                                                    {dropdownOpen[tpaInsCode] && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                                            <div className="py-1">
                                                                {/* Put Fetch LT Plans in dropdown if plans exist */}
                                                                {plans.length > 0 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleFetchPlansFromAPI(tpaInsCode)
                                                                            setDropdownOpen(prev => ({ ...prev, [tpaInsCode]: false }))
                                                                        }}
                                                                        disabled={isFetching}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        {isFetching ? 'Fetching...' : 'Fetch LT Plans'}
                                                                    </button>
                                                                )}
                                                                {/* Put Import Mantys Networks in dropdown if networks exist */}
                                                                {networks.length > 0 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleImportNetworks(tpaInsCode)
                                                                            setDropdownOpen(prev => ({ ...prev, [tpaInsCode]: false }))
                                                                        }}
                                                                        disabled={isImporting}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        {isImporting ? 'Importing...' : 'Import Mantys Networks'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {!collapsedTPAs[tpaInsCode] && (
                                    <div className="p-6 space-y-6">
                                        {/* LT Plans Section */}
                                        <div>
                                            <h4 className="text-md font-semibold text-gray-900 mb-3">LT Plans ({plans.length})</h4>
                                            {plans.length === 0 ? (
                                                <div className="text-sm text-gray-500 italic">No plans fetched yet. Click "Fetch LT Plans" to load plans from Lifetrenz API.</div>
                                            ) : (
                                                <div className="overflow-x-auto border border-gray-200 rounded">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Plan ID</th>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Plan Name</th>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Plan Code</th>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Class</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {plans.map((plan) => (
                                                                <tr key={plan.plan_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                                    <td className="py-2 px-3 font-mono">{plan.plan_id}</td>
                                                                    <td className="py-2 px-3">{plan.insurance_plan_name}</td>
                                                                    <td className="py-2 px-3 font-mono">{plan.plan_code}</td>
                                                                    <td className="py-2 px-3">{plan.type_name}</td>
                                                                    <td className="py-2 px-3">{plan.class_name}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Mantys Networks Section */}
                                        <div>
                                            <h4 className="text-md font-semibold text-gray-900 mb-3">Mantys Networks ({networks.length})</h4>
                                            {networks.length === 0 ? (
                                                <div className="text-sm text-gray-500 italic">No networks imported yet. Click "Import Mantys Networks" to load networks from the mapping.</div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {networks.map((network, index) => (
                                                        <span
                                                            key={`${network.name}-${index}`}
                                                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                                                        >
                                                            {network.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Mappings Section */}
                                        <div>
                                            <h4 className="text-md font-semibold text-gray-900 mb-3">Plan-Network Mappings ({mappings.length})</h4>
                                            {mappings.length === 0 ? (
                                                <div className="text-sm text-gray-500 italic">No mappings created yet. Create mappings to link LT plans with Mantys networks.</div>
                                            ) : (
                                                <div className="overflow-x-auto border border-gray-200 rounded">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">LT Plan</th>
                                                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Mantys Network</th>
                                                                <th className="text-center py-2 px-3 font-semibold text-gray-700">Default</th>
                                                                <th className="text-right py-2 px-3 font-semibold text-gray-700">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {mappings.map((mapping) => (
                                                                <tr key={mapping.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                                    <td className="py-2 px-3">
                                                                        <div className="font-medium">{mapping.lt_plan_name}</div>
                                                                        <div className="text-xs text-gray-500 font-mono">{mapping.lt_plan_code}</div>
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                                                            {mapping.mantys_network_name}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        {mapping.is_default ? (
                                                                            <div className="relative inline-block" data-default-dropdown={mapping.id}>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        setDefaultDropdownOpen(prev => ({
                                                                                            ...prev,
                                                                                            [mapping.id]: !prev[mapping.id]
                                                                                        }))
                                                                                    }}
                                                                                    className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium hover:bg-green-200 cursor-pointer"
                                                                                >
                                                                                    Default
                                                                                </button>
                                                                                {defaultDropdownOpen[mapping.id] && (
                                                                                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                                                                        <div className="py-1">
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation()
                                                                                                    handleUnsetDefault(tpaInsCode, mapping.id)
                                                                                                    setDefaultDropdownOpen(prev => ({
                                                                                                        ...prev,
                                                                                                        [mapping.id]: false
                                                                                                    }))
                                                                                                }}
                                                                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                                            >
                                                                                                Unset Default
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleSetDefault(tpaInsCode, mapping.id)}
                                                                            >
                                                                                Set Default
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right">
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteMapping(tpaInsCode, mapping.id)}
                                                                        >
                                                                            Delete
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Mapping Modal */}
            {showMappingModal && selectedTPA && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">Create Plan-Network Mapping (Many-to-Many)</h2>
                            <p className="text-sm text-gray-600 mt-1">TPA: {getTPAName(selectedTPA)} ({selectedTPA})</p>
                            <p className="text-xs text-gray-500 mt-1">You can map one LT plan to multiple Mantys networks</p>
                        </div>
                        <form onSubmit={handleCreateMapping} className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="lt_plan_id">LT Plan</Label>
                                <select
                                    id="lt_plan_id"
                                    value={mappingForm.lt_plan_id}
                                    onChange={(e) => setMappingForm({ ...mappingForm, lt_plan_id: e.target.value, mantys_network_names: [] })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select a plan...</option>
                                    {(plansByTPA[selectedTPA] || []).map((plan) => (
                                        <option key={plan.plan_id} value={plan.plan_id}>
                                            {plan.insurance_plan_name} ({plan.plan_code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label htmlFor="mantys_network_names">Mantys Networks (Select Multiple)</Label>
                                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                                    {(networksByTPA[selectedTPA] || []).map((network, index) => (
                                        <label key={`${network.name}-${index}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={mappingForm.mantys_network_names.includes(network.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setMappingForm({
                                                            ...mappingForm,
                                                            mantys_network_names: [...mappingForm.mantys_network_names, network.name]
                                                        })
                                                    } else {
                                                        setMappingForm({
                                                            ...mappingForm,
                                                            mantys_network_names: mappingForm.mantys_network_names.filter(n => n !== network.name)
                                                        })
                                                    }
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">{network.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {mappingForm.mantys_network_names.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Selected: {mappingForm.mantys_network_names.join(', ')}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mappingForm.is_default}
                                        onChange={(e) => setMappingForm({ ...mappingForm, is_default: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">Set first selected network as default (only 1 default allowed per Mantys network)</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6 mt-1">
                                    If a default already exists for that network, it will be replaced.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowMappingModal(false)
                                        setMappingForm({ lt_plan_id: '', mantys_network_names: [], is_default: false })
                                        setSelectedTPA(null)
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={mappingForm.mantys_network_names.length === 0}>
                                    Create {mappingForm.mantys_network_names.length > 0 ? `${mappingForm.mantys_network_names.length} ` : ''}Mapping(s)
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Mappings Modal */}
            {showImportModal && selectedTPA && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">Import Plan-Network Mappings</h2>
                            <p className="text-sm text-gray-600 mt-1">TPA: {getTPAName(selectedTPA)} ({selectedTPA})</p>
                            <div className="text-xs text-gray-500 mt-2 space-y-1">
                                <p><strong>Paste JSON data from Slack.</strong> Supports multiple formats:</p>
                                <ul className="list-disc list-inside ml-2 space-y-1">
                                    <li>Full exported template with <code>{"mappings"}</code> array filled in</li>
                                    <li>Object with <code>{"expected_return_format.mappings"}</code> array</li>
                                    <li>Direct array of mappings: <code>[{"{..."}]</code></li>
                                </ul>
                                <p className="mt-2"><strong>Expected format:</strong></p>
                                <code className="block bg-gray-100 p-2 rounded text-xs mt-1">
                                    {'{'}"mappings": [{'{'}"lt_plan_id": 123, "lt_plan_name": "...", "mantys_network_name": "...", "is_default": false{'}'}]{'}'}
                                </code>
                            </div>
                        </div>
                        <form onSubmit={handleImportMappings} className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="import_json">Import Data (JSON or CSV)</Label>
                                <textarea
                                    id="import_json"
                                    value={importJson}
                                    onChange={(e) => setImportJson(e.target.value)}
                                    placeholder='Paste JSON array or CSV data here...'
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    rows={12}
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowImportModal(false)
                                        setImportJson('')
                                        setSelectedTPA(null)
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={!importJson.trim()}>
                                    Import Mappings
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// Payer Config Tab Component
interface LTPayer {
    ins_tpaid: number
    ins_tpa_name: string
    ins_tpa_code: string
    ins_tpa_type: number
    reciver_payer_map_id: number
    reciever_payer_id: number
}

function PayerConfigTab({ clinicId }: { clinicId: string }) {
    const [payersByTPA, setPayersByTPA] = useState<Record<string, LTPayer[]>>({})
    const [tpaConfigs, setTpaConfigs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [fetchingTPA, setFetchingTPA] = useState<string | null>(null)
    const [collapsedTPAs, setCollapsedTPAs] = useState<Record<string, boolean>>({})

    useEffect(() => {
        loadTPAs()
        loadPayers()
    }, [clinicId])

    const loadTPAs = async () => {
        try {
            const response = await fetch(`/api/clinic-config/tpa?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                const configs = data.configs || []
                setTpaConfigs(configs)
                // Initialize all TPAs as collapsed (closed) by default
                const initialCollapsed: Record<string, boolean> = {}
                configs.forEach((tpa: any) => {
                    if (tpa.ins_code) {
                        initialCollapsed[tpa.ins_code] = true
                    }
                })
                setCollapsedTPAs(initialCollapsed)
            }
        } catch (error) {
            console.error('Failed to load TPAs:', error)
        }
    }

    const loadPayers = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/clinic-config/payers?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                setPayersByTPA(data.payers_by_tpa || {})
            } else if (response.status === 404) {
                setPayersByTPA({})
            }
        } catch (error) {
            console.error('Failed to load payers:', error)
            setPayersByTPA({})
        } finally {
            setIsLoading(false)
        }
    }

    const handleFetchFromAPI = async (tpaInsCode: string) => {
        setFetchingTPA(tpaInsCode)
        try {
            const response = await fetch(
                `/api/clinic-config/payers?clinic_id=${clinicId}&tpa_ins_code=${tpaInsCode}&fetch_from_api=true`
            )

            if (response.ok) {
                const data = await response.json()
                // Update the payers for this TPA
                setPayersByTPA(prev => ({
                    ...prev,
                    [tpaInsCode]: data.payers || []
                }))
                alert(`Successfully fetched ${data.record_count || 0} payers for ${tpaInsCode}`)
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }))
                alert(`Failed to fetch payers: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to fetch payers from API:', error)
            alert('Failed to fetch payers from API')
        } finally {
            setFetchingTPA(null)
        }
    }

    const handleDeletePayers = async (tpaInsCode: string) => {
        if (!confirm(`Are you sure you want to delete all payers for ${tpaInsCode}?`)) return

        try {
            const response = await fetch(
                `/api/clinic-config/payers/${tpaInsCode}?clinic_id=${clinicId}`,
                { method: 'DELETE' }
            )

            if (response.ok) {
                // Remove from state
                setPayersByTPA(prev => {
                    const updated = { ...prev }
                    delete updated[tpaInsCode]
                    return updated
                })
                alert('Payers deleted successfully')
            } else {
                alert('Failed to delete payers')
            }
        } catch (error) {
            console.error('Failed to delete payers:', error)
            alert('Failed to delete payers')
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading payers...</div>
    }

    // Get TPA names for display
    const getTPAName = (insCode: string) => {
        const tpa = tpaConfigs.find(t => t.ins_code === insCode)
        return tpa?.insurance_name || tpa?.tpa_name || insCode
    }

    const tpaCodesWithPayers = Object.keys(payersByTPA)
    const allTPACodesSet = new Set([...tpaCodesWithPayers, ...tpaConfigs.map(t => t.ins_code).filter(Boolean)])
    const allTPACodes = Array.from(allTPACodesSet)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                    Manage Lifetrenz payers for each TPA. Payers are fetched from the Lifetrenz API and stored per TPA.
                </p>
            </div>

            {allTPACodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    <p className="mb-2">No TPAs found.</p>
                    <p className="text-sm">Please configure TPAs first in the TPA Config tab.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {allTPACodes.map((tpaInsCode) => {
                        const payers = payersByTPA[tpaInsCode] || []
                        const tpaName = getTPAName(tpaInsCode)
                        const isFetching = fetchingTPA === tpaInsCode

                        return (
                            <div key={tpaInsCode} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <button
                                                onClick={() => setCollapsedTPAs(prev => ({ ...prev, [tpaInsCode]: !prev[tpaInsCode] }))}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                aria-label={collapsedTPAs[tpaInsCode] ? 'Expand' : 'Collapse'}
                                            >
                                                <svg
                                                    className={`w-5 h-5 text-gray-600 transition-transform ${collapsedTPAs[tpaInsCode] ? '' : 'rotate-90'}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{tpaName}</h3>
                                                <p className="text-sm text-gray-600 font-mono mt-1">Ins Code: {tpaInsCode}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleFetchFromAPI(tpaInsCode)}
                                                disabled={isFetching}
                                            >
                                                {isFetching ? 'Fetching...' : 'Fetch from API'}
                                            </Button>
                                            {payers.length > 0 && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeletePayers(tpaInsCode)}
                                                >
                                                    Delete All
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {!collapsedTPAs[tpaInsCode] && (
                                    <>
                                        {payers.length === 0 ? (
                                            <div className="px-6 py-8 text-center text-gray-500">
                                                <p className="mb-2">No payers configured for this TPA.</p>
                                                <p className="text-sm">Click "Fetch from API" to load payers from Lifetrenz.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Payer ID</th>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Payer Name</th>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Payer Code</th>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Mapping ID</th>
                                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Receiver Payer ID</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {payers.map((payer, index) => (
                                                            <tr key={`${payer.ins_tpaid}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                                                                <td className="py-3 px-4 font-mono text-sm">{payer.ins_tpaid}</td>
                                                                <td className="py-3 px-4">{payer.ins_tpa_name}</td>
                                                                <td className="py-3 px-4 font-mono text-sm">{payer.ins_tpa_code}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`px-2 py-1 rounded text-xs ${payer.ins_tpa_type === 1
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : 'bg-green-100 text-green-800'
                                                                        }`}>
                                                                        {payer.ins_tpa_type === 1 ? 'Insurance' : 'TPA'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 font-mono text-sm text-gray-600">{payer.reciver_payer_map_id}</td>
                                                                <td className="py-3 px-4 font-mono text-sm text-gray-600">{payer.reciever_payer_id}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// Doctors Config Tab Component
function DoctorsConfigTab({ clinicId }: { clinicId: string }) {
    const [doctors, setDoctors] = useState<DoctorConfig[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingDoctor, setEditingDoctor] = useState<DoctorConfig | null>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importJson, setImportJson] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
    const [specialisationsMapping, setSpecialisationsMapping] = useState<Record<string, string>>({})
    const [formData, setFormData] = useState({
        doctor_id: '',
        doctor_name: '',
        doctor_code: '',
        specialization: '',
        lt_user_id: '',
        dha_id: '',
        moh_id: '',
        lt_role_id: '',
        lt_specialisation_id: ''
    })

    useEffect(() => {
        loadDoctors()
        loadSpecialisations()
    }, [clinicId])

    const loadSpecialisations = async () => {
        try {
            const response = await fetch('/api/clinic-config/specialisations')
            if (response.ok) {
                const data = await response.json()
                setSpecialisationsMapping(data.mapping || {})
            }
        } catch (error) {
            console.error('Failed to load specialisations:', error)
        }
    }

    const loadDoctors = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/clinic-config/doctors?clinic_id=${clinicId}`)
            if (response.ok) {
                const data = await response.json()
                setDoctors(data.configs || [])
            }
        } catch (error) {
            console.error('Failed to load doctors:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const method = editingDoctor ? 'PUT' : 'POST'
            const url = editingDoctor
                ? `/api/clinic-config/doctors/${editingDoctor.doctor_id}`
                : '/api/clinic-config/doctors'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    clinic_id: clinicId
                })
            })

            if (response.ok) {
                await loadDoctors()
                setShowAddModal(false)
                setEditingDoctor(null)
                setFormData({
                    doctor_id: '',
                    doctor_name: '',
                    doctor_code: '',
                    specialization: '',
                    lt_user_id: '',
                    dha_id: '',
                    moh_id: '',
                    lt_role_id: '',
                    lt_specialisation_id: ''
                })
            } else {
                alert('Failed to save doctor')
            }
        } catch (error) {
            console.error('Failed to save doctor:', error)
            alert('Failed to save doctor')
        }
    }

    const handleEdit = (doctor: DoctorConfig) => {
        setEditingDoctor(doctor)
        setFormData({
            doctor_id: doctor.doctor_id,
            doctor_name: doctor.doctor_name,
            doctor_code: doctor.doctor_code || '',
            specialization: doctor.specialization || '',
            lt_user_id: doctor.lt_user_id || '',
            dha_id: doctor.dha_id || '',
            moh_id: doctor.moh_id || '',
            lt_role_id: doctor.lt_role_id || '',
            lt_specialisation_id: doctor.lt_specialisation_id || ''
        })
        setShowAddModal(true)
    }

    const handleDelete = async (doctorId: string) => {
        if (!confirm('Are you sure you want to delete this doctor?')) return

        try {
            const response = await fetch(`/api/clinic-config/doctors/${doctorId}?clinic_id=${clinicId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await loadDoctors()
            } else {
                alert('Failed to delete doctor')
            }
        } catch (error) {
            console.error('Failed to delete doctor:', error)
            alert('Failed to delete doctor')
        }
    }

    const handleBulkImport = async () => {
        if (!importJson.trim()) {
            alert('Please paste the JSON data')
            return
        }

        setIsImporting(true)
        setImportProgress({ success: 0, failed: 0, total: 0 })

        try {
            const parsed = JSON.parse(importJson)

            // Extract doctors from the response structure
            const doctorsData = parsed?.body?.Data || parsed?.Data || []

            if (!Array.isArray(doctorsData) || doctorsData.length === 0) {
                alert('No doctor data found in JSON. Expected format: { body: { Data: [...] } }')
                setIsImporting(false)
                return
            }

            setImportProgress({ success: 0, failed: 0, total: doctorsData.length })

            let successCount = 0
            let failedCount = 0

            // Process each doctor
            for (const doctorData of doctorsData) {
                try {
                    // Map fields from JSON to our format
                    const doctorId = String(doctorData.user_id || doctorData.userId || '')
                    const doctorName = doctorData.full_name || doctorData.fullName || ''
                    const ltUserId = String(doctorData.user_id || doctorData.userId || '')
                    const ltRoleId = String(doctorData.role_id || doctorData.roleId || '')
                    const ltSpecialisationId = String(doctorData.specialisation_id || doctorData.specialisationId || '')

                    if (!doctorId || !doctorName) {
                        failedCount++
                        continue
                    }

                    // Check if doctor already exists by doctor_id or lt_user_id
                    const existingDoctor = doctors.find(d =>
                        d.doctor_id === doctorId || d.lt_user_id === ltUserId
                    )
                    const method = existingDoctor ? 'PUT' : 'POST'
                    const url = existingDoctor
                        ? `/api/clinic-config/doctors/${existingDoctor.doctor_id}`
                        : '/api/clinic-config/doctors'

                    const response = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            doctor_id: doctorId,
                            doctor_name: doctorName,
                            doctor_code: '',
                            specialization: '',
                            lt_user_id: ltUserId,
                            dha_id: '',
                            moh_id: '',
                            lt_role_id: ltRoleId,
                            lt_specialisation_id: ltSpecialisationId,
                            clinic_id: clinicId
                        })
                    })

                    if (response.ok) {
                        successCount++
                    } else {
                        failedCount++
                    }

                    setImportProgress({ success: successCount, failed: failedCount, total: doctorsData.length })
                } catch (error) {
                    console.error('Failed to import doctor:', error)
                    failedCount++
                    setImportProgress({ success: successCount, failed: failedCount, total: doctorsData.length })
                }
            }

            // Reload doctors list
            await loadDoctors()

            alert(`Import completed: ${successCount} succeeded, ${failedCount} failed`)

            if (successCount > 0) {
                setShowImportModal(false)
                setImportJson('')
            }
        } catch (error) {
            console.error('Failed to parse JSON:', error)
            alert('Invalid JSON format. Please check the data and try again.')
        } finally {
            setIsImporting(false)
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading doctors...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                    Manage doctor configurations and mappings
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                        setShowImportModal(true)
                        setImportJson('')
                        setImportProgress({ success: 0, failed: 0, total: 0 })
                    }}>
                        Bulk Import
                    </Button>
                    <Button onClick={() => {
                        setEditingDoctor(null)
                        setFormData({
                            doctor_id: '',
                            doctor_name: '',
                            doctor_code: '',
                            specialization: '',
                            lt_user_id: '',
                            dha_id: '',
                            moh_id: '',
                            lt_role_id: '',
                            lt_specialisation_id: ''
                        })
                        setShowAddModal(true)
                    }}>
                        Add Doctor
                    </Button>
                </div>
            </div>

            {doctors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No doctors found. Click "Add Doctor" to create one.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Doctor ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Doctor Code</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Specialization</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">LT User ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">DHA ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">MOH ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">LT Role ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">LT Specialisation ID</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.map((doctor) => (
                                <tr key={doctor.doctor_id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 font-mono text-sm">{doctor.doctor_id}</td>
                                    <td className="py-3 px-4">{doctor.doctor_name}</td>
                                    <td className="py-3 px-4 text-sm">{doctor.doctor_code || '-'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{doctor.specialization || '-'}</td>
                                    <td className="py-3 px-4 text-sm font-mono">{doctor.lt_user_id || '-'}</td>
                                    <td className="py-3 px-4 text-sm font-mono">{doctor.dha_id || '-'}</td>
                                    <td className="py-3 px-4 text-sm font-mono">{doctor.moh_id || '-'}</td>
                                    <td className="py-3 px-4 text-sm font-mono">{doctor.lt_role_id || '-'}</td>
                                    <td className="py-3 px-4 text-sm font-mono">
                                        {doctor.lt_specialisation_id
                                            ? `${doctor.lt_specialisation_id}${specialisationsMapping[doctor.lt_specialisation_id] ? ` (${specialisationsMapping[doctor.lt_specialisation_id]})` : ''}`
                                            : '-'
                                        }
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(doctor)}>
                                                Edit
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(doctor.doctor_id)}>
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                            <h2 className="text-xl font-semibold">
                                {editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div>
                                    <Label htmlFor="doctor_id">Doctor ID</Label>
                                    <Input
                                        id="doctor_id"
                                        value={formData.doctor_id}
                                        onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                                        placeholder="e.g., DOC001"
                                        required
                                        disabled={!!editingDoctor}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="doctor_name">Doctor Name</Label>
                                    <Input
                                        id="doctor_name"
                                        value={formData.doctor_name}
                                        onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                                        placeholder="e.g., Dr. Ahmed Khan"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="doctor_code">Doctor Code (Optional)</Label>
                                    <Input
                                        id="doctor_code"
                                        value={formData.doctor_code}
                                        onChange={(e) => setFormData({ ...formData, doctor_code: e.target.value })}
                                        placeholder="Doctor code"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="specialization">Specialization (Optional)</Label>
                                    <Input
                                        id="specialization"
                                        value={formData.specialization}
                                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                        placeholder="e.g., Cardiology, Pediatrics"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="lt_user_id">Lifetrenz User ID (Optional)</Label>
                                    <Input
                                        id="lt_user_id"
                                        value={formData.lt_user_id}
                                        onChange={(e) => setFormData({ ...formData, lt_user_id: e.target.value })}
                                        placeholder="Lifetrenz user ID"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="dha_id">DHA ID (Optional)</Label>
                                    <Input
                                        id="dha_id"
                                        value={formData.dha_id}
                                        onChange={(e) => setFormData({ ...formData, dha_id: e.target.value })}
                                        placeholder="DHA ID"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="moh_id">MOH ID (Optional)</Label>
                                    <Input
                                        id="moh_id"
                                        value={formData.moh_id}
                                        onChange={(e) => setFormData({ ...formData, moh_id: e.target.value })}
                                        placeholder="MOH ID"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="lt_role_id">Lifetrenz Role ID (Optional)</Label>
                                    <Input
                                        id="lt_role_id"
                                        value={formData.lt_role_id}
                                        onChange={(e) => setFormData({ ...formData, lt_role_id: e.target.value })}
                                        placeholder="Lifetrenz role ID"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="lt_specialisation_id">Lifetrenz Specialisation (Optional)</Label>
                                    <select
                                        id="lt_specialisation_id"
                                        value={formData.lt_specialisation_id}
                                        onChange={(e) => setFormData({ ...formData, lt_specialisation_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Specialisation</option>
                                        {Object.entries(specialisationsMapping).map(([id, name]) => (
                                            <option key={id} value={id}>
                                                {id} - {name}
                                            </option>
                                        ))}
                                    </select>
                                    {formData.lt_specialisation_id && !specialisationsMapping[formData.lt_specialisation_id] && (
                                        <div className="mt-1">
                                            <Input
                                                value={formData.lt_specialisation_id}
                                                onChange={(e) => setFormData({ ...formData, lt_specialisation_id: e.target.value })}
                                                placeholder="Or enter custom ID"
                                                className="mt-1"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 px-6 pb-6 border-t border-gray-200 flex-shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddModal(false)
                                        setEditingDoctor(null)
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editingDoctor ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">Bulk Import Doctors</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Paste the JSON response from Lifetrenz API
                            </p>
                        </div>
                        <div className="p-6 flex-1 overflow-hidden flex flex-col">
                            <div className="flex-1 mb-4">
                                <Label htmlFor="import_json">JSON Data</Label>
                                <textarea
                                    id="import_json"
                                    value={importJson}
                                    onChange={(e) => setImportJson(e.target.value)}
                                    placeholder="Paste JSON here..."
                                    className="w-full h-full min-h-[300px] p-3 border border-gray-300 rounded-md font-mono text-sm resize-none"
                                    disabled={isImporting}
                                />
                            </div>

                            {isImporting && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <div className="text-sm text-blue-800">
                                        Importing... {importProgress.success + importProgress.failed} / {importProgress.total}
                                    </div>
                                    <div className="mt-2 text-xs text-blue-600">
                                        Success: {importProgress.success} | Failed: {importProgress.failed}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowImportModal(false)
                                        setImportJson('')
                                        setImportProgress({ success: 0, failed: 0, total: 0 })
                                    }}
                                    disabled={isImporting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleBulkImport}
                                    disabled={isImporting || !importJson.trim()}
                                >
                                    {isImporting ? 'Importing...' : 'Import'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Specialisations Config Tab Component
function SpecialisationsConfigTab() {
    const [specialisations, setSpecialisations] = useState<Array<{ specialisation_id: string; specialisation_name: string }>>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importJson, setImportJson] = useState('')
    const [isImporting, setIsImporting] = useState(false)

    useEffect(() => {
        loadSpecialisations()
    }, [])

    const loadSpecialisations = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/clinic-config/specialisations')
            if (response.ok) {
                const data = await response.json()
                setSpecialisations(data.specialisations || [])
            }
        } catch (error) {
            console.error('Failed to load specialisations:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleImport = async () => {
        if (!importJson.trim()) {
            alert('Please paste the JSON data')
            return
        }

        setIsImporting(true)
        try {
            const parsed = JSON.parse(importJson)

            const response = await fetch('/api/clinic-config/specialisations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            })

            if (response.ok) {
                await loadSpecialisations()
                setShowImportModal(false)
                setImportJson('')
                alert('Specialisations imported successfully')
            } else {
                const error = await response.json()
                alert(`Failed to import: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to parse JSON:', error)
            alert('Invalid JSON format. Please check the data and try again.')
        } finally {
            setIsImporting(false)
        }
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading specialisations...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                    Manage specialisation mappings from Lifetrenz. These are used to display specialisation names in doctor records.
                </p>
                <Button variant="outline" onClick={() => {
                    setShowImportModal(true)
                    setImportJson('')
                }}>
                    Import Specialisations
                </Button>
            </div>

            {specialisations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No specialisations found. Click "Import Specialisations" to import from JSON.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Specialisation ID</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Specialisation Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {specialisations.map((spec) => (
                                <tr key={spec.specialisation_id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4 font-mono text-sm">{spec.specialisation_id}</td>
                                    <td className="py-3 px-4">{spec.specialisation_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold">Import Specialisations</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Paste the JSON response from Lifetrenz API
                            </p>
                        </div>
                        <div className="p-6 flex-1 overflow-hidden flex flex-col">
                            <div className="flex-1 mb-4">
                                <Label htmlFor="import_json">JSON Data</Label>
                                <textarea
                                    id="import_json"
                                    value={importJson}
                                    onChange={(e) => setImportJson(e.target.value)}
                                    placeholder="Paste JSON here..."
                                    className="w-full h-full min-h-[300px] p-3 border border-gray-300 rounded-md font-mono text-sm resize-none"
                                    disabled={isImporting}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowImportModal(false)
                                        setImportJson('')
                                    }}
                                    disabled={isImporting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={isImporting || !importJson.trim()}
                                >
                                    {isImporting ? 'Importing...' : 'Import'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

