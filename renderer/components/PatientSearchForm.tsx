import React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { SearchType } from '../types/dashboard'

interface PatientSearchFormProps {
    searchType: SearchType
    searchValue: string
    isSearching: boolean
    onSearchTypeChange: (type: SearchType) => void
    onSearchValueChange: (value: string) => void
    onSubmit: (e: React.FormEvent) => void
    onClear: () => void
}

export const PatientSearchForm: React.FC<PatientSearchFormProps> = ({
    searchType,
    searchValue,
    isSearching,
    onSearchTypeChange,
    onSearchValueChange,
    onSubmit,
    onClear,
}) => {
    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {/* Search Type Selection */}
            <div className="space-y-3">
                <Label className="text-base">Search By</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => onSearchTypeChange('phoneNumber')}
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
                    <button
                        type="button"
                        onClick={() => onSearchTypeChange('mpi')}
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
                    onChange={(e) => onSearchValueChange(e.target.value)}
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
                    onClick={onClear}
                    disabled={isSearching}
                >
                    Clear
                </Button>
            </div>
        </form>
    )
}

