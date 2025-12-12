import React, { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { DashboardHeader } from "../components/DashboardHeader";
import { ProfileTab } from "../components/ProfileTab";
import { TodaysAppointmentsList } from "../components/TodaysAppointmentsList";

export default function DashboardPage() {
  const { user, logout, isLoading, teams, switchTeam } = useAuth();
  const router = useRouter();
  const [isSwitchingTeam, setIsSwitchingTeam] = React.useState(false);
  const [showTeamList, setShowTeamList] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);

  // Redirect if not logged in or no team selected
  useEffect(() => {
    if (!isLoading && (!user || !user.selected_team_id)) {
      router.replace("/home");
    }
  }, [user, isLoading, router]);

  const handleSwitchTeam = async (teamId: string) => {
    setIsSwitchingTeam(true);
    try {
      await switchTeam(teamId);
      setShowTeamList(false);
    } catch (error) {
      console.error("Failed to switch team:", error);
      throw error;
    } finally {
      setIsSwitchingTeam(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !user.selected_team_id) {
    return null; // Will redirect
  }

  return (
    <React.Fragment>
      <Head>
        <title>Dashboard - Aster Clinics</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <DashboardHeader
          user={user}
          onLogout={logout}
          onShowProfile={() => setShowProfile(true)}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <TodaysAppointmentsList />
            </CardContent>
          </Card>

          {/* Profile Modal */}
          {showProfile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
                  <button
                    onClick={() => setShowProfile(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
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
                  </button>
                </div>
                <div className="p-6">
                  <ProfileTab
                    user={user}
                    teams={teams}
                    showTeamList={showTeamList}
                    isSwitchingTeam={isSwitchingTeam}
                    onToggleTeamList={() => setShowTeamList(!showTeamList)}
                    onSwitchTeam={handleSwitchTeam}
                    onLogout={logout}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </React.Fragment>
  );
}
