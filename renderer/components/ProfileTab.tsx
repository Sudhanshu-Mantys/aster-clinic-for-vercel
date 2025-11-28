import React from 'react'
import { useRouter } from 'next/router'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface Team {
    id: string
    display_name: string
    profile_image_url?: string | null
}

interface ProfileUser {
    id: string
    primary_email: string
    primary_email_verified: boolean
    display_name?: string | null
    signed_up_at_millis: number
    selected_team_id?: string
    selected_team?: Team
}

interface ProfileTabProps {
    user: ProfileUser
    teams: Team[]
    showTeamList: boolean
    isSwitchingTeam: boolean
    onToggleTeamList: () => void
    onSwitchTeam: (teamId: string) => Promise<void>
    onLogout: () => void
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
    user,
    teams,
    showTeamList,
    isSwitchingTeam,
    onToggleTeamList,
    onSwitchTeam,
    onLogout,
}) => {
    const router = useRouter()

    // Ensure selected_team_id is defined for type checking
    const selectedTeamId = user.selected_team_id || ''

    return (
        <div className="space-y-4">
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
                                                        if (team.id !== selectedTeamId) {
                                                            try {
                                                                await onSwitchTeam(team.id)
                                                            } catch (error) {
                                                                console.error('Failed to switch team:', error)
                                                                alert('Failed to switch team. Please try again.')
                                                            }
                                                        }
                                                    }}
                                                    disabled={isSwitchingTeam || team.id === selectedTeamId}
                                                    className={`w-full text-left p-3 rounded-lg border transition-all ${team.id === selectedTeamId
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
                                                        {team.id === selectedTeamId && (
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
                                            onClick={onToggleTeamList}
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
                        <Button variant="destructive" className="w-full" onClick={onLogout}>
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

