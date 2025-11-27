import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export default function TeamSwitcher() {
    const { user, teams, switchTeam } = useAuth()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSwitchTeam = async (teamId: string) => {
        if (teamId === user?.selected_team_id) {
            return // Already on this team
        }

        setError('')
        setIsLoading(true)

        try {
            await switchTeam(teamId)
            // Redirect to dashboard after successful team switch
            router.push('/dashboard')
        } catch (err: any) {
            console.error('Team switch error:', err)
            setError(err.message || 'Failed to switch team')
        } finally {
            setIsLoading(false)
        }
    }

    if (!teams || teams.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Teams</CardTitle>
                <CardDescription>
                    {teams.length === 1
                        ? 'You are a member of 1 team'
                        : `You are a member of ${teams.length} teams`
                    }
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {error && (
                    <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                        {error}
                    </div>
                )}
                {teams.map((team) => {
                    const isSelected = team.id === user?.selected_team_id
                    return (
                        <button
                            key={team.id}
                            onClick={() => handleSwitchTeam(team.id)}
                            disabled={isLoading || isSelected}
                            className={`w-full text-left p-3 rounded-md border transition-colors ${isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card hover:bg-accent border-border'
                                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-medium">{team.display_name}</p>
                                    {isSelected && (
                                        <p className="text-xs mt-1 opacity-80">Current team</p>
                                    )}
                                </div>
                                {isSelected && (
                                    <span className="text-sm">✓</span>
                                )}
                            </div>
                        </button>
                    )
                })}
            </CardContent>
        </Card>
    )
}

