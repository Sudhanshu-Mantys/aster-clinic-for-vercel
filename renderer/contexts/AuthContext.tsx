import React, { createContext, useContext, useState, useEffect } from 'react'

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

// Stack Auth API configuration
const STACK_API_URL = process.env.NEXT_PUBLIC_STACK_API_URL || 'https://api.stack-auth.com/api/v1'
const STACK_PROJECT_ID = process.env.NEXT_PUBLIC_STACK_PROJECT_ID
const STACK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

// Helper function to make Stack Auth API calls
function stackAuthFetch(endpoint: string, options: RequestInit = {}, accessToken?: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Stack-Access-Type': 'client',
        'X-Stack-Project-Id': STACK_PROJECT_ID || '',
        'X-Stack-Publishable-Client-Key': STACK_PUBLISHABLE_KEY || '',
        ...(options.headers as Record<string, string>),
    }

    if (accessToken) {
        headers['X-Stack-Access-Token'] = accessToken
    }

    return fetch(`${STACK_API_URL}${endpoint}`, {
        ...options,
        headers,
    })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [accessToken, setAccessToken] = useState<string | null>(null)

    // Fetch all teams for the current user
    const fetchTeams = async (token: string) => {
        try {
            // Stack Auth API: GET /teams?user_id=me
            const response = await stackAuthFetch('/teams?user_id=me', {}, token)
            if (response.ok) {
                const teamsData = await response.json()
                console.log('✅ User teams:', teamsData)
                // Stack Auth returns { items: [...] } format
                setTeams(teamsData.items || [])
            } else {
                console.error('❌ Failed to fetch teams - Status:', response.status)
            }
        } catch (error) {
            console.error('Failed to fetch teams:', error)
        }
    }

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('stack_access_token')
                const refreshToken = localStorage.getItem('stack_refresh_token')

                if (token) {
                    setAccessToken(token)

                    // Get current user from Stack Auth
                    const response = await stackAuthFetch('/users/me', {}, token)

                    if (response.ok) {
                        const userData = await response.json()
                        console.log('✅ Stack Auth user data received:', userData)
                        console.log('Available fields:', Object.keys(userData))
                        setUser(userData)

                        // Fetch teams
                        await fetchTeams(token)
                    } else if (response.status === 401 && refreshToken) {
                        // Try to refresh the token
                        const refreshResponse = await stackAuthFetch('/auth/sessions/refresh', {
                            method: 'POST',
                            body: JSON.stringify({ refresh_token: refreshToken }),
                        })

                        if (refreshResponse.ok) {
                            const { access_token, refresh_token } = await refreshResponse.json()
                            localStorage.setItem('stack_access_token', access_token)
                            localStorage.setItem('stack_refresh_token', refresh_token)
                            setAccessToken(access_token)

                            // Retry getting user
                            const userResponse = await stackAuthFetch('/users/me', {}, access_token)
                            if (userResponse.ok) {
                                const userData = await userResponse.json()
                                console.log('✅ Stack Auth user data (after refresh):', userData)
                                setUser(userData)

                                // Fetch teams
                                await fetchTeams(access_token)
                            }
                        } else {
                            // Refresh failed, clear tokens
                            localStorage.removeItem('stack_access_token')
                            localStorage.removeItem('stack_refresh_token')
                            setAccessToken(null)
                        }
                    } else {
                        localStorage.removeItem('stack_access_token')
                        localStorage.removeItem('stack_refresh_token')
                        setAccessToken(null)
                    }
                }
            } catch (error) {
                console.error('Auth check failed:', error)
                localStorage.removeItem('stack_access_token')
                localStorage.removeItem('stack_refresh_token')
                setAccessToken(null)
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [])

    const login = async (email: string, password: string) => {
        try {
            // Sign in with password using Stack Auth API
            const response = await stackAuthFetch('/auth/password/sign-in', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('❌ Login failed - Status:', response.status, 'Error:', error)

                // Stack Auth error format: { code: "ERROR_CODE", error: "Error message" }
                const errorMessage = error.error || error.message || 'Login failed'
                const errorCode = error.code

                // Handle specific error codes from Stack Auth
                if (errorCode === 'EMAIL_PASSWORD_MISMATCH' || response.status === 400) {
                    throw new Error('Wrong email or password. Please check your credentials and try again.')
                } else if (errorCode === 'USER_NOT_FOUND' || response.status === 404) {
                    throw new Error('No account found with this email. Please sign up first.')
                } else if (errorCode === 'TOO_MANY_REQUESTS' || response.status === 429) {
                    throw new Error('Too many login attempts. Please try again in a few minutes.')
                } else if (errorCode === 'INVALID_EMAIL') {
                    throw new Error('Invalid email format. Please check your email address.')
                } else {
                    // Use Stack Auth's error message if available
                    throw new Error(errorMessage)
                }
            }

            const data = await response.json()
            console.log('✅ Stack Auth login response:', data)

            // Store tokens
            localStorage.setItem('stack_access_token', data.access_token)
            if (data.refresh_token) {
                localStorage.setItem('stack_refresh_token', data.refresh_token)
            }
            setAccessToken(data.access_token)

            // Get user data
            const userResponse = await stackAuthFetch('/users/me', {}, data.access_token)
            if (userResponse.ok) {
                const userData = await userResponse.json()
                console.log('✅ Stack Auth user data after login:', userData)
                console.log('Available user fields:', Object.keys(userData))
                setUser(userData)

                // Fetch teams
                await fetchTeams(data.access_token)
            } else {
                console.error('❌ Failed to get user data:', await userResponse.text())
            }
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    }

    const signup = async (email: string, password: string, name?: string) => {
        try {
            // Sign up with password using Stack Auth API
            const response = await stackAuthFetch('/auth/password/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('❌ Signup failed - Status:', response.status, 'Error:', error)

                // Stack Auth error format: { code: "ERROR_CODE", error: "Error message" }
                const errorMessage = error.error || error.message || 'Signup failed'
                const errorCode = error.code

                // Handle specific error codes from Stack Auth
                if (errorCode === 'USER_ALREADY_EXISTS' || response.status === 409) {
                    throw new Error('An account with this email already exists. Please try logging in instead.')
                } else if (errorCode === 'INVALID_PASSWORD') {
                    throw new Error('Password does not meet requirements. Please use at least 8 characters with letters and numbers.')
                } else if (errorCode === 'INVALID_EMAIL') {
                    throw new Error('Invalid email format. Please enter a valid email address.')
                } else if (errorCode === 'TOO_MANY_REQUESTS' || response.status === 429) {
                    throw new Error('Too many signup attempts. Please try again in a few minutes.')
                } else if (response.status === 400) {
                    // Generic 400 error - use Stack Auth's message
                    throw new Error(errorMessage)
                } else {
                    // Use Stack Auth's error message
                    throw new Error(errorMessage)
                }
            }

            const data = await response.json()
            console.log('✅ Stack Auth signup response:', data)

            // Store tokens
            localStorage.setItem('stack_access_token', data.access_token)
            if (data.refresh_token) {
                localStorage.setItem('stack_refresh_token', data.refresh_token)
            }
            setAccessToken(data.access_token)

            // Get user data and update display name if provided
            const userResponse = await stackAuthFetch('/users/me', {}, data.access_token)
            if (userResponse.ok) {
                const userData = await userResponse.json()
                console.log('✅ Stack Auth user data after signup:', userData)
                console.log('Available user fields:', Object.keys(userData))

                // Update display name if provided
                if (name && name.trim()) {
                    await stackAuthFetch('/users/me', {
                        method: 'PATCH',
                        body: JSON.stringify({
                            display_name: name,
                        }),
                    }, data.access_token)
                    userData.displayName = name
                }

                setUser(userData)

                // Fetch teams
                await fetchTeams(data.access_token)
            }
        } catch (error) {
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
            const response = await stackAuthFetch('/users/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    selected_team_id: teamId,
                }),
            }, accessToken)

            if (!response.ok) {
                const error = await response.json()
                console.error('❌ Failed to switch team - Status:', response.status, 'Error:', error)
                throw new Error(error.error || 'Failed to switch team')
            }

            // The response should contain the updated user data
            const userData = await response.json()
            console.log('✅ Team switched successfully, updated user data:', userData)
            setUser(userData)
        } catch (error) {
            console.error('Switch team error:', error)
            throw error
        }
    }

    const logout = async () => {
        try {
            // Sign out from Stack Auth
            if (accessToken) {
                await stackAuthFetch('/auth/sessions/current', {
                    method: 'DELETE',
                }, accessToken)
            }
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            localStorage.removeItem('stack_access_token')
            localStorage.removeItem('stack_refresh_token')
            setAccessToken(null)
            setUser(null)
            setTeams([])
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

