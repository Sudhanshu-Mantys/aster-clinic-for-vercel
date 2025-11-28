import React from 'react'
import Image from 'next/image'
import { Button } from './ui/button'

interface DashboardHeaderProps {
    user: {
        display_name?: string
        primary_email: string
        selected_team?: {
            display_name: string
        }
    }
    onLogout: () => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user, onLogout }) => {
    return (
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
                        <Button onClick={onLogout} variant="outline" size="sm">
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    )
}

