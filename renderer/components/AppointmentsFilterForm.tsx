import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "../contexts/AuthContext";
import { cachedFetch } from "../lib/request-cache";

export interface AppointmentFilters {
    // Date filters
    fromDate: string;
    toDate: string;
    isFilterDate: number;

    // Patient filters
    patientName: string | null;
    mpi: string | null;
    phoneNumber: string | null;
    displayEncounterNumber: string | null;

    // Appointment filters
    appStatusId: string;
    physicianId: number | null;
    visitTypeId: number | null;
    specialisationId: number | null;
    roomId: number | null;

    // Payer filters
    payerId: number | null;
    payerTypeId: number | null;
    insuranceType: string | null;

    // Other filters
    customerSiteId: number;
    encounterType: number;
    visitPurposeId: number | null;

    // Pagination
    pageNo: number;
    recPerPage: number;
}

interface AppointmentsFilterFormProps {
    onSearch: (filters: AppointmentFilters) => void;
    onClear: () => void;
    onRefresh: () => void;
    isLoading?: boolean;
}

export const AppointmentsFilterForm: React.FC<AppointmentsFilterFormProps> = ({
    onSearch,
    onClear,
    onRefresh,
    isLoading = false,
}) => {
    // Get today's date in YYYY-MM-DD format for date input
    const getTodayFormatted = () => {
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const year = today.getFullYear();
        return `${month}/${day}/${year}`;
    };

    const getTodayInputFormat = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [filters, setFilters] = useState<AppointmentFilters>({
        fromDate: getTodayFormatted(),
        toDate: getTodayFormatted(),
        isFilterDate: 1,
        patientName: null,
        mpi: null,
        phoneNumber: null,
        displayEncounterNumber: null,
        appStatusId: "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27", // All statuses
        physicianId: null,
        visitTypeId: null,
        specialisationId: null,
        roomId: null,
        payerId: null,
        payerTypeId: null,
        insuranceType: null,
        customerSiteId: 31,
        encounterType: 1,
        visitPurposeId: null,
        pageNo: 0,
        recPerPage: 200,
    });

    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Doctors from clinic-config
    const { user } = useAuth();
    const selectedClinicId = user?.selected_team_id || null;
    const [doctorsList, setDoctorsList] = useState<any[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

    // Load doctors from clinic-config
    useEffect(() => {
        if (!selectedClinicId) {
            setDoctorsList([]);
            return;
        }

        // Reset doctors list when clinic changes
        setDoctorsList([]);

        let isCancelled = false;

        const loadDoctors = async () => {
            setIsLoadingDoctors(true);
            try {
                const response = await cachedFetch(`/api/clinic-config/doctors?clinic_id=${selectedClinicId}`);
                if (response.ok && !isCancelled) {
                    const data = await response.json();
                    setDoctorsList(data.configs || []);
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error("Failed to load doctors:", error);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingDoctors(false);
                }
            }
        };

        loadDoctors();

        return () => {
            isCancelled = true;
        };
    }, [selectedClinicId]);

    const handleInputChange = (field: keyof AppointmentFilters, value: any) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value === "" ? null : value,
        }));
    };

    // Convert YYYY-MM-DD to MM/DD/YYYY
    const convertDateFormat = (dateStr: string) => {
        if (!dateStr) return getTodayFormatted();
        const [year, month, day] = dateStr.split('-');
        return `${month}/${day}/${year}`;
    };

    // Convert MM/DD/YYYY to YYYY-MM-DD
    const convertToInputFormat = (dateStr: string) => {
        if (!dateStr) return getTodayInputFormat();
        const [month, day, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const handleDateChange = (field: 'fromDate' | 'toDate', value: string) => {
        const formattedDate = convertDateFormat(value);
        setFilters((prev) => ({
            ...prev,
            [field]: formattedDate,
        }));
    };

    const handleSearch = () => {
        onSearch(filters);
    };

    const handleClear = () => {
        const clearedFilters: AppointmentFilters = {
            fromDate: getTodayFormatted(),
            toDate: getTodayFormatted(),
            isFilterDate: 1,
            patientName: null,
            mpi: null,
            phoneNumber: null,
            displayEncounterNumber: null,
            appStatusId: "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27",
            physicianId: null,
            visitTypeId: null,
            specialisationId: null,
            roomId: null,
            payerId: null,
            payerTypeId: null,
            insuranceType: null,
            customerSiteId: 31,
            encounterType: 1,
            visitPurposeId: null,
            pageNo: 0,
            recPerPage: 200,
        };
        setFilters(clearedFilters);
        onClear();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // Appointment status options
    const statusOptions = [
        { value: "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27", label: "All Statuses" },
        { value: "16", label: "Open" },
        { value: "3", label: "Arrived" },
        { value: "8", label: "Cancelled" },
        { value: "11", label: "Pending Reconcilation" },
        { value: "17", label: "Ready to Bill" },
        { value: "18", label: "Billed" },
        { value: "21", label: "Nursing" },
        { value: "24", label: "Not Conducted" },
        { value: "6", label: "Confirmed" },
        { value: "7", label: "In Progress" },
        { value: "15", label: "Completed" },
        { value: "22", label: "Approved" },
        { value: "23", label: "No Show" },
        { value: "25", label: "Walk In" },
        { value: "26", label: "On Hold" },
        { value: "27", label: "Ready" },
    ];

    // Encounter type options
    const encounterTypeOptions = [
        { value: 1, label: "All Appointments" },
        { value: 2, label: "Outpatient" },
        { value: 3, label: "Inpatient" },
        { value: 4, label: "Emergency" },
    ];

    // Payer type options
    const payerTypeOptions = [
        { value: null, label: "All Payer Types" },
        { value: 1, label: "Insurance" },
        { value: 2, label: "Corporate" },
        { value: 3, label: "Credit" },
        { value: 4, label: "Self Pay" },
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            {/* Main Filters - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fromDate" className="text-sm font-medium">
                        From Date
                    </Label>
                    <Input
                        id="fromDate"
                        type="date"
                        value={convertToInputFormat(filters.fromDate)}
                        onChange={(e) => handleDateChange("fromDate", e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="toDate" className="text-sm font-medium">
                        To Date
                    </Label>
                    <Input
                        id="toDate"
                        type="date"
                        value={convertToInputFormat(filters.toDate)}
                        onChange={(e) => handleDateChange("toDate", e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-sm font-medium">
                        Mobile Phone
                    </Label>
                    <Input
                        id="phoneNumber"
                        type="text"
                        placeholder="Phone number"
                        value={filters.phoneNumber || ""}
                        onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="mpi" className="text-sm font-medium">
                        MPI
                    </Label>
                    <Input
                        id="mpi"
                        type="text"
                        placeholder="Patient MPI"
                        value={filters.mpi || ""}
                        onChange={(e) => handleInputChange("mpi", e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="patientName" className="text-sm font-medium">
                        Patient Name
                    </Label>
                    <Input
                        id="patientName"
                        type="text"
                        placeholder="Enter patient name"
                        value={filters.patientName || ""}
                        onChange={(e) => handleInputChange("patientName", e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="appStatus" className="text-sm font-medium">
                        Appointment Status
                    </Label>
                    <select
                        id="appStatus"
                        value={filters.appStatusId}
                        onChange={(e) => handleInputChange("appStatusId", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="physicianId" className="text-sm font-medium">
                        Physician
                    </Label>
                    <select
                        id="physicianId"
                        value={filters.physicianId || ""}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Convert doctor_id (string) to number for physicianId
                            const physicianId = value ? Number(value) : null;
                            handleInputChange("physicianId", physicianId);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoadingDoctors}
                    >
                        <option value="">All Physicians</option>
                        {doctorsList.map((doctor) => {
                            // Try to convert doctor_id to number, fallback to lt_user_id if available
                            const doctorIdNum = doctor.doctor_id ? Number(doctor.doctor_id) : null;
                            const ltUserIdNum = doctor.lt_user_id ? Number(doctor.lt_user_id) : null;
                            const physicianId = doctorIdNum || ltUserIdNum;

                            if (!physicianId || isNaN(physicianId)) {
                                return null; // Skip doctors without valid numeric IDs
                            }

                            return (
                                <option key={doctor.doctor_id} value={physicianId}>
                                    {doctor.doctor_name} {doctor.doctor_code ? `(${doctor.doctor_code})` : ""}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            {/* Advanced Filters Toggle */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    <svg
                        className={`w-4 h-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                    {showAdvancedFilters ? "Hide" : "Show"} Advanced Filters
                </button>
            </div>

            {/* Advanced Filters - Collapsible */}
            {showAdvancedFilters && (
                <div className="space-y-4 pt-2 border-t border-gray-200">
                    {/* First Row - Encounter #, Payer Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="encounterNumber" className="text-sm font-medium">
                                Encounter #
                            </Label>
                            <Input
                                id="encounterNumber"
                                type="text"
                                placeholder="Encounter number"
                                value={filters.displayEncounterNumber || ""}
                                onChange={(e) =>
                                    handleInputChange("displayEncounterNumber", e.target.value)
                                }
                                onKeyPress={handleKeyPress}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="payerType" className="text-sm font-medium">
                                Payer
                            </Label>
                            <select
                                id="payerType"
                                value={filters.payerTypeId || ""}
                                onChange={(e) =>
                                    handleInputChange(
                                        "payerTypeId",
                                        e.target.value ? Number(e.target.value) : null
                                    )
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {payerTypeOptions.map((option) => (
                                    <option key={option.value || "all"} value={option.value || ""}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="visitTypeId" className="text-sm font-medium">
                                Visit Type ID
                            </Label>
                            <Input
                                id="visitTypeId"
                                type="number"
                                placeholder="Visit Type ID"
                                value={filters.visitTypeId || ""}
                                onChange={(e) =>
                                    handleInputChange(
                                        "visitTypeId",
                                        e.target.value ? Number(e.target.value) : null
                                    )
                                }
                                onKeyPress={handleKeyPress}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="roomId" className="text-sm font-medium">
                                Room ID
                            </Label>
                            <Input
                                id="roomId"
                                type="number"
                                placeholder="Room ID"
                                value={filters.roomId || ""}
                                onChange={(e) =>
                                    handleInputChange(
                                        "roomId",
                                        e.target.value ? Number(e.target.value) : null
                                    )
                                }
                                onKeyPress={handleKeyPress}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Second Row - Encounter Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="encounterType" className="text-sm font-medium">
                                Appointment Level
                            </Label>
                            <select
                                id="encounterType"
                                value={filters.encounterType}
                                onChange={(e) =>
                                    handleInputChange("encounterType", Number(e.target.value))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {encounterTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
                <Button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin mr-2">⏳</span>
                            Searching...
                        </>
                    ) : (
                        <>
                            <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            Search
                        </>
                    )}
                </Button>

                <Button
                    onClick={handleClear}
                    disabled={isLoading}
                    variant="outline"
                    className="px-6"
                >
                    <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                    Clear
                </Button>

                <Button
                    onClick={onRefresh}
                    disabled={isLoading}
                    variant="outline"
                    className="px-6"
                >
                    <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    Refresh
                </Button>

                <Button
                    onClick={() => window.print()}
                    disabled={isLoading}
                    variant="outline"
                    className="px-6"
                >
                    <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                    </svg>
                    Print Options
                </Button>
            </div>
        </div>
    );
};

