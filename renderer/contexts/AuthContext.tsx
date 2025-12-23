import React, { createContext, useContext, useState, useEffect } from 'react'
import { ApiError, stackAuthApi } from '../lib/api-client'
import { isElectron } from '../lib/environment'

interface Team {
    id: string
    display_name: string
    profile_image_url?: string | null
}

interface User {
    id: string
    primary_email: string
    display_name?: string | null
    profile_image_url?: string | null
    primary_email_verified: boolean
    signed_up_at_millis: number
    auth_with_email: boolean
    has_password: boolean
    selected_team_id?: string
    selected_team?: Team
}

interface AuthContextType {
    user: User | null
    teams: Team[]
    login: (email: string, password: string) => Promise<void>
    signup: (email: string, password: string, name?: string) => Promise<void>
    logout: () => Promise<void>
    switchTeam: (teamId: string) => Promise<void>
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)


export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [accessToken, setAccessToken] = useState<string | null>(null)

    const persistUser = (userData: User | null) => {
        try {
            if (userData) {
                localStorage.setItem('stack_user', JSON.stringify(userData))
            } else {
                localStorage.removeItem('stack_user')
            }
        } catch (error) {
            console.warn('Failed to persist user data:', error)
        }
    }

    const loadCachedUser = (): User | null => {
        try {
            const cached = localStorage.getItem('stack_user')
            if (!cached) return null
            return JSON.parse(cached) as User
        } catch (error) {
            console.warn('Failed to load cached user:', error)
            return null
        }
    }

    const clearSession = () => {
        localStorage.removeItem('stack_access_token')
        localStorage.removeItem('stack_refresh_token')
        localStorage.removeItem('stack_user')
        setAccessToken(null)
        setUser(null)
        setTeams([])
    }

    // Fetch all teams for the current user
    const fetchTeams = async (token: string) => {
        try {
            // Stack Auth API: GET /teams?user_id=me
            const teamsData = await stackAuthApi.getTeams(token)
            console.log('✅ User teams:', teamsData)
            // Stack Auth returns { items: [...] } format
            setTeams((teamsData as { items?: Team[] }).items || [])
        } catch (error) {
            const status = error instanceof ApiError ? error.status : 'unknown'
            console.error('Failed to fetch teams:', status, error)
        }
    }

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            // Log environment for debugging
            console.log('🌍 Running in:', isElectron() ? 'Electron' : 'Web Browser')

            try {
                const token = localStorage.getItem('stack_access_token')
                const refreshToken = localStorage.getItem('stack_refresh_token')

                if (token) {
                    setAccessToken(token)
                    const cachedUser = loadCachedUser()
                    if (cachedUser) {
                        setUser(cachedUser)
                    }

                    // Get current user from Stack Auth
                    try {
                        const userData = await stackAuthApi.getCurrentUser(token)
                        console.log('✅ Stack Auth user data received:', userData)
                        console.log('Available fields:', Object.keys(userData as object))
                        setUser(userData as User)
                        persistUser(userData as User)

                        // Fetch teams
                        await fetchTeams(token)
                    } catch (error) {
                        if (error instanceof ApiError && error.status === 401 && refreshToken) {
                            // Try to refresh the token
                            try {
                                const refreshed = await stackAuthApi.refreshSession(refreshToken)
                                localStorage.setItem('stack_access_token', refreshed.access_token)
                                if (refreshed.refresh_token) {
                                    localStorage.setItem('stack_refresh_token', refreshed.refresh_token)
                                }
                                setAccessToken(refreshed.access_token)

                                // Retry getting user
                                const userData = await stackAuthApi.getCurrentUser(refreshed.access_token)
                                console.log('✅ Stack Auth user data (after refresh):', userData)
                                setUser(userData as User)
                                persistUser(userData as User)

                                // Fetch teams
                                await fetchTeams(refreshed.access_token)
                            } catch (refreshError) {
                                if (refreshError instanceof ApiError && (refreshError.status === 0 || refreshError.status === 408)) {
                                    console.warn('⚠️ Token refresh failed due to network issue; keeping session for retry.')
                                    return
                                }
                                // Refresh failed, clear tokens
                                console.error('❌ Token refresh failed:', refreshError)
                                clearSession()
                            }
                        } else if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
                            console.warn('⚠️ Auth check failed due to network issue; keeping session for retry.')
                        } else {
                            clearSession()
                        }
                    }
                }
            } catch (error) {
                console.error('Auth check failed:', error)
                if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
                    console.warn('⚠️ Auth check failed due to network issue; keeping session for retry.')
                } else {
                    clearSession()
                }
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [])

    const login = async (email: string, password: string) => {
        try {
            // Sign in with password using Stack Auth API
            const data = await stackAuthApi.signInWithPassword(email, password)
            console.log('✅ Stack Auth login response:', data)

            // Store tokens
            localStorage.setItem('stack_access_token', data.access_token)
            if (data.refresh_token) {
                localStorage.setItem('stack_refresh_token', data.refresh_token)
            }
            setAccessToken(data.access_token)

            // Get user data
            const userData = await stackAuthApi.getCurrentUser(data.access_token)
            console.log('✅ Stack Auth user data after login:', userData)
            console.log('Available user fields:', Object.keys(userData as object))
            setUser(userData as User)
            persistUser(userData as User)

            // Fetch teams
            await fetchTeams(data.access_token)
        } catch (error) {
            if (error instanceof ApiError) {
                const errorData = error.data as { code?: string; error?: string; message?: string } | undefined
                const errorMessage = errorData?.error || errorData?.message || 'Login failed'
                const errorCode = errorData?.code

                console.error('❌ Login failed - Status:', error.status, 'Error:', errorData)

                // Handle specific error codes from Stack Auth
                if (errorCode === 'EMAIL_PASSWORD_MISMATCH' || error.status === 400) {
                    throw new Error('Wrong email or password. Please check your credentials and try again.')
                } else if (errorCode === 'USER_NOT_FOUND' || error.status === 404) {
                    throw new Error('No account found with this email. Please sign up first.')
                } else if (errorCode === 'TOO_MANY_REQUESTS' || error.status === 429) {
                    throw new Error('Too many login attempts. Please try again in a few minutes.')
                } else if (errorCode === 'INVALID_EMAIL') {
                    throw new Error('Invalid email format. Please check your email address.')
                } else {
                    // Use Stack Auth's error message if available
                    throw new Error(errorMessage)
                }
            }
            console.error('Login error:', error)
            throw error
        }
    }

    const signup = async (email: string, password: string, name?: string) => {
        try {
            // Sign up with password using Stack Auth API
            const data = await stackAuthApi.signUpWithPassword(email, password)
            console.log('✅ Stack Auth signup response:', data)

            // Store tokens
            localStorage.setItem('stack_access_token', data.access_token)
            if (data.refresh_token) {
                localStorage.setItem('stack_refresh_token', data.refresh_token)
            }
            setAccessToken(data.access_token)

            // Get user data and update display name if provided
            const userData = await stackAuthApi.getCurrentUser(data.access_token)
            console.log('✅ Stack Auth user data after signup:', userData)
            console.log('Available user fields:', Object.keys(userData as object))

            // Update display name if provided
            if (name && name.trim()) {
                await stackAuthApi.updateUser({ display_name: name }, data.access_token)
                ;(userData as { display_name?: string }).display_name = name
            }

            setUser(userData as User)
            persistUser(userData as User)

            // Fetch teams
            await fetchTeams(data.access_token)
        } catch (error) {
            if (error instanceof ApiError) {
                const errorData = error.data as { code?: string; error?: string; message?: string } | undefined
                const errorMessage = errorData?.error || errorData?.message || 'Signup failed'
                const errorCode = errorData?.code

                console.error('❌ Signup failed - Status:', error.status, 'Error:', errorData)

                // Handle specific error codes from Stack Auth
                if (errorCode === 'USER_ALREADY_EXISTS' || error.status === 409) {
                    throw new Error('An account with this email already exists. Please try logging in instead.')
                } else if (errorCode === 'INVALID_PASSWORD') {
                    throw new Error('Password does not meet requirements. Please use at least 8 characters with letters and numbers.')
                } else if (errorCode === 'INVALID_EMAIL') {
                    throw new Error('Invalid email format. Please enter a valid email address.')
                } else if (errorCode === 'TOO_MANY_REQUESTS' || error.status === 429) {
                    throw new Error('Too many signup attempts. Please try again in a few minutes.')
                } else if (error.status === 400) {
                    // Generic 400 error - use Stack Auth's message
                    throw new Error(errorMessage)
                } else {
                    // Use Stack Auth's error message
                    throw new Error(errorMessage)
                }
            }
            console.error('Signup error:', error)
            throw error
        }
    }

    const switchTeam = async (teamId: string) => {
        if (!accessToken) {
            throw new Error('Not authenticated')
        }

        try {
            // Use PATCH /users/me to update selected team
            const userData = await stackAuthApi.updateUser(
                { selected_team_id: teamId },
                accessToken
            )

            console.log('✅ Team switched successfully, updated user data:', userData)
            setUser(userData as User)
            persistUser(userData as User)
        } catch (error) {
            if (error instanceof ApiError) {
                const errorData = error.data as { error?: string; message?: string } | undefined
                console.error('❌ Failed to switch team - Status:', error.status, 'Error:', errorData)
                throw new Error(errorData?.error || errorData?.message || 'Failed to switch team')
            }
            console.error('Switch team error:', error)
            throw error
        }
    }

    const logout = async () => {
        try {
            // Sign out from Stack Auth
            if (accessToken) {
                await stackAuthApi.signOut(accessToken)
            }
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            clearSession()
        }
    }

    return (
        <AuthContext.Provider value={{ user, teams, login, signup, logout, switchTeam, isLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
