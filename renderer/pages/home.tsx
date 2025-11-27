import React, { useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import TeamSwitcher from '../components/TeamSwitcher'

export default function HomePage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()

  // Redirect to dashboard if user is logged in and has a team selected
  useEffect(() => {
    if (!isLoading && user && user.selected_team_id) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // If user has a team selected, will redirect (show loading state)
  if (user && user.selected_team_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Redirecting to dashboard...</div>
      </div>
    )
  }

  return (
    <React.Fragment>
      <Head>
        <title>Home - Aster Clinics</title>
      </Head>
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <Image
              className="mx-auto"
              src="/images/logo.png"
              alt="Logo image"
              width={128}
              height={128}
            />
            <div className="space-y-2">
              <h1 className="text-4xl font-bold">Aster Clinics</h1>
            </div>
          </div>

          {/* Auth Status Card */}
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Status</CardTitle>
                <CardDescription>
                  {user ? 'You are currently signed in' : 'Sign in to access your account'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.primary_email}</p>
                      {user.primary_email_verified && (
                        <span className="text-xs text-green-600">✓ Verified</span>
                      )}
                    </div>
                    {user.display_name && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{user.display_name}</p>
                      </div>
                    )}
                    {user.selected_team && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Team</p>
                        <p className="font-medium">{user.selected_team.display_name}</p>
                      </div>
                    )}
                    <div className="pt-4 space-y-2">
                      <Button
                        onClick={logout}
                        variant="destructive"
                        className="w-full"
                      >
                        Sign Out
                      </Button>
                      <Link href="/next" className="block">
                        <Button variant="outline" className="w-full">
                          Go to Next Page
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link href="/login" className="block">
                      <Button className="w-full">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/signup" className="block">
                      <Button variant="outline" className="w-full">
                        Create Account
                      </Button>
                    </Link>
                    <Link href="/next" className="block">
                      <Button variant="ghost" className="w-full">
                        Continue as Guest
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Switcher */}
            {user && <TeamSwitcher />}
          </div>
        </div>
      </div>
    </React.Fragment>
  )
}

